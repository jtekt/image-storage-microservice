const AdmZip = require('adm-zip')
const path = require('path')
const {ObjectID} = require('mongodb')
const { error_handling } = require('../utils.js')
const { getDb } = require('../db.js')
const {
  uploads_directory_path,
  mongodb_export_file_name
} = require('../config.js')


const mongodb_data_import = async ({collection, data}) => {

  const bulk = getDb()
    .collection(collection)
    .initializeUnorderedBulkOp()

  // Build the bulk operations
  // Using update upsert to prevent duplicates
  data.forEach((item) => {

    // Put time and id back in their appropriate type
    item._id = ObjectID(item._id)
    item.time = new Date(item.time)

    bulk.find({_id: item._id})
    .upsert()
    .updateOne({$set: item})
  })

  await bulk.execute()

}



exports.import_collection = async (req, res) => {

  // TODO check if JSON file exists first


  try {
    const {collection} = req.params
    if(!collection) throw {code: 400, message: 'collection not specified'}

    const {file} = req
    if(!file)  throw {code: 400, message: 'File not provided'}
    const {mimetype, buffer} = file
    if(mimetype !== 'application/x-zip-compressed') throw {code: 400, message: 'File is not zip'}

    const unzip_directory = path.join(
      uploads_directory_path,
      'images',
      collection
    )

    const zip = new AdmZip(buffer)

    // Check if archive contains mongodb data file
    const found_json = zip.getEntries().find( ({ entryName }) => entryName === mongodb_export_file_name)
    if(!found_json) throw {code: 400, message: `${mongodb_export_file_name} not found in archive`}

    zip.extractAllTo(unzip_directory, true)

    const json_file_path = path.join(unzip_directory, `export.json`)
    const data = require(json_file_path)

    await mongodb_data_import({data,collection})


    res.send({collection})
  }
  catch (error) { error_handling(error,res) }
}
