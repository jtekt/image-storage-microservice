exports.uploads_directory_path = "/usr/share/pv"
exports.db = {
  url: process.env.MONGODB_URL || 'mongodb://mongodb:27017',
  db: process.env.MONGODB_DB || 'storage_microservice',
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
}
