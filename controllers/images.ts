import createHttpError from 'http-errors'
import { IImage, Image } from '../models/image'
import { parseUpdateBody, parse_post_body } from '../utils'
import { parse_query } from '../utils/query'
import { Request, Response } from 'express'
import { s3Client, streamFileFromS3, deleteFileFromS3 } from '../fileStorage/s3'
import { downloadLocalFile, removeLocalFile } from '../fileStorage/local'
import { removeImageFiles } from '../fileStorage/common'
import { assertSafeFilePath } from '../fileStorage/paths'
import { defaultLimit, maxListLimit } from '../config'

interface NewImage extends IImage {
    time: Date
}

export const upload_image = async (req: Request, res: Response) => {
    // NOTE: Req.body is multipart form-data
    if (!req.file) throw createHttpError(400, 'File not provided')

    // TODO: Only allow images

    const { originalname } = req.file

    const {
        _id,
        time,
        file: userProvidedFilePath,
        ...data
    } = parse_post_body(req.body)

    const file = assertSafeFilePath(userProvidedFilePath || originalname)

    const query = { file }
    const itemProperties: NewImage = {
        _id,
        time: time ? new Date(time) : new Date(),
        file,
        data,
    }

    const options = { upsert: true, new: true }
    const newImage = await Image.findOneAndUpdate(
        query,
        itemProperties,
        options
    )
    res.send(newImage)
}

export const read_images = async (req: Request, res: Response) => {
    // Limiting here because parse_query also used in export
    const {
        query,
        sortStatement,
        limit: requestedLimit,
        skip,
        select,
    } = parse_query(req.query)

    // Validate limit: reject values above the maximum, treat 0/negative/invalid as default
    let limit: number
    if (requestedLimit === undefined) {
        limit = defaultLimit
    } else {
        const parsed = Number(requestedLimit)
        if (!Number.isInteger(parsed) || parsed <= 0) {
            limit = defaultLimit
        } else if (parsed > maxListLimit) {
            throw createHttpError(
                400,
                `Limit exceeds maximum of ${maxListLimit}`
            )
        } else {
            limit = parsed
        }
    }

    // Clamp skip: treat negative, non-numeric, or decimal values as 0
    const parsedSkip = Math.max(0, Math.floor(Number(skip)))
    const safeSkip = Number.isFinite(parsedSkip) ? parsedSkip : 0

    const items = await Image.find(query)
        .sort(sortStatement)
        .skip(safeSkip)
        .limit(limit)
        .select(select)

    const total = await Image.countDocuments(query)

    res.send({ total, skip, limit, items, select })
}

export const read_image = async (req: Request, res: Response) => {
    const { _id } = req.params

    const query: Record<string, string> = { _id }

    const image = await Image.findOne(query)

    if (!image) throw createHttpError(404, `Image ${_id} not found`)

    res.send(image)
}

export const read_image_file = async (req: Request, res: Response) => {
    const { _id } = req.params

    const query: Record<string, string> = { _id }

    const image = await Image.findOne(query)

    if (!image) throw createHttpError(404, `Image ${_id} not found`)

    const { file } = image

    if (s3Client) await streamFileFromS3(res, file)
    else downloadLocalFile(res, file)
}

export const update_images = async (req: Request, res: Response) => {
    const { query } = parse_query(req.query)
    const { $set, $unset } = parseUpdateBody(req.body)

    const result = await Image.updateMany(query, { $set, $unset })

    res.send(result)
}

export const update_image = async (req: Request, res: Response) => {
    const { _id } = req.params
    const { $set, $unset } = parseUpdateBody(req.body)

    const query: Record<string, string> = { _id }

    const updatedDoc = await Image.findOneAndUpdate(
        query,
        { $set, $unset },
        { new: true }
    )

    if (!updatedDoc) throw createHttpError(404, `Image ${_id} not found`)

    res.send(updatedDoc)
}

export const replace_image_data = async (req: Request, res: Response) => {
    const { _id } = req.params
    const data = req.body

    const query: Record<string, string> = { _id }

    const updated_image = await Image.findOneAndUpdate(query, { data })

    if (!updated_image) throw createHttpError(404, `Image ${_id} not found`)

    res.send(updated_image)
}

export const delete_images = async (req: Request, res: Response) => {
    const { query } = parse_query(req.query)

    const items = await Image.find(query)

    // Delete files in the background, so omitting await
    removeImageFiles(items)

    const result = await Image.deleteMany(query)

    res.send(result)
}

export const delete_image = async (req: Request, res: Response) => {
    const { _id } = req.params

    const query: Record<string, string> = { _id }

    const image = await Image.findOneAndDelete(query)

    if (!image) throw createHttpError(404, `Image ${_id} not found`)

    if (s3Client) await deleteFileFromS3(image.file)
    else removeLocalFile(image.file)

    res.send({ _id })
}
