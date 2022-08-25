const dotenv = require('dotenv')

dotenv.config()

exports.uploads_directory = process.env.UPLOADS_DIRECTORY || 'uploads'
exports.mongodb_export_file_name = 'mongodb_data.json'
