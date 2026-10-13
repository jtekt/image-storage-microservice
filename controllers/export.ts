import archiver from 'archiver' // NOTE: Archiver is advertized as having a low memory footprint
import { Image, IImage } from '../models/image'
import path from 'path'
import fs from 'fs'
import XLSX from 'xlsx'
import { v4 as uuidv4 } from 'uuid'
import { parse_query } from '../utils/query'
import { Request, Response } from 'express'
import { rimraf } from 'rimraf'
import {
    mongodb_export_file_name,
    export_excel_file_name,
    maxExportLimit,
} from '../config'
import { S3_BUCKET, s3Client } from '../fileStorage/s3'
import {
    create_directory_if_not_exists,
    tempDirectoryPath,
    uploadsDirectoryPath,
} from '../fileStorage/local'
import createHttpError from 'http-errors'
import { getUserId } from '../utils/user'
import { assertSafeFilePath, resolveInside } from '../fileStorage/paths'

const generate_excel = (data: IImage[], path: string) => {
    const formatted_data = data.map((item) => {
        // Convert nested data properties

        // Important: create a copy so as to not affect original data
        const { data, ...baseMetaData } = item
        const output: Record<string, any> = {
            ...baseMetaData,
            _id: baseMetaData._id ? baseMetaData._id.toString() : undefined,
        }

        for (let key in data) {
            if (data[key] !== null && data[key] !== undefined) {
                const value = data[key]
                // Only convert objects to JSON, let XLSX handle primitives
                if (typeof value === 'object') {
                    output[key] = JSON.stringify(value)
                } else {
                    output[key] = value
                }
            }
        }
        return output
    })

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(formatted_data)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
    XLSX.writeFile(workbook, path)
}

const generate_json = (data: IImage[], path: string) => {
    fs.writeFileSync(path, JSON.stringify(data))
}

export const export_images = async (req: Request, res: Response) => {
    // Making zip name unique so as to allow parallel exports
    const export_id = uuidv4()

    // Create temp directory if it does not exist
    create_directory_if_not_exists(tempDirectoryPath)

    const json_file_path = path.join(tempDirectoryPath, `${export_id}.json`)
    const excel_file_path = path.join(tempDirectoryPath, `${export_id}.xlsx`)

    const {
        query,
        sortStatement,
        limit: requestedLimit,
        skip,
    } = parse_query(req.query)

    if (process.env.IMAGE_SCOPE && process.env.IMAGE_SCOPE === 'user') {
        const id = getUserId(res.locals.user)
        if (!id) throw createHttpError(401, 'User ID not provided')
        query.userId = id
    }

    // Reject if explicit limit exceeds max
    if (requestedLimit !== undefined && requestedLimit > maxExportLimit)
        throw createHttpError(
            400,
            `Export limit exceeds maximum of ${maxExportLimit}. Please add filters to reduce the selection or export in batches.`
        )

    // Reject if the matching result set exceeds the max, so the user knows to filter or batch
    const totalCount = await Image.countDocuments(query)
    if (totalCount > maxExportLimit)
        throw createHttpError(
            400,
            `Query matches ${totalCount} images which exceeds the export limit of ${maxExportLimit}. Please add filters to reduce the selection or export in batches.`
        )

    const limit = Math.min(requestedLimit ?? maxExportLimit, totalCount)
    const images = await Image.find(query)
        .sort(sortStatement)
        .skip(Number(skip))
        .limit(limit)

    const images_json = images.map((i) => i.toJSON()) as IImage[]

    generate_excel(images_json, excel_file_path)
    generate_json(images_json, json_file_path)

    // Set headers upfront so the browser starts the download immediately
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', 'attachment; filename="export.zip"')

    const archive = archiver('zip', { zlib: { level: 9 } })

    archive.on('warning', (err) => {
        if (err.code === 'ENOENT') console.log(err)
        else throw err
    })

    archive.on('error', (err) => {
        throw err
    })

    archive.on('finish', async () => {
        await rimraf(excel_file_path)
        await rimraf(json_file_path)
        console.log(`[Export] Images exported`)
    })

    console.log(`[Export] Exporting started`)

    // Pipe directly to response — browser download starts immediately without waiting for zip to complete
    archive.pipe(res)
    // Adding files one by one instead of whole folder because query parameters might be used as filters

    for (const { file } of images) {
        try {
            assertSafeFilePath(file)
        } catch (error) {
            console.error(`[Export] Skipping ${file}: invalid file path`)
            continue
        }

        if (s3Client && S3_BUCKET) {
            console.log('EXPORTING WITH S3')
            const objectStream = await s3Client.getObject(S3_BUCKET, file)
            archive.append(objectStream, { name: file })
        } else {
            archive.file(resolveInside(uploadsDirectoryPath, file), {
                name: file,
            })
        }
    }

    // Adding excel and json files
    archive.file(json_file_path, { name: mongodb_export_file_name })
    archive.file(excel_file_path, { name: export_excel_file_name })

    archive.finalize()
}
