import multer from 'multer'
import { Router } from 'express'
import { import_images } from '../controllers/import'
import { tempDirectoryPath } from '../fileStorage/local'

const router = Router()
const upload = multer({ dest: tempDirectoryPath })

router.route('/').post(upload.single('archive'), import_images)

export default router
