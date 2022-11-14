const Image = require('../models/image.js')
const path = require('path')
const createHttpError = require('http-errors')
const unzipper = require('unzipper') // NOTE: Unzipper is advertized as having a low memory footprint
const { remove_file } = require('../utils.js')
const {
  uploads_directory,
  mongodb_export_file_name,
} = require('../config.js')


 const mongodb_data_import = (images) => {
   const promises = images.map( (image) => Image.findOneAndUpdate( image, image, { upsert: true }) )
   return Promise.all(promises)
 }

exports.import_images = async (req, res, next) => {


  try {

    const {file} = req

    if (!file) throw createHttpError(400, 'File not provided')
    const {mimetype, path: archive_relative_path} = file

    const allowed_mimetypes = [
      'application/x-zip-compressed',
      'application/zip',
    ]

    if ( ! allowed_mimetypes.includes(mimetype) ) throw createHttpError(400, 'File is not zip')

    console.log(`[Import] Importing archive...`)

    const archive_path = path.join(__dirname, `../${archive_relative_path}`) 

    const directory = await unzipper.Open.file(archive_path)
    const unzip_directory = path.join(__dirname, `../${uploads_directory}`)

    // Check if the archive contains the .json file containing the MonggoDB backup
    const contains_json = directory.files.some(({ path }) => path === mongodb_export_file_name )
    // if (!contains_json) throw createHttpError(400, `${mongodb_export_file_name} not found in archive`)

    if(contains_json) {
      // Restore DB records MonggoDB backup
      const json_file_path = path.join(unzip_directory, mongodb_export_file_name)
      const mongodb_data = require(json_file_path)
      await mongodb_data_import(mongodb_data)
    }
    else {
      const mongodb_data = directory.files.map( f => ({file: f.path}))
      await mongodb_data_import(mongodb_data)
    }

    // Unzip the archive to the uploads directory
    await directory.extract({ path: unzip_directory })

    // Remove the archive when done extracting
    await remove_file(archive_path)

    console.log(`[Import] Images from archive ${archive_relative_path} imported`)
    res.send({ file: archive_relative_path })
  }
  catch (error) {
    next(error)
  }
}
