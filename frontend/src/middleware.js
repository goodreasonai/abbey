import { NextResponse } from 'next/server';
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
            // I used to verify this JWT
            // However, NextJS middleware runs on a special runtime that doesn't support the jsonwebtoken module
            // Alas – I can think of some ways around it, but annoying!
            return NextResponse.next();
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

export const config = {
    matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
