const multer  = require('multer')
const { Router } = require('express')
const { import_images } = require('../controllers/import.js')
const { directories } = require('../config.js')

const router = Router()
const upload = multer({ dest: directories.temp })

router.route('/')
  .post(upload.single('archive'), import_images)


module.exports = router
