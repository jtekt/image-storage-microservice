import { Schema, model } from 'mongoose'

export interface IImage {
    _id?: Schema.Types.ObjectId
    file: string
    time?: Date
    data: any
}

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

export const Image = model('Image', imageSchema)
