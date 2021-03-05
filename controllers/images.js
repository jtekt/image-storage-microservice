const mongodb = require('mongodb')
const mv = require('mv')
const formidable = require('formidable')
const path = require('path')
const dotenv = require('dotenv')
const config = require('../config.js')

// Parse environment variables
dotenv.config()

const uploads_directory_path = config.uploads_directory_path

const MongoClient = mongodb.MongoClient
const ObjectID = mongodb.ObjectID
const DB_config = config.mongodb



function parse_form(req) {
  return new Promise ( (resolve, reject) => {

    const form = new formidable.IncomingForm()

    form.parse(req, (error, fields, files) => {
      if (error) return reject(error)
      resolve({ fields, files })
    })

  })
}

function move_file(original_path, destination_path){
   return new Promise ( (resolve, reject) => {

     const options = {mkdirp: true}

     mv(original_path, destination_path, options, (error) => {
       if (error) return reject(error)
       resolve()
     })
   })
}



exports.image_upload = (req, res) => {

  // retrieve collection name from query
  const collection = req.params.collection
  if(!collection)   return res.status(400).send(`Collection not specified`)

  // needs to be global
  let file_name = undefined
  let fields = undefined
  let files = undefined


  parse_form(req)
  .then((parsed_form) => {

    fields = parsed_form.fields
    files = parsed_form.files

    // Read the form files
    const original_file = files['image']

    if(!original_file) {
      console.log("Request does not contain an image")
      res.status(400).send(`Request does not contain an image`)
      return
    }

    const original_path = original_file.path
    file_name = original_file.name

    // construct the destination
    // uploads are placed in a folder called "images" and then separated by collection
    const destination_path = path.join(
      uploads_directory_path,
      'images',
      collection,
      file_name)

    return move_file(original_path,destination_path)

  })
  .then( () => {
    return MongoClient.connect(DB_config.url,DB_config.options)
  })
  .then( db => {

    let new_document = {
      time: new Date(),
      image: file_name,
    }

    // Check if proerties passed as JSON
    let json_properties = fields.json
      || fields.json_properties
      || fields.proerties_json

    if (json_properties) {
      console.log(`Found JSON properties in fields`)
      try {
        // Add parsed properties using spread operator
        let parsed_properties = JSON.parse(json_properties)

        // Deal with ID
        if (parsed_properties._id) {
          parsed_properties._id = ObjectID(parsed_properties._id)
        }

        new_document = {...new_document, ...parsed_properties}
      } catch (e) {
        console.log(`Cannot parse supposedly JSON properties`)
        res.status(400).send(`Could not parse JSON`)
        return
      }
    }
    else {
      //otherwise just insert properties as is
      // Using spread operator
      new_document = {...new_document, ...fields}
    }

    return db.db(DB_config.db)
    .collection(collection)
    .insertOne(new_document)

  })

  .then(result => {
    console.log(`[MongoDB] Image ${file_name} inserted in collection ${collection}`)

    const new_document = result.ops[0]

    // Respond to the client
    res.send(new_document)

    // Broadcast result with socket.io
    io.sockets.emit('upload', {
      collection: collection,
      document: new_document
    })
  })

  .catch(error => {
    console.log(error)
    res.status(500).send(error)
  })

}

exports.get_all_images = (req, res) => {

  // Check for collection here to save a DB query if not necessary
  const collection = req.params.collection
  if(!collection)   return res.status(400).send(`Collection not specified`)

  MongoClient.connect(DB_config.url,DB_config.options)
  .then(db => {

    const limit = req.query.limit
      || req.query.batch_size
      || 0

    const sort = req.query.sort || {time: -1}
    const start_index = req.query.start_index || 0

    let filter = {}
    if(req.query.filter) {
      try {
        filter = JSON.parse(req.query.filter)
      } catch (e) {
        console.log(`[Express] Failed to parse filter`)
      }
    }


    return db.db(DB_config.db)
    .collection(collection)
    .find(filter)
    .skip(Number(start_index))
    .limit(Number(limit))
    .sort(sort) // sort by timestamp
    .toArray()
  })
  .then(result => {
    res.send(result)
    console.log(`[MongoDB] Images of ${collection} queried`)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(error)
  })

}



exports.get_single_image = (req, res) => {

  const image_id = req.params.image_id
  if(!image_id) return res.status(400).send(`ID not specified`)

  const collection = req.params.collection
  if(!collection)   return res.status(400).send(`Collection not specified`)

  let query = undefined
  try {
    query = { _id: ObjectID(image_id)}
  }
  catch (e) {
    console.log('Invalid ID requested')
    res.status(400).send('Invalid ID')
    return
  }

  MongoClient.connect(DB_config.url,DB_config.options)
  .then(db => {
    return db.db(DB_config.db)
    .collection(collection)
    .findOne(query)
  })
  .then(result => {
    res.send(result)
    console.log(`[MongoDB] Document ${image_id} of collection ${collection} queried`)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(error)
  })
}

exports.delete_image = (req, res) => {

  const image_id = req.params.image_id
  if(!image_id) return res.status(400).send(`ID not specified`)

  const collection = req.params.collection
  if(!collection)   return res.status(400).send(`Collection not specified`)

  let query = undefined
  try {
    query = { _id: ObjectID(image_id)}
  }
  catch (e) {
    console.log('Invalid ID requested')
    res.status(400).send('Invalid ID')
    return
  }

  MongoClient.connect(DB_config.url,DB_config.options)
  .then(db => {
    return db.db(DB_config.db)
    .collection(req.params.collection)
    .deleteOne(query)
  })
  .then(result => {
    res.send(result)
    console.log(`Document ${image_id} of ${collection} deleted`)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(error)
  })
}

exports.patch_image = (req, res) => {

  const image_id = req.params.image_id
  if(!image_id) return res.status(400).send(`ID not specified`)

  const collection = req.params.collection
  if(!collection)   return res.status(400).send(`Collection not specified`)

  let query = undefined
  try {
    query = { _id: ObjectID(image_id)}
  }
  catch (e) {
    console.log('Invalid ID requested')
    res.status(400).send('Invalid ID')
    return
  }

  delete req.body._id
  let new_image_properties = {$set: req.body}


  MongoClient.connect(DB_config.url,DB_config.options)
  .then(db => {
    const options = {returnOriginal: false}
    return db.db(DB_config.db)
    .collection(collection)
    .findOneAndUpdate(query, new_image_properties, options)
  })
  .then(result => {

    const document = result.value
    console.log(`Image ${image_id} of collection ${collection} updated`)
    res.send(document)

    // websockets modification
    io.sockets.emit('update', {
      collection,
      document,
    })
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(error)
  })
}

exports.replace_image = (req, res) => {

  const image_id = req.params.image_id
  if(!image_id) return res.status(400).send(`ID not specified`)

  const collection = req.params.collection
  if(!collection) return res.status(400).send(`Collection not specified`)

  let query = undefined
  try {
    query = { _id: ObjectID(image_id)}
  }
  catch (e) {
    console.log('Invalid ID requested')
    res.status(400).send('Invalid ID')
    return
  }

  delete req.body._id

  let new_image_properties = req.body


  MongoClient.connect(DB_config.url,DB_config.options)
  .then(db => {
    return db.db(DB_config.db)
    .collection(collection)
    .replaceOne(query, new_image_properties)
  })
  .then(result => {
    console.log(`Image ${image_id} of collection ${collection} replaced`)
    res.send(result.value)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(error)
  })

}


exports.serve_image_file = (req,res) => {

  const image_id = req.params.image_id
  if(!image_id) return res.status(400).send(`ID not defined`)

  const collection = req.params.collection
  if(!collection) return res.status(400).send(`Collection not defined`)

  let query = undefined
  try {
    query = { _id: ObjectID(image_id)}
  }
  catch (e) {
    console.log('Invalid ID requested')
    res.status(400).send('Invalid ID')
    return
  }

  MongoClient.connect(DB_config.url,DB_config.options)
  .then(db => {
    return db.db(DB_config.db)
    .collection(collection)
    .findOne(query)
  })
  .then(result => {
    console.log(`[Express] serving image ${image_id} of collection ${collection}`)
    const image_path = path.join(
      uploads_directory_path,
      'images',
      collection,
      result.image)

    res.sendFile(image_path)
  })
  .catch((error) => {
    res.status(500).send(error)
    console.log(error)
  })

}
