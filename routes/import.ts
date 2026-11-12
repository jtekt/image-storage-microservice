import multer from 'multer'
import { Router } from 'express'
import { Request } from 'express'
import { import_images } from '../controllers/import'
import { tempDirectoryPath } from '../fileStorage/local'
import { maxUploadFileSize, maxUploadFiles } from '../config'

const router = Router()

const ALLOWED_MIMETYPES = [
    'application/x-zip-compressed',
    'application/zip',
    'application/octet-stream',
]

const upload = multer({
    dest: tempDirectoryPath,
    limits: {
        fileSize: maxUploadFileSize,
        files: maxUploadFiles,
    },
    fileFilter: (
        _req: Request,
        file: Express.Multer.File,
        cb: multer.FileFilterCallback
    ) => {
        if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
            cb(null, true)
        } else {
            cb(
                Object.assign(new Error(`Mimetype ${file.mimetype} is not allowed`), {
                    statusCode: 400,
                })
            )
        }
    },
})

router.route('/').post(upload.single('archive'), import_images)

export default router
