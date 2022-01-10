const rimraf = require('rimraf')

exports.error_handling = (error, res) => {
  console.log(error)
  let status_code = error.code || 500
  if(status_code > 600) status_code = 500
  const message = error.message || error
  if(!res._headerSent) res.status(status_code).send(message)
}

exports.delete_file = (file_path) => new Promise((resolve, reject) => {
  rimraf(file_path, (error) => {
    if(error) return reject(error)
    resolve()
  })
})
