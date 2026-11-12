import path from 'path'
import fs from 'fs'
import { Transform } from 'stream'
import createHttpError from 'http-errors'
import unzipper, { File } from 'unzipper' // NOTE: Unzipper is advertized as having a low memory footprint
import { Image, IImage } from '../models/image'
import { parse_formdata_fields } from '../utils'
import { Request, Response } from 'express'
import { mongodb_export_file_name, export_excel_file_name, importMaxEntryCount, importMaxUncompressedSize } from '../config'
import { rimraf } from 'rimraf'
import { S3_BUCKET, s3Client } from '../fileStorage/s3'
import {
    tempDirectoryPath,
    uploadsDirectoryPath,
    create_directory_if_not_exists,
} from '../fileStorage/local'
import { assertSafeFilePath, resolveInside } from '../fileStorage/paths'

const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GiB`
    if (bytes >= 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`
    return `${bytes} B`
}

const mongodb_data_import = (documents: IImage[]) => {
    const operations = documents.map((document) => ({
        updateOne: {
            filter: { file: document.file },
            update: { $set: document as any },
            upsert: true,
        },
    }))
    return Image.bulkWrite(operations)
}

// Extract a file from the zip to a specific destination path (preserving folder structure).
// The onBytes callback is called with each chunk length as the file streams, so the caller
// can enforce a running total uncompressed-size limit.
const extract_single_file = (
    file: File,
    destination_path: string,
    onBytes?: (n: number) => void
) =>
    new Promise<void>((resolve, reject) => {
        create_directory_if_not_exists(path.dirname(destination_path))

        let fileStream = file.stream() as NodeJS.ReadableStream

        // Wrap with a counting transform if the caller wants byte notifications
        if (onBytes) {
            const counter = new Transform({
                transform(chunk: Buffer, _enc, cb) {
                    onBytes(chunk.length)
                    cb(null, chunk)
                },
            })
            fileStream = fileStream.pipe(counter)
        }

        fileStream
            .pipe(fs.createWriteStream(destination_path))
            .on('error', reject)
            .on('finish', () => resolve())
    })

const read_stream_as_string = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        file.stream()
            .on('data', (chunk: Buffer) => chunks.push(chunk))
            .on('error', reject)
            .on('finish', () =>
                resolve(Buffer.concat(chunks).toString('utf-8'))
            )
    })

// Run an array of async tasks with bounded concurrency.
// concurrency=1 is fully serial; higher values allow parallel execution.
async function runWithConcurrency<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number
): Promise<T[]> {
    const results: T[] = new Array(tasks.length)
    let nextIndex = 0

    async function worker() {
        while (nextIndex < tasks.length) {
            const index = nextIndex++
            results[index] = await tasks[index]()
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker)
    await Promise.all(workers)
    return results
}

// Concurrency for local file extraction. High enough to benefit from OS I/O
// parallelism without exhausting file descriptors.
const EXTRACT_CONCURRENCY = 8

export const import_images = async (req: Request, res: Response) => {
    const { file, body } = req

    if (!file) throw createHttpError(400, 'File not provided')
    const { filename } = file

    // Note: MIME type validation is now performed by the multer fileFilter in
    // routes/import.ts, before the file is written to disk.  The check here is
    // kept as an explicit guard for defense in depth in case the route is called
    // directly (e.g. in tests that bypass the fileFilter).
    const allowed_mimetypes = [
        'application/x-zip-compressed',
        'application/zip',
        'application/octet-stream',
    ]

    if (!allowed_mimetypes.includes(file.mimetype))
        throw createHttpError(400, `Mimetype ${file.mimetype} is not allowed`)

    console.log(`[Import] Importing archive...`)

    const archive_path = path.join(tempDirectoryPath, filename)

    // Track local files and S3 keys written during this import so we can roll
    // back partial extractions on failure.
    const extractedLocalPaths: string[] = []
    const extractedS3Keys: string[] = []

    // Shared running total of uncompressed bytes written so far.
    // Using a mutable object so it can be updated across concurrent extractions.
    const bytesWritten = { total: 0 }

    const onBytes = (n: number) => {
        bytesWritten.total += n
        if (bytesWritten.total > importMaxUncompressedSize)
            throw createHttpError(
                400,
                `Import archive exceeds the maximum total uncompressed size. Maximum allowed: ${formatBytes(importMaxUncompressedSize)}.`
            )
    }

    try {
        const archive = await unzipper.Open.file(archive_path)

        // Each file is streamed individually rather than extracted all at once,
        // keeping memory usage low even for large archives
        const ignoredFiles = [mongodb_export_file_name, export_excel_file_name]
        const filteredFiles = archive.files.filter(
            (f) => !ignoredFiles.includes(f.path) && f.type !== 'Directory'
        )

        // -----------------------------------------------------------------------
        // Pre-extraction safety checks (before any file is written)
        // -----------------------------------------------------------------------

        if (filteredFiles.length > importMaxEntryCount)
            throw createHttpError(
                400,
                `Import archive contains ${filteredFiles.length} images, which exceeds the maximum of ${importMaxEntryCount}. Please split the archive into smaller batches.`
            )

        // Sum uncompressed sizes from the ZIP central directory.
        // These values are authoritative for entries parsed by unzipper.Open.file()
        // (the central directory is read first; local header values are overridden
        // by central directory values when available).  A streaming byte counter
        // in onBytes() provides defense-in-depth against manipulated metadata.
        const metadataTotalSize = filteredFiles.reduce(
            (sum, f) => sum + (f.uncompressedSize ?? 0),
            0
        )
        if (metadataTotalSize > importMaxUncompressedSize)
            throw createHttpError(
                400,
                `Import archive's total uncompressed size (${formatBytes(metadataTotalSize)}) exceeds the maximum allowed (${formatBytes(importMaxUncompressedSize)}). Please split the archive into smaller batches.`
            )

        // -----------------------------------------------------------------------
        // Parse optional metadata and user-provided data
        // -----------------------------------------------------------------------

        // The user can pass data for all the images of the zip
        const userDefinedData = parse_formdata_fields(body)

        const json_file = archive.files.find(
            ({ path }) => path === mongodb_export_file_name
        )

        // Build a map of basename -> full file path from MongoDB JSON data so that
        // even if images were flattened in the zip, they are saved to the correct path
        let filePathMap: Map<string, string> | null = null
        let mongodbData: IImage[] | null = null

        if (json_file) {
            console.log(`[Import] importing and restoring MongoDB data`)

            try {
                const jsonString = await read_stream_as_string(json_file)
                mongodbData = JSON.parse(jsonString)
                if (!Array.isArray(mongodbData))
                    throw new Error('MongoDB data is not an array')
            } catch (error) {
                console.error('[Import] MongoDB data parse error:', error)
                throw createHttpError(
                    400,
                    'Archive contains malformed MongoDB data'
                )
            }

            mongodbData.forEach(({ file }) => assertSafeFilePath(file))

            // Map basename -> full path (e.g. "image.jpg" -> "folder/image.jpg")
            filePathMap = new Map(
                mongodbData.map((doc) => [path.basename(doc.file), doc.file])
            )
        }

        // Validate every path before extracting anything
        filteredFiles.forEach(({ path }) => assertSafeFilePath(path))

        // -----------------------------------------------------------------------
        // Extract files with bounded concurrency
        // -----------------------------------------------------------------------

        const extractionTasks = filteredFiles.map((file) => async () => {
            // Use the full path from JSON if available, otherwise fall back to zip entry path
            const resolvedPath =
                filePathMap?.get(path.basename(file.path)) ?? file.path

            if (s3Client && S3_BUCKET) {
                await s3Client.putObject(
                    S3_BUCKET,
                    resolvedPath,
                    file.stream()
                )
                extractedS3Keys.push(resolvedPath)
            } else {
                const destination = resolveInside(uploadsDirectoryPath, resolvedPath)
                await extract_single_file(file, destination, onBytes)
                extractedLocalPaths.push(destination)
            }
        })

        await runWithConcurrency(extractionTasks, EXTRACT_CONCURRENCY)

        // -----------------------------------------------------------------------
        // Write MongoDB records
        // -----------------------------------------------------------------------

        if (mongodbData) {
            mongodbData.forEach((document: IImage) => {
                document.data = { ...document.data, ...userDefinedData }
            })

            await mongodb_data_import(mongodbData)
        } else {
            // No backup is provided
            console.log(`[Import] importing without restoring MongoDB data`)
            const mongodbData: IImage[] = filteredFiles.map((f) => ({
                file: f.path,
                data: userDefinedData,
            }))
            await mongodb_data_import(mongodbData)
        }
    } catch (err) {
        // Roll back any files that were already extracted before the error
        if (extractedLocalPaths.length > 0) {
            console.warn(
                `[Import] Rolling back ${extractedLocalPaths.length} extracted local file(s) after error`
            )
            for (const p of extractedLocalPaths) {
                try {
                    if (fs.existsSync(p)) fs.rmSync(p, { force: true })
                } catch (cleanupErr) {
                    console.error(`[Import] Failed to remove ${p} during rollback:`, cleanupErr)
                }
            }
        }
        if (extractedS3Keys.length > 0 && s3Client && S3_BUCKET) {
            console.warn(
                `[Import] Rolling back ${extractedS3Keys.length} S3 object(s) after error`
            )
            for (const key of extractedS3Keys) {
                try {
                    await s3Client.removeObject(S3_BUCKET, key)
                } catch (cleanupErr) {
                    console.error(`[Import] Failed to remove S3 key ${key} during rollback:`, cleanupErr)
                }
            }
        }
        throw err
    } finally {
        // Always clean up the archive temp file, even if an error occurred
        await rimraf(archive_path)
    }

    console.log(`[Import] Images from archive ${filename} imported`)
    res.send({ file: filename })
}
