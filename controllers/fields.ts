import createHttpError from 'http-errors'
import { Image } from '../models/image'
import { parse_query } from '../utils'
import { Request, Response } from 'express'
import { getUserId } from '../utils/user'
import { PipelineStage } from 'mongoose'

export const read_fields = async (_: Request, res: Response) => {
    const pipeline: PipelineStage[] = []

    if (process.env.IMAGE_SCOPE === 'user') {
        const id = getUserId(res.locals.user)

        if (!id) throw createHttpError(401, 'User ID not provided')

        pipeline.push({ $match: { userId: id } })
    }

    pipeline.push(
        { $sample: { size: 100000 } },
        { $project: { arrayofkeyvalue: { $objectToArray: '$$ROOT.data' } } },
        { $unwind: '$arrayofkeyvalue' },
        { $group: { _id: null, fields: { $addToSet: '$arrayofkeyvalue.k' } } }
    )

    const [result] = await Image.aggregate(pipeline)

    if (!result) return res.send([])

    const { fields } = result

    res.send(fields)
}

export const read_field_unique_values = async (req: Request, res: Response) => {
    const { field_name } = req.params
    const { query } = parse_query(req.query)

    if (process.env.IMAGE_SCOPE === 'user') {
        const id = getUserId(res.locals.user)

        if (!id) throw createHttpError(401, 'User ID not provided')

        query.userId = id
    }

    const items = await Image.distinct(`data.${field_name}`, query)

    res.send(items)
}
