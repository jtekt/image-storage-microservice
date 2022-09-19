const { Schema, model } = require('mongoose')

const options = { minimize: false }

const imageSchema = new Schema({
  file: { ype: String, required: true, unique: true },
  time: {type: Date, default: Date.now},
  data: {type: Schema.Types.Mixed, default: {}},
}, options)

const Image = model('Image', imageSchema)

module.exports = Image
