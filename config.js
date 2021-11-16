const dotenv = require('dotenv')

// Parse environment variables
dotenv.config()

exports.uploads_directory_path = process.env.UPLOAD_DIRECTORY || "/usr/share/pv"
exports.mongodb_export_file_name = 'mongodb_data.json'
