type UserLike = {
    [key: string]: any
    sub?: string
    _id?: string
    id?: string
    username?: string
}

export const getUserId = (user: UserLike): string | undefined => {
    const identifier = process.env.USER_IDENTIFIER

    let userId: string | undefined
    if (identifier && user[identifier]) {
        userId = user[identifier]
    }

    if (!userId) {
        userId =
            user.preferred_username ||
            user.sub ||
            user._id ||
            user.id ||
            user.username
    }

    return userId?.split(':').pop() || userId
}
