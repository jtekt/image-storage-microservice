import 'dotenv/config'
import { env } from './config/env'
import { author, name as application_name } from './package.json'

import express, { NextFunction, Request, Response } from 'express'
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
import { auth } from 'express-oauth2-jwt-bearer'

const { APP_PORT, OIDC_ISSUER_BASE_URL, OIDC_AUDIENCE, TZ, APP_VERSION } = env

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
            oidc_issuer_base_url: OIDC_ISSUER_BASE_URL,
            oidc_audience: OIDC_AUDIENCE,
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
    })
})

// plug in the middleware
if (OIDC_ISSUER_BASE_URL) {
    const jwtCheck = auth({
        issuerBaseURL: OIDC_ISSUER_BASE_URL,
        audience: OIDC_AUDIENCE.split(','),
    })

    app.use(jwtCheck)
}

app.use('/import', import_router)
app.use('/export', export_router)
app.use('/images', images_router)
app.use('/fields', fields_router)

// Express error handling
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err)
    const { statusCode = 500, message } = err
    res.status(statusCode).send(message)
})

// Start server
app.listen(APP_PORT, () => {
    console.log(`[Express] Listening on port ${APP_PORT}`)
})
