const mongodb = require('mongodb')


const {
  MONGODB_URL = 'mongodb://mongo',
  MONGODB_DB = 'image_storage',
} = process.env

const MongoClient = mongodb.MongoClient

const mongodb_options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}

let db

function mongodb_connect(){
  console.log(`[MongoDB] Connecting...`)
  MongoClient.connect(MONGODB_URL,mongodb_options)
  .then(client => {

    console.log(`[MongoDB] Connected`)
    db = client.db(MONGODB_DB)

  })
  .catch(error => {
    console.log(error)
    console.log(`[MongoDB] Connection failed`)
    setTimeout(mongodb_connect,5000)
  })
}


mongodb_connect()



exports.url = MONGODB_URL
exports.name = MONGODB_DB
exports.getDb = () => db
