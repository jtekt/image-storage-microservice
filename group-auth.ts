import { Request, Response, NextFunction } from 'express'

interface GroupAuthOptions {
    url: string
    groupIds: string[]
}

const retrieveJwt = (req: Request, res: Response): string | undefined => {
    const authHeader = req.headers?.authorization
    if (authHeader) {
        return authHeader.split(' ')[1]
    }
    return (req.query.jwt as string) || (req.query.token as string)
}

const getMatchingGroups = (
    groupsOfUser: any[],
    groupIds: string[]
): string[] => {
    return groupsOfUser
        .map((g) => {
            const id =
                g.properties?._id ||
                g.properties?.id ||
                g.identity ||
                g._id ||
                g.id
            return id?.toString()
        })
        .filter((id) => id && groupIds.includes(id))
}

const middleware = (options: GroupAuthOptions = {} as GroupAuthOptions) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!options.url) {
            const message = 'Group check URL not specified'
            console.log(`[Group Auth] ${message}`)
            return res.status(500).send(message)
        }

        // Retrieve JWT
        const jwt = retrieveJwt(req, res)
        if (!jwt) {
            const message =
                'JWT not found in authorization header or query params'
            console.log(`[Group Auth] ${message}`)
            return res.status(401).send(message)
        }

        if (!options.groupIds?.length) {
            const message = 'No group ID specified'
            console.log(`[Group Auth] ${message}`)
            return res.status(500).send(message)
        }

        try {
            const response = await fetch(options.url, {
                headers: {
                    Authorization: `Bearer ${jwt}`,
                    'Content-Type': 'application/json',
                },
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const data = await response.json()
            const groupsOfUser = data.items || data
            const matchingGroups = getMatchingGroups(
                groupsOfUser,
                options.groupIds
            )

            if (matchingGroups.length) {
                res.locals.groups = matchingGroups
                return next()
            } else {
                const message = `User is not a member of required groups: ${options.groupIds.join(', ')}`
                console.log(`[Group Auth] ${message}`)
                return res.status(403).send(message)
            }
        } catch (error) {
            console.error(`[Group Auth] Error:`, error)
            return res.status(403).send('Authorization check failed')
        }
    }
}

export default middleware
export type { GroupAuthOptions }
