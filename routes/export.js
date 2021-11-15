const {Router} = require('express')
const path = require('path')
const multer  = require('multer')
const {
  export_collection,
} = require('../controllers/export.js')

const router = Router({mergeParams: true})

router.route('/')
  .get(export_collection)


module.exports = router
