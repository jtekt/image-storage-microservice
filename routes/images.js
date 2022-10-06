const { Router } = require('express')
const multer  = require('multer')
const { uploads_directory } = require('../config.js')
const { create_directory_if_not_exists } = require('../utils.js')
const {
  read_images,
  upload_image,
  read_image,
  read_image_file,
  delete_image,
  update_image,
} = require('../controllers/images.js')

const {
  read_fields
} = require('../controllers/fields.js')

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    create_directory_if_not_exists(uploads_directory)
    cb(null, uploads_directory)
  },
  filename: (req, file, cb) => { cb(null, file.originalname) }
})

const router = Router({ mergeParams: true })
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
