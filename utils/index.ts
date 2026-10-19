import createHttpError from 'http-errors'

export const parse_post_body = (body: any) => {
    const { json, data: bodyData, ...bodyRest } = body

    // Check if parsable jsonData
    const jsonData = json || bodyData
    return jsonData ? JSON.parse(jsonData) : bodyRest
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

const assertNoOperatorKeys = (obj: Record<string, any>) => {
    for (const key of Object.keys(obj)) {
        if (key.startsWith('$'))
            throw createHttpError(
                400,
                `Key "${key}" is not allowed in update body`
            )
    }
}

export const parseUpdateBody = (body: any) => {
    const { $unset = {}, ...$set } = body
    assertNoOperatorKeys($set)
    assertNoOperatorKeys($unset)
    return { $set: nestInDataField($set), $unset: nestInDataField($unset) }
}
