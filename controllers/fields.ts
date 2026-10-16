import { Image } from '../models/image'
import { parse_query } from '../utils/query'
import { Request, Response } from 'express'
import { PipelineStage } from 'mongoose'

export const read_fields = async (_: Request, res: Response) => {
    const pipeline: PipelineStage[] = [
        { $sample: { size: 100000 } },
        { $project: { arrayofkeyvalue: { $objectToArray: '$$ROOT.data' } } },
        { $unwind: '$arrayofkeyvalue' },
        { $group: { _id: null, fields: { $addToSet: '$arrayofkeyvalue.k' } } },
    ]

    const [result] = await Image.aggregate(pipeline)

    if (!result) return res.send([])

    const { fields } = result
    fields.sort((a: string, b: string) => a.localeCompare(b))

    res.send(fields)
}

export const read_field_unique_values = async (req: Request, res: Response) => {
    const { field_name } = req.params
    const { query } = parse_query(req.query)

    const fieldPath = `data.${field_name}`
    const distinctQuery = {
        ...query,
        [fieldPath]: {
            ...(query[fieldPath] && typeof query[fieldPath] === 'object'
                ? query[fieldPath]
                : {}),
            $ne: null,
            $exists: true,
        },
    }

    const items = await Image.distinct(fieldPath, distinctQuery)

    res.send(items)
}
