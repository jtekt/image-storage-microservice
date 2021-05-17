const dotenv = require('dotenv')

// Parse environment variables
dotenv.config()

// Setting timezone
process.env.TZ = 'Asia/Tokyo'

exports.uploads_directory_path = process.env.UPLOAD_DIRECTORY || "/usr/share/pv"

exports.app_port = process.env.APP_PORT || 80
