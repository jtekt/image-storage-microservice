import { Request, Response } from 'express'
import path from 'path'
import { Client } from 'minio'
import multerMinIOStorage from 'multer-minio-storage'
import { parse_post_body } from '../utils'
import { StorageEngine } from 'multer'
import { getUserId } from '../utils/user'
export const {
    S3_REGION,
    S3_ACCESS_KEY_ID = '',
    S3_SECRET_ACCESS_KEY = '',
    S3_ENDPOINT = 's3.amazonaws.com',
    S3_PORT,
    S3_BUCKET,
    S3_USE_SSL,
} = process.env

export let s3Client: Client
export let s3Storage: StorageEngine

if (S3_BUCKET) {
    console.log(`[S3] S3_BUCKET is set, uploading to "${S3_BUCKET}"`)

    s3Client = new Client({
        accessKey: S3_ACCESS_KEY_ID,
        secretKey: S3_SECRET_ACCESS_KEY,
        endPoint: S3_ENDPOINT,
        port: Number(S3_PORT),
        useSSL: !!S3_USE_SSL,
        region: S3_REGION,
    })

    s3Storage = multerMinIOStorage({
        minioClient: s3Client,
        bucket: S3_BUCKET,
        key: (req: Request, { originalname }, callback) => {
            const { file: userProvidedFilename } = parse_post_body(req.body)

            let filename = userProvidedFilename || originalname

            // Decode the filename
            try {
                const decoder = new TextDecoder('utf-8')
                filename = decoder.decode(Buffer.from(filename, 'latin1'))
            } catch (error) {
                console.error('Failed to decode filename:', error)
                // Fallback to original name
            }

            if (req.user && process.env.IMAGE_SCOPE === 'user') {
                const userId = getUserId(req.user)

                if (!userId) {
                    throw new Error('User ID not found')
                }

                filename = path.join(userId, filename)

                // Update the request filename
                req.body.file = filename
            }

            callback(null, filename)
        },
    })
} else {
    console.log(`[S3] S3_BUCKET is NOT set, storing uploads locally`)
}

export const streamFileFromS3 = async (res: Response, Key: string) => {
    if (!S3_BUCKET || !s3Client) throw 'S3 not configured'

    const stream = await s3Client.getObject(S3_BUCKET, Key)
    const { ext } = path.parse(Key)
    res.setHeader('Content-Type', `image/${ext.replace('.', '')}`)
    // res.setHeader(
    //     'Content-Disposition',
    //     `attachment; filename=${encodeURIComponent(base)}`
    // )
    stream.on('data', (chunk) => {
        res.write(chunk)
    })
    stream.on('end', () => {
        res.end()
    })
    stream.on('error', (err) => {
        res.end()
    })
}

export const deleteFileFromS3 = async (Key: string) => {
    if (!S3_BUCKET || !s3Client) throw 'S3 not configured'
    const options = { Key, Bucket: S3_BUCKET }
    await s3Client.removeObject(S3_BUCKET, Key)
}
