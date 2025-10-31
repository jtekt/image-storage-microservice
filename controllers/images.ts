import createHttpError from 'http-errors'
import { IImage, Image } from '../models/image'
import { parseUpdateBody, parse_query, parse_post_body } from '../utils'
import { Request, Response } from 'express'
import { s3Client, streamFileFromS3, deleteFileFromS3 } from '../fileStorage/s3'
import { downloadLocalFile, removeLocalFile } from '../fileStorage/local'
import { removeImageFiles } from '../fileStorage/common'
import { defaultLimit } from '../config'
import { getUserId } from '../utils/user'

interface NewImage extends IImage {
    time: Date
}

export const upload_image = async (req: Request, res: Response) => {
    // NOTE: Req.body is multipart form-data
    if (!req.file) throw createHttpError(400, 'File not provided')

    // TODO: Only allow images

    let userId: string | undefined = undefined
    if (process.env.IMAGE_SCOPE === 'user') {
        const id = getUserId(res.locals.user)

        // If no id found, throw an error
        if (!id) throw createHttpError(401, 'User ID not provided')
        userId = id
    }

    const { originalname } = req.file

    const {
        _id,
        time,
        file: userProvidedFilePath,
        ...data
    } = parse_post_body(req.body)

    const file = userProvidedFilePath || originalname

    const query = { file, userId }
    const itemProperties: NewImage = {
        _id,
        time: time ? new Date(time) : new Date(),
        file,
        data,
        userId,
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
        limit = defaultLimit,
        skip,
        select,
    } = parse_query(req.query)

    if (process.env.IMAGE_SCOPE === 'user') {
        const id = getUserId(res.locals.user)

        if (!id) throw createHttpError(401, 'User ID not provided')

        query.userId = id
    }

    const items = await Image.find(query)
        .sort(sortStatement)
        .skip(Number(skip))
        .limit(limit)
        .select(select)

    const total = await Image.countDocuments(query)

    res.send({ total, skip, limit, items, select })
}

export const read_image = async (req: Request, res: Response) => {
    const { _id } = req.params

    const query: Record<string, string> = { _id }

    if (process.env.IMAGE_SCOPE === 'user') {
        const id = getUserId(res.locals.user)

        if (!id) throw createHttpError(401, 'User ID not provided')

        query.userId = id
    }

    const image = await Image.findOne(query)

    if (!image) throw createHttpError(404, `Image ${_id} not found`)

    res.send(image)
}

export const read_image_file = async (req: Request, res: Response) => {
    const { _id } = req.params

    const query: Record<string, string> = { _id }

    if (process.env.IMAGE_SCOPE === 'user') {
        const id = getUserId(res.locals.user)

        if (!id) throw createHttpError(401, 'User ID not provided')

        query.userId = id
    }

    const image = await Image.findOne(query)

    if (!image) throw createHttpError(404, `Image ${_id} not found`)

    const { file } = image

    if (s3Client) await streamFileFromS3(res, file)
    else downloadLocalFile(res, file)
}

export const update_images = async (req: Request, res: Response) => {
    const { query } = parse_query(req.query)
    const { $set, $unset } = parseUpdateBody(req.body)

    if (process.env.IMAGE_SCOPE === 'user') {
        const id = getUserId(res.locals.user)

        if (!id) throw createHttpError(401, 'User ID not provided')

        query.userId = id
    }

    const result = await Image.updateMany(query, { $set, $unset })

    res.send(result)
}

export const update_image = async (req: Request, res: Response) => {
    const { _id } = req.params
    const { $set, $unset } = parseUpdateBody(req.body)

    const query: Record<string, string> = { _id }

    if (process.env.IMAGE_SCOPE === 'user') {
        const id = getUserId(res.locals.user)

        if (!id) throw createHttpError(401, 'User ID not provided')

        query.userId = id
    }

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

    if (process.env.IMAGE_SCOPE === 'user') {
        const id = getUserId(res.locals.user)

        if (!id) throw createHttpError(401, 'User ID not provided')

        query.userId = id
    }

    const updated_image = await Image.findOneAndUpdate(query, { data })

    if (!updated_image) throw createHttpError(404, `Image ${_id} not found`)

    res.send(updated_image)
}

export const delete_images = async (req: Request, res: Response) => {
    const { query } = parse_query(req.query)

    if (process.env.IMAGE_SCOPE === 'user') {
        const id = getUserId(res.locals.user)

        if (!id) throw createHttpError(401, 'User ID not provided')

        query.userId = id
    }

    const items = await Image.find(query)

    // Delete files in the background, so omitting await
    removeImageFiles(items)

    const result = await Image.deleteMany(query)

    res.send(result)
}

export const delete_image = async (req: Request, res: Response) => {
    const { _id } = req.params

    const query: Record<string, string> = { _id }

    if (process.env.IMAGE_SCOPE === 'user') {
        const id = getUserId(res.locals.user)

        if (!id) throw createHttpError(401, 'User ID not provided')

        query.userId = id
    }

    const image = await Image.findOneAndDelete(query)

    if (!image) throw createHttpError(404, `Image ${_id} not found`)

    if (s3Client) await deleteFileFromS3(image.file)
    else removeLocalFile(image.file)

    res.send({ _id })
}
