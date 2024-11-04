import { LandingPage, SHOW_SIGNED_OUT_HOME_PAGE, SignedInHomePage } from '../config/config'
import LoginPage from './login'
import { Auth } from '@/auth/auth'

export default function Home() {

    // Home page is taken care of in config
    return (
        <>
            <Auth.SignedIn>
                <SignedInHomePage />
            </Auth.SignedIn>
            <Auth.SignedOut>
                {SHOW_SIGNED_OUT_HOME_PAGE ? (
                    <LandingPage />
                ) : (
                    <LoginPage />
                )}
            </Auth.SignedOut>
        </>
    )
}
