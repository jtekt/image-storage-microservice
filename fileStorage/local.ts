import path from 'path'
import { existsSync, mkdirSync } from 'fs'
import { Response } from 'express'
import { rimrafSync } from 'rimraf'
import { diskStorage } from 'multer'
import { parse_post_body } from '../utils'
export const { UPLOADS_DIRECTORY = 'uploads' } = process.env

export const uploadsDirectoryPath = path.resolve(UPLOADS_DIRECTORY)
export const tempDirectoryPath = path.resolve('./temp')

export const create_directory_if_not_exists = (target: string) => {
    if (!existsSync(target)) mkdirSync(target, { recursive: true })
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

        if (userProvidedFilename) {
            const destinationPath = path.join(
                uploadsDirectoryPath,
                path.dirname(userProvidedFilename)
            )
            create_directory_if_not_exists(destinationPath)
            callback(null, destinationPath)
        } else {
            create_directory_if_not_exists(uploadsDirectoryPath)
            callback(null, uploadsDirectoryPath)
        }
    },
    filename: (req, { originalname }, callback) => {
        const { file: userProvidedFilename } = parse_post_body(req.body)
        if (userProvidedFilename)
            callback(null, path.basename(userProvidedFilename))
        else callback(null, originalname)
    },
})
