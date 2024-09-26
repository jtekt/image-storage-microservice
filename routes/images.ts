import multer from 'multer'
import { Router } from 'express'
import {
    read_images,
    upload_image,
    read_image,
    read_image_file,
    update_image,
    replace_image_data,
    delete_image,
    delete_images,
    update_images,
} from '../controllers/images'
import { localStorage } from '../fileStorage/local'
import { s3Storage } from '../fileStorage/s3'

const router = Router({ mergeParams: true })

const storage = s3Storage || localStorage
const upload = multer({ storage })

router
    .route('/')
    .get(read_images)
    .post(upload.single('image'), upload_image)
    .delete(delete_images)
    .patch(update_images)

router
    .route('/:_id')
    .get(read_image)
    .delete(delete_image)
    .patch(update_image)
    .put(replace_image_data)

router.route('/:_id/image').get(read_image_file)
router.route('/:_id/file').get(read_image_file)

export default router
