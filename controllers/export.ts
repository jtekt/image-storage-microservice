import archiver from 'archiver' // NOTE: Archiver is advertized as having a low memory footprint
import { Image, IImage } from '../models/image'
import path from 'path'
import fs from 'fs'
import XLSX from 'xlsx'
import { v4 as uuidv4 } from 'uuid'
import { parse_query } from '../utils'
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

const generate_excel = (data: IImage[], path: string) => {
    const formatted_data = data.map((item) => {
        // Convert nested data properties

        // Important: create a copy so as to not affect original data
        const { data, ...baseMetaData } = item

        const output = {
            ...baseMetaData,
            _id: baseMetaData._id ? baseMetaData._id.toString() : undefined,
        }

        for (let key in data) {
            // @ts-ignore
            if (data[key]) output[key] = data[key].toString()
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

    // TODO: Store everything in a dedicated directory
    const temp_zip_path = path.join(tempDirectoryPath, `${export_id}.zip`)
    const json_file_path = path.join(tempDirectoryPath, `${export_id}.json`)
    const excel_file_path = path.join(tempDirectoryPath, `${export_id}.xlsx`)

    const {
        query,
        sort,
        order,
        limit = maxExportLimit,
        skip,
    } = parse_query(req.query)

    if (process.env.IMAGE_SCOPE && process.env.IMAGE_SCOPE === 'user') {
        const id = getUserId(res.locals.user)
        if (!id) throw createHttpError(401, 'User ID not provided')
        query.userId = id
    }

    if (limit > maxExportLimit)
        throw createHttpError(400, `Limit exceeds maximum allowed value`)

    const images = await Image.find(query)
        .sort({ [sort]: order })
        .skip(Number(skip))
        .limit(limit)

    const images_json = images.map((i) => i.toJSON()) as IImage[]

    generate_excel(images_json, excel_file_path)
    generate_json(images_json, json_file_path)

    const output = fs.createWriteStream(temp_zip_path)
    const archiver_options = { zlib: { level: 9 } }
    const archive = archiver('zip', archiver_options)

    // TODO: use async await
    output.on('close', async () => {
        res.download(temp_zip_path)

        // Cleanup of generated files
        await rimraf(excel_file_path)
        await rimraf(json_file_path)
        await rimraf(temp_zip_path)

        console.log(`[Export] Images exported`)
    })

    // good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', function (err) {
        if (err.code === 'ENOENT') console.log(err)
        else throw err
    })

    // good practice to catch this error explicitly
    archive.on('error', function (err) {
        throw err
    })

    console.log(`[Export] Exporting started`)

    archive.pipe(output)
    // Adding files one by one instead of whole folder because query parameters might be used as filters

    for (const { file } of images) {
        if (s3Client && S3_BUCKET) {
            console.log('EXPORTING WITH S3')
            const objectStream = await s3Client.getObject(S3_BUCKET, file)
            const fileName = path.basename(file)
            archive.append(objectStream, { name: fileName })
        } else {
            archive.file(path.join(uploadsDirectoryPath, file), { name: file })
        }
    }

    // Adding excel and json files
    archive.file(json_file_path, { name: mongodb_export_file_name })
    archive.file(excel_file_path, { name: export_excel_file_name })

    archive.finalize()
}
