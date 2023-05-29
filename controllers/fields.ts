import Image from "../models/image"
import { parse_query } from "../utils"
import { Request, Response } from "express"

export const read_fields = async (req: Request, res: Response) => {
  // TODO: find more efficient way
  const { limit = 10000 } = req.query as any
  const images = await Image.find({}).limit(limit)

  // Using set to remove duplicates
  const fields = images.reduce((prev, { data }) => {
    Object.keys(data).forEach((i) => prev.add(i))
    return prev
  }, new Set<string>([]))

  res.send([...fields])
}

export const read_field_unique_values = async (req: Request, res: Response) => {
  const { field_name } = req.params
  const { query } = parse_query(req.query)

  const items = await Image.distinct(`data.${field_name}`, query)

  res.send(items)
}
