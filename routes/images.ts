import multer, { StorageEngine } from 'multer'
import path from 'path'
import { create_directory_if_not_exists } from '../utils'
import { Router } from 'express'
import { uploadsDirectoryPath } from '../fileStorage/local'
import { s3Client, S3_BUCKET } from '../fileStorage/s3'
import multerS3 from 'multer-s3'
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

const router = Router({ mergeParams: true })

// Need a special hander because keeping the original file name
const diskStorage = multer.diskStorage({
    destination: (req, _, callback) => {
        // Allowing the user to specify a file name
        const { file } = req.body
        if (file) {
            const destinationPath = path.join(
                uploadsDirectoryPath,
                path.dirname(file)
            )
            create_directory_if_not_exists(destinationPath)
            callback(null, destinationPath)
        } else {
            callback(null, uploadsDirectoryPath)
        }
    },
    filename: (req, { originalname }, callback) => {
        const { file } = req.body
        if (file) {
            callback(null, path.basename(file))
        } else {
            callback(null, originalname)
        }
    },
})

// Consider having that is s3.ts
let s3Storage: StorageEngine | undefined = undefined
if (s3Client && S3_BUCKET) {
    s3Storage = multerS3({
        s3: s3Client,
        bucket: S3_BUCKET,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => cb(null, file.originalname),
    })
}

const upload = multer({ storage: s3Storage ? s3Storage : diskStorage })

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

export default router
