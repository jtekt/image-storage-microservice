const multer  = require('multer')
const { Router } = require('express')
const { directories } = require('../config.js')
const {
  read_images,
  upload_image,
  read_image,
  read_image_file,
  update_image,
  delete_image,
  delete_images,
} = require('../controllers/images.js')

// Need a special hander because keeping the original file name
const storage = multer.diskStorage({

  destination: directories.uploads,

  filename: (req, file, callback) => {
    callback(null, file.originalname)
  }

})

const router = Router({ mergeParams: true })
const upload = multer({ storage })


router.route('/')
  .get(read_images)
  .post(upload.single('image'), upload_image)
  .delete(delete_images)

router.route('/:_id')
  .get(read_image)
  .delete(delete_image)
  .patch(update_image)

router.route('/:_id/image')
  .get(read_image_file)

module.exports = router
