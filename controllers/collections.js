const mongodb = require('mongodb')
//const del = require('del')
const rimraf = require('rimraf')
const dotenv = require('dotenv')
const config = require('../config.js')
const path = require('path')

// exports
const fs = require('fs')
const XLSX = require('xlsx')
var AdmZip = require('adm-zip');

// Parse environment variables
dotenv.config()

const uploads_directory_path = config.uploads_directory_path
const MongoClient = mongodb.MongoClient
const DB_config = config.mongodb

exports.get_collections = (req, res) => {

  MongoClient.connect(DB_config.url,DB_config.options, (err, db) => {
    // Handle DB connection errors
    if (err) {
      console.log(err)
      res.status(500).send(err)
      return
    }

    db.db(DB_config.db)
    .listCollections()
    .toArray( (err, collections) => {
      // Close the connection to the DB
      db.close()

      // Handle errors
      if (err) {
        console.log(err)
        res.status(500).send(err)
        return
      }

      res.send(collections)

      console.log(`[MongoDB] Queried list of collections`)
    })

  })
}

exports.get_collection_count = (req, res) => {
  const collection = req.params.collection

  if(!collection) {
    return res.status(400).send(`Collection not specified`)
  }

  MongoClient.connect(DB_config.url,DB_config.options)
  .then(db => {
    return db.db(DB_config.db)
    .collection(collection)
    .countDocuments()
  })
  .then(result => { res.send({documents: result}) })
  .catch(error => {
    res.status(500).send('Error while counting documents')
  })
}

exports.drop_collection = (req, res) => {

  const collection = req.params.collection

  if(!collection) {
    return res.status(400).send(`Collection not specified`)
  }

  MongoClient.connect(DB_config.url,DB_config.options, (err, db) => {
    // Handle DB connection errors
    if (err) {
      console.log(err)
      res.status(500).send(err)
      return
    }

    db.db(DB_config.db)
    .collection(collection)
    .drop( (err, result) => {
      // Close the connection to the DB
      db.close()

      // Handle errors
      if (err) {
        console.log(err)
        res.status(500).send(err)
        return
      }


      const folder_to_remove = path.join(uploads_directory_path,'images',collection)

      rimraf(folder_to_remove, (error) => {
        if(error) {
          console.log(error)
          res.status(500).send(`Failed to delete folder ${folder_to_remove}`)
          return
        }

        res.send(`Collection ${collection} dropped`)


      })

    })
  })
}

const generate_excel = (data, filename) => {

  // convert ID from ObjectID to String
  data = data.map((item) => {
    item._id = item._id.toString()
    return item
  })

  let workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1")
  XLSX.writeFile(workbook, filename)
}

exports.export_collection_excel = (req, res) => {

  const collection = req.params.collection

  if(!collection) {
    return res.status(400).send(`Collection not specified`)
  }

  MongoClient.connect(DB_config.url,DB_config.options, (err, db) => {
    // Handle DB connection errors
    if (err) {
      console.log(err)
      res.status(500).send(err)
      return
    }



    db.db(DB_config.db)
    .collection(collection)
    .find({})
    .sort({time: -1}) // sort by timestamp
    .toArray( (err, result) => {

      // Close the connection to the DB
      db.close()

      // Handle errors
      if (err) {
        console.log(err)
        res.status(500).send(err)
        return
      }

      const filename = `export.xlsx`
      generate_excel(result, filename)

      const stream = fs.createReadStream(filename);         // create read stream

      res.setHeader( "Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" )
      res.setHeader( "Content-Disposition", `attachment; filename=${filename}` )

      stream.pipe(res)
      res.end()

      rimraf(filename, (error) => {
        if(error) {
          console.log(error)
        }
      })


      console.log(`[MongoDB] Images of ${collection} exported`)
    })
  })
}

exports.export_collection_zip = (req, res) => {

  const collection = req.params.collection

  if(!collection) {
    return res.status(400).send(`Collection not specified`)
  }

  const folder_to_zip = path.join(uploads_directory_path,'images',collection)

  MongoClient.connect(DB_config.url,DB_config.options, (err, db) => {
    // Handle DB connection errors
    if (err) {
      console.log(err)
      res.status(500).send(`Error while connecting to database`)
      return
    }

    db.db(DB_config.db)
    .collection(collection)
    .find({})
    .sort({time: -1}) // sort by timestamp
    .toArray( (err, result) => {

      // Close the connection to the DB
      db.close()

      // Handle errors
      if (err) {
        console.log(err)
        res.status(500).send(err)
        return
      }

      const excel_filename = `database_export.xlsx`
      generate_excel(result, excel_filename)

      const dir_content = fs.readdir(folder_to_zip, (error, files) => {
        if(error) {
          console.log(error)
          return res.status(500).send('Error listing content')
        }

        let zip = new AdmZip()

        // add local file
        files.forEach((file) => { zip.addLocalFile(path.join(folder_to_zip,file)) })

        // Add excel export
        zip.addLocalFile(excel_filename)

        // get everything as a buffer
        const zipFileContents = zip.toBuffer();
        const zip_filename = `export.zip`;
        res.setHeader( "Content-Type", "application/zip" )
        res.setHeader( "Content-Disposition", `attachment; filename=${zip_filename}` )
        res.send(zipFileContents)

        console.log(`[MongoDB] Images of ${collection} exported`)

        // Delete the excel file once done
        rimraf(excel_filename, (error) => {
          if(error) { console.log(error) }
        })

      })



    })
  })







  //fs.readdir(path, callbackFunction)


}
