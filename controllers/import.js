const AdmZip = require('adm-zip')
const createError = require('http-errors')
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const { ObjectID } = require('mongodb')
const { getDb } = require('../db.js')
const { delete_file } = require('../utils.js')
const {
  uploads_directory_path,
  mongodb_export_file_name
} = require('../config.js')


const mongodb_data_import = async ({collection, data}) => {

  const bulk = getDb()
    .collection(collection)
    .initializeUnorderedBulkOp()


  console.log(`[MongodB] Importing ${data.length} items`);

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



exports.import_collection = async (req, res, next) => {

  // TODO check if JSON file exists first


  try {
    const { collection } = req.params
    if(!collection) throw createError(400, 'Collection not specified')

    const {file} = req
    if(!file)  throw createError(400, 'File not provided')
    const {mimetype, buffer} = file
    if(mimetype !== 'application/x-zip-compressed') throw createError(400, 'File is not zip')

    const unzip_directory = path.join(
      uploads_directory_path,
      'images',
      collection
    )

    const zip = new AdmZip(buffer)

    // Check if archive contains mongodb data file
    const found_json = zip.getEntries().find( ({ entryName }) => entryName === mongodb_export_file_name)
    if(!found_json) throw createError(400, `${mongodb_export_file_name} not found in archive`)

    zip.extractAllTo(unzip_directory, true)

    const json_file_path = path.join(unzip_directory, mongodb_export_file_name)
    const data = JSON.parse(fs.readFileSync(json_file_path, 'utf8'));

    await mongodb_data_import({data,collection})

    // delete the json file
    //await delete_file(json_file_path)

    console.log(`[MongoDB] Collection ${collection} imported`)


    res.send({collection})
  }
  catch (error) {
    next(error)
  }
}
