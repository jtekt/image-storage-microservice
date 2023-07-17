import { Schema, model } from "mongoose"
import IImage from "../interfaces/IImage"

const options = { minimize: false }

const imageSchema = new Schema<IImage>(
  {
    file: { type: String, required: true, unique: true },
    time: { type: Date, default: Date.now },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  options
)

imageSchema.index({ time: 1 })

const Image = model("Image", imageSchema)

export default Image
