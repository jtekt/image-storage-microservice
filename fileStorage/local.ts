import path from 'path'
import { existsSync, mkdirSync } from 'fs'
import { Response } from 'express'
import { rimrafSync } from 'rimraf'
import { diskStorage } from 'multer'
import { parse_post_body } from '../utils'
import { getUserId } from '../utils/user'

export const { UPLOADS_DIRECTORY = 'uploads' } = process.env

export const uploadsDirectoryPath = path.resolve(UPLOADS_DIRECTORY)
export const tempDirectoryPath = path.resolve('./temp')

export const create_directory_if_not_exists = (target: string) => {
    if (!existsSync(target)) return mkdirSync(target, { recursive: true })
}

export const downloadLocalFile = (res: Response, file: string) => {
    const file_absolute_path = path.join(uploadsDirectoryPath, file)
    // Second argument is filename
    res.download(file_absolute_path, file)
}

export const removeLocalFile = (filename: string) =>
    rimrafSync(path.join(uploadsDirectoryPath, filename))

export const localStorage = diskStorage({
    destination: (req, _, callback) => {
        const { file: userProvidedFilename } = parse_post_body(req.body)

        let destinationPath = uploadsDirectoryPath
        if (userProvidedFilename) {
            destinationPath = path.join(
                uploadsDirectoryPath,
                path.dirname(userProvidedFilename)
            )
        }

        if (req.user && process.env.IMAGE_SCOPE === 'user') {
            const userId = getUserId(req.user)

            if (!userId) {
                throw new Error('User ID not found')
            }

            destinationPath = path.join(destinationPath, userId)
        }

        create_directory_if_not_exists(destinationPath)

        callback(null, destinationPath)
    },
    filename: (req, { originalname }, callback) => {
        const { file: userProvidedFilename } = parse_post_body(req.body)

        let filename = originalname
        if (userProvidedFilename) {
            filename = path.basename(userProvidedFilename)
        }

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

            req.body.file = path.join(userId, filename)
        }

        // If the user provided a filename, we need to use it
        callback(null, filename)
    },
})
