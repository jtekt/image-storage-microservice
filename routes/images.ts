import multer from "multer"
import path from "path"
import { create_directory_if_not_exists } from "../utils"
import { Router } from "express"
import { directories } from "../config"
import {
  read_images,
  upload_image,
  read_image,
  read_image_file,
  update_image,
  replace_image_data,
  delete_image,
  delete_images,
} from "../controllers/images"

// Need a special hander because keeping the original file name
const storage = multer.diskStorage({
  destination: (req, _, callback) => {
    // Allowing the user to specify a file name
    const { file } = req.body
    if (file) {
      const destinationPath = path.join(directories.uploads, path.dirname(file))
      create_directory_if_not_exists(destinationPath)
      callback(null, destinationPath)
    } else {
      callback(null, directories.uploads)
    }
  },
  filename: (req, { originalname }, callback) => {
    const { file } = req.body
    if (file) {
      callback(null, path.basename(file))
    } else {
      callback(null, originalname)
    }
  },
})

const router = Router({ mergeParams: true })
const upload = multer({ storage })

router
  .route("/")
  .get(read_images)
  .post(upload.single("image"), upload_image)
  .delete(delete_images)

router
  .route("/:_id")
  .get(read_image)
  .delete(delete_image)
  .patch(update_image)
  .put(replace_image_data)

router.route("/:_id/image").get(read_image_file)

export default router
