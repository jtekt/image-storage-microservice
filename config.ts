const dotenv = require('dotenv')
const path = require('path')

dotenv.config()

export const { UPLOADS_DIRECTORY = 'uploads' } = process.env

export const uploadsDirectoryPath = path.resolve(UPLOADS_DIRECTORY)
export const tempDirectoryPath = path.resolve('./temp')

export const mongodb_export_file_name = 'mongodb_data.json'
export const export_excel_file_name = 'mongodb_data.xlsx'
