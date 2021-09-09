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
const collections_router = require('./routes/collections.js')
const auth = require('@moreillon/express_identification_middleware')

console.log(`Image storage service v${pjson.version}`)

// Parse environment variables
dotenv.config()

// Setting the timezone default
process.env.TZ = process.env.TZ || 'Asia/Tokyo'

// Instanciate objects
const app = express()
const http_server = http.Server(app)
const io = socketio(http_server)

// Make the websocket library available to the whole app
global.io = io

// Authentication if necessary
const auth_options = {
  lax: !process.env.USE_AUTHENTICATION,
  url: process.env.IDENTIFICATION_URL,
}

// provide express with the ability to read json request bodies
app.use(bodyParser.json())

// Authorize requests from different origins
app.use(cors())

// Home route
app.get('/', (req, res) => {
  res.send({
    application_name: 'Image storage API',
    version: pjson.version,
    author: pjson.author,
    mongodb: {
      url: db.url,
      db: db.name,
      initially_connected: !!db.getDb(),
    },
    auth: auth_options,
  })
})


app.use('/collections', auth(auth_options), collections_router)

const APP_PORT = process.env.APP_PORT || 80

http_server.listen(APP_PORT, () => {
  console.log(`[Express] Server listening on port ${APP_PORT}`)
})

// Handle Websockets
io.sockets.on('connection', (socket) => {
  // Deals with Websocket connections
  console.log('[WS] User connected')

  socket.on('disconnect', () => {
    console.log('[WS] user disconnected');
  })

})
