import styles from "@/styles/LoginPage.module.css"
import DefaultPage from "@/components/DefaultPage";
import { useSearchParams } from 'next/navigation'
import { LOGIN_BACKGROUND } from "@/config/config"; 
import { NAME } from "@/config/config";
import MyImage from "@/components/MyImage/MyImage";
import { Auth } from "@/auth/auth";
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function LoginPage() {
    
    const { isSignedIn } = Auth.useAuth()
    const router = useRouter()

    const searchParams = useSearchParams()
    const redirectUrl = searchParams.get('redirect_url')

    useEffect(() => {
        if (isSignedIn && router){
            if (redirectUrl){
                router.push(redirectUrl)
            }
            else {
                router.push('/')
            }
        }
    }, [isSignedIn, redirectUrl, router])

    return (
        <DefaultPage title={`${NAME} - Login`} mustSignIn={false} noMargin={true} footerStyle={{'margin': '0px'}} noBackground={true}>
            <MyImage canSwitch={false} src={LOGIN_BACKGROUND} className={styles.bgImg} alt={"Background image"} />
            <div className={`${styles.center}`}>
                <div style={{'margin': '1.5rem'}}>
                    <Auth.SignIn redirectUrl={redirectUrl} />
                </div>
            </div>
        </DefaultPage>
    )
}