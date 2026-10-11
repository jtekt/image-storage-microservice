import createHttpError from 'http-errors'
export const parse_post_body = (body: any) => {
    const { json, data: bodyData, ...bodyRest } = body

    // Check if parsable jsonData
    const jsonData = json || bodyData
    return jsonData ? JSON.parse(jsonData) : bodyRest
}

const isNotUndefined = (value: any) => value && value !== 'undefined'

const isPlainObject = (v: any) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)

const isNestedPath = (key: string) => !key.startsWith('$')

const flattenPaths = (obj: any, prefix = ''): Record<string, any> =>
    Object.entries(obj).reduce((acc, [k, v]) => {
        const path = prefix ? `${prefix}.${k}` : k
        if (isPlainObject(v) && isNestedPath(k))
            return { ...acc, ...flattenPaths(v, path) }
        return { ...acc, [path]: v }
    }, {})

const dataFilters = (rest: Record<string, any>): Record<string, any> =>
    Object.entries(rest).reduce((acc, [key, value]) => {
        if (key.startsWith('data.') || key.startsWith('data[')) {
            // explicit data.<key> or data[key] — flatten nested objects
            const normalized = key.replace(/\[([^\]]+)\]/g, '.$1')
            if (isPlainObject(value))
                return { ...acc, ...flattenPaths(value, normalized) }
            return { ...acc, [normalized]: value }
        }
        // bare key=value — nest under data (deprecated path)
        return { ...acc, [`data.${key}`]: value }
    }, {})

const stringIsValidDate = (s: string) => !isNaN(new Date(s).getTime())

export const parse_query = (rawQuery: any) => {
    // TODO: using zod would be helpful
    const {
        skip = '0',
        sort,
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

    for (const [key, value] of Object.entries(dataFilters(rest))) {
        if (isNotUndefined(regex))
            query[key] = { $regex: value, $options: 'i' }
        else query[key] = value
    }

    if (ids) {
        // Make it an array if not already
        const idArray = Array.isArray(ids) ? ids : [ids]
        query._id = { $in: idArray }
    }

    // Time filters
    if (isNotUndefined(to) || isNotUndefined(from)) query.time = {}
    if (isNotUndefined(to)) {
        if (!stringIsValidDate(to))
            throw createHttpError(400, 'Parameter "to" is not a valid date')
        query.time.$lte = new Date(to)
    }
    if (isNotUndefined(from)) {
        if (!stringIsValidDate(from))
            throw createHttpError(400, 'Parameter "from" is not a valid date')
        query.time.$gte = new Date(from)
    }

    const sortStatement = sort ? { [sort]: order } : undefined

    return {
        query,
        to,
        from,
        limit,
        skip,
        select,
        sortStatement,
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
