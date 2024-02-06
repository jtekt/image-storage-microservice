import { s3Client, deleteFileFromS3 } from './s3'
import { removeLocalFile } from './local'

export const removeImageFiles = async (items: { file: string }[]) => {
    for await (const { file } of items) {
        try {
            if (s3Client) await deleteFileFromS3(file)
            else await removeLocalFile(file)
        } catch (error) {
            console.error(error)
        }
    }
}
