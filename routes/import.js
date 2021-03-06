const {Router} = require('express')
const path = require('path')
const multer  = require('multer')
const { import_collection } = require('../controllers/import.js')

const router = Router({mergeParams: true})
const storage = multer.memoryStorage()
const upload = multer({ storage, limits: { fieldSize: 25 * 1024 * 1024 } })


router.route('/')
  .post(upload.single('archive'), import_collection)


module.exports = router
