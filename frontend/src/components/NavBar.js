import styles from '@/styles/NavBar.module.css'
import Link from 'next/link'
import Dropdown from './Dropdown/Dropdown';
import { LOGO, FRONTEND_VERSION } from '../config/config'
import MenuIcon from '../../public/icons/MenuIcon.png'
import MyImage from './MyImage/MyImage';
import { useTheme } from 'next-themes'
import { useCallback, useState, createContext, useContext, useRef, useEffect } from 'react'
import Quick from './Quick/Quick';
import { HIDE_COLLECTIONS } from '../config/config';
import { Auth } from '@/auth/auth';
import useKeyboardShortcut from '@/utils/keyboard';

export default function NavBar({}){
  
    const { theme, setTheme } = useTheme()
    const UserButton = Auth.UserButton
    const { isShrunk, setNavBarHeight, wantNavBar, shrinkNavBar, expandNavBar, setOnNavBar, onNavBar, quickWantsNavBar, setQuickWantsNavBar } = useNavBar();
    const navBarRef = useRef(null);

    let mobileMenuValue = (
        <div style={{'display': 'flex', 'alignItems': 'center'}}>
            <MyImage src={MenuIcon} width={15} height={15} alt="Menu" />
        </div>
    )

    const keyboardShortcutCallback = useCallback(() => {
        setTheme(theme == 'dark' ? 'light' : 'dark')
    }, [theme])
    useKeyboardShortcut([['d']], keyboardShortcutCallback, true)

    useEffect(() => {
        let shrinkTimer;
        if (!onNavBar && !wantNavBar && !quickWantsNavBar){
            shrinkTimer = setTimeout(() => {
                shrinkNavBar();
            }, 1000);
        }
        else {
            if (shrinkTimer) {
                clearTimeout(shrinkTimer);
            }
            expandNavBar()
        }
        return () => {
            if (shrinkTimer) {
                clearTimeout(shrinkTimer);
            }
        };
    }, [onNavBar, wantNavBar, quickWantsNavBar])

    useEffect(() => {
        const navBar = navBarRef.current;

        if (!navBar) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                setNavBarHeight(entry.contentRect.height);
            }
        });

        resizeObserver.observe(navBar);

        function handleMouseEnter(){
            setOnNavBar(true)
        }

        function handleMouseLeave(){
            setOnNavBar(false)
        }

        navBar.addEventListener('mouseenter', handleMouseEnter);
        navBar.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            navBar.removeEventListener('mouseleave', handleMouseLeave);
            navBar.removeEventListener('mouseleave', handleMouseLeave);
            resizeObserver.disconnect();
        };
    }, [setNavBarHeight, navBarRef?.current, wantNavBar]);

    return (
        <div ref={navBarRef} style={{'height': isShrunk ? '15px' : 'var(--nav-bar-height)', 'overflow': 'hidden', 'transition': 'all var(--nav-bar-transition) ease-in-out', 'position': 'relative'}}>
            <div style={{'position': 'absolute', 'top': '0px', 'left': '0px', 'height': '100%', 'width': '100%', 'backgroundColor': 'var(--light-primary)', 'transition': 'all .5s ease-in-out', 'zIndex': '1', 'opacity': isShrunk ? '1' : '0', 'pointerEvents': !isShrunk ? 'none': 'auto'}}></div>
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
        </div>
    )
}

// Create a context with default values
const NavBarContext = createContext();

export const useNavBar = () => {
    return useContext(NavBarContext);
};

export const NavBarProvider = ({ children }) => {
    const [isShrunk, setIsShrunk] = useState(false);
    const [navBarHeight, setNavBarHeight] = useState('var(--nav-bar-height)')
    const [wantNavBar, setWantNavBar] = useState(true);  // whether an asset wants the nav bar open or closed
    const [quickWantsNavBar, setQuickWantsNavBar] = useState(true);  // whether <Quick /> needs the navbar open or not 
    const [onNavBar, setOnNavBar] = useState(false)

    const shrinkNavBar = () => {
        setIsShrunk(true);
    };

    const expandNavBar = () => {
        setIsShrunk(false);
    };

    return (
        <NavBarContext.Provider value={{ setOnNavBar, onNavBar, navBarHeight, setNavBarHeight, isShrunk, shrinkNavBar, expandNavBar, wantNavBar, setWantNavBar, quickWantsNavBar, setQuickWantsNavBar }}>
            {children}
        </NavBarContext.Provider>
    );
};

