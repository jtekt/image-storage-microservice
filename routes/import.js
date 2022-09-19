const {Router} = require('express')
const multer  = require('multer')
const { import_images } = require('../controllers/import.js')

const router = Router()

// Memory storage maybe not ideal if archive is very large
const storage = multer.memoryStorage()

const upload = multer({ storage })


router.route('/')
  .post(upload.single('archive'), import_images)


module.exports = router
