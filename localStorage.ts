import path from 'path'
import { directories } from './config'
import { Response } from 'express'
import { rimraf } from 'rimraf'

export const downloadLocalFile = (res: Response, file: string) => {
    const file_absolute_path = path.join(directories.uploads, file)
    // Second argument is filename
    res.download(file_absolute_path, file)
}

export const removeLocalFile = (filename: string) =>
    rimraf(path.join(directories.uploads, filename))
