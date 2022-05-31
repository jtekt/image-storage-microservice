const Image = require('../models/image.js')
const path = require('path')
const createHttpError = require('http-errors')
const {uploads_directory} = require('../config.js')
const {
  remove_file,
  parse_db_query_parameters
} = require('../utils.js')


exports.upload_image = async (req, res, next) => {
  try {

    // WARNING: Body becomes data so no way to pass time
    if (!req.file) throw { code: 400, message: 'File not provided' }
    const file = req.file.originalname
    const data = req.body
    const time = new Date()

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

    const {skip, filter, limit, sort} = parse_db_query_parameters(req)

    const images = await Image
      .find(filter)
      .skip(skip)
      .limit(limit)
      .sort(sort)

    // TODO: RETURN COUNT

    res.send(images)
    console.log(`Images queried`)
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
    image.data = {...image.data,...properties}
    const updated_image = await image.save()

    res.send(updated_image)
    console.log(`Image ${_id} updated`)
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
