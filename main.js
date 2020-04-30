const express = require('express')
const axios = require('axios')
const path = require('path')
const bodyParser = require('body-parser')
const cors = require('cors')
const formidable = require('formidable')
const mongodb = require('mongodb')
const mv = require('mv')

// Todo: set port using dotenv
const port = 8435

// uploads directory in deployment
//const uploads_directory_path = path.join("/usr/share/pv", 'uploads')
const uploads_directory_path = path.join(__dirname, 'uploads')

// Helper objects for mongodb
const MongoClient = mongodb.MongoClient;
const ObjectID = mongodb.ObjectID;


// Express config
const app = express()

// provide express the ability to read json request bodies
app.use(bodyParser.json({limit: '50mb', extended: true}))

// serve static content from uploads directory
app.use(express.static(uploads_directory_path))

// Authorize requests from different origins
app.use(cors())

app.get('/', (req, res) => {
  res.send('Storage microservice')
})

app.post('/notification', (req, res) => {
  // Debugging route
  console.log(req.body.message)
  res.send('OK')
})


app.post('/image_upload', (req, res) => {

  // using formidable to parse the content of the multipart/form-data
  var form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {

    // Handle form parsing errors
    if (err) return res.status(400).send('Error parsing form')

    // Input sanitation (check if vody contains everything needed)
    if(!('image_0' in files)) return res.status(503)
    if(!('image_1' in files)) return res.status(503)
    if(!('prediction' in fields)) return res.status(503)


    let promises = []

    // need an wait here
    for (var key in files) {

      let original_file = files[key]
      let original_path = original_file.path
      let original_file_name = original_file.name

      let destination_path = path.join(uploads_directory_path, original_file_name)

      // using promises for asynchronousity
      promises.push( new Promise ((resolve, reject) => {
        mv(original_path, destination_path, {mkdirp: true}, (err) => {
          if (err) return res.status(500).send('Error moving file')
          resolve(destination_path)
        })
      }))
    }

    // Once all promises have been resolved
    Promise.all(promises).then((paths) => {

      let record = {
        image_front: paths[0],
        image_top: paths[1],
        ai_prediction: fields.prediction,
      }

      console.log(record)

      // DB insertion here
      res.send("OK")
    });



  })
})

app.get('/all', (req, res) => {
  res.status(501) // not implemented
})

app.get('/image_info', (req, res) => {
  if(!('id' in req.query)) return res.status(400).send(`ID not specified`)
  res.status(501) // not implemented
})

app.listen(port, () => {
  console.log(`Storage microservice running on port ${port}`)
})
