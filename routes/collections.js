
const express = require('express')
const collections_controller = require('../controllers/collections.js')
const images_router = require('./images.js')

const router = express.Router()

router.route('/')
.get(collections_controller.get_collections)

router.route('/import')
.get(collections_controller.import_collection)

router.route('/:collection')
.get(collections_controller.get_collection_info)
.delete(collections_controller.drop_collection)

router.route('/:collection/export')
.get(collections_controller.export_collection_zip)



router.use('/:collection/images', images_router)
router.use('/:collection/documents', images_router) // alias
router.use('/:collection/items', images_router) // alias


module.exports = router
