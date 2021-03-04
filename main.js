const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')
const http = require('http')
const socketio = require('socket.io')
const pjson = require('./package.json')
const config = require('./config.js')

console.log(`Image storage service v${pjson.version}`)

// Parse environment variables
dotenv.config()

// Instanciate objects
const app = express()
const http_server = http.Server(app)
const io = socketio(http_server)

// Make the websocket library available to the whole app
global.io = io

// provide express with the ability to read json request bodies
app.use(bodyParser.json())

// serve static content from uploads directory
// NOTE: No longer needed since serving images from controller now
// Could use  app.use('/images', express.static(config.uploads_directory_path))
app.use(express.static(config.uploads_directory_path))


// Authorize requests from different origins
app.use(cors())

// Home route
app.get('/', (req, res) => {
  res.send({
    application_name: 'Image storage API',
    version: pjson.version,
    author: pjson.author,
    mongodb_url: config.mongodb.url,
    mongodb_db: config.mongodb.db,
  })
})

app.use('/collections', require('./routes/collections.js'))

/*
app.route('/collections')
  .get(collections_controller.get_collections) // OK

app.route('/collections/:collection')
  .post(images_controller.image_upload) // OK
  .get(images_controller.get_all_images) // OK
  .delete(collections_controller.drop_collection) // OK

app.route('/collections/:collection/count')
  .get(collections_controller.get_collection_count) // OK

app.route('/collections/:collection/export')
  .get(collections_controller.export_collection_zip) // OK

app.route('/collections/:collection/:image_id')
  .get(images_controller.get_single_image) // OK
  .delete(images_controller.delete_image) // OK
  .put(images_controller.replace_image) // OK
  .patch(images_controller.patch_image) // OK
*/

http_server.listen(config.app_port, () => {
  console.log(`[Express] Server listening on port ${config.app_port}`)
})

// Handle Websockets
io.sockets.on('connection', (socket) => {
  // Deals with Websocket connections
  console.log('[WS] User connected')

  socket.on('disconnect', () => {
    console.log('[WS] user disconnected');
  })

})
