const mongodb = require('mongodb')
const mv = require('mv')
const formidable = require('formidable')
const path = require('path')

const io = require('../servers.js').io

const uploads_directory_path = require('../config.js').uploads_directory_path

const MongoClient = mongodb.MongoClient;
const ObjectID = mongodb.ObjectID;

const DB_config = {
  url: 'mongodb://172.16.98.151:27017/',
  db: 'tokushima_bearings',
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
  collection: 'test',
}


exports.image_upload = (req, res) => {

  // using formidable to parse the content of the multipart/form-data
  var form = new formidable.IncomingForm()

  // Async used so as to use await inside
  form.parse(req, async (err, fields, files) => {

    // Handle form parsing errors
    if (err) {
      console.log(err)
      res.status(400).send('Error parsing form')
      return
    }

    // Input sanitation (check if request contains at least one file)
    if(!Object.keys(files).length) {
      console.log("Request does not contain any file")
      return res.status(503).send(`Request does not contain any file`)
    }

    let image_key = 'image'
    let original_file = files[image_key]
    let original_path = original_file.path
    let file_name = original_file.name

    let destination_path = path.join(uploads_directory_path, file_name)

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

        let new_document = {
          time: new Date(),
          image_id: fields.image_id,
          image: file_name,
        }

        // if an AI prediction is available, save it
        if(('AI_prediction') in fields) {
          new_document.AI = {
            prediction: fields.AI_prediction,
            version: fields.AI_version,
            inference_time: fields.AI_inference_time,
          }
        }

        // Insert into the DB
        db.db(DB_config.db)
        .collection(DB_config.collection)
        .insertOne(new_document, (err, result) => {

          // DB insertion error handling
          if (err) {
            console.log(err)
            res.status(500).send(err)
            return
          }

          console.log("Document inserted");

          // Important: close connection to DB
          db.close()

          // Respond to the client
          res.send("OK")

          // Emit result with socket.io
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

    db.db(DB_config.db)
    .collection(DB_config.collection)
    .find({})
    .sort({time: -1})
    .limit(100)
    .toArray( (err, result) => {

      if (err) {
        console.log(err)
        res.status(500).send(err)
        return
      }

      db.close()

      res.send(result)
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
    .collection(DB_config.collection)
    .drop( (err, delOK) => {
      if (err) {
        console.log(err)
        res.status(500).send(err)
        return
      }
      if (delOK) res.send('Collection deleted')
      db.close();
    })
  })
}

exports.get_single_image = (req, res) => {

  let image_id = req.params.image_id
    || req.query.image_id
    || req.query.id

  if(!image_id) return res.status(400).send(`ID not specified`)

  if(!('collection' in req.query)) return res.status(400).send('Collection not defined')

  MongoClient.connect(DB_config.url,DB_config.options, (err, db) => {
    // Handle DB connection errors
    if (err) {
      console.log(err)
      res.status(500).send(err)
      return
    }

    let query = { _id: ObjectID(image_id)};

    db.db(DB_config.db)
    .collection(req.query.collection)
    .findOne(query,(err, result) => {
      if (err) {
        console.log(err)
        res.status(500).send(err)
        return
      }
      res.send(result)
      db.close();
    });
  })
}

exports.delete_image = (req, res) => {

  let image_id = req.params.image_id
    || req.query.image_id
    || req.query.id

  if(!image_id) return res.status(400).send(`ID not specified`)

  if(!('collection' in req.query)) return res.status(400).send('Collection not defined')

  MongoClient.connect(DB_config.url,DB_config.options, (err, db) => {
    // Handle DB connection errors
    if (err) {
      console.log(err)
      res.status(500).send(err)
      return
    }

    let query = { _id: ObjectID(image_id)};

    db.db(DB_config.db)
    .collection(req.query.collection)
    .deleteOne(query,(err, result) => {
      if (err) {
        console.log(err)
        res.status(500).send(err)
        return
      }
      res.send(result)
      db.close();
    });
  })
}
