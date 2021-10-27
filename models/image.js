const { Schema } = require('mongoose')

const imageSchema = new Schema({
  file: String,
  time: Date,
  data: Object
})

const Image = mongoose.model('Image', imageSchema);

module.exports = Image
