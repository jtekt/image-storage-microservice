import { Types } from 'mongoose'
export const parse_post_body = (body: any) => {
    const { json, data: bodyData, ...bodyRest } = body

    // Check if parseable jsonData
    const jsonData = json || bodyData
    return jsonData ? JSON.parse(jsonData) : bodyRest
}

export const parse_query = (rawQuery: any) => {
    const {
        skip = '0',
        sort = 'time',
        order = '1',
        limit, // Do not put default here as set in /imagers and /export
        from,
        to,
        regex = false, // boolean toggling partial text search, not ideal
        file,
        filter,
        select,
        ids,
        ...rest
    } = rawQuery

    // NOTE: partial text search on any field might not work because field list not fixed

    let query: any = {}

    if (file) {
        if (regex) query.file = { $regex: file, $options: 'i' }
        else query.file = file
    }

    if (filter) {
        try {
            query = { ...query, ...JSON.parse(filter) }
        } catch (error) {
            throw 'Malformed filter'
        }
    }

    for (const key in rest) {
        let value = rest[key]

        if (regex) query[`data.${key}`] = { $regex: value, $options: 'i' }
        else query[`data.${key}`] = value
    }

    if (ids) {
        const idArray = Array.isArray(ids) ? ids : [ids]
        query._id = { $in: idArray }
    }

    // Time filters
    // Using $gt and $lt instead of $gte and $lte for annotation tool
    if (to || from) query.time = {}
    if (to) query.time.$lt = new Date(to)
    if (from) query.time.$gt = new Date(from)

    return {
        query,
        to,
        from,
        limit,
        skip,
        sort,
        order,
        select,
    }
}

export const parse_formdata_fields = (body: { json?: any; data?: any }) => {
    const json_data = body.data || body.json
    const data = json_data ? JSON.parse(json_data) : body
    return data
}

const nestInDataField = (obj: any) =>
    Object.keys(obj).reduce(
        (acc, key) => ({ ...acc, [`data.${key}`]: obj[key] }),
        {}
    )
export const parseUpdateBody = (body: any) => {
    const { $unset = {}, ...$set } = body
    return { $set: nestInDataField($set), $unset: nestInDataField($unset) }
}
