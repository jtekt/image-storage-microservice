const createError = require('http-errors')
const formidable = require('formidable')
const path = require('path')
const dotenv = require('dotenv')
const { uploads_directory_path } = require('../config.js')
const { ObjectID } = require('mongodb')
const { getDb } = require('../db.js')
const {
  delete_file,
  move_file,
} = require('../utils.js')

dotenv.config()

const parse_form = (req) => new Promise ( (resolve, reject) => {

  const content_type = req.headers['content-type']

  if(!content_type?.includes('multipart/form-data')) {
    reject(createError(400,'Content-type must bne multipart/form-data'))
  }

  const form = new formidable.IncomingForm()

  form.parse(req, (error, fields, files) => {
    if (error) return reject(error)
    resolve({ fields, files })
  })

})



function get_collection_from_request(req){
    const {collection} = req.params
    if(!collection) throw createError(400,'Collection not specified')
    return collection
}

function get_id_from_request(req){

    let {image_id} = req.params

    if(!image_id) throw createError(400,'Missigng ID')


    try {
      image_id = ObjectID(image_id)
    }
    catch (e) {
      throw createError(400,'Invalid ID')
    }

    return image_id
}


function parse_db_query_parameters(req) {

    const limit = Number(req.query.limit
      || req.query.batch_size
      || req.query.count
      || 500
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
      }
      catch (e) {
        throw createError(400,'Malformed sorting')
      }
    }

    let filter = {}
    if(req.query.filter) {
      try {
        filter = JSON.parse(req.query.filter)
      }
      catch (e) {
        throw createError(400,'Malformed filter')
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
  }
  catch (e) {
    throw createError(400,'Field cannot be parsed as JSON')
  }

}

exports.image_upload = async (req, res, next) => {

  try {

    const collection = get_collection_from_request(req)
    const {fields, files} = await parse_form(req)

    // Read the form files
    const original_file = files['image']

    if(!original_file) throw createError(400, 'Request does not contain an image')

    const original_path = original_file.path
    const file_name = original_file.name

    // construct the destination
    // uploads are placed in a folder called "images" and then separated by collection
    const destination_path = path.join(
      uploads_directory_path,
      'images',
      collection,
      file_name
    )

    await move_file(original_path,destination_path)

    // Base properties are always going to be date and file name
    const base_properties = { time: new Date(), image: file_name }

    // Use JSON properties or fields if no JSON properties
    const json_properties = parse_json_properties(fields)
    const user_defined_properties = json_properties || fields

    if (user_defined_properties._id) throw createError(400, '_id cannot be user-defined')
    if (user_defined_properties.time) throw createError(400, 'time cannot be user-defined')

    // Add user defined properties to the base properties
    const new_document = { ...base_properties, ...user_defined_properties }


    const insertion_result = await getDb()
      .collection(collection)
      .insertOne(new_document)

    const inserted_document = insertion_result.ops[0]

    console.log(`[MongoDB] Image ${file_name} inserted in collection ${collection}`)

    res.send(inserted_document)

  }
  catch (error) {
    next(error)
  }

}





exports.get_all_images = async (req, res, next) => {

  try {

    // Note: document count is provided by GET /collections/:collection

    const collection = get_collection_from_request(req)
    const {skip, filter, limit, sort} = parse_db_query_parameters(req)

    const result = await getDb()
      .collection(collection)
      .find(filter)
      .skip(skip)
      .limit(limit)
      .sort(sort)
      .toArray()

    console.log(`[MongoDB] Images of ${collection} queried`)
    res.send(result)
  }
  catch (error) {
    next(error)
  }
}



exports.get_single_image = async (req, res, next) => {

  try {
    const collection = get_collection_from_request(req)
    const _id = get_id_from_request(req)

    const queried_documment = await getDb()
      .collection(collection)
      .findOne({ _id })

    if(!queried_documment) throw createError(404, 'Document not found')

    console.log(`[MongoDB] Document ${_id} of collection ${collection} queried`)
    res.send(queried_documment)
  }
  catch (error) {
    next(error)
  }
}

exports.delete_image = async (req, res, next) => {

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
  catch (error) {
    next(error)
  }
}

exports.patch_image = async (req, res, next) => {

  try {
    const collection = get_collection_from_request(req)
    const _id = get_id_from_request(req)

    const new_properties = req.body

    // Prevent edition of time and _id
    delete new_properties.time
    delete new_properties._id

    const action = { $set: new_properties }
    const options = { returnOriginal: false }

    const result = await getDb()
      .collection(collection)
      .findOneAndUpdate({_id}, action, options)

    res.send(result.value)

    console.log(`[MongoDB] Document ${_id} of ${collection} deleted`)
  }
  catch (error) {
    next(error)
  }
}


exports.serve_image_file = async (req, res, next) => {

  try {

    const collection = get_collection_from_request(req)
    const _id = get_id_from_request(req)

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
  catch (error) {
    next(error)
  }


}
