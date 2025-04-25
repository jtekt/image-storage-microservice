import multer from 'multer'
import { Router } from 'express'
import { import_images } from '../controllers/import'
import { tempDirectoryPath } from '../fileStorage/local'
import { multerImportFileFilter } from '../fileStorage/common'

const router = Router()
const upload = multer({
    dest: tempDirectoryPath,
    fileFilter: multerImportFileFilter,
})

router.route('/').post(upload.single('archive'), import_images)

export default router
