const dotenv = require('dotenv')

dotenv.config()

const {
    UPLOADS_DIRECTORY = 'uploads'
} = process.env

exports.uploads_directory = UPLOADS_DIRECTORY
exports.mongodb_export_file_name = 'mongodb_data.json'
exports.import_temp_directory = 'import'
