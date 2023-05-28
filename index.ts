import express, { NextFunction, Request, Response} from "express"
import "express-async-errors"
import cors from "cors"
import dotenv from "dotenv"
import apiMetrics from "prometheus-api-metrics"
import auth from "@moreillon/express_identification_middleware"
import group_auth from "@moreillon/express_group_based_authorization_middleware"
import * as db from "./db"
import { author, name as application_name, version } from "./package.json"
import { directories } from "./config.js"

import images_router from "./routes/images"
import import_router from "./routes/import"
import export_router from "./routes/export"
import fields_router from "./routes/fields"

dotenv.config()

const {
  APP_PORT = 80,
  AUTHENTICATION_URL,
  AUTHORIZED_GROUPS,
  GROUP_AUTHORIZATION_URL,
  TZ,
} = process.env

process.env.TZ = TZ || "Asia/Tokyo"

db.connect()

// Express configuration
export const app = express()
app.use(express.json())
app.use(cors())
app.use(apiMetrics())

app.get("/", (req, res) => {
  res.send({
    application_name,
    timeZone: process.env.TZ,
    author,
    version,
    mongodb: {
      url: db.url,
      db: db.db,
      connected: db.get_connected(),
    },
    directories,
    auth: {
      authentication_url: AUTHENTICATION_URL,
      group_authorization_url: GROUP_AUTHORIZATION_URL,
      authorized_groups: AUTHORIZED_GROUPS,
    },
  })
})

if (AUTHENTICATION_URL) app.use(auth({ url: AUTHENTICATION_URL }))
if (AUTHORIZED_GROUPS && GROUP_AUTHORIZATION_URL) {
  console.log(`Enabling group-based authorization`)
  const group_auth_options = {
    url: GROUP_AUTHORIZATION_URL,
    groups: AUTHORIZED_GROUPS.split(","),
  }
  app.use(group_auth(group_auth_options))
}

app.use("/import", import_router)
app.use("/export", export_router)
app.use("/images", images_router)
app.use("/fields", fields_router)

// Express error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err)
  const { statusCode = 500, message } = err
  res.status(statusCode).send(message)
})

// Start server
app.listen(APP_PORT, () => {
  console.log(`Image storage v${version} listening on port ${APP_PORT}`)
})

