
const archiver = require('archiver') // NOTE: Archiver is advertized as having a low memory footprint
const Image = require('../models/image.js')
const path = require('path')
const fs = require('fs')
const XLSX = require('xlsx')
const rimraf = require('rimraf')
const {
  uploads_directory,
  mongodb_export_file_name,
 } = require('../config.js')


const generate_excel = (data, path) => {

  const formatted_data = data.map(item => {

    // Convert nested data properties

    // Important: create a copy so as to not affect original data
    const {data, ...baseMetaData} = item

    const output = {
      ...baseMetaData,
      _id: baseMetaData._id.toString(),
    }

    // Remove unused properties
    delete output.data
    
    for (let key in data) { 
      if (data[key]) output[key] = data[key].toString()
    }

    return output

  })

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(formatted_data)
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1")
  XLSX.writeFile(workbook, path)
}

const generate_json = (data, path) => {
  fs.writeFileSync(path, JSON.stringify(data))
}

const list_files_of_directory = (folder) => new Promise((resolve, reject) => {
  fs.readdir(folder, (error, files) => {
    if(error) return reject(error)
    resolve(files)
  })
})

const delete_file = (file_path) => new Promise( (resolve, reject) => {
  rimraf(file_path, (error) => {
    if(error) reject(error)
    resolve()
  })
})

exports.export_images = async (req, res, next) => {

  try {

    const folder_to_zip = path.join(__dirname, `../${uploads_directory}`)
    const json_file_path = path.join(__dirname, `../${uploads_directory}`, mongodb_export_file_name)
    const excel_file_path = path.join(__dirname, `../${uploads_directory}`, 'mongodb_data.xlsx')
    const temp_zip_path = path.join(__dirname, `../image_storage_service_export.zip`)

    

    const images = await Image.find({})
    const images_json = images.map(i => i.toJSON())

    generate_excel(images_json, excel_file_path)
    generate_json(images_json, json_file_path)

    const output = fs.createWriteStream(temp_zip_path);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    output.on('close', async () => {
      console.log(`[Export] ${archive.pointer()} total bytes`);
      console.log('[Export] archiver has been finalized and the output file descriptor has closed.');
      res.download(temp_zip_path)


      // Cleanup of generated files
      await delete_file(excel_file_path)
      await delete_file(json_file_path)
      await delete_file(temp_zip_path)

      console.log(`[Export] Images exported`)


    });

    // This event is fired when the data source is drained no matter what was the data source.
    // It is not part of this library but rather from the NodeJS Stream API.
    // @see: https://nodejs.org/api/stream.html#stream_event_end
    output.on('end', function () {
      console.log('[Export] Data has been drained');
    });

    // good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', function (err) {
      if (err.code === 'ENOENT') {
        // log warning
      } else {
        // throw error
        throw err;
      }
    });

    // good practice to catch this error explicitly
    archive.on('error', function (err) {
      throw err;
    });

    console.log(`[Export] Exporting started`)

    archive.pipe(output);
    archive.directory(folder_to_zip, false);
    archive.finalize();

    

  }
  catch (error) {
    next(error)
  }
}
