const {Router} = require('express')
const path = require('path')
const multer  = require('multer')
const {uploads_directory} = require('../config.js')
const {
  read_images,
  upload_image,
  read_image,
  read_image_file,
  delete_image,
  update_image,
} = require('../controllers/images.js')

const router = Router()

const storage = multer.diskStorage({
  destination:  (req, file, cb) => { cb(null, `${uploads_directory}/`) },
  filename:  (req, file, cb) => { cb(null, file.originalname) }
})

const upload = multer({ storage })


router.route('/')
  .get(read_images)
  .post(upload.single('image'), upload_image)

router.route('/:_id')
  .get(read_image)
  .delete(delete_image)
  .patch(update_image)

router.route('/:_id/image')
  .get(read_image_file)

module.exports = router
