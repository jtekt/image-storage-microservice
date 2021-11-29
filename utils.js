const rimraf = require('rimraf')

exports.error_handling = (error, res) => {
  console.log(error)
  let status_code = error.code || 500
  if(status_code > 600) status_code = 500 // Mongoose error cdes also exist
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
