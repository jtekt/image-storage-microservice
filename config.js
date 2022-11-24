const dotenv = require('dotenv')
const path = require('path')

dotenv.config()

const {
    UPLOADS_DIRECTORY = 'uploads'
} = process.env


exports.directories = {
    uploads: path.resolve(UPLOADS_DIRECTORY),
    temp: path.resolve('./temp')
}

exports.mongodb_export_file_name = 'mongodb_data.json'
