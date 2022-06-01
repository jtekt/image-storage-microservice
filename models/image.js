const { Schema, model } = require('mongoose')

const imageSchema = new Schema({
  file: {
    type: String,
    required: true,
    unique: true,
  },
  time: {type: Date, default: Date.now},
  data: Object,
})

const Image = model('Image', imageSchema)

module.exports = Image
