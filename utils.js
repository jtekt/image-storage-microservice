const rimraf = require('rimraf')
const mv = require('mv')

exports.delete_file = (file_path) => new Promise((resolve, reject) => {
  rimraf(file_path, (error) => {
    if(error) return reject(error)
    resolve()
  })
})

exports.move_file = (original_path, destination_path) => new Promise ( (resolve, reject) => {

  const options = {mkdirp: true}

  mv(original_path, destination_path, options, (error) => {
    if (error) return reject(error)
    resolve()
  })
})
