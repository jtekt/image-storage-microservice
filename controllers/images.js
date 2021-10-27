const Image = require('../models/image.js')
const path = require('path')
const {uploads_directory} = require('../config.js')
const {
  error_handling,
  remove_file,
} = require('../utils.js')



exports.read_images = async (req,res) => {

  try {
    const images = await Image.find({})
    res.send(images)
    console.log(`Images queried`)
  }
  catch (error) {
    error_handling(error,res)
  }

}

exports.upload_image = async (req,res) => {
  try {
    // WARNING: Body becomes data so no way to pass time
    const file = req.file.originalname
    const data = req.body
    const time = new Date()
    const new_image = new Image({file,time,data})
    const saved_image = await new_image.save()
    res.send(saved_image)
    console.log(`Image ${file} uploaded and saved`)
  }
  catch (error) {
    error_handling(error,res)
  }
}


exports.read_image = async (req,res) => {
  try {
    const {_id} = req.params
    const image = await Image.findOne({_id})
    res.send(image)
    console.log(`Image ${_id} queried`)
  }
  catch (error) {
    error_handling(error,res)
  }
}

exports.delete_image = async (req,res) => {
  try {
    const {_id} = req.params
    const {file} = await Image.findOne({_id})
    const file_absolute_path = path.join(__dirname, `../${uploads_directory}`,file)
    await remove_file(file_absolute_path)
    await Image.findOneAndDelete({_id})
    res.send({_id})
    console.log(`Image ${_id} deleted`)
  }
  catch (error) {
    error_handling(error,res)
  }
}

exports.read_image_file = async (req,res) => {
  try {
    const {_id} = req.params
    const {file} = await Image.findOne({_id})
    const file_absolute_path = path.join(__dirname, `../${uploads_directory}`,file)
    res.sendFile(file_absolute_path)
    console.log(`Image file ${_id} queried`)
  }
  catch (error) {
    error_handling(error,res)
  }
}
