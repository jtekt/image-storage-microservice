const mongodb = require('mongodb')
const mv = require('mv')
const formidable = require('formidable')
const path = require('path')
const dotenv = require('dotenv')
const config = require('../config.js')

// Parse environment variables
dotenv.config()

const uploads_directory_path = config.uploads_directory_path

const MongoClient = mongodb.MongoClient
const ObjectID = mongodb.ObjectID
const DB_config = config.mongodb


exports.image_upload = (req, res) => {

  // retrieve collection name from query
  const collection = req.params.collection

  // using formidable to parse the content of the multipart/form-data
  let form = new formidable.IncomingForm()

  // Async used so as to use await inside
  form.parse(req, (err, fields, files) => {

    // Handle form parsing errors
    if (err) {
      console.log(err)
      res.status(500).send('Error parsing form')
      return
    }

    // Input sanitation (check if request contains at least one file)
    if(!Object.keys(files).length) {
      console.log("Request does not contain any file")
      res.status(400).send(`Request does not contain any file`)
      return
    }

    // Read the form files
    let original_file = files['image']

    if(!original_file) {
      console.log("Request does not contain an image")
      res.status(400).send(`Request does not contain an image`)
      return
    }

    const original_path = original_file.path
    const file_name = original_file.name

    // construct the destination
    // uploads are placed in a folder called "images" and then separated by collection
    const destination_path = path.join(
      uploads_directory_path,
      'images',
      collection,
      file_name)

    // Move file in appropriate folder
    mv(original_path, destination_path, {mkdirp: true}, (err) => {

      // Handling errors while moving file
      if (err) {
        console.log(err)
        return res.status(500).send('Error moving file')
      }


      MongoClient.connect(DB_config.url,DB_config.options, (err, db) => {

        // Handle DB connection errors
        if (err) {
          console.log(err)
          res.status(500).send(err)
          return
        }

        // Basic document consists of a timestamp and the image nam
        // Note: Both can be overwritten with properties provided in the body
        let new_document = {
          time: new Date(),
          image: file_name,
        }

        // Check if proerties passed as JSON
        let json_properties = fields.json
          || fields.json_properties
          || fields.proerties_json

        if (json_properties) {
          console.log(`Found JSON properties in fields`)
          try {
            // Add parsed properties using spread operator
            let parsed_properties = JSON.parse(json_properties)

            // Deal with ID
            if (parsed_properties._id) {
              parsed_properties._id = ObjectID(parsed_properties._id)
            }

            new_document = {...new_document, ...parsed_properties}
          } catch (e) {
            console.log(`Cannot parse supposedly JSON properties`)
            res.status(400).send(`Could not parse JSON`)
            return
          }
        }
        else {
          //otherwise just insert properties as is
          // Using spread operator
          new_document = {...new_document, ...fields}
        }


        // Insert into the DB
        db.db(DB_config.db)
        .collection(collection)
        .insertOne(new_document, (err, result) => {

          // Important: close connection to DB
          db.close()

          // DB insertion error handling
          if (err) {
            console.log(err)
            res.status(500).send(err)
            return
          }

          console.log(`[MongoDB] Image ${file_name} inserted in collection ${collection}`)

          // Respond to the client
          res.send(result)

          // Broadcast result with socket.io
          io.sockets.emit('upload', {
            collection: collection,
            document: new_document
          })

        })
      })
    })
  })
}

exports.get_all_images = (req, res) => {

  MongoClient.connect(DB_config.url,DB_config.options, (err, db) => {
    // Handle DB connection errors
    if (err) {
      console.log(err)
      res.status(500).send(err)
      return
    }

    const limit = req.query.limit || 0
    const filter = req.query.filter || {}
    const collection = req.params.collection

    db.db(DB_config.db)
    .collection(collection)
    .find(filter)
    .sort({time: -1}) // sort by timestamp
    .limit(limit)
    .toArray( (err, result) => {

      // Close the connection to the DB
      db.close()

      // Handle errors
      if (err) {
        console.log(err)
        res.status(500).send(err)
        return
      }

      res.send(result)

      console.log(`[MongoDB] Images of ${collection} queried`)
    })
  })
}



exports.get_single_image = (req, res) => {

  let image_id = req.params.image_id
    || req.query.image_id
    || req.query.id

  if(!image_id) return res.status(400).send(`ID not specified`)

  let query = undefined
  try {
    query = { _id: ObjectID(image_id)}
  }
  catch (e) {
    console.log('Invalid ID requested')
    res.status(400).send('Invalid ID')
    return
  }

  MongoClient.connect(DB_config.url,DB_config.options, (err, db) => {
    // Handle DB connection errors
    if (err) {
      console.log(err)
      res.status(500).send(err)
      return
    }

    db.db(DB_config.db)
    .collection(req.params.collection)
    .findOne(query,(err, result) => {

      // Close the connection to the DB
      db.close()

      if (err) {
        console.log(err)
        res.status(500).send(err)
        return
      }
      res.send(result)

    })
  })
}

exports.delete_image = (req, res) => {

  let image_id = req.params.image_id
    || req.query.image_id
    || req.query.id

  if(!image_id) return res.status(400).send(`ID not specified`)

  let query = undefined
  try {
    query = { _id: ObjectID(image_id)}
  }
  catch (e) {
    console.log('Invalid ID requested')
    res.status(400).send('Invalid ID')
    return
  }

  MongoClient.connect(DB_config.url,DB_config.options, (err, db) => {
    // Handle DB connection errors
    if (err) {
      console.log(err)
      res.status(500).send(err)
      return
    }

    db.db(DB_config.db)
    .collection(req.params.collection)
    .deleteOne(query,(err, result) => {

      // Close the connection to the DB
      db.close()

      // Handle errors
      if (err) {
        console.log(err)
        res.status(500).send(err)
        return
      }

      console.log(`Image ${image_id} deleted`)
      res.send(result)

    });
  })
}

exports.patch_image = (req, res) => {

  let image_id = req.params.image_id
    || req.query.image_id
    || req.query.id

  if(!image_id) return res.status(400).send(`ID not specified`)

  let query = undefined
  try {
    query = { _id: ObjectID(image_id)}
  }
  catch (e) {
    console.log('Invalid ID requested')
    res.status(400).send('Invalid ID')
    return
  }

  delete req.body._id
  let new_image_properties = {$set: req.body}


  MongoClient.connect(DB_config.url,DB_config.options, (err, db) => {
    // Handle DB connection errors
    if (err) {
      console.log(err)
      res.status(500).send(err)
      return
    }


    db.db(DB_config.db)
    .collection(req.params.collection)
    .updateOne(query, new_image_properties, (err, result) => {

      // Close the connection to the DB
      db.close()

      // Handle errors
      if (err) {
        console.log(err)
        res.status(500).send(err)
        return
      }

      console.log(`Image updated`)
      res.send(result)

    })
  })
}

exports.replace_image = (req, res) => {

  let image_id = req.params.image_id
    || req.query.image_id
    || req.query.id

  if(!image_id) return res.status(400).send(`ID not specified`)

  let query = undefined
  try {
    query = { _id: ObjectID(image_id)}
  }
  catch (e) {
    console.log('Invalid ID requested')
    res.status(400).send('Invalid ID')
    return
  }

  delete req.body._id

  let new_image_properties = req.body


  MongoClient.connect(DB_config.url,DB_config.options, (err, db) => {
    // Handle DB connection errors
    if (err) {
      console.log(err)
      res.status(500).send(err)
      return
    }


    db.db(DB_config.db)
    .collection(req.params.collection)
    .replaceOne(query, new_image_properties, (err, result) => {

      // Close the connection to the DB
      db.close()

      // Handle errors
      if (err) {
        console.log(err)
        res.status(500).send(err)
        return
      }

      console.log(`Image replaced`)
      res.send(result)

    });
  })
}
