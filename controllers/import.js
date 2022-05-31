const AdmZip = require('adm-zip')
const Image = require('../models/image.js')
const path = require('path')
const createHttpError = require('http-errors')
const {
  uploads_directory,
  mongodb_export_file_name,
} = require('../config.js')


 const mongodb_data_import = (images) => {
   const promises = []
   images.forEach( (image) => {
     promises.push(Image.findOneAndUpdate( image, image, { upsert: true }))
   })
   return Promise.all(promises)
 }

exports.import_images = async (req, res, next) => {

  try {
    const {file} = req
    if (!file) throw createHttpError(400, 'File not provided')
    const {mimetype, buffer} = file
    if (mimetype !== 'application/x-zip-compressed') throw createHttpError(400, 'File is not zip')

    const zip = new AdmZip(buffer)

    // Check if archive contains mongodb data file
    const found_json = zip.getEntries().find( ({ entryName }) => entryName === mongodb_export_file_name)
    if (!found_json) throw createHttpError(400, `${mongodb_export_file_name} not found in archive`)

    const unzip_directory = path.join(__dirname, `../${uploads_directory}`)
    zip.extractAllTo(unzip_directory, true)

    const json_file_path = path.join(unzip_directory, mongodb_export_file_name)
    const mongodb_data = require(json_file_path)

    await mongodb_data_import(mongodb_data)

    res.send('OK')

    console.log(`[Import] Images imported`)

  }
  catch (error) {
    next(error)
  }
}
