const mongodb = require('mongodb')
const mv = require('mv')
const formidable = require('formidable')
const path = require('path')
const dotenv = require('dotenv')

// Parse environment variables
dotenv.config()

const io = require('../main').io

const config = require('../config.js')
const uploads_directory_path = config.uploads_directory_path

const MongoClient = mongodb.MongoClient
const ObjectID = mongodb.ObjectID
const DB_config = config.db



exports.image_upload = (req, res) => {

  // using formidable to parse the content of the multipart/form-data
  // TODO: use multer
  let form = new formidable.IncomingForm()

  // Async used so as to use await inside
  form.parse(req, async (err, fields, files) => {

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

    let original_path = original_file.path
    let file_name = original_file.name

    // construct the destination
    // uploads are placed in a folder called "images" and then separated by collection
    let destination_path = path.join(
      uploads_directory_path,
      'images',
      req.params.collection,
      file_name)

    // using promises for asynchronousity
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
        let new_document = {
          time: new Date(),
          image: file_name,
        }

        // Add properties if passed via the POST request
        for (var key in fields) {
          new_document[key] = fields[key]
        }

        // Insert into the DB
        db.db(DB_config.db)
        .collection(req.params.collection)
        .insertOne(new_document, (err, result) => {

          // Important: close connection to DB
          db.close()

          // DB insertion error handling
          if (err) {
            console.log(err)
            res.status(500).send(err)
            return
          }

          console.log(`[MongoDB] Image ${file_name} inserted in collection ${req.params.collection}`)

          // Respond to the client
          res.send("OK")

          // Broadcast result with socket.io
          io.sockets.emit(fields.image_type, new_document)

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

    let limit = req.query.limit || 0

    db.db(DB_config.db)
    .collection(req.params.collection)
    .find({})
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
  } catch (e) {
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

  MongoClient.connect(DB_config.url,DB_config.options, (err, db) => {
    // Handle DB connection errors
    if (err) {
      console.log(err)
      res.status(500).send(err)
      return
    }

    let query = { _id: ObjectID(image_id)};

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
      res.send(result)

    });
  })
}
