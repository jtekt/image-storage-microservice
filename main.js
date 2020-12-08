const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')
const http = require('http')
const socketio = require('socket.io')

const pjson = require('./package.json')

const config = require('./config.js')
const images_controller = require('./controllers/images.js')
const collections_controller = require('./controllers/collections.js')

// Parse environment variables
dotenv.config()

// Instanciate objects
const app = express()
const http_server = http.Server(app)
const io = socketio(http_server)

global.io = io

// provide express with the ability to read json request bodies
app.use(bodyParser.json())

// serve static content from uploads directory
app.use(express.static(config.uploads_directory_path))
// Could use  app.use('/images', express.static(config.uploads_directory_path))
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

app.route('/collections')
  .get(collections_controller.get_collections)

app.route('/collections/:collection')
  .post(images_controller.image_upload)
  .get(images_controller.get_all_images)
  .delete(collections_controller.drop_collection)

app.route('/collections/:collection/:image_id')
  .get(images_controller.get_single_image)
  .delete(images_controller.delete_image)
  .put(images_controller.replace_image)
  .patch(images_controller.patch_image)

http_server.listen(config.app_port, () => {
  console.log(`[HTTP] Server listening on port ${config.app_port}`)
})

// Handle Websockets
io.sockets.on('connection', (socket) => {
  // Deals with Websocket connections
  console.log('[WS] User connected')

  socket.on('disconnect', () => {
    console.log('[WS] user disconnected');
  })

})
