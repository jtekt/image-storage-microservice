const mongodb = require('mongodb')
const del = require('del')
const dotenv = require('dotenv')
const config = require('../config.js')
const path = require('path')

// Parse environment variables
dotenv.config()

const uploads_directory_path = config.uploads_directory_path
const MongoClient = mongodb.MongoClient
const DB_config = config.mongodb

exports.get_collections = (req, res) => {

  MongoClient.connect(DB_config.url,DB_config.options, (err, db) => {
    // Handle DB connection errors
    if (err) {
      console.log(err)
      res.status(500).send(err)
      return
    }

    db.db(DB_config.db)
    .listCollections()
    .toArray( (err, collections) => {
      // Close the connection to the DB
      db.close()

      // Handle errors
      if (err) {
        console.log(err)
        res.status(500).send(err)
        return
      }

      res.send(collections)

      console.log(`[MongoDB] Queried list of collections`)
    })

  })
}

exports.drop_collection = (req, res) => {

  const collection = req.params.collection

  MongoClient.connect(DB_config.url,DB_config.options, (err, db) => {
    // Handle DB connection errors
    if (err) {
      console.log(err)
      res.status(500).send(err)
      return
    }

    db.db(DB_config.db)
    .collection(collection)
    .drop( (err, result) => {
      // Close the connection to the DB
      db.close()

      // Handle errors
      if (err) {
        console.log(err)
        res.status(500).send(err)
        return
      }

      const folder_to_remove = path.join(uploads_directory_path,'images',collection)

      del(folder_to_remove)
      .then(() => {
        console.log(`[MongoDB] Collection ${collection} dropped`)
        res.send(`Collection ${collection} dropped`)
      })
      .catch(() => {
        console.log(`Failed to delete folder ${folder_to_remove}`)
        res.status(500).send(`Failed to delete folder ${folder_to_remove}`)
      })





    })
  })
}
