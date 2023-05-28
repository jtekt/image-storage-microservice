import multer  from 'multer'
import { Router } from 'express'
import { import_images } from '../controllers/import'
import { directories } from '../config'

const router = Router()
const upload = multer({ dest: directories.temp })

router.route('/')
  .post(upload.single('archive'), import_images)


export default router
