const { Schema, model } = require('mongoose')

const imageSchema = new Schema({
  file: {
    type: String,
    required: true,
    unique: true,
  },
  time: Date,
  data: Object,
})

const Image = model('Image', imageSchema)

module.exports = Image
