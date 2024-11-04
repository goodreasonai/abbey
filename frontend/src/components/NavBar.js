import styles from '@/styles/NavBar.module.css'
import Link from 'next/link'
import Dropdown from './Dropdown/Dropdown';
import { LOGO, FRONTEND_VERSION } from '../config/config'
import MenuIcon from '../../public/icons/MenuIcon.png'
import MyImage from './MyImage/MyImage';
import { useTheme } from 'next-themes'
import { useCallback, useEffect } from 'react'
import Quick from './Quick/Quick';
import { HIDE_COLLECTIONS } from '../config/config';
import { Auth } from '@/auth/auth';
import useKeyboardShortcut from '@/utils/keyboard';

export default function NavBar({}){
  
    const { theme, setTheme } = useTheme()
    const UserButton = Auth.UserButton

    let mobileMenuValue = (
        <div style={{'display': 'flex', 'alignItems': 'center'}}>
            <MyImage src={MenuIcon} width={15} height={15} alt="Menu" />
        </div>
    )

    const keyboardShortcutCallback = useCallback(() => {
        setTheme(theme == 'dark' ? 'light' : 'dark')
    }, [theme])
    useKeyboardShortcut([['d']], keyboardShortcutCallback, true)

    return (
        <div className={`${styles.navBar}`}>
            <div className={`${styles.leftText}`}>
                <Link href="/" id='NavLogo' title={FRONTEND_VERSION}>
                    {LOGO}
                </Link>
            </div>
            <div className={styles.navBarRight}>
                <Auth.SignedOut>
                    <Link href={Auth.getSignInURL('/')}>
                        <div className={`${styles.littleLink}`}>
                            Login
                        </div>
                    </Link>
                    <Link href={Auth.getSignUpURL('/')}>
                        <div className={`${styles.littleLink}`}>
                            Sign Up
                        </div>
                    </Link>
                    {!HIDE_COLLECTIONS ? (
                        <Link href="/groups">
                            <div className={`${styles.littleLink}`}>
                                Collections
                            </div>
                        </Link>
                    ) : ""}
                </Auth.SignedOut>
                <Auth.SignedIn>
                    <Link href="/library" id="NavMyCards">
                        <div className={`${styles.littleLink}`}>
                            Library
                        </div>
                    </Link>
                    {!HIDE_COLLECTIONS ? (
                        <Link href="/groups" id='NavCollections'>
                            <div className={`${styles.littleLink}`}>
                                Collections
                            </div>
                        </Link>
                    ) : ""}
                    <Link href="/settings" id="NavProfile">
                        <div className={`${styles.littleLink}`}>
                            Settings
                        </div> 
                    </Link>
                    <Link href="/create" id='NavCreate'>
                        <div className={`${styles.littleLink}`}>
                            Create
                        </div>
                    </Link>
                    <div style={{'flex': '1', 'display': 'flex', 'paddingLeft': '15px', 'alignItems': 'center'}}>
                        <Quick />
                    </div>

                    <div className={styles.navBarRightRight}>
                        <UserButton />
                    </div>
                </Auth.SignedIn>
            </div>
            <div className={styles.mobileMenu}>
                <Auth.SignedOut>
                    <Dropdown rightAlign={true} value={mobileMenuValue} options={[
                        {'value': (<Link href={Auth.getSignInURL('/')}>Login</Link>), 'onClick': ()=>{}},
                        {'value': (<Link href={Auth.getSignUpURL('/')}>Sign Up</Link>), 'onClick': ()=>{}},
                    ]} />
                </Auth.SignedOut>
                <Auth.SignedIn>
                    <div style={{'display': 'flex', 'alignItems': 'center'}}>
                        <UserButton afterSignOutUrl="/" />
                    </div>
                    <Dropdown initialButtonStyle={{'padding': '5px 8px'}} rightAlign={true} value={mobileMenuValue} options={[
                        {'value': (<Link href="/library">Library</Link>), 'onClick': ()=>{}},
                        ...(HIDE_COLLECTIONS ? [] : [{'value': (<Link href="/groups">Collections</Link>), 'onClick': ()=>{}}]),
                        {'value': (<Link href="/settings">Settings</Link>), 'onClick': ()=>{}},
                        {'value': (<Link href="/create">Create</Link>), 'onClick': ()=>{}}
                    ]} />
                </Auth.SignedIn>
            </div> 
        </div>
    )
}

