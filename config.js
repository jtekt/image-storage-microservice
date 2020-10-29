const dotenv = require('dotenv')

// Parse environment variables
dotenv.config()

// Setting timezone
process.env.TZ = 'Asia/Tokyo'

exports.uploads_directory_path = process.env.UPLOAD_DIRECTORY || "/usr/share/pv"

exports.mongodb = {
  url : process.env.MONGODB_URL || 'mongodb://mongodb:27017',
  db : process.env.MONGODB_DB || 'image_storage',
  options : {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
}

exports.app_port = process.env.APP_PORT || 80
