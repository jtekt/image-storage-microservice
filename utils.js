const rimraf = require('rimraf')
const fs = require('fs')

exports.error_handling = (error, res) => {
  console.log(error)
  let status_code = error.code || 500
  if(status_code === 11000) return res.status(400).send('Image already exists')
  const message = error.message || error
  res.status(status_code).send(message)
}

exports.remove_file = (file_path) => {
  return new Promise((resolve, reject) => {
    rimraf(file_path, (error) => {
      if(error) return reject(error)
      resolve()
    })
  })
}

exports.create_directory_if_not_exists = (target) => {
  let stat = null
  try {
    stat = fs.statSync(target)
  } catch (err) {
    fs.mkdirSync(target, { recursive: true })
  }
  if (stat && !stat.isDirectory()) {
    throw new Error(`Directory cannot be created because an inode of a different type exists at ${target}`);
  }
}
