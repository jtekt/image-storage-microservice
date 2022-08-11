const Image = require('../models/image.js')
const path = require('path')
const createHttpError = require('http-errors')
const {
  uploads_directory,
  mongodb_export_file_name,
} = require('../config.js')
const unzipper = require('unzipper');


 const mongodb_data_import = (images) => {
   const promises = images.map( (image) => {
     return Image.findOneAndUpdate( image, image, { upsert: true })
   })
   return Promise.all(promises)
 }

exports.import_images = async (req, res, next) => {


  try {
    const {file} = req
    if (!file) throw createHttpError(400, 'File not provided')
    const {mimetype, buffer} = file

    const allowed_mimetypes = [
      'application/x-zip-compressed',
      'application/zip',
    ]
    if ( ! allowed_mimetypes.includes(mimetype) ) throw createHttpError(400, 'File is not zip')

    console.log(`[Import] Importing archive...`)

    const directory = await unzipper.Open.buffer(buffer);
    const contains_json = directory.files.some(({ path }) => path === mongodb_export_file_name )
    if (!contains_json) throw createHttpError(400, `${mongodb_export_file_name} not found in archive`)
    const unzip_directory = path.join(__dirname, `../${uploads_directory}`)
    await directory.extract({path: unzip_directory})

    const json_file_path = path.join(unzip_directory, mongodb_export_file_name)
    const mongodb_data = require(json_file_path)

    const {length} = await mongodb_data_import(mongodb_data)

    res.send({count: length})

    console.log(`[Import] ${length} Images imported`)

  }
  catch (error) {
    next(error)
  }
}
