export const mongodb_export_file_name = 'mongodb_data.json'
export const export_excel_file_name = 'mongodb_data.xlsx'
export const maxExportLimit = Number(process.env.EXPORT_MAX_LIMIT) || 10000
export const defaultLimit = 100
export const maxListLimit = Number(process.env.LIST_MAX_LIMIT) || 1000

// Upload limits
// UPLOAD_MAX_FILE_SIZE: maximum bytes per uploaded file (images and import archives).
// Default: 100 MiB — large enough for high-resolution industrial images.
export const maxUploadFileSize =
    Number(process.env.UPLOAD_MAX_FILE_SIZE) || 100 * 1024 * 1024

// UPLOAD_MAX_FILES: maximum number of files per multipart request.
// Both upload endpoints use .single(), so 1 is the natural ceiling.
export const maxUploadFiles = Number(process.env.UPLOAD_MAX_FILES) || 1

// Import archive limits
// IMPORT_MAX_ENTRY_COUNT: maximum number of entries to extract from an import archive.
// Default matches EXPORT_MAX_LIMIT so that a full export archive can always be re-imported.
export const importMaxEntryCount =
    Number(process.env.IMPORT_MAX_ENTRY_COUNT) || maxExportLimit

// IMPORT_MAX_UNCOMPRESSED_SIZE: maximum total uncompressed bytes across all archive entries.
// Default: 10 GiB — prevents ZIP bomb attacks while allowing large dataset imports.
export const importMaxUncompressedSize =
    Number(process.env.IMPORT_MAX_UNCOMPRESSED_SIZE) || 10 * 1024 * 1024 * 1024
