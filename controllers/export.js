const fs = require('fs')
const XLSX = require('xlsx')
const AdmZip = require('adm-zip')
const rimraf = require('rimraf')
const path = require('path')
const { getDb } = require('../db.js')
const {
  uploads_directory_path,
  mongodb_export_file_name
} = require('../config.js')

const generate_excel = (data, path) => {
  // convert any object into String
  const data_formatted = data.map( (item) => {
    for (let key in item) { item[key] = item[key].toString() }
    return item
  })

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(data_formatted)
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1")
  XLSX.writeFile(workbook, path)
}

const generate_json = (data, path) => {
  console.log(data)
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

exports.export_collection = async (req, res) => {

  try {

    const {collection} = req.params
    if(!collection) throw {code: 400, message: 'collection not specified'}

    const folder_to_zip = path.join(uploads_directory_path,'images',collection)
    const json_file_path = path.join(folder_to_zip, mongodb_export_file_name)
    const excel_file_path = path.join(folder_to_zip, `mongodb_data.xlsx`)


    const items = await getDb()
      .collection(collection)
      .find({})
      .sort({time: -1}) // sort by timestamp
      .toArray()

    generate_json(items, json_file_path)
    generate_excel(items, excel_file_path)

    const files = await list_files_of_directory(folder_to_zip)

    const zip = new AdmZip()

    // add every file
    files.forEach((file) => {
      zip.addLocalFile(path.join(folder_to_zip,file))
    })

    // get everything as a buffer
    const zipFileContents = zip.toBuffer()
    const zip_filename = `${collection}_export.zip`

    // Cleaning up
    await delete_file(excel_file_path)
    await delete_file(json_file_path)

    res.setHeader("Content-Type", "application/zip" )
    res.setHeader("Content-Disposition", `attachment; filename=${zip_filename}` )
    res.send(zipFileContents)

    console.log(`[MongoDB] Images of ${collection} exported`)

  }
  catch (error) {
    console.log(error)
    res.status(500).send(error)
  }


}
