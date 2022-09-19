const rimraf = require('rimraf')
const fs = require('fs')

exports.remove_file = (file_path) => new Promise((resolve, reject) => {
  rimraf(file_path, (error) => {
    if(error) return reject(error)
    resolve()
  })
})


exports.create_directory_if_not_exists = (target) => {
  let stat = null
  
  try {
    stat = fs.statSync(target)
  } 
  catch (err) {
    fs.mkdirSync(target, { recursive: true })
  }

  if (stat && !stat.isDirectory()) {
    throw new Error(`Directory cannot be created because an inode of a different type exists at ${target}`);
  }
}

exports.compute_filters = (req) => {

  let filter = {}

  if(req.query.filter) {
    try {
      filter = JSON.parse(req.query.filter)
    } catch (e) {
      throw {code: 400, message: 'Malformed filter'}
    }
  }

  // Convert time filter to date {FLIMSY}
  if(filter.time) {
    for (let key in filter.time) {
      filter.time[key] = new Date(filter.time[key])
    }
  }

  return filter
}