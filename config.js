const dotenv = require('dotenv')

// Parse environment variables
dotenv.config()

exports.uploads_directory_path = process.env.UPLOAD_DIRECTORY || "/usr/share/pv"
