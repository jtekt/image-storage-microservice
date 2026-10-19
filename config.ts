export const mongodb_export_file_name = 'mongodb_data.json'
export const export_excel_file_name = 'mongodb_data.xlsx'
export const maxExportLimit = Number(process.env.EXPORT_MAX_LIMIT) || 10000
export const defaultLimit = 100
export const maxListLimit = Number(process.env.LIST_MAX_LIMIT) || 1000
