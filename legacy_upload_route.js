// Using promises so as to create DB record only when all files have been saved successfully
let promises = []

// go through all the files of the request
for (var key in files) {

  let image_type = key
  let original_file = files[key]
  let original_path = original_file.path
  let file_name = original_file.name

  let destination_path = path.join(uploads_directory_path, file_name)

  // using promises for asynchronousity
  promises.push( new Promise ((resolve, reject) => {
    mv(original_path, destination_path, {mkdirp: true}, (err) => {
      if (err) return res.status(500).send('Error moving file')
      resolve({
        type: image_type,
        file_name: file_name,
      })
    })
  }))
}

// Once all promises have been resolved, i.e. all files have been stored
Promise.all(promises)
.then( images => {

  MongoClient.connect(DB_config.url,DB_config.options, (err, db) => {
    // Handle DB connection errors
    if (err) {
      console.log(err)
      res.status(500).send(err)
      return
    }

    let new_document = {
      time: new Date(),
    }

    // Add images to the new_document
    images.forEach( image => {
      new_document[image.type] = { image: image.file_name }

      // Add the result of the AI if available
      if(fields[image.type]) {
        new_document[image.type].AI = {
          pediction: fields[image.type]
        }
      }
    })

    // Insert into the DB
    db.db(DB_config.db)
    .collection(DB_config.collection)
    .insertOne(new_document, (err, result) => {

      if (err) {
        console.log(err)
        res.status(500).send(err)
        return
      }

      console.log("Document inserted");
      db.close()

      res.send("OK")
    })
  })

})
