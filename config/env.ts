import 'dotenv/config'
import { z } from 'zod'

// Replicates the Number(v) || fallback idiom used throughout the codebase for
// numeric env vars.  Truthy numbers (positive, negative, decimal) pass through
// unchanged; NaN, 0, and undefined all fall back to the given default.
const numberOrFallback = (fallback: number) =>
    z.preprocess(
        (v) => {
            const n = Number(v as any)
            return n || fallback
        },
        z.number()
    )

export const envSchema = z.object({
    // Server
    APP_PORT: z.coerce.number().catch(80),
    APP_VERSION: z.string().default('dev'),
    TZ: z.string().optional(),

    // Authentication (optional — omitting OIDC_ISSUER_BASE_URL disables auth)
    OIDC_ISSUER_BASE_URL: z.string().optional(),
    OIDC_AUDIENCE: z.string().default('account'),

    // MongoDB — all optional at schema level; db.ts owns the branching logic
    // for choosing between MONGODB_URL (legacy), MONGODB_CONNECTION_STRING,
    // MONGODB_USERNAME+PASSWORD, or unauthenticated connection.
    MONGODB_CONNECTION_STRING: z.string().optional(),
    MONGODB_PROTOCOL: z.string().default('mongodb'),
    MONGODB_USERNAME: z.string().optional(),
    MONGODB_PASSWORD: z.string().optional(),
    MONGODB_HOST: z.string().default('localhost'),
    MONGODB_PORT: z.string().optional(), // kept as string; db.ts appends ":${port}"
    MONGODB_DB: z.string().default('image_storage'),
    MONGODB_OPTIONS: z.string().default(''),
    MONGODB_URL: z.string().optional(), // legacy

    // Pagination / export limits — exact match to Number(v) || default behavior
    LIST_MAX_LIMIT: numberOrFallback(1000),
    EXPORT_MAX_LIMIT: numberOrFallback(10000),

    // Local file storage
    UPLOADS_DIRECTORY: z.string().default('uploads'),

    // S3 / MinIO (all optional — S3_BUCKET being absent means local storage)
    S3_BUCKET: z.string().optional(),
    S3_ENDPOINT: z.string().default('s3.amazonaws.com'),
    S3_PORT: z.string().optional(), // kept as string; s3.ts calls Number(S3_PORT) directly
    S3_REGION: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().default(''),
    S3_SECRET_ACCESS_KEY: z.string().default(''),
    S3_USE_SSL: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

export const env = envSchema.parse(process.env)
