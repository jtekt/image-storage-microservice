const {ObjectID} = require('mongodb')
const rimraf = require('rimraf')
const dotenv = require('dotenv')
const config = require('../config.js')
const path = require('path')
const url = require('url')
const { getDb } = require('../db.js')
const axios = require('axios') // USed for imports

// Modules used for export
const fs = require('fs')
const XLSX = require('xlsx')
const AdmZip = require('adm-zip')
// COULD USE express-zip INSTEAD


// Parse environment variables
dotenv.config()

const uploads_directory_path = config.uploads_directory_path

function error_handling(res, error) {
  const status_code = error.code || 500
  const message = error.message || error
  console.log(message)
  if(!res._headerSent) res.status(status_code).send(message)
}

function get_collection_from_request(req){
    const collection = req.params.collection
    if(!collection) throw {code: 400, message: 'Collection not specified'}
    return collection
}


function delete_images_folder(folder_to_remove){
  return new Promise((resolve, reject) => {
    rimraf(folder_to_remove, (error) => {
      if(error) reject(error)
      resolve()
    })
  })
}

const generate_excel = (data, filename) => {

  // convert any object into String
  data = data.map( (item) => {
    for (let key in item) { item[key] = item[key].toString() }
    return item
  })

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1")
  XLSX.writeFile(workbook, filename)
}

async function download_single_image(parameters) {

  const {
    item,
    remote_collection,
    origin_url,
    headers} = parameters

  const url = `${origin_url}/collections/${remote_collection}/images/${item._id}/image`
  const options = {
    url,
    method: 'GET',
    responseType: 'stream', // This is important
    headers,
  }
  return axios(options)
}

function save_file(parameters){

  const {image_data, destination_path} = parameters

  const writer = fs.createWriteStream(destination_path)

  image_data.pipe(writer)

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve)
    writer.on('error', reject)
  })
}


function promise_chain(parameters){

  const  {
    list,
    item_index,
    remote_collection,
    local_collection,
    origin_url,
    destination_folder_path,
    headers,
  } = parameters


  const item = list[item_index]

  io.sockets.emit('import_progress', {
    origin: origin_url,
    progress: item_index/list.length,
    remote_collection,
    local_collection,
  })

  return new Promise((resolve, reject) => {

    if(item_index >= list.length) return resolve()

    download_single_image({item, remote_collection, origin_url, headers})
    .then( ({data: image_data}) => {
      const destination_path = path.join(destination_folder_path, item.image)
      return save_file({image_data, destination_path})
    })
    .catch((error) => {
      console.log(`Image ${item._id} download failed`)
      io.sockets.emit('import_error', {
        origin: origin_url,
        remote_collection,
        local_collection,
        error: `Image ${item._id} download failed`,
      })
    })
    .finally(() => {

      let next_parameters = parameters
      next_parameters.item_index = parameters.item_index +1

      return promise_chain(next_parameters)
    })


  })

}

function download_all_images(options){

  // Destructuring parameter
  const {
    list,
    remote_collection,
    local_collection,
    origin_url,
    headers,
  } = options

  const images_directory_path = path.join( uploads_directory_path, 'images')

  // Create image directory if it doesn't exist
  if (!fs.existsSync(images_directory_path)){
    fs.mkdirSync(images_directory_path)
  }

  const destination_folder_path = path.join(images_directory_path, local_collection)

  // Create destination directory if it does not exist
  if (!fs.existsSync(destination_folder_path)){
    fs.mkdirSync(destination_folder_path)
  }

  const parameters = {
    item_index: 0,
    list,
    remote_collection,
    local_collection,
    origin_url,
    destination_folder_path,
    headers,
  }

  promise_chain(parameters)
  .then(() => {
    console.log(`[Import] Downloaded all images of ${remote_collection}`)
  })
  .catch(error => {
    io.sockets.emit('import_error', {
      origin: origin_url,
      remote_collection,
      local_collection,
      error: 'Import failed',
    })
  })

}




exports.get_collections = async (req, res) => {

  // Todo: respond with more info than just name

  try {
    const collections = await getDb()
      .listCollections()
      .toArray()

    res.send(collections.map(collection => { return collection.name }))
    console.log(`[MongoDB] Queried list of collections`)
  }
  catch (error) { error_handling(res, error) }

}

exports.get_collection_info = async (req, res) => {

  try {
    const collection = get_collection_from_request(req)

    const document_count = await getDb()
      .collection(collection)
      .countDocuments()

      res.send({ name: collection, documents: document_count })
      console.log(`[MongoDB] Queried info for collection ${collection}`)
  }
  catch (error) { error_handling(res, error) }

}



exports.drop_collection = async (req, res) => {

  try {
    const collection = get_collection_from_request(req)
    await getDb()
      .collection(collection)
      .drop()
    const folder_to_remove = path.join(uploads_directory_path,'images',collection)
    await delete_images_folder(folder_to_remove)

    console.log(`[MongoDB] Collection ${collection} dropped`)
    res.send(`Collection ${collection} dropped`)

  }
  catch (error) { error_handling(res, error) }

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

exports.export_collection_zip = async (req, res) => {

  const {collection} = req.params

  if(!collection) return res.status(400).send(`Collection not specified`)

  try {

    const folder_to_zip = path.join(uploads_directory_path,'images',collection)
    const excel_filename = `${collection}_export.xlsx`

    const items = await getDb()
      .collection(collection)
      .find({})
      .sort({time: -1}) // sort by timestamp
      .toArray()

    generate_excel(items, excel_filename)

    const files = await list_files_of_directory(folder_to_zip)

    const zip = new AdmZip()

    // add every file
    files.forEach((file) => {
      zip.addLocalFile(path.join(folder_to_zip,file))
    })

    // Add the excel file
    zip.addLocalFile(excel_filename)

    // get everything as a buffer
    const zipFileContents = zip.toBuffer()
    const zip_filename = `${collection}_export.zip`

    await delete_file(excel_filename)

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



exports.import_collection = async (req, res) => {

  const remote_collection = req.query.remote_collection
  if(!remote_collection)   return res.status(400).send(`Remote collection not specified`)

  const local_collection = req.query.local_collection || remote_collection

  let origin_url = req.query.origin
  if(!origin_url)   return res.status(400).send(`Origin not specified`)
  // Sanitizing URL
  try {
    origin_url = new URL(origin_url).origin
  } catch (e) {
    console.log(e)
    return res.status(400).send(`Origin URL invalid`)
  }

  console.log(`[MongoDB] Importing collection ${remote_collection} from ${origin_url} into local collection ${local_collection}`)
  const list_url = `${origin_url}/collections/${remote_collection}/images`

  try {
    const headers = req.headers
    // Get the collection from the remote collection
    const {data: list} = await axios.get(list_url, {headers})
    console.log(`Remote collection contains ${list.length} items`)

    const bulk = getDb()
      .collection(local_collection)
      .initializeUnorderedBulkOp()

    // Build the bulk operations
    // Using update upsert to prevent duplicates
    list.forEach((item) => {

      item._id = ObjectID(item._id)

      bulk.find({_id: item._id})
      .upsert()
      .updateOne({$set: item})
    })

    await bulk.execute()
    console.log(`MongoDB collection imported, now transferring images`)

    res.send({items: list.length})

    download_all_images({
      list,
      remote_collection,
      local_collection,
      origin_url,
      headers,
    })


  }
  catch (error) {
    console.log(error)
    res.status(500).send(error)
  }

}
