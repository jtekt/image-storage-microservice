const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const auth = require('@moreillon/express_identification_middleware')
const group_auth = require('@moreillon/express_group_based_authorization_middleware')
const {author, name: application_name, version} = require('./package.json')
const {uploads_directory} = require('./config.js')
const db = require('./db.js')
const images_router = require('./routes/images.js')
const import_router = require('./routes/import.js')
const export_router = require('./routes/export.js')


dotenv.config()


const {
  APP_PORT = 80,
  AUTHENTICATION_URL,
  AUTHORIZED_GROUPS,
  GROUP_AUTHORIZATION_URL
} = process.env

db.connect()

// Express configuration
const app = express()
app.use(express.json())
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
    uploads_directory,
    auth:{
      authentication_url: AUTHENTICATION_URL,
      group_authorization_url: GROUP_AUTHORIZATION_URL,
      authorized_groups: AUTHORIZED_GROUPS
    }
  })
})

if(AUTHENTICATION_URL) app.use(auth({url: AUTHENTICATION_URL}))
if(AUTHORIZED_GROUPS && GROUP_AUTHORIZATION_URL) {
  console.log(`Enabling group-based authorization`)
  const group_auth_options = {
    url: GROUP_AUTHORIZATION_URL,
    groups: AUTHORIZED_GROUPS.split(',')
  }
  app.use(group_auth(group_auth_options))
}


app.use('/import', import_router)
app.use('/export', export_router)
app.use('/images', images_router)


// Start server
app.listen(APP_PORT, () => {
  console.log(`Image storage (Mongoose version) v${version} listening on port ${APP_PORT}`);
})

// Export for testing
exports.app = app
