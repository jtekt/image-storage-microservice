import { Express, Request } from 'express'

type User = Record<string, any>

declare global {
    namespace Express {
        interface Request {
            user?: User
        }
    }
}
