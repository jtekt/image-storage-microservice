const Image = require('../models/image.js')
const path = require('path')
const fs = require('fs')
const createHttpError = require('http-errors')
const unzipper = require('unzipper') // NOTE: Unzipper is advertized as having a low memory footprint
const { 
  remove_file,
  parse_formdata_fields
} = require('../utils.js')
const {
  directories,
  mongodb_export_file_name,
  export_excel_file_name,
} = require('../config.js')


const mongodb_data_import = (documents) => {
  // TODO: Consider bulkwrite
  // Querying by file because unique and imports without mongodb data do not have an ID
  const promises = documents.map((document) => Image.findOneAndUpdate({ file: document.file }, document, { upsert: true }) )
  return Promise.all(promises)
}


const extract_single_file = (file, output_directory) => new Promise ( (resolve, reject) => {
  const file_name = file.path
  const output_path = path.join(output_directory, file_name)
  file.stream()
      .pipe(fs.createWriteStream(output_path))
      .on('error',reject)
      .on('finish',resolve)
})
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
    // TODO: This is very memory intensive for large archives
    // await directory.extract({ path: directories.uploads })

    for await ( const file of directory.files) {
      // TODO: only move images
      await extract_single_file(file, directories.uploads)
    }

    // Another attempt using streams, but throws Unexpected end of file Zlib zlibOnError 5 Z_BUF_ERROR
    // try {
    //   const zip = fs.createReadStream(archive_path)
    //   .pipe(unzipper.Parse({forceStream: true}));

    //   for await (const entry of zip) {
    //     const fileName = entry.path;
    //     const outut_path = path.join(directories.uploads, fileName)
    //     entry.pipe(fs.createWriteStream(outut_path));      
    //   }
    // } catch (error) {
    //   console.log('Error was caught!')
    //   throw 'banana'
    // }

    // The user can pass data for all the images of the zip
    const userDefinedData = parse_formdata_fields(body)

    const json_file_path = path.join(directories.uploads, mongodb_export_file_name)
    const excel_file_path = path.join(directories.uploads, export_excel_file_name)

    const json_file_exists = directory.files.some(({ path }) => path === mongodb_export_file_name )


    if(json_file_exists) {
      // Restore DB records MonggoDB backup
      console.log(`[Import] importing and restoring MongDB data`)
      // TODO: Read file directly from archive
      const jsonFileDataBuffer = fs.readFileSync(json_file_path);
      const mongodbData = JSON.parse(jsonFileDataBuffer)

      mongodbData.forEach( document => {
        document.data = { ...document.data, ...userDefinedData } 
      })


      // TODO: consider allowing the addition of properties
      await mongodb_data_import(mongodbData)
    }
    else {
      // No backup is provided
      console.log(`[Import] importing without restoring MongoDB data`)
      const mongodbData = directory.files.map(f => ({ file: f.path, data: userDefinedData }))
      await mongodb_data_import(mongodbData)
    }

    // Remove the archive when done extracting
    await remove_file(archive_path)
    
    // remove excel and json (will not be needed if only copying images from archive)
    if(fs.existsSync(excel_file_path)) remove_file(excel_file_path)
    if(fs.existsSync(json_file_path)) remove_file(json_file_path)
    


    console.log(`[Import] Images from archive ${filename} imported`)
    res.send({ file: filename })
  }
  catch (error) {
    next(error)
  }
}
