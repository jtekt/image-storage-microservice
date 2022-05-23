const {Router} = require('express')
const path = require('path')
const multer  = require('multer')
const {
  import_images,
} = require('../controllers/import.js')

const router = Router()
const storage = multer.memoryStorage()
const upload = multer({ storage })


router.route('/')
  .post(upload.single('archive'), import_images)


module.exports = router
