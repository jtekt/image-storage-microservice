const express = require('express')
const axios = require('axios')
const path = require('path')
const bodyParser = require('body-parser')
const cors = require('cors')
const formidable = require('formidable')

// Todo: set port using dotenv
const port = 8435


// uploads directory in deployment
const uploads_directory_path = path.join("/usr/share/pv", 'uploads')

// Express config
const app = express()
app.use(bodyParser.json({limit: '50mb', extended: true}))
app.use(express.static(uploads_directory_path))
app.use(cors())

app.get('/', (req, res) => {
  res.send('Storage microservice')
})


app.post('/image_upload', (req, res) => {

  var form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {

    // Handle form parsing errors
    if (err) return res.status(400).send('Error parsing form');

    // Handle missing image
    if(!('image' in files)) return res.status(503)

    let original_file = files.image
    var original_path = original_file.path
    let original_file_name = original_file.name

    let destination_path = path.join(uploads_directory_path, original_file_name)


    mv(original_path, destination_path, {mkdirp: true}, (err) => {
      if (err) return res.status(500).send('Error moving file')

      // Todo: DB communication

      // respond to the request
      res.send("OK")


    })


  })
})


app.listen(port, () => {
  console.log(`Storage microservice running on port ${port}`)
})
