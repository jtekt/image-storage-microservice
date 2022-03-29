const {Router} = require('express')
const {
  get_collections,
  get_collection_info,
  drop_collection,
} = require('../controllers/collections.js')
const images_router = require('./images.js')
const import_router = require('./import.js')
const export_router = require('./export.js')

const router = Router()

router.route('/')
  .get(get_collections)


router.route('/:collection')
  .get(get_collection_info)
  .delete(drop_collection)


router.use('/:collection/import', import_router)
router.use('/:collection/export', export_router)

router.use('/:collection/images', images_router)
router.use('/:collection/documents', images_router) // alias
router.use('/:collection/items', images_router) // alias


module.exports = router
