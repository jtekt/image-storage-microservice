exports.error_handling = (error, res) => {
  console.error(error)
  const status_code = error.code || 500
  const message = error.message || error
  console.log(message)
  if(!res._headerSent) res.status(status_code).send(message)
}
