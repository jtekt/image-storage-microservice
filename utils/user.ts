type UserLike = {
    [key: string]: any
    sub?: string
    _id?: string
    id?: string
    username?: string
}

export const getUserId = (user: UserLike): string | undefined => {
    const identifier = process.env.USER_IDENTIFIER

    if (identifier && user[identifier]) {
        return user[identifier]
    }

    return user.sub || user._id || user.id || user.username
}
