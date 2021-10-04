const ObjectID = require('mongodb').ObjectID
const rimraf = require('rimraf') // Used to delete image files
const mv = require('mv')
const formidable = require('formidable')
const path = require('path')
const dotenv = require('dotenv')
const config = require('../config.js')
const { getDb } = require('../db.js')

// Parse environment variables
dotenv.config()

const uploads_directory_path = config.uploads_directory_path

function parse_form(req) {
  return new Promise ( (resolve, reject) => {

    const content_type = req.headers['content-type']
    if(!content_type.includes('multipart/form-data')) {
      reject({code: 400, message: 'Content-type must bne multipart/form-data'})
    }

    const form = new formidable.IncomingForm()

    form.parse(req, (error, fields, files) => {
      if (error) return reject(error)
      resolve({ fields, files })
    })

  })
}

function move_file(original_path, destination_path){
   return new Promise ( (resolve, reject) => {

     const options = {mkdirp: true}

     mv(original_path, destination_path, options, (error) => {
       if (error) return reject(error)
       resolve()
     })
   })
}

function delete_file(file_path){
  return new Promise((resolve, reject) => {
    rimraf(file_path, (error) => {
      if(error) return reject(error)
      resolve()
    })
  })
}



function error_handling(res, error) {
  let status_code = error.code || 500
  if(status_code === 11000) status_code = 500
  const message = error.message || error
  console.log(message)
  if(!res._headerSent) res.status(status_code).send(message)
}

function get_collection_from_request(req){
    const collection = req.params.collection
    if(!collection) throw {code: 400, message: 'Collection not specified'}
    return collection
}

function get_id_from_request(req){
    let image_id = req.params.image_id

    if(!image_id) throw {code: 400, message: 'ID not specified'}


    try { image_id = ObjectID(image_id) }
    //catch (e) { throw {code: 400, message: 'Invalid ID'} }
    catch (e) {
      console.log('Invalid ID')
    }

    return image_id
}


function parse_db_query_parameters(req) {

    const limit = Number(req.query.limit
      || req.query.batch_size
      || req.query.count
      || 0
    )

    const skip = Number(
      req.query.start_index
        || req.query.index
        || req.query.skip
        || 0
    )

    let sort = {time: -1}
    if(req.query.sort) {
      try {
        sort = JSON.parse(req.query.sort)
      } catch (e) {
        throw {code: 400, message: 'Malformed sorting'}
      }
    }

    let filter = {}
    if(req.query.filter) {
      try {
        filter = JSON.parse(req.query.filter)
      } catch (e) {
        throw {code: 400, message: 'Malformed filter'}
      }
    }

    // Convert time filter to date {FLIMSY}
    if(filter.time) {
      for (let key in filter.time) {
        filter.time[key] = new Date(filter.time[key])
      }
    }

    return {sort, filter, limit, skip}
}

function parse_json_properties(fields){
  // JSON properties can be named as folows
  let properties = {}

  const json_field = fields.json
    || fields.json_properties
    || fields.properties_json

  // if no json field, ignore
  if(!json_field) return

  try {
    let properties = JSON.parse(json_field)
    // Deal with ID and Time properties
    if (properties._id) properties._id = ObjectID(properties._id)
    if (properties.time) properties.time = new Date(properties.time)

    return properties
  } catch (e) {
    throw { code: 400, message: "Field cannot be parsed as JSON" }
  }

}

const create_image_index = (collection) => {

}

exports.image_upload = async (req, res) => {

  try {

    const collection = get_collection_from_request(req)
    const {fields, files} = await parse_form(req)

    // Read the form files
    const original_file = files['image']

    if(!original_file) throw { code: 400, message: "Request does not contain an image" }

    const original_path = original_file.path
    const file_name = original_file.name

    // construct the destination
    // uploads are placed in a folder called "images" and then separated by collection
    const destination_path = path.join(
      uploads_directory_path,
      'images',
      collection,
      file_name)

    await move_file(original_path,destination_path)

    // Base properties are always going to be date and file name
    let new_document = { time: new Date(), image: file_name }

    const json_properties = parse_json_properties(fields)
    if(json_properties) new_document = {...new_document, ...json_properties}
    else new_document = {...new_document, ...fields}

    // Create index so that image becomes unique
    // await getDb()
    //   .collection(collection)
    //   .createIndex({ image: 1 }, { unique: true })

    const insertion_result = await getDb()
      .collection(collection)
      .insertOne(new_document)


    console.log(`[MongoDB] Image ${file_name} inserted in collection ${collection}`)

    const inserted_document = insertion_result.ops[0]

    // Respond to the client
    res.send(inserted_document)

    // Broadcast result with socket.io
    io.sockets.emit('upload', { collection, document: new_document })

  }
  catch (error) { error_handling(res, error) }

}





exports.get_all_images = async (req, res) => {

  try {

    const collection = get_collection_from_request(req)
    const {skip, filter, limit, sort} = parse_db_query_parameters(req)

    const result = await getDb()
    .collection(collection)
    .find(filter)
    .skip(skip)
    .limit(limit)
    .sort(sort)
    .toArray()

    res.send(result)
    console.log(`[MongoDB] Images of ${collection} queried`)
  }
  catch (error) { error_handling(res, error) }

}



exports.get_single_image = async (req, res) => {

  try {
    const collection = get_collection_from_request(req)
    const _id = get_id_from_request(req)

    const query = { $or: [ { _id: _id }, { image: _id} ] }

    const queried_documment = await getDb()
    .collection(collection)
    .findOne(query)

    if(!queried_documment) throw {code: 404, message: 'Document not found'}

    res.send(queried_documment)
    console.log(`[MongoDB] Document ${_id} of collection ${collection} queried`)
  }
  catch (error) { error_handling(res, error) }

}

exports.delete_image = async (req, res) => {

  try {
    const collection = get_collection_from_request(req)
    const _id = get_id_from_request(req)

    const queried_documment = await getDb()
      .collection(collection)
      .findOne({_id})

    const image_path = path.join(
      uploads_directory_path,
      'images',
      collection,
      queried_documment.image)

    await delete_file(image_path)


    const db_deletion_result = await getDb()
      .collection(collection)
      .deleteOne({_id})

    res.send(db_deletion_result)
    console.log(`[MongoDB] Document ${_id} of ${collection} deleted`)
  }
  catch (error) { error_handling(res, error) }

}

exports.patch_image = async (req, res) => {

  try {
    const collection = get_collection_from_request(req)
    const _id = get_id_from_request(req)

    //TODO: Make date an actual date
    delete req.body._id
    const new_image_properties = {$set: req.body}

    const options = {returnOriginal: false}

    const result = await getDb()
      .collection(collection)
      .findOneAndUpdate({_id}, new_image_properties, options)

    res.send(result.value)

    io.sockets.emit('update', { collection, document: result.value })

    console.log(`[MongoDB] Document ${_id} of ${collection} deleted`)
  }
  catch (error) { error_handling(res, error) }

}

exports.replace_image = async (req, res) => {

  try {
    const collection = get_collection_from_request(req)
    const _id = get_id_from_request(req)

    //TODO: Make date an actual date
    delete req.body._id
    const new_image_properties = req.body

    const options = {returnOriginal: false}

    const result = await getDb()
      .collection(collection)
      .replaceOne({_id}, new_image_properties)

    res.send(result.value)

    console.log(`[MongoDB] Document ${_id} of ${collection} deleted`)
  }
  catch (error) { error_handling(res, error) }

}


exports.serve_image_file = async (req,res) => {

  try {
    const collection = get_collection_from_request(req)
    const _id = get_id_from_request(req)

    //TODO: Make date an actual date
    delete req.body._id
    const new_image_properties = req.body

    const options = {returnOriginal: false}

    const result = await getDb()
      .collection(collection)
      .findOne({_id})

    const image_path = path.join(
      uploads_directory_path,
      'images',
      collection,
      result.image)

    res.sendFile(image_path)

    console.log(`[Express] Serving image ${_id} of ${collection}`)
  }
  catch (error) { error_handling(res, error) }


}
