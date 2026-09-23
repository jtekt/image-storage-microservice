import { NextFunction, Request, Response, Router } from 'express'
import legacyAuth from '@moreillon/express_identification_middleware'
import oidcAuth from '@moreillon/express-oidc'

const { OIDC_JWKS_URI, IDENTIFICATION_URL } = process.env

export const createAuthMiddleware = () => {
    if (!IDENTIFICATION_URL && !OIDC_JWKS_URI) {
        return (_req: Request, _res: Response, next: NextFunction) => next()
    }

    const legacyMiddleware = IDENTIFICATION_URL
        ? legacyAuth({ url: IDENTIFICATION_URL })
        : null

    const oidcMiddleware = OIDC_JWKS_URI
        ? oidcAuth({ jwksUri: OIDC_JWKS_URI })
        : null

    //  Both enabled
    if (legacyMiddleware && oidcMiddleware) {
        console.log('[Auth] Both Legacy and OIDC auth are enabled')

        return (req: Request, res: Response, next: NextFunction) => {
            // Route to the correct middleware based on the JWT header's kid field.
            // Legacy JWTs never carry a kid; OIDC JWTs always do (required for JWKS
            // key lookup). This lets us avoid running both middlewares on every request.
            const token = req.headers.authorization?.split(' ')[1]

            let hasKid = false

            if (token) {
                try {
                    const header = JSON.parse(
                        Buffer.from(token.split('.')[0], 'base64url').toString(
                            'utf8'
                        )
                    )
                    hasKid = !!header.kid
                } catch {
                    // Malformed token — let the selected middleware produce the error
                }
            }

            if (hasKid) {
                return oidcMiddleware!(req, res, next)
            }

            return legacyMiddleware!(req, res, next)
        }
    }

    // Only legacy
    if (legacyMiddleware) {
        console.log(`[Auth] Legacy auth enabled: ${IDENTIFICATION_URL}`)
        return legacyMiddleware
    }

    // Only OIDC
    if (oidcMiddleware) {
        console.log(`[Auth] OIDC auth enabled: ${OIDC_JWKS_URI}`)
        return oidcMiddleware
    }

    return (_req: Request, _res: Response, next: NextFunction) => next()
}
