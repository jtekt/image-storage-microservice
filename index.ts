import 'dotenv/config'
import { author, name as application_name } from './package.json'

import express, { Request, Response } from 'express'
import cors from 'cors'
import promBundle from 'express-prom-bundle'
import * as db from './db'
import { S3_BUCKET, S3_ENDPOINT, S3_REGION, s3Client } from './fileStorage/s3'
import { uploadsDirectoryPath, tempDirectoryPath } from './fileStorage/local'
import swaggerUi from 'swagger-ui-express'
import swaggerDocument from './swagger-output.json'
import images_router from './routes/images'
import import_router from './routes/import'
import export_router from './routes/export'
import fields_router from './routes/fields'
import middleware, {
    type Options,
} from '@jtekt/express-authentication-middleware'
import groupAuth from './group-auth'

const {
    APP_PORT = 80,
    OIDC_JWKS_URI,
    IDENTIFICATION_URL,
    AUTHORIZED_GROUPS,
    GROUP_AUTHORIZATION_URL,
    TZ,
    IMAGE_SCOPE,
    APP_VERSION = 'dev',
} = process.env

process.env.TZ = TZ || 'Asia/Tokyo'

const promOptions = { includeMethod: true, includePath: true }
const corsOptions = {
    exposedHeaders: 'Content-Disposition',
}

db.connect()

export const app = express()
app.set('query parser', 'extended')
app.use(express.json())
app.use(cors(corsOptions))
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))
app.use(promBundle(promOptions))

app.get('/', (_, res) => {
    res.send({
        application_name,
        author,
        version: APP_VERSION,
        timeZone: process.env.TZ,
        mongodb: {
            connection_string: db.redactedConnectionString,
            connected: db.get_connected(),
        },
        auth: {
            oidc_jwks_uri: OIDC_JWKS_URI,
            legacy_auth_url: IDENTIFICATION_URL,
            group_authorization_url: GROUP_AUTHORIZATION_URL,
            authorized_groups: AUTHORIZED_GROUPS,
        },
        storage: {
            directories: !s3Client
                ? {
                      uploadsDirectoryPath,
                      tempDirectoryPath,
                  }
                : undefined,
            s3: s3Client
                ? {
                      bucket: S3_BUCKET,
                      endpoint: S3_ENDPOINT,
                      region: S3_REGION,
                  }
                : undefined,
        },
        image_scope: IMAGE_SCOPE,
    })
})

// plug in the middleware
const options: Options = {
    strategies: {},
    identifierFieldName: '_id',
}

if (IDENTIFICATION_URL) {
    options.strategies.identification = {
        url: IDENTIFICATION_URL,
        identifierField: '_id',
    }
}

if (OIDC_JWKS_URI) {
    options.strategies.local = {
        secret: OIDC_JWKS_URI,
        identifierField: 'user_id',
    }
}
if (IDENTIFICATION_URL || OIDC_JWKS_URI) app.use(middleware(options))

if (AUTHORIZED_GROUPS && GROUP_AUTHORIZATION_URL) {
    console.log(`Enabling group-based authorization`)
    const groupAuthOptions = {
        url: GROUP_AUTHORIZATION_URL,
        groupIds: AUTHORIZED_GROUPS.split(','),
    }
    app.use(groupAuth(groupAuthOptions))
}

app.use('/import', import_router)
app.use('/export', export_router)
app.use('/images', images_router)
app.use('/fields', fields_router)

// Express error handling
app.use((err: any, _: Request, res: Response) => {
    console.error(err)
    const { statusCode = 500, message } = err
    res.status(statusCode).send(message)
})

// Start server
app.listen(APP_PORT, () => {
    console.log(`[Express] Listening on port ${APP_PORT}`)
})
