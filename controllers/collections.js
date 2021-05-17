const ObjectID = require('mongodb').ObjectID
const { getDb } = require('../db.js')

//const del = require('del')
const rimraf = require('rimraf')
const dotenv = require('dotenv')
const config = require('../config.js')
const path = require('path')
const url = require('url')

// exports
const fs = require('fs')
const XLSX = require('xlsx')
const AdmZip = require('adm-zip')
// COULD USE express-zip INSTEAD

// Import
const axios = require('axios')

// Parse environment variables
dotenv.config()

const uploads_directory_path = config.uploads_directory_path

exports.get_collections = (req, res) => {

  getDb()
  .listCollections()
  .toArray()
  .then(collections => {
    //res.send(collections)
    res.send(collections.map(collection => { return collection.name }))

    console.log(`[MongoDB] Queried list of collections`)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send('Error while counting documents')
  })

}

exports.get_collection_info = (req, res) => {

  const collection = req.params.collection
  if(!collection) {
    return res.status(400).send(`Collection not specified`)
  }

  getDb()
  .collection(collection)
  .countDocuments()
  .then(result => {
    res.send({
      name: collection,
      documents: result,
    })
  })
  .catch(error => {
    console.log(error)
    res.status(500).send('Error while counting documents')
  })
}

function delete_images_folder(folder_to_remove){
  return new Promise((resolve, reject) => {
    rimraf(folder_to_remove, (error) => {
      if(error) reject(error)
      resolve()
    })
  })
}

exports.drop_collection = (req, res) => {

  const collection = req.params.collection

  if(!collection) {
    return res.status(400).send(`Collection not specified`)
  }

  getDb()
  .collection(collection)
  .drop()
  .then( () => {
    const folder_to_remove = path.join(uploads_directory_path,'images',collection)
    return delete_images_folder(folder_to_remove)
  })
  .then(() => {
    console.log(`[MongoDB] Collection ${collection} dropped`)
    res.send(`Collection ${collection} dropped`)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send('Error while counting documents')
  })
}

const generate_excel = (data, filename) => {

  // convert ID from ObjectID to String
  data = data.map( (item) => {
    for (var key in item) {
      item[key] = item[key].toString()
    }
    return item
  })

  let workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1")
  XLSX.writeFile(workbook, filename)
}

exports.export_collection_excel = (req, res) => {

  const collection = req.params.collection

  if(!collection) return res.status(400).send(`Collection not specified`)

  getDb()
  .collection(collection)
  .find({})
  .sort({time: -1}) // sort by timestamp
  .toArray()
  .then(result => {
    const filename = `export.xlsx`
    generate_excel(result, filename)

    const stream = fs.createReadStream(filename);         // create read stream

    res.setHeader( "Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" )
    res.setHeader( "Content-Disposition", `attachment; filename=${filename}` )

    stream.pipe(res)
    res.end()

    rimraf(filename, (error) => {
      if(error) {
        console.log(error)
      }
    })

    console.log(`[MongoDB] Images of ${collection} exported`)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send('Error while exporting documents')
  })

}

exports.export_collection_zip = (req, res) => {

  const collection = req.params.collection

  if(!collection) return res.status(400).send(`Collection not specified`)

  const folder_to_zip = path.join(uploads_directory_path,'images',collection)

  getDb()
  .collection(collection)
  .find({})
  .sort({time: -1}) // sort by timestamp
  .toArray()
  .then(result => {

    const excel_filename = `database_export.xlsx`
    generate_excel(result, excel_filename)

    const dir_content = fs.readdir(folder_to_zip, (error, files) => {

      if(error) throw Error('Could not list content of directory')

      let zip = new AdmZip()

      // add local file
      files.forEach((file) => { zip.addLocalFile(path.join(folder_to_zip,file)) })

      // Add excel export
      zip.addLocalFile(excel_filename)

      // get everything as a buffer
      const zipFileContents = zip.toBuffer();
      const zip_filename = `export.zip`;
      res.setHeader( "Content-Type", "application/zip" )
      res.setHeader( "Content-Disposition", `attachment; filename=${zip_filename}` )
      res.send(zipFileContents)

      console.log(`[MongoDB] Images of ${collection} exported`)

      // Delete the excel file once done
      rimraf(excel_filename, (error) => {
        if(error) { console.log(error) }
      })

    })

  })
  .catch(error => {
    console.log(error)
    res.status(500).send(error)
  })

}

async function download_single_image(parameters) {

  const {item, remote_collection, origin_url} = parameters

  const url = `${origin_url}/collections/${remote_collection}/images/${item._id}/image`
  const options = {
    url,
    method: 'GET',
    responseType: 'stream', // This is important
  }
  return axios(options)
}

function save_file(parameters){

  const {response, destination_path} = parameters

  const writer = fs.createWriteStream(destination_path)

  response.data.pipe(writer)

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
    destination_folder_path
  } = parameters


  const item = list[item_index]

  io.sockets.emit('import_progress', {
    origin: origin_url,
    progress: item_index/list.length,
    remote_collection,
    local_collection,
  })

  return new Promise((resolve, reject) => {

    if(item_index < list.length) {
      download_single_image({item, remote_collection, origin_url})
      .then(response => {
        const destination_path = path.join(destination_folder_path, item.image)
        return save_file({response, destination_path})
      })
      .then(() => {

        let next_parameters = parameters
        next_parameters.item_index = parameters.item_index +1

        return promise_chain(next_parameters)
      })
      .catch(error => reject)
    }

    else return resolve()
  })

}

function download_all_images(options){

  // Destructuring parameter
  const {
    list,
    remote_collection,
    local_collection,
    origin_url
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
    destination_folder_path
  }

  promise_chain(parameters)
  .then(() => {
    console.log(`[Import] Downloaded all images of ${remote_collection}`)
  })
  .catch(error => {
    console.log(error)
  })



}

exports.import_collection = (req, res) => {

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

  let list = []

  axios.get(list_url)
  .then(response => {
    // converting ID and date into proper format
    list = response.data.map(entry => {
      entry._id = ObjectID(entry._id)
      entry.time = new Date(entry.time)
      return entry
    })

    let bulk = getDb()
      .collection(local_collection)
      .initializeUnorderedBulkOp()

    list.forEach((item) => {
      bulk.find({_id: item._id}).upsert().updateOne({$set: item})
    })

    return bulk.execute()

  })
  .then(result => {
    console.log(`[MongoDB] Imported ${list.length} in collection ${local_collection}`)
    res.send({items: list.length})

    download_all_images({
      list,
      remote_collection,
      local_collection,
      origin_url,
    })
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(error)
  })
}
