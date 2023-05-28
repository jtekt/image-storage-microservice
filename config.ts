const dotenv = require('dotenv')
const path = require('path')

dotenv.config()

const {
    UPLOADS_DIRECTORY = 'uploads'
} = process.env


export const directories = {
    uploads: path.resolve(UPLOADS_DIRECTORY),
    temp: path.resolve('./temp')
}

export const mongodb_export_file_name = 'mongodb_data.json'
export const export_excel_file_name = 'mongodb_data.xlsx'
