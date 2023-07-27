import Image from "../models/image"
import { parse_query } from "../utils"
import { Request, Response } from "express"

export const read_fields = async (req: Request, res: Response) => {
  const [{ fields }] = await Image.aggregate([
    { $sample: { size: 100000 } },
    { $project: { arrayofkeyvalue: { $objectToArray: "$$ROOT.data" } } },
    { $unwind: "$arrayofkeyvalue" },
    { $group: { _id: null, fields: { $addToSet: "$arrayofkeyvalue.k" } } },
  ])

  res.send(fields)
}

export const read_field_unique_values = async (req: Request, res: Response) => {
  const { field_name } = req.params
  const { query } = parse_query(req.query)

  const items = await Image.distinct(`data.${field_name}`, query)

  res.send(items)
}
