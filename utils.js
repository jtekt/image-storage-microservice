const rimraf = require('rimraf')

exports.error_handling = (error, res) => {
  console.error(error)
  const status_code = error.code || 500
  const message = error.message || error
  console.log(message)
  if(!res._headerSent) res.status(status_code).send(message)
}

exports.remove_file = (file_path) => {
  return new Promise((resolve, reject) => {
    rimraf(file_path, (error) => {
      if(error) return reject(error)
      resolve()
    })
  })
}
