import { Schema, model } from 'mongoose'

export interface IImage {
    _id?: Schema.Types.ObjectId
    file: string
    time?: Date
    data: any
    userId?: string
}

const options = { minimize: false }

const imageSchema = new Schema<IImage>(
    {
        file: { type: String, required: true, unique: true },
        time: { type: Date, default: Date.now },
        data: { type: Schema.Types.Mixed, default: {} },
        userId: { type: String },
    },
    options
)

imageSchema.index({ time: 1 })
imageSchema.index(
    { userId: 1 },
    { partialFilterExpression: { userId: { $exists: true } } }
)

export const Image = model('Image', imageSchema)
