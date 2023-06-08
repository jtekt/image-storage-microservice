import Image from "../models/image"
import path from "path"
import createHttpError from "http-errors"
import { directories } from "../config"
import { remove_file, parse_query } from "../utils"
import { Request, Response } from "express"

interface NewImage {
  _id?: string
  time: Date
  file: string
  data: any
}

export const upload_image = async (req: Request, res: Response) => {
  // NOTE: Req.body is multipart form-data
  if (!req.file) throw createHttpError(400, "File not provided")

  // TODO: Only allow images
  const {
    file: { originalname },
    body,
  } = req

  const { _id, time, file: filePath, json, data: bodyData, ...bodyRest } = body

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
  const newImage = await Image.findOneAndUpdate(query, itemProperties, options)
  res.send(newImage)
}

export const read_images = async (req: Request, res: Response) => {
  // Limiting here because parse_query also used in export
  const { query, sort, order, limit = 100, skip } = parse_query(req.query)

  const items = await Image.find(query)
    .sort({ [sort]: order })
    .skip(Number(skip))
    .limit(Math.max(Number(limit), 0))

  const total = await Image.countDocuments(query)

  res.send({ total, skip, limit, items })
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
  const file_absolute_path = path.join(directories.uploads, file)
  // Second argument is filename
  res.download(file_absolute_path, file)
}

export const update_image = async (req: Request, res: Response) => {
  const { _id } = req.params
  const properties = req.body

  const image = await Image.findOne({ _id })
  if (!image) throw createHttpError(404, `Image ${_id} not found`)

  // Unpack properties into data
  // WARNING: Nested fields are replaced
  image.data = { ...image.data, ...properties }

  // Deleting properties by setting them to null
  // WARNING: this makes it imposible to have null properties
  Object.keys(properties).forEach((k) => {
    if (properties[k] === null) delete image.data[k]
  })

  const updated_image = await image.save()
  res.send(updated_image)
}

export const replace_image_data = async (req: Request, res: Response) => {
  const { _id } = req.params
  const properties = req.body

  const image = await Image.findOne({ _id })
  if (!image) throw createHttpError(404, `Image ${_id} not found`)

  // replace all properties
  image.data = properties
  const updated_image = await image.save()
  res.send(updated_image)
}

export const delete_images = async (req: Request, res: Response) => {
  const { query, sort, order, limit = 0, skip } = parse_query(req.query)

  const items = await Image.find(query)
    .sort({ [sort]: order })
    .skip(Number(skip))
    .limit(Math.max(Number(limit), 0))

  // Delete files
  const fileDeletePromises = items.map(({ file }) =>
    remove_file(path.join(directories.uploads, file))
  )
  await Promise.all(fileDeletePromises)

  // delete records
  const recordDeletePromises = items.map(({ _id }) => Image.deleteOne({ _id }))
  await Promise.all(recordDeletePromises)

  console.log(`${items.length} images deleted`)
  res.send({ item_count: items.length })
}

export const delete_image = async (req: Request, res: Response) => {
  const { _id } = req.params
  const image = await Image.findOneAndDelete({ _id })
  if (!image) throw createHttpError(404, `Image ${_id} not found`)
  const file_absolute_path = path.join(directories.uploads, image.file)
  await remove_file(file_absolute_path)
  res.send({ _id })
}
