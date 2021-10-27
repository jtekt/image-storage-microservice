// NPM modules
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')
const {author, name: application_name, version} = require('./package.json')
const db = require('./db.js')
const images_router = require('./routes/images.js')


dotenv.config()

const app_port = process.env.APP_PORT ?? 80

// Express configuration
const app = express()
app.use(bodyParser.json())
app.use(cors())

app.get('/', (req, res) => {
  res.send({
    application_name,
    author,
    version,
    mongodb: {
      url: db.url,
      db: db.db,
      connected: db.get_connected(),
    },
  })
})

app.use('/images', images_router)





// Start server
app.listen(app_port, () => {
  console.log(`Image storage (Mongoose version) v${version} listening on port ${app_port}`);
})
