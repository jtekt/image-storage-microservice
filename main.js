const express = require('express')
const axios = require('axios')
const path = require('path')
const bodyParser = require('body-parser')
const cors = require('cors')
const formidable = require('formidable')
const mongodb = require('mongodb')
const mv = require('mv')

process.env.TZ = 'Asia/Tokyo'

// Todo: set port using dotenv
const port = 8435

// uploads directory in deployment
//const uploads_directory_path = "/usr/share/pv"
const uploads_directory_path = path.join(__dirname, 'uploads')

// Helper objects for mongodb
const MongoClient = mongodb.MongoClient;
const ObjectID = mongodb.ObjectID;

const DB_config = {
  url: 'mongodb://172.16.98.151:27017/',
  db: 'tokushima_bearings',
  collection: 'test',
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
}


// Express config
const app = express()

// provide express the ability to read json request bodies
app.use(bodyParser.json())

// serve static content from uploads directory
app.use(express.static(uploads_directory_path))

// Authorize requests from different origins
app.use(cors())

app.get('/', (req, res) => {
  // Home route
  res.send('Storage microservice v1.0.2')
})



app.post('/image_upload', (req, res) => {

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


    // Using promises so as to create DB record only when all files have been saved successfully
    let promises = []

    // go through all the files of the request
    for (var key in files) {

      let image_type = key
      let original_file = files[key]
      let original_path = original_file.path
      let file_name = original_file.name

      let destination_path = path.join(uploads_directory_path, file_name)

      // using promises for asynchronousity
      promises.push( new Promise ((resolve, reject) => {
        mv(original_path, destination_path, {mkdirp: true}, (err) => {
          if (err) return res.status(500).send('Error moving file')
          resolve({
            type: image_type,
            file_name: file_name,
          })
        })
      }))
    }

    // Once all promises have been resolved, i.e. all files have been stored
    Promise.all(promises)
    .then( images => {

      MongoClient.connect(DB_config.url,DB_config.options, (err, db) => {
        // Handle DB connection errors
        if (err) {
          console.log(err)
          res.status(500).send(err)
          return
        }

        let new_document = {
          time: new Date(),
        }

        // Add AI result to the new_document
        if(fields.AI_prediction){
          new_document.AI = {
            pediction: fields.AI_prediction
          }
        }

        // Add images to the new_document
        images.forEach( image => {
          new_document[image.type] = image.file_name
        })

        // Insert into the DB
        db.db(DB_config.db)
        .collection(DB_config.collection)
        .insertOne(new_document, (err, result) => {

          if (err) {
            console.log(err)
            res.status(500).send(err)
            return
          }

          console.log("Document inserted");
          db.close()

          res.send("OK")
        })
      })

    })
  })
})

app.post('/debug', (req, res) => {
  // Debugging route
  console.log(req.body.message)
  res.send('OK')
})


app.get('/all', (req, res) => {
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
})

app.get('/drop', (req, res) => {
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
    });
  })
})

app.get('/image_info', (req, res) => {
  if(!('id' in req.query)) return res.status(400).send(`ID not specified`)
  res.status(501) // not implemented
})

app.listen(port, () => {
  console.log(`Storage microservice running on port ${port}`)
})
