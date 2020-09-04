const mongodb = require('mongodb')
const dotenv = require('dotenv')

// Parse environment variables
dotenv.config()

const config = require('../config.js')

const MongoClient = mongodb.MongoClient
const ObjectID = mongodb.ObjectID
const DB_config = config.db

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
    })

  })
}

exports.drop_collection = (req, res) => {

  MongoClient.connect(DB_config.url,DB_config.options, (err, db) => {
    // Handle DB connection errors
    if (err) {
      console.log(err)
      res.status(500).send(err)
      return
    }

    db.db(DB_config.db)
    .collection(req.params.collection)
    .drop( (err, delOK) => {
      // Close the connection to the DB
      db.close()

      // Handle errors
      if (err) {
        console.log(err)
        res.status(500).send(err)
        return
      }
      
      if (delOK) {
        console.log(`Collection ${req.params.collection} dropped`)
        res.send(`Collection ${req.params.collection} dropped`)
      }

    })
  })
}
