import {
    S3Client,
    GetObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { Request, Response } from 'express'
import path from 'path'
import multerS3 from 'multer-s3'
import { StorageEngine } from 'multer'

export const {
    S3_REGION,
    S3_ACCESS_KEY_ID = '',
    S3_SECRET_ACCESS_KEY = '',
    S3_ENDPOINT,
    S3_BUCKET,
} = process.env

export let s3Client: S3Client | undefined
export let s3Storage: StorageEngine | undefined

if (S3_BUCKET) {
    console.log(`[S3] S3_BUCKET is set, uploading to "${S3_BUCKET}"`)

    s3Client = new S3Client({
        region: S3_REGION,
        credentials: {
            accessKeyId: S3_ACCESS_KEY_ID,
            secretAccessKey: S3_SECRET_ACCESS_KEY,
        },
        endpoint: S3_ENDPOINT,
    })

    s3Storage = multerS3({
        s3: s3Client,
        bucket: S3_BUCKET,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req: Request, { originalname }, callback) => {
            const { file: userProvidedFilename } = req.body
            const filename = userProvidedFilename || originalname
            callback(null, filename)
        },
    })
} else {
    console.log(`[S3] S3_BUCKET is NOT set, storing uploads locally`)
}

export const streamFileFromS3 = async (res: Response, Key: string) => {
    if (!S3_BUCKET || !s3Client) throw 'S3 not configured'

    const options = {
        Bucket: S3_BUCKET,
        Key,
    }

    const { base, ext } = path.parse(Key)

    const response = await s3Client.send(new GetObjectCommand(options))
    if (!response.Body) throw 'No Body'
    response.Body.transformToWebStream().pipeTo(
        new WritableStream({
            start() {
                // res.setHeader(
                //     'Content-Disposition',
                //     `attachment; filename=${encodeURIComponent(base)}`
                // )
                res.setHeader('Content-Type', `image/${ext.replace('.', '')}`)
            },
            write(chunk) {
                res.write(chunk)
            },
            close() {
                res.end()
            },
        })
    )
}

export const deleteFileFromS3 = async (Key: string) => {
    if (!S3_BUCKET || !s3Client) throw 'S3 not configured'
    const options = { Key, Bucket: S3_BUCKET }
    await s3Client.send(new DeleteObjectCommand(options))
}
