import styles from '@/styles/DefaultPage.module.css'
import Head from 'next/head';
import { NAME, PRIVACY_POLICY, TERMS_OF_USE } from '@/config/config'
import MyImage from './MyImage/MyImage';
import USAI from '../../public/US-AI.png'
import Link from 'next/link';
import Button from './form/Button';
import { useRouter } from 'next/router';
import { LOGIN_FOOTER_BACKGROUND } from '@/config/config';
import { Auth } from '@/auth/auth';

// A wrapper for a default page
// Gives standard margins

export default function DefaultPage({ noMargin=false, title=NAME, mustSignIn=true, mainDivStyle={}, footerStyle={}, noBackground=false, backgroundColor="var(--light-background)", noFooter=false, children }){
    const router = useRouter()
    const { isSignedIn } = Auth.useAuth()

    let wrapperStyle = {'backgroundColor': backgroundColor}
    if (noBackground){
        wrapperStyle = {'backgroundImage': 'unset'}
    }
    if (noFooter){
        wrapperStyle['minHeight'] = 'unset'
    }

    let realStyle = noMargin ? {'margin': '0px', 'padding': '0px', ...mainDivStyle} : mainDivStyle
    if (mustSignIn && isSignedIn === false){
        realStyle['pointerEvents'] = 'none';
        realStyle['opacity'] = '.3';
    }

    const footer = (
        <div className={styles.footer} style={footerStyle}>
            <div className={styles.footerSection}>
                <MyImage src={USAI} height={45} alt={"US AI"} />
            </div>
            <div className={styles.footerSection} style={{'flex': '4'}}>
                <div>
                    Copyright © U.S. Artificial Intelligence Inc. All rights reserved.
                </div>
                <div>
                        By using our site, you confirm that you are over the age of 13 and agree to our <Link style={{'textDecoration': 'underline'}} href={TERMS_OF_USE}>Terms of Use</Link> and <Link href={PRIVACY_POLICY} style={{'textDecoration': 'underline'}}>Privacy Policy</Link>
                </div>
                <div>
                    Contact <u>team@goodreason.ai</u> with any questions, comments, or concerns.
                </div>
            </div>
            <div className={styles.footerSection} style={{'textDecoration': 'underline'}}>
                <div>
                    <Link href={'https://twitter.com/goodreasonai'}>
                        Twitter
                    </Link>
                </div>
                <div>
                    <Link href={'https://www.linkedin.com/company/goodreasonai'}>
                        LinkedIn
                    </Link>
                </div>
                <div>
                    <Link href={'https://blog.goodreason.ai/'}>
                        Blog
                    </Link>
                </div>
            </div>
        </div>
    )

    const currentUrl = `${router.asPath}`;
    return (
        <div className={styles.wrapper} style={{...wrapperStyle}}>
            <div className={styles.mainDiv} style={realStyle}>
                <Head>
                    <title>{title}</title>
                </Head>
                {children}
            </div>
            {!noFooter ? footer : ""}
            {
                mustSignIn && (
                    <Auth.SignedOut>
                        <div className={styles.signInFooter}>
                            <MyImage src={LOGIN_FOOTER_BACKGROUND} className={styles.signInFooterImg} alt={"Background image"} />
                            <div style={{'fontSize': '1.25rem', 'textShadow': '0px 0px 1px var(--light-background), 0px 0px 1px var(--light-background), 0px 0px 1px var(--light-background), 0px 0px 1px var(--light-background)'}}>
                                Won't you be our neighbor?
                            </div>
                            <div style={{'color': 'var(--passive-text)', 'fontSize': '.8rem'}}>
                                Register quickly and for free.
                            </div>
                            <div style={{'display': 'flex', 'gap': '20px', 'alignItems': 'center'}}>
                                <Link href={`${Auth.getSignInURL(currentUrl)}`}>
                                    <Button value={'Login'} />
                                </Link>
                                <div style={{'position': 'relative'}}>
                                    <Link href={`${Auth.getSignUpURL(currentUrl)}`}>
                                        <Button value={'Sign-Up'} />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </Auth.SignedOut>
                )
            }
        </div>
    )
}