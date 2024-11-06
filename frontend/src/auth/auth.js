import { useUser, SignedOut, SignedIn, useAuth, UserButton, ClerkProvider, SignIn, SignUp } from '@clerk/nextjs';
import { TERMS_OF_USE, PRIVACY_POLICY } from '@/config/config';
import { useMemo } from 'react';
import { CustomAuthProvider, CustomLogin, customLogout, useCustomAuth, getToken } from './custom';
import { splitName } from '@/utils/user';


export const AuthInterface = {
    Provider: ({children}) => <>{children}</>,  // wraps the entire app
    useUser: () => {
        return {
            user: { firstName: '', lastName: '', emailAddress: '' }
        };
    },  // provides information about the current user
    useAuth: () => {
        return {
            getToken: ()=>{return ""},
            isSignedIn: false
        }
    },  // gives a token (string) for backend requests
    UserButton: () => {return "User"},  // administrative button where the user can logout and change his info
    SignedIn: ({ children }) => <>{children}</>,  // passes through children when signed in
    SignedOut: ({ children }) => <>{children}</>,  // passes through children when signed out
    SignIn: ({ redirectUrl })=>"",  // the component users use to sign in
    SignUp: ({ redirectUrl })=>"",  // the component users use to sign up
    getSignInURL: (redirectUrl) => '/login',  // the link to where the user signs in
    getSignUpURL: (redirectUrl) => '/sign-up'   // same but for sign out
};

export const ClerkAuth = {
    ...AuthInterface,
    Provider: ({ pageProps, children }) => {return (
        <ClerkProvider
            appearance={{
                'layout': {
                    'termsPageUrl': TERMS_OF_USE,
                    'privacyPageUrl': PRIVACY_POLICY
                }
            }}
            {...pageProps}
        >
            {children}
        </ClerkProvider>
    )},
    useUser: () => {
        const { user } = useUser();
        const transformedUser = useMemo(() => {
            if (!user) return undefined;
            return {
                firstName: user.firstName,
                lastName: user.lastName,
                emailAddress: user.primaryEmailAddress?.emailAddress
            };
        }, [user]);
        return { user: transformedUser };
    },
    useAuth: () => {
        const { getToken, isSignedIn } = useAuth();
        return { getToken, isSignedIn }
    },
    SignIn: ({ redirectUrl }) => <SignIn fallbackRedirectUrl={redirectUrl ? redirectUrl : '/'} routing="hash" />,
    SignUp: ({ redirectUrl }) => <SignUp fallbackRedirectUrl={redirectUrl ? redirectUrl : '/'} signInUrl="/login" routing="hash" />,
    UserButton: () => {return <UserButton afterSignOutUrl="/" />},
    SignedIn: ({ children }) => {return <SignedIn>{children}</SignedIn>},
    SignedOut: ({ children }) => {return <SignedOut>{children}</SignedOut>},
    getSignInURL: (redirectUrl) => `/login?redirect_url=${redirectUrl}`,
    getSignUpURL: (redirectUrl) => `/sign-up?redirect_url=${redirectUrl}`,
};

export const CustomAuth = {
    ...AuthInterface,
    Provider: ({ pageProps, children }) => {return (
        <CustomAuthProvider pageProps={pageProps} >
            {children}
        </CustomAuthProvider>
    )},
    useUser: () => {
        const { user } = useCustomAuth()
        const transformedUser = useMemo(() => {
            if (!user){
                return undefined
            }
            const [firstName, lastName] = splitName(user.name)
            return {
                firstName:  firstName,
                lastName: lastName,
                emailAddress: user.email
            };
        }, [user]);
        return { 'user': transformedUser }
    },
    useAuth: () => {
        const { isSignedIn } = useCustomAuth()
        return useMemo(() => ({
            getToken: async () => {return (await getToken()).token},
            isSignedIn: isSignedIn
        }), [isSignedIn]);
    },
    SignedIn: ({ children }) => {
        const { isSignedIn } = useCustomAuth()
        return isSignedIn ? <>{children}</> : null;
    },
    SignedOut: ({ children }) => {
        const { isSignedIn } = useCustomAuth()
        return isSignedIn === false ? <>{children}</> : null;
    },
    UserButton: () => {
        return (
            <div className='_touchableOpacity' onClick={() => customLogout()}>Logout</div>
        )
    },
    SignIn: ({ redirectUrl })=> (<CustomLogin redirectUrl={redirectUrl} />),  // the component users use to sign in
    SignUp: ({ redirectUrl })=> (<CustomLogin redirectUrl={redirectUrl} />),  // the component users use to sign up
    getSignInURL: (redirectUrl) => !redirectUrl ? '/login' : `/login?redirect_url=${process.env.NEXT_PUBLIC_ROOT_URL}${redirectUrl}`,
    getSignUpURL: (redirectUrl) => !redirectUrl ? '/sign-up' : `/sign-up?redirect_url=${process.env.NEXT_PUBLIC_ROOT_URL}${redirectUrl}`
}

// Note: similar thing done in ssAuth.js

function getAuthExport(){
    const as = process.env.NEXT_PUBLIC_AUTH_SYSTEM
    if (as == 'clerk'){
        return ClerkAuth
    }
    else if (as == 'custom'){
        return CustomAuth
    }
}

export const Auth = getAuthExport()
