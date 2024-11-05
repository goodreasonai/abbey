import Link from "next/link";
import React, { createContext, use, useContext, useEffect, useState } from 'react';
import jwt from 'jsonwebtoken';
import GitHubLogo from '../../public/random/GitHubLogo.png'
import KeycloakLogo from '../../public/random/KeycloakLogo.png'
import styles from './Custom.module.css'
import MyImage from "@/components/MyImage/MyImage";
import GLogo from '../../public/random/GLogo.png'
import { Roboto } from 'next/font/google';

const roboto = Roboto({
    weight: ['300', '400', '500', '700'],
    subsets: ['latin'],
    display: 'swap',
});

export const tokenName = '_customToken'
export const refreshTokenName = '_customRefreshToken'
const refreshTimeout = 60 * 1000  // in milliseconds

// has "github" if process.env.NEXT_
const enabledProviders = []
if (process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === '1'){
    enabledProviders.push('google')
}
if (process.env.NEXT_PUBLIC_ENABLE_GITHUB_AUTH === '1'){
    enabledProviders.push('github')
}
if (process.env.NEXT_PUBLIC_ENABLE_KEYCLOAK_AUTH === '1'){
    enabledProviders.push('keycloak')
}

export function CustomLogin({ redirectUrl }) {

    let providers = [
        {
            'name': 'github',
            'value': (
                <>
                    <MyImage unoptimized={true} src={GitHubLogo} alt={"GitHub"} height={25} />
                    <div>Sign in with GitHub</div>
                </>
            )
        },
        {
            'name': 'google',
            'value': (
                <>
                    <MyImage canSwitch={false} unoptimized={true} src={GLogo} alt={"Google"} height={25} />
                    <div className={roboto.className}>Sign in with Google</div>
                </>
            )
        },
        {
            'name': `keycloak`,
            'value': (
                <MyImage canSwitch={false} unoptimized={true} src={KeycloakLogo} alt={"Keycloak"} height={25} />
            )
        },
    ]

    providers = providers.filter((x) => enabledProviders.includes(x.name))

    function makeProvider(item, i){
        return (
            <div>
                <a href={`/api/auth/login/${item.name}?returnUrl=${redirectUrl}`}>
                    <div className={styles.button}>
                        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                            {item.value}
                        </div>
                    </div>
                </a>
            </div>
        )
    }

    return (
        <div style={{'height': 'calc(100vh - var(--nav-bar-height) - 2 * var(--std-margin))', 'width': '100%', 'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center'}}>
            <div
                style={{
                    'backgroundColor': 'var(--light-primary)', 
                    'border': '1px solid var(--light-border)',
                    'width': '400px',
                    'borderRadius': 'var(--large-border-radius)',
                    'display': 'flex', 
                    'alignItems': 'stretch',
                    'justifyContent': 'center',
                    'flexDirection': 'column',
                    'gap': '1rem',
                    'padding': '10%'
                }}
                suppressHydrationWarning={true}
            >
                {providers.map(makeProvider)}
            </div>
        </div>
    )
}

const AuthContext = createContext();

export const CustomAuthProvider = ({ children }) => {
    const [token, setToken] = useState(undefined)
    const [isSignedIn, setIsSignedIn] = useState(undefined)
    const [user, setUser] = useState(undefined)
    
    function logout(){
        setIsSignedIn(false)
        setUser(undefined)
        setToken(undefined)        
    }

    useEffect(() => {
        const oldToken = getTokenLocally()
        if (oldToken){
            const interval = setInterval(async () => {
                const newToken = await tryRefresh()
                if (!newToken){
                    logout()
                    clearInterval(interval)
                }
                else {
                    setToken(newToken)
                }
            }, refreshTimeout);
            return () => clearInterval(interval);
        }
    }, [isSignedIn]);

    useEffect(() => {
        async function checkIfSignedIn(){
            const { token, payload } = await getToken()
            if (token) {
                setToken(token)
                setIsSignedIn(true)
                delete payload.exp
                delete payload.iat
                setUser(payload)
            }
            else {
                logout()
            }
        }
        checkIfSignedIn()
        document.addEventListener('visibilitychange', checkIfSignedIn);
        return () => {
            document.removeEventListener('visibilitychange', checkIfSignedIn);
        };
    }, []);

    return (
        <AuthContext.Provider value={{token, isSignedIn, user}}>
            {children}
        </AuthContext.Provider>
    );
};

export const useCustomAuth = () => {
    return useContext(AuthContext);
};

// Calls /refresh with retry error behavior
// If you can't refresh due to unauthorized (401), throws error immediately; otherwise tries again.
export async function refreshToken(extraTries) {

    if (extraTries < 0){
        throw new Error('Failed to refresh token (tries exceeded)');
    }

    let response = undefined
    try {
        response = await fetch('/api/auth/refresh', {
            method: 'POST',
        });
    }
    catch(e) {
        console.log(e)
        await new Promise(resolve => setTimeout(resolve, 250));
        return await refreshToken(extraTries-1)
    }

    if (response.stauts == 401){
        // Unauthorized; no need to try agagin.
        throw new Error('Failed to refresh token (unauthorized)');
    }

    if (!response.ok) {
        console.log("Token refresh response was not ok")
        await new Promise(resolve => setTimeout(resolve, 250));
        return await refreshToken(extraTries-1)
    }
}

async function tryRefresh(){
    let token = ""
    try {
        await refreshToken(1);
        token = getTokenLocally()
    }
    catch(e) {
        console.log(e)
        return ""
    }
    return token
}

// If it detects an old token, will try to refresh; otherwise returns token from cookies.
// May want to use a lock in here
export async function getToken(){
    const token = getTokenLocally()
    if (!token){
        return ""
    }
    else {
        const payload = jwt.decode(token);
        // if the token is expired
        const currentTime = Math.floor(Date.now() / 1000);  
        if (payload.exp < currentTime){
            // try refresh
            return { token: await tryRefresh(), payload }
        }
        return { token, payload }
    }
}
    

function getTokenLocally(){
    const token = document.cookie.split('; ').find(row => row.startsWith(`${tokenName}=`));
    if (!token){
        return ""
    }
    return token.split('=')[1]
}

export async function customLogout(){
    window.location.href = '/api/auth/logout';
}

