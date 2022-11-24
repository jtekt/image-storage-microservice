const multer  = require('multer')
const { Router } = require('express')
const { import_images } = require('../controllers/import.js')
const { import_temp_directory } = require('../config.js')

const router = Router()
const upload = multer({ dest: import_temp_directory })

router.route('/')
  .post(upload.single('archive'), import_images)


module.exports = router
