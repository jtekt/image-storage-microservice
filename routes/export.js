const {Router} = require('express')
const {
  export_images,
} = require('../controllers/export.js')

const router = Router()

router.route('/')
  .get(export_images)


module.exports = router
