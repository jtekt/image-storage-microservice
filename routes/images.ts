import multer from "multer"
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
  destination: directories.uploads,

  filename: (req, file, callback) => {
    callback(null, file.originalname)
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
