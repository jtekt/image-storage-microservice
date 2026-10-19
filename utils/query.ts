import createHttpError from 'http-errors'
import type { SortOrder } from 'mongoose'

const isNotUndefined = (value: any) => value && value !== 'undefined'

// Escape all regex metacharacters so a client string is treated as a
// literal substring match rather than a raw regex pattern (ReDoS prevention).
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const isPlainObject = (v: any) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)

// { $ne: 'x' } is an operator expression, not a nested path
const isOperatorObject = (v: any) =>
    Object.keys(v).some((k) => k.startsWith('$'))

const flattenPaths = (obj: any, prefix = ''): Record<string, any> =>
    Object.entries(obj).reduce((acc, [k, v]) => {
        const path = prefix ? `${prefix}.${k}` : k
        if (isPlainObject(v) && !isOperatorObject(v))
            return { ...acc, ...flattenPaths(v, path) }
        return { ...acc, [path]: v }
    }, {})

const dataFilters = (rest: Record<string, any>): Record<string, any> =>
    Object.entries(rest).reduce((acc, [key, value]) => {
        // data[key]=value, already parsed into { data: { key: value } } by
        // the extended query parser
        if (key === 'data' && isPlainObject(value))
            return { ...acc, ...flattenPaths(value, 'data') }
        if (key.startsWith('data.') || key.startsWith('data[')) {
            // explicit data.<key> or data[key] — flatten nested objects
            const normalized = key.replace(/\[([^\]]+)\]/g, '.$1')
            if (isPlainObject(value) && !isOperatorObject(value))
                return { ...acc, ...flattenPaths(value, normalized) }
            return { ...acc, [normalized]: value }
        }
        // bare key=value — nest under data (deprecated path)
        return { ...acc, [`data.${key}`]: value }
    }, {})

const stringIsValidDate = (s: string) => !isNaN(new Date(s).getTime())

// Coerce a query-string value to number, boolean, or null when the caller
// opts in via coerce=true.  Strings that cannot be unambiguously classified
// are left as-is.  Empty strings and pure-whitespace strings are left as-is
// to avoid unintended type changes.
const coerceQueryValue = (s: string): any => {
    if (s === 'true') return true
    if (s === 'false') return false
    if (s === 'null') return null
    const trimmed = s.trim()
    if (trimmed !== '' && !isNaN(Number(trimmed))) return Number(trimmed)
    return s
}

// Query operators clients may use, in `filter` or as object values of other
// query parameters. Anything else (e.g. $where, $expr, $function) is rejected
const ALLOWED_OPERATORS = new Set([
    '$eq',
    '$ne',
    '$gt',
    '$gte',
    '$lt',
    '$lte',
    '$in',
    '$nin',
    '$and',
    '$or',
    '$nor',
    '$not',
    '$exists',
    '$type',
    '$regex',
    '$options',
    '$all',
    '$elemMatch',
    '$size',
])

const assertSafeQuery = (value: any): void => {
    if (Array.isArray(value)) return value.forEach(assertSafeQuery)
    if (!isPlainObject(value)) return

    for (const [key, nested] of Object.entries(value)) {
        if (key.startsWith('$')) {
            if (!ALLOWED_OPERATORS.has(key))
                throw createHttpError(400, `Operator ${key} is not allowed`)
        } else if (key.split('.').some((segment) => segment.startsWith('$')))
            throw createHttpError(400, `Field path ${key} is not allowed`)
        assertSafeQuery(nested)
    }
}

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
        coerce = false, // opt-in: coerce query-string values to number/boolean/null
        file,
        filter,
        select,
        ids,
        ...rest
    } = rawQuery

    // NOTE: partial text search on any field might not work because field list not fixed

    let query: any = {}

    if (file) {
        if (isNotUndefined(regex))
            query.file = { $regex: escapeRegex(String(file)), $options: 'i' }
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
            query[key] = {
                $regex: escapeRegex(String(value)),
                $options: 'i',
            }
        else
            query[key] =
                isNotUndefined(coerce) && typeof value === 'string'
                    ? coerceQueryValue(value)
                    : value
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

    assertSafeQuery(query)

    const sortStatement: { [key: string]: SortOrder } | undefined = sort
        ? { [String(sort)]: Number(order) as SortOrder }
        : undefined

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
