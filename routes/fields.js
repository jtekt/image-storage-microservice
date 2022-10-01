const { Router } = require('express')
const {
    read_fields,
    read_field_unique_values
} = require('../controllers/fields')

const router = Router()


router.route('/')
    .get(read_fields)

router.route('/:field_name')
    .get(read_field_unique_values)


module.exports = router
