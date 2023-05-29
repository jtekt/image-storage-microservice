import { Router } from 'express'
import {
    read_fields,
    read_field_unique_values
} from '../controllers/fields'

const router = Router()


router.route('/')
    .get(read_fields)

router.route('/:field_name')
    .get(read_field_unique_values)


export default router
