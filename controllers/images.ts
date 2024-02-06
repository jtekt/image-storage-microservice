import Image from '../models/image'
import createHttpError from 'http-errors'
import { parseUpdateBody, parse_query } from '../utils'
import { Request, Response } from 'express'
import { s3Client, streamFileFromS3, deleteFileFromS3 } from '../fileStorage/s3'
import { downloadLocalFile, removeLocalFile } from '../fileStorage/local'
import { removeImageFiles } from '../fileStorage/common'

interface NewImage {
    _id?: string
    time: Date
    file: string
    data: any
}

export const upload_image = async (req: Request, res: Response) => {
    // NOTE: Req.body is multipart form-data
    if (!req.file) throw createHttpError(400, 'File not provided')

    // TODO: Only allow images
    const {
        file: { originalname },
        body,
    } = req

    const {
        _id,
        time,
        file: filePath,
        json,
        data: bodyData,
        ...bodyRest
    } = body

    const jsonData = json || bodyData
    const data = jsonData ? JSON.parse(jsonData) : bodyRest

    const file = filePath || originalname

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
        sort,
        order,
        limit = 100,
        skip,
        select,
    } = parse_query(req.query)

    const items = await Image.find(query)
        .sort({ [sort]: order })
        .skip(Number(skip))
        .limit(Math.max(Number(limit), 0))
        .select(select)

    const total = await Image.countDocuments(query)

    res.send({ total, skip, limit, items, select })
}

export const read_image = async (req: Request, res: Response) => {
    const { _id } = req.params
    const image = await Image.findOne({ _id })
    if (!image) throw createHttpError(404, `Image ${_id} not found`)
    res.send(image)
}

export const read_image_file = async (req: Request, res: Response) => {
    const { _id } = req.params
    const image = await Image.findOne({ _id })
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

    const updatedDoc = await Image.findByIdAndUpdate(
        _id,
        { $set, $unset },
        { new: true }
    )

    if (!updatedDoc) throw createHttpError(404, `Image ${_id} not found`)

    res.send(updatedDoc)
}

export const replace_image_data = async (req: Request, res: Response) => {
    const { _id } = req.params
    const data = req.body

    const updated_image = await Image.findByIdAndUpdate(_id, { data })
    if (!updated_image) throw createHttpError(404, `Image ${_id} not found`)

    res.send(updated_image)
}

export const delete_images = async (req: Request, res: Response) => {
    const { query } = parse_query(req.query)

    const items = await Image.find(query)

    // Delete files in the background, so omitting await
    removeImageFiles(items)

    await Image.deleteMany(query)

    res.send({ item_count: items.length })
}

export const delete_image = async (req: Request, res: Response) => {
    const { _id } = req.params
    const image = await Image.findOneAndDelete({ _id })
    if (!image) throw createHttpError(404, `Image ${_id} not found`)
    if (s3Client) await deleteFileFromS3(image.file)
    else removeLocalFile(image.file)
    res.send({ _id })
}
