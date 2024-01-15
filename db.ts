import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const {
    MONGODB_CONNECTION_STRING,
    MONGODB_PROTOCOL = 'mongodb',
    MONGODB_USERNAME,
    MONGODB_PASSWORD,
    MONGODB_HOST = 'localhost',
    MONGODB_PORT,
    MONGODB_DB = 'image_storage',
    MONGODB_OPTIONS = '',
    MONGODB_URL, // legacy
} = process.env

const mongodbPort = MONGODB_PORT ? `:${MONGODB_PORT}` : ''

let connectionString: string

if (MONGODB_URL) {
    console.log('[MongoDB] Connection string set using legacy syntax')
    connectionString = `${MONGODB_URL}/${MONGODB_DB}${MONGODB_OPTIONS}`
} else if (MONGODB_CONNECTION_STRING) {
    connectionString = MONGODB_CONNECTION_STRING
} else if (MONGODB_USERNAME && MONGODB_PASSWORD) {
    connectionString = `${MONGODB_PROTOCOL}://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@${MONGODB_HOST}${mongodbPort}/${MONGODB_DB}${MONGODB_OPTIONS}`
} else {
    connectionString = `${MONGODB_PROTOCOL}://${MONGODB_HOST}${mongodbPort}/${MONGODB_DB}${MONGODB_OPTIONS}`
}

export const redactedConnectionString = connectionString.replace(
    /:.*@/,
    '://***:***@'
)

export const connect = () => {
    console.log(`[MongoDB] Connecting to ${redactedConnectionString}...`)
    mongoose
        .connect(connectionString)
        .then(() => {
            console.log('[Mongoose] Initial connection successful')
        })
        .catch((error) => {
            console.log('[Mongoose] Initial connection failed')
            setTimeout(connect, 5000)
        })
}

export const get_connected = () => mongoose.connection.readyState
