const Image = require('../models/image.js')
const path = require('path')
const createHttpError = require('http-errors')
const {uploads_directory} = require('../config.js')
const {
  remove_file,
  compute_filters
} = require('../utils.js')

const isNumeric = (str) => {
  if (typeof str != "string") return false // we only process strings!  
  return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

exports.upload_image = async (req, res, next) => {
  try {

    // WARNING: Body becomes data so no way fro user to set time
    // BUG: NUMBERS ARE CONVERTED TO STRING
    if (!req.file) throw createHttpError(400, 'File not provided') 
    const file = req.file.originalname
    const data = req.body
    const {convert_numbers} = req.query
    const time = new Date()

    if (convert_numbers) {
      for (const key in data) {
        if (isNumeric(data[key])) data[key] = parseFloat(data[key])
      }
    }
    

    const new_image = await Image.create({ file, time, data })
    res.send(new_image)
    console.log(`Image ${file} uploaded and saved`)
  }
  catch (error) {
    next(error)
  }
}

exports.read_images = async (req, res, next) => {

  try {

    const {
      skip = 0,
      limit = 100,
      sort = 'time',
      order = -1,
    } = req.query

    const filter = compute_filters(req)

    

    const items = await Image
      .find(filter)
      .sort({ [sort]: order })
      .skip(Number(skip))
      .limit(Math.max(Number(limit), 0))

    const total = await Image.countDocuments(filter)


    res.send({ total, skip, limit, items })
  }
  catch (error) {
    next(error)
  }

}




exports.read_image = async (req, res, next) => {
  try {
    const {_id} = req.params

    const image = await Image.findOne({_id})

    if (!image) throw createHttpError(404, `Image ${_id} not found`)

    res.send(image)
    console.log(`Image ${_id} queried`)
  }
  catch (error) {
    next(error)
  }
}

exports.delete_image = async (req, res, next) => {
  try {
    const {_id} = req.params
    const {file} = await Image.findOne({_id})

    const file_absolute_path = path.join(__dirname, `../${uploads_directory}`,file)
    await remove_file(file_absolute_path)

    const image = await Image.findOneAndDelete({_id})
    if (!image) throw createHttpError(404, `Image ${_id} not found`)

    console.log(`Image ${_id} deleted`)
    res.send({_id})
  }
  catch (error) {
    next(error)
  }
}

exports.update_image = async (req, res, next) => {
  try {

    const {_id} = req.params
    const properties = req.body

    const image = await Image.findOne({_id})
    if (!image) throw createHttpError(404, `Image ${_id} not found`)

    // Unpack properties into data, overwriting fields if necessary
    image.data = {...image.data, ...properties}

    const updated_image = await image.save()

    console.log(`Image ${_id} updated`)
    res.send(updated_image)
  }
  catch (error) {
    next(error)
  }
}

exports.read_image_file = async (req, res, next) => {
  try {
    const {_id} = req.params
    const {file} = await Image.findOne({_id})
    const file_absolute_path = path.join(__dirname, `../${uploads_directory}`,file)
    console.log(`Image file ${_id} queried`)
    res.sendFile(file_absolute_path)
  }
  catch (error) {
    next(error)
  }
}
