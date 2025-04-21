import dotenv from 'dotenv'
dotenv.config()
import { author, name as application_name, version } from './package.json'
console.log(`Image storage v${version}`)

import express, { NextFunction, Request, Response } from 'express'
import 'express-async-errors'
import cors from 'cors'
import promBundle from 'express-prom-bundle'
import oidcAuth from '@moreillon/express-oidc'
import legacyAuth from '@moreillon/express_identification_middleware'
import group_auth from '@moreillon/express_group_based_authorization_middleware'
import * as db from './db'
import { S3_BUCKET, S3_ENDPOINT, S3_REGION, s3Client } from './fileStorage/s3'
import { uploadsDirectoryPath, tempDirectoryPath } from './fileStorage/local'
import swaggerUi from 'swagger-ui-express'
import swaggerDocument from './swagger-output.json'
import images_router from './routes/images'
import import_router from './routes/import'
import export_router from './routes/export'
import fields_router from './routes/fields'

const {
    APP_PORT = 80,
    OIDC_JWKS_URI,
    IDENTICATION_URL,
    AUTHORIZED_GROUPS,
    GROUP_AUTHORIZATION_URL,
    TZ,
    IMAGE_SCOPE,
} = process.env

process.env.TZ = TZ || 'Asia/Tokyo'

const promOptions = { includeMethod: true, includePath: true }
const corsOptions = {
    exposedHeaders: 'Content-Disposition',
}

db.connect()

export const app = express()
app.use(express.json())
app.use(cors(corsOptions))
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))
app.use(promBundle(promOptions))

app.get('/', (req, res) => {
    res.send({
        application_name,
        author,
        version,
        timeZone: process.env.TZ,
        mongodb: {
            connection_string: db.redactedConnectionString,
            connected: db.get_connected(),
        },
        auth: {
            oidc_jwks_uri: OIDC_JWKS_URI,
            legacy_auth_url: IDENTICATION_URL,
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

if (OIDC_JWKS_URI) {
    console.log(`Enabling OIDC authentication`)
    app.use(oidcAuth({ jwksUri: OIDC_JWKS_URI }))
} else if (IDENTICATION_URL) {
    console.log(`Enabling legacy authentication`)
    app.use(legacyAuth({ url: IDENTICATION_URL }))
}
if (AUTHORIZED_GROUPS && GROUP_AUTHORIZATION_URL) {
    console.log(`Enabling group-based authorization`)
    const group_auth_options = {
        url: GROUP_AUTHORIZATION_URL,
        groups: AUTHORIZED_GROUPS.split(','),
    }
    app.use(group_auth(group_auth_options))
}

app.use('/import', import_router)
app.use('/export', export_router)
app.use('/images', images_router)
app.use('/fields', fields_router)

// Express error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err)
    const { statusCode = 500, message } = err
    res.status(statusCode).send(message)
})

// Start server
app.listen(APP_PORT, () => {
    console.log(`[Express] Listening on port ${APP_PORT}`)
})
