const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')
const cors = require('cors')
const http = require('http')
const socketio = require('socket.io')

// Setting timezone
process.env.TZ = 'Asia/Tokyo'

// Todo: set port using dotenv
const port = 8435

// Servers
const app = express()
const http_server = http.Server(app)
const io = socketio(http_server)

// Make socket io available to other files
exports.io = io

const images_controller = require('./controllers/images.js')

const uploads_directory_path = require('./config.js').uploads_directory_path


// provide express with the ability to read json request bodies
app.use(bodyParser.json())

// serve static content from uploads directory
app.use(express.static(uploads_directory_path))

// Authorize requests from different origins
app.use(cors())

// Home route
app.get('/', (req, res) => {
  res.send('Storage microservice API')
})

app.route('/images')
  .post(images_controller.image_upload)
  .get(images_controller.get_all_images)
  .delete(images_controller.drop_collection)

app.route('/images/:image_id')
  .get(images_controller.get_single_image)
  .delete(images_controller.delete_image)

// Start the web server
http_server.listen(port, () => {
  console.log(`[HTTP] Storage microservice running on port ${port}`)
})

// Handle WS
io.sockets.on('connection', (socket) => {
  // Deals with Websocket connections
  console.log('[WS] User connected')

  socket.on('disconnect', () => {
    console.log('[WS] user disconnected');
  })

})
