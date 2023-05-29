import mongoose from "mongoose"
import dotenv from 'dotenv'

dotenv.config()


const {
  MONGODB_URL = 'mongodb://mongo',
  MONGODB_DB = 'image_storage'
} = process.env



export const connect = () => {
  const connection_string = `${MONGODB_URL}/${MONGODB_DB}`
  console.log(`[MongoDB] Attempting connection to ${connection_string}`)
  mongoose.connect(connection_string)
  .then(() => {console.log('[Mongoose] Initial connection successful')})
  .catch(error => {
    console.log('[Mongoose] Initial connection failed')
    setTimeout(connect,5000)
  })
}


export const url = MONGODB_URL
export const db = MONGODB_DB
export const get_connected = () => mongoose.connection.readyState
