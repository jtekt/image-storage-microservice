const Image = require('../models/image.js')
const createHttpError = require('http-errors')


exports.read_fields = async (req, res, next) => {
    try {

        const images = await Image.find({})
        // Using set to remove duplicates
        const fields = images.reduce((prev, image) => [...new Set([...prev, ...Object.keys(image.data)])], [])
        res.send(fields)
    }
    catch (error) {
        next(error)
    }
}

exports.read_field_unique_values = async (req, res, next) => {
    try {

        const { field_name } = req.params
        const items = await Image.find().distinct(`data.${field_name}`)
        res.send(items)

    }
    catch (error) {
        next(error)
    }
}
