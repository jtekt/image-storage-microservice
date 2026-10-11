import path from 'path'
import createHttpError from 'http-errors'

// Stored file paths are relative to the uploads directory (or bucket root).
// Reject anything that could point outside of it
export const assertSafeFilePath = (file: unknown): string => {
    if (
        typeof file !== 'string' ||
        !file ||
        file.includes('\0') ||
        path.isAbsolute(file) ||
        file.split(/[\\/]/).includes('..')
    )
        throw createHttpError(400, `Invalid file path: ${file}`)
    return file
}

// Absolute path of a stored file, guaranteed to be inside baseDirectory
export const resolveInside = (baseDirectory: string, file: unknown) => {
    const resolved = path.resolve(baseDirectory, assertSafeFilePath(file))
    const relative = path.relative(baseDirectory, resolved)
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
        throw createHttpError(400, `Invalid file path: ${file}`)
    return resolved
}
