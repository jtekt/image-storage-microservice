const dotenv = require('dotenv')

dotenv.config()

exports.uploads_directory = process.env.UPLOADS_DIRECTORY || 'uploads'
