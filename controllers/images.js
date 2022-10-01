const Image = require('../models/image.js')
const path = require('path')
const createHttpError = require('http-errors')
const {uploads_directory} = require('../config.js')
const { remove_file } = require('../utils.js')



exports.upload_image = async (req, res, next) => {
  try {

    
    if (!req.file) throw createHttpError(400, 'File not provided') 
    const file = req.file.originalname
    const { body } = req

    // User can provide data as a stringified JSON by using the data field
    const data = body.data ? JSON.parse(body.data) : body

    // Time: Set to upload time unless provided otherwise by user
    let time = new Date()
    if ( data.time ) {
      time = new Date(data.time)
      delete data.time
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
      order = 1,
      from,
      to,
      regex, // boolean toggling partial text search, not ideal
      ...query
    } = req.query

    // NOTE: partial text search on any field might not work because field list not fixed

    const formattedQuery = { }

    for (const key in query) {
      if (regex) formattedQuery[`data.${key}`] = { $regex: query[key], $options: 'i'}
      else formattedQuery[`data.${key}`] = query[key]
    }

    // Time filters
    if (to || from) formattedQuery.time = {}
    if (to) formattedQuery.time.$lte = new Date(to)
    if (from) formattedQuery.time.$gt = new Date(from)

    const items = await Image
      .find(formattedQuery)
      .sort({ [sort]: order })
      .skip(Number(skip))
      .limit(Math.max(Number(limit), 0))

    const total = await Image.countDocuments(formattedQuery)


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
