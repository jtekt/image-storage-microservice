import { s3Client, deleteFileFromS3 } from './s3'
import { removeLocalFile } from './local'
import type { Options } from 'multer'
import createHttpError from 'http-errors'

export const removeImageFiles = async (items: { file: string }[]) => {
    for await (const { file } of items) {
        try {
            if (s3Client) await deleteFileFromS3(file)
            else removeLocalFile(file)
        } catch (error) {
            console.error(error)
        }
    }
}

export const multerImageFilter: Options['fileFilter'] = (_, file, callback) => {
    const [type] = file.mimetype.split('/')

    if (type !== 'image') {
        callback(createHttpError(415, 'Unsupported Media Type'))
    }

    callback(null, true)
}

export const multerImportFileFilter: Options['fileFilter'] = (
    _,
    file,
    callback
) => {
    const allowed_mimetypes = [
        'application/x-zip-compressed',
        'application/zip',
        'application/octet-stream',
    ]

    if (!allowed_mimetypes.includes(file.mimetype)) {
        callback(createHttpError(415, 'Unsupported Media Type'))
    }

    callback(null, true)
}
