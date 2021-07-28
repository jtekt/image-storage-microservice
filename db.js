const mongodb = require('mongodb')

const db_url = process.env.MONGODB_URL || 'mongodb://mongo'
const db_name = process.env.MONGODB_DB || 'image_storage'

const MongoClient = mongodb.MongoClient

const mongodb_options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}

let db

function mongodb_connect(){
  console.log(`[MongoDB] Connecting...`)
  MongoClient.connect(db_url,mongodb_options)
  .then(client => {

    console.log(`[MongoDB] Connected`)
    db = client.db(db_name)

  })
  .catch(error => {
    console.log(error)
    console.log(`[MongoDB] Connection failed`)
    setTimeout(mongodb_connect,5000)
  })
}


mongodb_connect()



exports.name = db_name
exports.url = db_url
exports.getDb = () => db
