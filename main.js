const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')
const cors = require('cors')
const http = require('http')
const socketio = require('socket.io')
const dotenv = require('dotenv')
const pjson = require('./package.json')

// Parse environment variables
dotenv.config()


// Setting timezone
process.env.TZ = 'Asia/Tokyo'

// Application port, defaults to 80
const port = process.env.APP_PORT || 80

// Servers
const app = express()
const http_server = http.Server(app)
const io = socketio(http_server)

// Make socket io available to other files
exports.io = io

// provide express with the ability to read json request bodies
app.use(bodyParser.json())

// serve static content from uploads directory
app.use(express.static(require('./config.js').uploads_directory_path))

// Authorize requests from different origins
app.use(cors())

// Home route
app.get('/', (req, res) => {
  res.send({
    application_name: pjson.name,
    version: pjson.version,
    author: pjson.author,
    mongodb_url: process.env.MONGODB_URL,
  })
})

const images_controller = require('./controllers/images.js')


app.route('/images')
  .post(images_controller.image_upload)
  .get(images_controller.get_all_images)
  .delete(images_controller.drop_collection)

app.route('/images/:image_id')
  .get(images_controller.get_single_image)
  .delete(images_controller.delete_image)
  // TODO: PUT

// Start the web server
http_server.listen(port, () => {
  console.log(`[Express] Storage microservice running on port ${port}`)
})

// Handle Websockets
io.sockets.on('connection', (socket) => {
  // Deals with Websocket connections
  console.log('[WS] User connected')

  socket.on('disconnect', () => {
    console.log('[WS] user disconnected');
  })

})
