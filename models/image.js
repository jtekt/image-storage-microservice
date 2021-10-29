const { Schema, model } = require('mongoose')

const imageSchema = new Schema({
  file: {
    type: String,
    require: true,
    unique: true,
  },
  time: Date,
  data: Object,
})

const Image = model('Image', imageSchema)

module.exports = Image
