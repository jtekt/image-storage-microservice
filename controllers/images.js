const Image = require("../models/image.js")
const path = require("path")
const createHttpError = require("http-errors")
const { directories } = require("../config.js")
const {
  remove_file,
  parse_query,
  parse_formdata_fields,
} = require("../utils.js")

exports.upload_image = async (req, res) => {
  // NOTE: Req.body is multipart form-data
  if (!req.file) throw createHttpError(400, "File not provided")

  // TODO: Only allow images
  const {
    file: { originalname: file },
    body,
  } = req

  const data = parse_formdata_fields(body)

  // Time: Set to upload time unless provided otherwise by user
  let time = new Date()
  if (data.time) {
    time = new Date(data.time)
    delete data.time
  }

  // Allowing user to set _id (used for transfers)
  let _id = undefined
  if (data._id) {
    _id = data._id
    delete data._id
  }

  const query = { file }
  const itemProperties = { _id, file, time, data }
  const options = { upsert: true, new: true }

  // const new_image = await Image.create(itemProperties)
  const newImage = await Image.findOneAndUpdate(query, itemProperties, options)
  console.log(`Image ${file} uploaded and saved`)
  res.send(newImage)
}

exports.read_images = async (req, res) => {
  // Limiting here because parse_query also used in export
  const { query, sort, order, limit = 100, skip } = parse_query(req.query)

  const items = await Image.find(query)
    .sort({ [sort]: order })
    .skip(Number(skip))
    .limit(Math.max(Number(limit), 0))

  const total = await Image.countDocuments(query)

  res.send({ total, skip, limit, items })
}

exports.read_image = async (req, res) => {
  const { _id } = req.params

  const image = await Image.findOne({ _id })

  if (!image) throw createHttpError(404, `Image ${_id} not found`)

  res.send(image)
  console.log(`Image ${_id} queried`)
}

exports.read_image_file = async (req, res) => {
  const { _id } = req.params
  const image = await Image.findOne({ _id })
  if (!image) throw createHttpError(404, `Image ${_id} not found`)
  const { file } = image
  const file_absolute_path = path.join(directories.uploads, file)
  // Second argument is filename
  res.download(file_absolute_path, file)
}

exports.update_image = async (req, res) => {
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

  console.log(`Image ${_id} updated`)
  res.send(updated_image)
}

exports.replace_image_data = async (req, res) => {
  const { _id } = req.params
  const properties = req.body

  const image = await Image.findOne({ _id })
  if (!image) throw createHttpError(404, `Image ${_id} not found`)

  // replace all properties
  image.data = properties
  const updated_image = await image.save()

  console.log(`Image ${_id} replaced`)
  res.send(updated_image)
}

exports.delete_images = async (req, res) => {
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

exports.delete_image = async (req, res) => {
  const { _id } = req.params
  const image = await Image.findOneAndDelete({ _id })
  if (!image) throw createHttpError(404, `Image ${_id} not found`)
  const file_absolute_path = path.join(directories.uploads, image.file)
  await remove_file(file_absolute_path)

  console.log(`Image ${_id} deleted`)
  res.send({ _id })
}
