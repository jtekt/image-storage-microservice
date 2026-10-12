import path from 'path'
import fs from 'fs'
import createHttpError from 'http-errors'
import unzipper, { File } from 'unzipper' // NOTE: Unzipper is advertized as having a low memory footprint
import { Image, IImage } from '../models/image'
import { parse_formdata_fields } from '../utils'
import { Request, Response } from 'express'
import { mongodb_export_file_name, export_excel_file_name } from '../config'
import { rimraf } from 'rimraf'
import { S3_BUCKET, s3Client } from '../fileStorage/s3'
import {
    tempDirectoryPath,
    uploadsDirectoryPath,
    create_directory_if_not_exists,
} from '../fileStorage/local'
import { getUserId } from '../utils/user'
import { assertSafeFilePath, resolveInside } from '../fileStorage/paths'

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

// Extract a file from the zip to a specific destination path (preserving folder structure)
const extract_single_file = (file: File, destination_path: string) =>
    new Promise((resolve, reject) => {
        create_directory_if_not_exists(path.dirname(destination_path))
        file.stream()
            .pipe(fs.createWriteStream(destination_path))
            .on('error', reject)
            .on('finish', () => resolve(0))
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

export const import_images = async (req: Request, res: Response) => {
    const { file, body } = req

    if (!file) throw createHttpError(400, 'File not provided')
    const { mimetype, filename } = file

    const allowed_mimetypes = [
        'application/x-zip-compressed',
        'application/zip',
        'application/octet-stream',
    ]

    if (!allowed_mimetypes.includes(mimetype))
        throw createHttpError(400, `Mimetype ${mimetype} is not allowed`)

    console.log(`[Import] Importing archive...`)

    const archive_path = path.join(tempDirectoryPath, filename)

    try {
        const archive = await unzipper.Open.file(archive_path)

        // Each file is streamed individually rather than extracted all at once,
        // keeping memory usage low even for large archives
        const ignoredFiles = [mongodb_export_file_name, export_excel_file_name]
        const filteredFiles = archive.files.filter(
            (f) => !ignoredFiles.includes(f.path)
        )

        // The user can pass data for all the images of the zip
        const userDefinedData = parse_formdata_fields(body)

        let userId: string
        if (process.env.IMAGE_SCOPE === 'user') {
            const id = getUserId(req.auth?.payload)
            if (!id) throw createHttpError(401, 'User ID not provided')
            userId = id
        }

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

        // Extract all files in parallel, resolving destination path from JSON metadata if available
        await Promise.all(
            filteredFiles.map((file) => {
                // Use the full path from JSON if available, otherwise fall back to zip entry path
                const resolvedPath =
                    filePathMap?.get(path.basename(file.path)) ?? file.path

                if (s3Client && S3_BUCKET)
                    return s3Client.putObject(
                        S3_BUCKET,
                        resolvedPath,
                        file.stream()
                    )
                else
                    return extract_single_file(
                        file,
                        resolveInside(uploadsDirectoryPath, resolvedPath)
                    )
            })
        )

        if (mongodbData) {
            mongodbData.forEach((document: IImage) => {
                document.data = { ...document.data, ...userDefinedData }
                if (userId) document.userId = userId
            })

            await mongodb_data_import(mongodbData)
        } else {
            // No backup is provided
            console.log(`[Import] importing without restoring MongoDB data`)
            const mongodbData: IImage[] = filteredFiles.map((f) => ({
                file: f.path,
                data: userDefinedData,
                ...(userId ? { userId } : {}),
            }))
            await mongodb_data_import(mongodbData)
        }
    } finally {
        // Always clean up the archive temp file, even if an error occurred
        await rimraf(archive_path)
    }

    console.log(`[Import] Images from archive ${filename} imported`)
    res.send({ file: filename })
}
