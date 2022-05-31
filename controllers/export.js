const AdmZip = require('adm-zip')
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

  formatted_data = data.map(item => {

    // TODO: Remove the "data" property

    // Convert nested data properties
    for (let key in item.data) { item.data[key] = item.data[key].toString() }

    return {
      ...item,
      _id: item._id.toString(),
      ...item.data
    }

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

    const images = await Image.find({})
    const images_json = images.map(i => i.toJSON())

    generate_excel(images_json, excel_file_path)
    generate_json(images_json, json_file_path)

    const files = await list_files_of_directory(folder_to_zip)
    const zip_filename = `export.zip`

    const zip = new AdmZip()

    // add every file
    files.forEach((file) => {
      zip.addLocalFile(path.join(folder_to_zip,file))
    })

    const zipFileContents = zip.toBuffer()

    // Cleanup of summary files, not strictly necesary but good practice
    await delete_file(excel_file_path)
    await delete_file(json_file_path)

    res.setHeader("Content-Type", "application/zip" )
    res.setHeader("Content-Disposition", `attachment; filename=${zip_filename}` )
    res.send(zipFileContents)

    console.log(`[Export] Images exported`)
  }
  catch (error) {
    next(error)
  }
}
