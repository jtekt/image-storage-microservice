const dotenv = require('dotenv')
const path = require('path')

dotenv.config()

const {
    UPLOADS_DIRECTORY = 'uploads'
} = process.env

exports.uploads_directory = path.resolve(UPLOADS_DIRECTORY)
exports.import_temp_directory = path.resolve('./import')
exports.mongodb_export_file_name = 'mongodb_data.json'
