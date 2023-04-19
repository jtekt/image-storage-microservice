const Image = require("../models/image.js")
const { parse_query } = require("../utils.js")

exports.read_fields = async (req, res) => {
  // TODO: find more efficient way
  const { limit = 10000 } = req.query
  const images = await Image.find({}).limit(limit)

  // Using set to remove duplicates
  const fields = images.reduce((prev, { data }) => {
    Object.keys(data).forEach((i) => prev.add(i))
    return prev
  }, new Set([]))

  res.send([...fields])
}

exports.read_field_unique_values = async (req, res) => {
  const { field_name } = req.params
  const { query } = parse_query(req.query)

  const items = await Image.distinct(`data.${field_name}`, query)

  res.send(items)
}
