import { parse } from 'cookie';
import { tokenName } from './custom';

// Server-side auth
// Needs to be cleanly separated from the regular auth code.

async function clerkGetToken(ctx) {
    const { getAuth } = require("@clerk/nextjs/server");
    const { getToken } = getAuth(ctx.req);
    const token = await getToken();
    return token
}

async function customGetToken(ctx) {
    const cookies = parse(ctx.req.headers.cookie || '');
    const token = cookies[`${tokenName}`]
    return token
}

function getSsGetToken(){
    const as = process.env.NEXT_PUBLIC_AUTH_SYSTEM
    if (as == 'clerk'){
        return clerkGetToken
    }
    else if (as == 'custom'){
        return customGetToken
    }
}

export const ssAuthGetToken = getSsGetToken()
