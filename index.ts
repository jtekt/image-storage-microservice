import dotenv from 'dotenv'
dotenv.config()
import { author, name as application_name, version } from './package.json'
console.log(`Image storage v${version}`)

import express, { NextFunction, Request, Response } from 'express'
import 'express-async-errors'
import cors from 'cors'
import promBundle from 'express-prom-bundle'
import auth from '@moreillon/express_identification_middleware'
import group_auth from '@moreillon/express_group_based_authorization_middleware'
import * as db from './db'
import { directories } from './config'
import { create_directory_if_not_exists } from './utils'
import { S3_BUCKET, S3_ENDPOINT, S3_REGION, s3Client } from './s3'
import swaggerUi from 'swagger-ui-express'
import swaggerDocument from './swagger-output.json'
import images_router from './routes/images'
import import_router from './routes/import'
import export_router from './routes/export'
import fields_router from './routes/fields'

const {
    APP_PORT = 80,

    AUTHENTICATION_URL,
    AUTHORIZED_GROUPS,
    GROUP_AUTHORIZATION_URL,
    TZ,
} = process.env

process.env.TZ = TZ || 'Asia/Tokyo'

const promOptions = { includeMethod: true, includePath: true }
const corsOptions = {
    exposedHeaders: 'Content-Disposition',
}

create_directory_if_not_exists(directories.temp)
create_directory_if_not_exists(directories.uploads)
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
            authentication_url: AUTHENTICATION_URL,
            group_authorization_url: GROUP_AUTHORIZATION_URL,
            authorized_groups: AUTHORIZED_GROUPS,
        },
        storage: {
            directories: !s3Client ? directories : undefined,
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

if (AUTHENTICATION_URL) app.use(auth({ url: AUTHENTICATION_URL }))
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
