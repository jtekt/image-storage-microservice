import { env } from './config/env'

export const mongodb_export_file_name = 'mongodb_data.json'
export const export_excel_file_name = 'mongodb_data.xlsx'
export const maxExportLimit = env.EXPORT_MAX_LIMIT
export const defaultLimit = 100
export const maxListLimit = env.LIST_MAX_LIMIT
