import createHttpError from 'http-errors'
export const parse_post_body = (body: any) => {
    const { json, data: bodyData, ...bodyRest } = body

    // Check if parsable jsonData
    const jsonData = json || bodyData
    return jsonData ? JSON.parse(jsonData) : bodyRest
}

const isNotUndefined = (value: any) => value && value !== 'undefined'
const stringIsValidDate = (s: string) => !isNaN(new Date(s).getTime())

export const parse_query = (rawQuery: any) => {
    let {
        skip = '0',
        sort = 'time',
        order = '1',
        limit, // Do not put default here as set in /images and /export
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
        if (isNotUndefined(regex)) query.file = { $regex: file, $options: 'i' }
        else query.file = file
    }

    if (filter) {
        try {
            query = { ...query, ...JSON.parse(filter) }
        } catch (error) {
            throw createHttpError(400, 'Malformed filter')
        }
    }

    for (const key in rest) {
        const value = rest[key]
        if (isNotUndefined(regex))
            query[`data.${key}`] = { $regex: value, $options: 'i' }
        // Had to add this validation for issue #8
        else if(key === "ids[]") ids = value
        else query[`data.${key}`] = value
    }

    if (ids) {
        const idArray = Array.isArray(ids) ? ids : [ids]
        query._id = { $in: idArray }
    }

    // Time filters
    // Using $gt and $lt instead of $gte and $lte for annotation tool
    if (isNotUndefined(to) || isNotUndefined(from)) query.time = {}
    if (isNotUndefined(to)) {
        if (!stringIsValidDate(to))
            throw createHttpError(400, 'Parameter "to" is not a valid date')
        query.time.$lt = new Date(to)
    }
    if (isNotUndefined(from)) {
        if (!stringIsValidDate(from))
            throw createHttpError(400, 'Parameter "from" is not a valid date')
        query.time.$gt = new Date(from)
    }

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
