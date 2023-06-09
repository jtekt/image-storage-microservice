// @ts-ignore
import rimraf from "rimraf"
import fs from "fs"

export const remove_file = (file_path: string) =>
  new Promise((resolve, reject) => {
    rimraf(file_path, (error: any) => {
      if (error) return reject(error)
      resolve(null)
    })
  })

export const create_directory_if_not_exists = (target: string) => {
  // TODO: find if no better way
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

export const parse_query = (rawQuery: any) => {
  const {
    skip = 0,
    limit = 10000,
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

  let query: any = {}

  if (file) {
    if (regex) query.file = { $regex: file, $options: "i" }
    else query.file = file
  }

  if (filter) {
    try {
      query = { ...query, ...JSON.parse(filter) }
    } catch (error) {
      throw "Malformed filter"
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
  if (to) query.time.$lt = new Date(to)
  if (from) query.time.$gt = new Date(from)

  return { query, to, from, limit, skip, sort, order }
}
