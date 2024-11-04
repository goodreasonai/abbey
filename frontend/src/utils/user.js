import shortenText from "./text"


// Extracts everything before the @ sign in an email.
export function extractEmailName(email) {
    if (!email){
        return ''
    }
    const atIndex = email.indexOf('@');
    if (atIndex === -1) {
        // Couldn't find an @ sign.
        // Just use the whole thing
        return email
    }
    return email.substring(0, atIndex);
}


// for generating author stuff mostly
export function getUserName(user){
    if (!user){  // shouldn't really happen.
        return "Anon"
    }
    if (user.firstName && user.lastName){
        return `${user.firstName} ${user.lastName}`
    }
    else if (user.firstName){
        return user.firstName
    }
    return shortenText(extractEmailName(user.emailAddress), 2, 100, true)
}

export function splitName(name){
    if (!name){
        return ["", ""]
    }
    const parts = name.trim().split(/\s+/);
    // Ensure the result is always an array with two elements
    if (parts.length === 1) {
        return [parts[0], ""];
    }
    return parts
}
