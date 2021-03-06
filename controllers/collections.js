const createError = require('http-errors')
const rimraf = require('rimraf')
const dotenv = require('dotenv')
const path = require('path')
const { ObjectID } = require('mongodb')
const { uploads_directory_path } = require('../config.js')
const { getDb } = require('../db.js')


// Parse environment variables
dotenv.config()


const delete_images_folder = (folder_to_remove) => new Promise((resolve, reject) => {
  rimraf(folder_to_remove, (error) => {
    if(error) return reject(error)
    resolve()
  })
})


const get_collection_from_request = (req) => {
  const {collection} = req.params
  if(!collection) throw createError(400, 'Collection not specified')
  return collection
}

exports.get_collections = async (req, res, next) => {

  // Todo: respond with more info than just name

  try {
    const collections = await getDb()
      .listCollections()
      .toArray()

    console.log(`[MongoDB] Queried list of collections`)
    res.send(collections.map(collection => collection.name ))
  }
  catch (error) {
    next(error)
  }
}

exports.get_collection_info = async (req, res, next) => {

  try {
    const collection = get_collection_from_request(req)

    const document_count = await getDb()
      .collection(collection)
      .countDocuments()

      console.log(`[MongoDB] Queried info for collection ${collection}`)
      res.send({ name: collection, documents: document_count })
  }
  catch (error) {
    next(error)
  }
}



exports.drop_collection = async (req, res, next) => {

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
  catch (error) {
    next(error)
  }
}
