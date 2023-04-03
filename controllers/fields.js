const Image = require("../models/image.js")
const { parse_query } = require("../utils.js")

exports.read_fields = async (req, res) => {
  // TODO: find more efficient way
  const images = await Image.find({})
  // Using set to remove duplicates
  const fields = images.reduce(
    (prev, image) => [...new Set([...prev, ...Object.keys(image.data)])],
    []
  )
  res.send(fields)
}

exports.read_field_unique_values = async (req, res) => {
  const { field_name } = req.params
  const { query } = parse_query(req.query)

  const items = await Image.distinct(`data.${field_name}`, query)

  res.send(items)
}
