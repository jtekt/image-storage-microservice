const Image = require('../models/image.js')
const path = require('path')
const createHttpError = require('http-errors')
const unzipper = require('unzipper') // NOTE: Unzipper is advertized as having a low memory footprint
const { remove_file } = require('../utils.js')
const {
  directories,
  mongodb_export_file_name,
} = require('../config.js')


 const mongodb_data_import = (images) => {
  // Querying by file because unique and imports without mongodb data do not have an ID
   const promises = images.map( (image) => Image.findOneAndUpdate( {file: image.file}, image, { upsert: true }) )
   return Promise.all(promises)
 }

exports.import_images = async (req, res, next) => {


  try {

    const {file, body} = req

    if (!file) throw createHttpError(400, 'File not provided')
    const {mimetype, filename} = file

    const allowed_mimetypes = [
      'application/x-zip-compressed',
      'application/zip',
    ]

    if ( ! allowed_mimetypes.includes(mimetype) ) throw createHttpError(400, 'File is not zip')

    console.log(`[Import] Importing archive...`)

    const archive_path = path.join(directories.temp, filename) 

    const directory = await unzipper.Open.file(archive_path)
    
    // Unzip the archive to the uploads directory
    await directory.extract({ path: directories.uploads })

    // Check if the archive contains the .json file containing the MonggoDB backup
    const contains_json = directory.files.some(({ path }) => path === mongodb_export_file_name )
    // if (!contains_json) throw createHttpError(400, `${mongodb_export_file_name} not found in archive`)

    if(contains_json) {
      // Restore DB records MonggoDB backup
      console.log(`[Import] importing and restoring MongDB data`)
      const json_file_path = path.join(directories.uploads, mongodb_export_file_name)
      const mongodb_data = require(json_file_path)
      await mongodb_data_import(mongodb_data)
    }
    else {
      // No backup is provided
      console.log(`[Import] importing without restoring MongoDB data`)

      // The user can pass data for all the images of the zip
      const json_data = body.data || body.json
      const data = json_data ? JSON.parse(json_data) : {...body}

      const mongodb_data = directory.files.map( f => ({file: f.path, data}))
      await mongodb_data_import(mongodb_data)
    }

    // Remove the archive when done extracting
    await remove_file(archive_path)

    console.log(`[Import] Images from archive ${filename} imported`)
    res.send({ file: filename })
  }
  catch (error) {
    next(error)
  }
}
