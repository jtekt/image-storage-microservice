
const express = require('express')
const images_controller = require('../controllers/images.js')

const router = express.Router({mergeParams: true})

router.route('/')
.post(images_controller.image_upload)
.get(images_controller.get_all_images)

router.route('/:image_id')
.get(images_controller.get_single_image)
.delete(images_controller.delete_image)
.patch(images_controller.patch_image)
//.put(images_controller.replace_image)

router.route('/:image_id/info') // Alias
.get(images_controller.get_single_image)

router.route('/:image_id/image')
.get(images_controller.serve_image_file)

router.route('/:image_id/file') // Alias
.get(images_controller.serve_image_file)


module.exports = router
