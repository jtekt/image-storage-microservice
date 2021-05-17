const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')
const http = require('http')
const socketio = require('socket.io')
const pjson = require('./package.json')
const config = require('./config.js')
const db = require('./db.js')

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
    mongodb_url: db.url,
    mongodb_db: db.url,
  })
})

app.use('/collections', require('./routes/collections.js'))


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
