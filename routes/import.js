const multer  = require('multer')
const { Router } = require('express')
const { import_images } = require('../controllers/import.js')
const { create_directory_if_not_exists } = require('../utils.js')
const { import_temp_directory } = require('../config.js')

const router = Router()


// Memory storage maybe not ideal if archive is very large
// const storage = multer.memoryStorage()

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    create_directory_if_not_exists(import_temp_directory)
    cb(null, import_temp_directory)
  },
  filename: (req, file, cb) => { cb(null, file.originalname) }
})

const upload = multer({ storage })


router.route('/')
  .post(upload.single('archive'), import_images)


module.exports = router
