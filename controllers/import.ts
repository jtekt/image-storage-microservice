import path from 'path'
import fs from 'fs'
import createHttpError from 'http-errors'
import unzipper, { File } from 'unzipper' // NOTE: Unzipper is advertized as having a low memory footprint
import { Image, IImage } from '../models/image'
import { parse_formdata_fields } from '../utils'
import { Request, Response } from 'express'
import { mongodb_export_file_name, export_excel_file_name } from '../config'
import { rimraf } from 'rimraf'
import { s3Client } from '../fileStorage/s3'
import {
    tempDirectoryPath,
    uploadsDirectoryPath,
    create_directory_if_not_exists,
} from '../fileStorage/local'
import { getUserId } from '../utils/user'

const mongodb_data_import = (documents: IImage[]) => {
    // TODO: Consider bulkwrite
    // Querying by file because unique and imports without mongodb data do not have an ID
    const promises = documents.map((document) =>
        Image.findOneAndUpdate({ file: document.file }, document, {
            upsert: true,
        })
    )
    return Promise.all(promises)
}

const extract_single_file = (file: File, output_directory: string) =>
    new Promise((resolve, reject) => {
        const file_name = file.path

        // Restore folder structure if necessary
        const file_folder = path.join(
            uploadsDirectoryPath,
            path.dirname(file_name)
        )
        create_directory_if_not_exists(file_folder)

        const output_path = path.join(output_directory, file_name)
        file.stream()
            .pipe(fs.createWriteStream(output_path))
            .on('error', reject)
            .on('finish', resolve)
    })

export const import_images = async (req: Request, res: Response) => {
    if (s3Client) throw createHttpError(400, `Import is not supported with S3`)
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

    const directory = await unzipper.Open.file(archive_path)

    // Unzip the archive to the uploads directory
    // This is very memory intensive for large archives
    // await directory.extract({ path: uploadsDirectoryPath })
    // This method is not too memory intensive (about 300Mi for a 3Gi archive)
    // TODO: find way to just unzip without using out too much memory
    for await (const file of directory.files) {
        // TODO: only move images
        await extract_single_file(file, uploadsDirectoryPath)
    }

    // The user can pass data for all the images of the zip
    const userDefinedData = parse_formdata_fields(body)

    const json_file_path = path.join(
        uploadsDirectoryPath,
        mongodb_export_file_name
    )
    const excel_file_path = path.join(
        uploadsDirectoryPath,
        export_excel_file_name
    )

    let userId: string | undefined = undefined
    if (process.env.IMAGE_SCOPE === 'user') {
        const id = getUserId(res.locals.user)

        // If no id found, throw an error
        if (!id) throw createHttpError(401, 'User ID not provided')
        userId = id
    }

    const json_file_exists = directory.files.some(
        ({ path }) => path === mongodb_export_file_name
    )

    if (json_file_exists) {
        // Restore DB records MonggoDB backup
        console.log(`[Import] importing and restoring MongDB data`)
        // TODO: Read file directly from archive

        const jsonFileDataBuffer = fs.readFileSync(json_file_path)
        // TODO: check if this is really an error
        // @ts-ignore
        const mongodbData = JSON.parse(jsonFileDataBuffer)

        mongodbData.forEach((document: IImage) => {
            document.data = { ...document.data, ...userDefinedData }
            if (userId) {
                document.userId = userId
            }
        })

        await mongodb_data_import(mongodbData)
    } else {
        // No backup is provided
        console.log(`[Import] importing without restoring MongoDB data`)
        const mongodbData: IImage[] = directory.files.map((f) => ({
            file: f.path,
            data: userDefinedData,
            ...(userId ? { userId } : {}),
        }))
        await mongodb_data_import(mongodbData)
    }

    // Remove the archive when done extracting
    await rimraf(archive_path)

    // remove excel and json (will not be needed if only copying images from archive)
    if (fs.existsSync(excel_file_path)) rimraf(excel_file_path)
    if (fs.existsSync(json_file_path)) rimraf(json_file_path)

    console.log(`[Import] Images from archive ${filename} imported`)
    res.send({ file: filename })
}
