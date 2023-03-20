const rimraf = require("rimraf")
const fs = require("fs")

exports.remove_file = (file_path) =>
  new Promise((resolve, reject) => {
    rimraf(file_path, (error) => {
      if (error) return reject(error)
      resolve()
    })
  })

exports.create_directory_if_not_exists = (target) => {
  let stat = null

  try {
    stat = fs.statSync(target)
  } catch (err) {
    fs.mkdirSync(target, { recursive: true })
  }

  if (stat && !stat.isDirectory()) {
    throw new Error(
      `Directory cannot be created because an inode of a different type exists at ${target}`
    )
  }
}

const dateInLocalTz = (date) =>
  new Date(new Date(date).getTime() + new Date().getTimezoneOffset() * 60000)

exports.parse_query = (rawQuery) => {
  const {
    skip = 0,
    limit,
    sort = "time",
    order = 1,
    from,
    to,
    regex = false, // boolean toggling partial text search, not ideal
    file,
    filter,
    ...rest
  } = rawQuery

  // NOTE: partial text search on any field might not work because field list not fixed

  let query = {}

  if (file) {
    if (regex) query.file = { $regex: file, $options: "i" }
    else query.file = file
  }

  if (filter) {
    try {
      query = { ...query, ...JSON.parse(filter) }
    } catch (error) {
      console.error(`Filter cannot be parsed`)
    }
  }

  for (const key in rest) {
    let value = rest[key]

    // Convert numbers into numbers
    // try {
    //   value = JSON.parse(value)
    // } catch (error) { }

    if (regex) query[`data.${key}`] = { $regex: value, $options: "i" }
    else query[`data.${key}`] = value
  }

  // Time filters
  // Using $gt and $lt instead of $gte and $lte for annotation tool
  if (to || from) query.time = {}
  if (to) query.time.$lt = dateInLocalTz(to)
  if (from) query.time.$gt = dateInLocalTz(from)

  return { query, to, from, limit, skip, sort, order }
}

exports.parse_formdata_fields = (body) => {
  const json_data = body.data || body.json

  let data
  try {
    data = json_data ? JSON.parse(json_data) : body
  } catch (error) {
    console.log("JSON body cannot be parsed")
    data = body
  }

  return data
}
