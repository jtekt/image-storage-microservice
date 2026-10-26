import { describe, it } from 'mocha'
import { expect } from 'chai'
import { envSchema } from '../config/env'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse only the field under test; all other fields fall back to their defaults. */
const parseField = <K extends string>(key: K, value: any) =>
    envSchema.parse({ [key]: value } as any)

// ---------------------------------------------------------------------------
// LIST_MAX_LIMIT — must exactly match Number(v) || 1000 behavior
// ---------------------------------------------------------------------------

describe('envSchema — LIST_MAX_LIMIT', () => {
    const parse = (val: any) => parseField('LIST_MAX_LIMIT', val).LIST_MAX_LIMIT

    it('defaults to 1000 when undefined (env var absent)', () =>
        expect(parse(undefined)).to.equal(1000))

    it('defaults to 1000 for empty string ""', () =>
        expect(parse('')).to.equal(1000))

    it('defaults to 1000 for non-numeric string "abc"', () =>
        expect(parse('abc')).to.equal(1000))

    it('defaults to 1000 for "0" (falsy in Number(v) || default)', () =>
        expect(parse('0')).to.equal(1000))

    it('preserves negative value "-5" (truthy — mirrors Number("-5") || 1000 = -5)', () =>
        expect(parse('-5')).to.equal(-5))

    it('preserves decimal value "2.5" (truthy — passes through unchanged)', () =>
        expect(parse('2.5')).to.equal(2.5))

    it('accepts a valid integer "500"', () =>
        expect(parse('500')).to.equal(500))

    it('accepts the maximum valid integer "1000"', () =>
        expect(parse('1000')).to.equal(1000))
})

// ---------------------------------------------------------------------------
// EXPORT_MAX_LIMIT — same logic, different default (10000)
// ---------------------------------------------------------------------------

describe('envSchema — EXPORT_MAX_LIMIT', () => {
    const parse = (val: any) => parseField('EXPORT_MAX_LIMIT', val).EXPORT_MAX_LIMIT

    it('defaults to 10000 when undefined', () =>
        expect(parse(undefined)).to.equal(10000))

    it('defaults to 10000 for non-numeric string', () =>
        expect(parse('abc')).to.equal(10000))

    it('defaults to 10000 for "0"', () =>
        expect(parse('0')).to.equal(10000))

    it('preserves a truthy numeric value "5000"', () =>
        expect(parse('5000')).to.equal(5000))
})

// ---------------------------------------------------------------------------
// APP_PORT
// ---------------------------------------------------------------------------

describe('envSchema — APP_PORT', () => {
    const parse = (val: any) => parseField('APP_PORT', val).APP_PORT

    it('defaults to 80 when undefined', () =>
        expect(parse(undefined)).to.equal(80))

    it('coerces a valid port string to a number', () =>
        expect(parse('3001')).to.equal(3001))

    it('accepts port 0 (assigns random OS port)', () =>
        expect(parse('0')).to.equal(0))

    it('falls back to 80 for a non-numeric string', () =>
        expect(parse('abc')).to.equal(80))
})

// ---------------------------------------------------------------------------
// MongoDB defaults
// ---------------------------------------------------------------------------

describe('envSchema — MongoDB defaults', () => {
    const base = envSchema.parse({})

    it('MONGODB_PROTOCOL defaults to "mongodb"', () =>
        expect(base.MONGODB_PROTOCOL).to.equal('mongodb'))

    it('MONGODB_HOST defaults to "localhost"', () =>
        expect(base.MONGODB_HOST).to.equal('localhost'))

    it('MONGODB_DB defaults to "image_storage"', () =>
        expect(base.MONGODB_DB).to.equal('image_storage'))

    it('MONGODB_OPTIONS defaults to ""', () =>
        expect(base.MONGODB_OPTIONS).to.equal(''))

    it('MONGODB_CONNECTION_STRING is undefined when not set', () =>
        expect(base.MONGODB_CONNECTION_STRING).to.be.undefined)

    it('MONGODB_USERNAME is undefined when not set', () =>
        expect(base.MONGODB_USERNAME).to.be.undefined)

    it('MONGODB_PASSWORD is undefined when not set', () =>
        expect(base.MONGODB_PASSWORD).to.be.undefined)

    it('MONGODB_PORT is undefined when not set', () =>
        expect(base.MONGODB_PORT).to.be.undefined)

    it('MONGODB_URL is undefined when not set', () =>
        expect(base.MONGODB_URL).to.be.undefined)
})

// ---------------------------------------------------------------------------
// S3 / MinIO defaults
// ---------------------------------------------------------------------------

describe('envSchema — S3 defaults', () => {
    const base = envSchema.parse({})

    it('S3_BUCKET is undefined when not set (signals local storage mode)', () =>
        expect(base.S3_BUCKET).to.be.undefined)

    it('S3_ENDPOINT defaults to "s3.amazonaws.com"', () =>
        expect(base.S3_ENDPOINT).to.equal('s3.amazonaws.com'))

    it('S3_PORT is undefined when not set (stays string for downstream Number() call)', () =>
        expect(base.S3_PORT).to.be.undefined)

    it('S3_ACCESS_KEY_ID defaults to ""', () =>
        expect(base.S3_ACCESS_KEY_ID).to.equal(''))

    it('S3_SECRET_ACCESS_KEY defaults to ""', () =>
        expect(base.S3_SECRET_ACCESS_KEY).to.equal(''))

    it('S3_REGION is undefined when not set', () =>
        expect(base.S3_REGION).to.be.undefined)

    it('S3_USE_SSL is undefined when not set', () =>
        expect(base.S3_USE_SSL).to.be.undefined)
})

// ---------------------------------------------------------------------------
// Auth defaults
// ---------------------------------------------------------------------------

describe('envSchema — auth defaults', () => {
    const base = envSchema.parse({})

    it('OIDC_ISSUER_BASE_URL is undefined when not set (auth disabled)', () =>
        expect(base.OIDC_ISSUER_BASE_URL).to.be.undefined)

    it('OIDC_AUDIENCE defaults to "account"', () =>
        expect(base.OIDC_AUDIENCE).to.equal('account'))
})

// ---------------------------------------------------------------------------
// Other server defaults
// ---------------------------------------------------------------------------

describe('envSchema — server defaults', () => {
    const base = envSchema.parse({})

    it('APP_VERSION defaults to "dev"', () =>
        expect(base.APP_VERSION).to.equal('dev'))

    it('TZ is undefined when not set', () =>
        expect(base.TZ).to.be.undefined)

    it('UPLOADS_DIRECTORY defaults to "uploads"', () =>
        expect(base.UPLOADS_DIRECTORY).to.equal('uploads'))
})

// ---------------------------------------------------------------------------
// MongoDB configuration alternatives (all three supported paths)
// ---------------------------------------------------------------------------

describe('envSchema — MongoDB configuration alternatives', () => {
    it('accepts a full MONGODB_CONNECTION_STRING', () => {
        const { MONGODB_CONNECTION_STRING } = envSchema.parse({
            MONGODB_CONNECTION_STRING:
                'mongodb://user:pass@host:27017/db?authSource=admin',
        })
        expect(MONGODB_CONNECTION_STRING).to.equal(
            'mongodb://user:pass@host:27017/db?authSource=admin'
        )
    })

    it('accepts legacy MONGODB_URL', () => {
        const { MONGODB_URL } = envSchema.parse({
            MONGODB_URL: 'mongodb://legacy-host:27017',
        })
        expect(MONGODB_URL).to.equal('mongodb://legacy-host:27017')
    })

    it('accepts individual MONGODB_USERNAME and MONGODB_PASSWORD', () => {
        const parsed = envSchema.parse({
            MONGODB_USERNAME: 'admin',
            MONGODB_PASSWORD: 'secret',
            MONGODB_HOST: 'db.internal',
            MONGODB_PORT: '27017',
            MONGODB_DB: 'mydb',
        })
        expect(parsed.MONGODB_USERNAME).to.equal('admin')
        expect(parsed.MONGODB_PASSWORD).to.equal('secret')
        expect(parsed.MONGODB_HOST).to.equal('db.internal')
        expect(parsed.MONGODB_PORT).to.equal('27017')
        expect(parsed.MONGODB_DB).to.equal('mydb')
    })

    it('accepts unauthenticated connection (no username or password)', () => {
        const parsed = envSchema.parse({
            MONGODB_HOST: 'localhost',
            MONGODB_DB: 'image_storage',
        })
        expect(parsed.MONGODB_USERNAME).to.be.undefined
        expect(parsed.MONGODB_PASSWORD).to.be.undefined
    })
})
