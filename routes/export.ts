import {Router} from 'express'
import { export_images } from '../controllers/export'

const router = Router()

router.route('/')
  .get(export_images)


export default router
