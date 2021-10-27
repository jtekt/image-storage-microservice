const { Schema, model } = require('mongoose')

const imageSchema = new Schema({
  file: String,
  time: Date,
  data: Object
})

const Image = model('Image', imageSchema);

module.exports = Image
