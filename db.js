const mongodb = require('mongodb')

const db_name = process.env.MONGODB_DB || 'image_storage'

const MongoClient = mongodb.MongoClient

const mongodb_options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}

let db


MongoClient.connect(process.env.MONGODB_URL,mongodb_options)
.then(client => {
  console.log(`[MongoDB] connected`)
  db = client.db(db_name)
})
.catch(error => {console.log(error)})

exports.db_name = db_name
exports.getDb = () => db
