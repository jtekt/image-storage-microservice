const express = require('express')
const path = require('path')
const cors = require('cors')
const dotenv = require('dotenv')
const {version, author} = require('./package.json')
const {uploads_directory_path} = require('./config.js')
const db = require('./db.js')
const collections_router = require('./routes/collections.js')
const auth = require('@moreillon/express_identification_middleware')

console.log(`Image storage service v${version}`)

// Parse environment variables
dotenv.config()

// Setting the timezone default
process.env.TZ = process.env.TZ || 'Asia/Tokyo'

// Instanciate objects
const app = express()

// Authentication if necessary
const auth_options = {
  lax: !process.env.USE_AUTHENTICATION,
  url: process.env.IDENTIFICATION_URL,
}

// provide express with the ability to read json request bodies
app.use(express.json())

// Authorize requests from different origins
app.use(cors())

// Home route
app.get('/', (req, res) => {
  res.send({
    application_name: 'Image storage microservice',
    version,
    author,
    mongodb: {
      url: db.url,
      db: db.name,
      initially_connected: !!db.getDb(),
    },
    auth: auth_options,
    uploads_directory_path,

  })
})

const middleware = process.env.USE_AUTHENTICATION ? auth(auth_options) : (res, req, next) => {next()}
app.use('/collections', middleware, collections_router)

const APP_PORT = process.env.APP_PORT || 80

app.listen(APP_PORT, () => {
  console.log(`[Express] Server listening on port ${APP_PORT}`)
})

exports.app = app
