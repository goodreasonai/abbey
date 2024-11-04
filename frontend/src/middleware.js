import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { tokenName } from './auth/custom';


// Clerk middleware
const isProtectedRoute = createRouteMatcher(['/settings', "/create", "/library", "/bug"]);
const clerkMiddlewareWrapper = clerkMiddleware((auth, req) => {
    // Restrict dashboard routes to signed in users
    if (isProtectedRoute(req)) auth().protect();
});


function customAuthMiddleware(req) {
    const protectedRoutes = ['/settings', '/create', '/library', '/bug'];
    const url = req.nextUrl.clone();

    if (protectedRoutes.includes(url.pathname)) {
        const token = req.cookies.get(`${tokenName}`)        
        if (token?.value){
            try {
                const decoded = jwt.decode(token.value);
                // Check if the token is expired
                if (decoded.exp * 1000 < Date.now()) {  // the * 1000 is due to ms vs. s distinction
                    throw new Error('Token expired');
                }    
                return NextResponse.next();
            }
            catch (error) {
                console.error('Token validation failed:', error);
            }
        }

        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_ROOT_URL}/login`);
    }

    return NextResponse.next();
}

// Conditional export based on the environment variable
function getDefaultExport(){
    const authSystem = process.env.NEXT_PUBLIC_AUTH_SYSTEM 
    if (authSystem === 'clerk'){
        return clerkMiddlewareWrapper
    }
    else if (authSystem === 'custom'){
        return customAuthMiddleware
    }
}

export default getDefaultExport()

function getConfigExport(){
    const authSystem = process.env.NEXT_PUBLIC_AUTH_SYSTEM 
    if (authSystem === 'clerk'){
        return {
            matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
        }
    }
    else if (authSystem === 'custom'){
        return ['/settings', '/library', '/create', '/bug']
    }
}

export const config = getConfigExport()
