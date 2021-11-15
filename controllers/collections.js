const {ObjectID} = require('mongodb')
const rimraf = require('rimraf')
const dotenv = require('dotenv')
const {uploads_directory_path} = require('../config.js')
const path = require('path')
const { getDb } = require('../db.js')
const { error_handling } = require('../utils.js')


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
  if(!collection) throw {code: 400, message: 'Collection not specified'}
  return collection
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
  catch (error) { error_handling(error, res) }

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
  catch (error) { error_handling(error, res) }

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
  catch (error) { error_handling(error, res) }

}
