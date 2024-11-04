import styles from "@/styles/LoginPage.module.css"
import DefaultPage from "@/components/DefaultPage";
import { useSearchParams } from 'next/navigation'
import { NAME } from "@/config/config";
import { LOGIN_BACKGROUND } from "@/config/config";
import MyImage from "@/components/MyImage/MyImage";
import { Auth } from "@/auth/auth";
import { useRouter } from "next/router";
import { useEffect } from "react";


export default function SignUpPage(){
    const searchParams = useSearchParams()
    const redirectUrl = searchParams.get('redirect_url')

    const { isSignedIn } = Auth.useAuth()
    const router = useRouter()

    useEffect(() => {
        if (isSignedIn && router){
            if (redirectUrl){
                router.push(redirectUrl)
            }
            else {
                router.push('/')
            }
        }
    }, [isSignedIn, router, redirectUrl])

    return (
        <DefaultPage title={`${NAME} - Sign Up`} mustSignIn={false} noMargin={true} footerStyle={{'margin': '0px'}} noBackground={true}>
            <MyImage canSwitch={false} src={LOGIN_BACKGROUND} className={styles.bgImg} alt={"Background image"} />
            <div className={`${styles.center}`}>
                <div style={{'margin': '1.5rem'}}>
                    <Auth.SignUp redirectUrl={redirectUrl} />
                </div>
            </div>
        </DefaultPage>
    )
}
