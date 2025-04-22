import { Request, Response, NextFunction } from 'express'

type User = Record<string, any>

declare global {
    namespace Express {
        interface Request {
            user?: User
        }
    }
}

export function bindUserToRequestMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
        req.user = res.locals.user
        next()
    }
}
