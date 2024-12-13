import NavBar from '@/components/NavBar';
import Favicon16x16 from '../../public/Favicon16x16.png'
import Favicon32x32 from '../../public/Favicon32x32.png'
import FaceliftHomePage from '@/components/HomePages/FaceliftHomePage';
import NavBarLogo from '../../public/NavBarLogo.png'
import DefaultLogo from './DefaultLogo';
import SignedOutHomePage from '@/components/HomePages/SignedOutHomePage';
import Babel from '../../public/random/babel.jpg'
import Library from '../../public/random/Library.png'
import RhodesExpanded from '../../public/random/RhodesExpanded.webp'

export const FRONTEND_VERSION = '0.12.7'

/*

Most Important Config Variables

*/

export const NAME = "Abbey"
export const NAV_BAR_LOGO = NavBarLogo
export const LOGO = (<DefaultLogo mainImage={NAV_BAR_LOGO} mainText={NAME} />)  // just puts the text next to the image with the correct sizes / spacing.
export const FAVICON_16x16 = Favicon16x16
export const FAVICON_32x32 = Favicon32x32
export const HOME_PAGE_URL = "https://abbey.us.ai"  // Used for metadata in iMessages/social media - must be publicly accessible to function
export const PREVIEW_IMAGE_URL = `${HOME_PAGE_URL}/Preview.png`  // In iMessages and social media, this image is used (needs to be publicly accessible to function)
export const ANIMATED_LOGO = `/AnimatedLogo.svg`  // used in the signed out home page, if enabled.

export const HOME_PAGE_HEADER = (first, last) => first ? `Thank you for using ${NAME}, ${first}.` : `Thank you for using ${NAME}.`

export const DESCRIPTION = "Book-up on anything with Abbey, by US AI. Learn faster and better using LLM generated summaries, AI-tailored curricula, and a growing content library of articles and textbooks."
export const SITE_TITLE = "Abbey - Book-up on anything"  // Shows up in a browser tab
export const COMPANY = "U.S. Artificial Intelligence Inc."

// To change these, place an image in public/random, import it above, and replace the current image here.
export const LOGIN_BACKGROUND = Babel  // image that shows up in the background of the login page
export const LOGIN_FOOTER_BACKGROUND = Library  // image that shows up in the background of the footer that asks a user to login if he tries to access a forbidden page
export const CREATE_BACKGROUND = RhodesExpanded  // the image that shows up in the background of Create

// Will promote the extension in the website template. Set to empty string to disable the promo.
export const CHROME_EXT_PROMO_LINK = "https://chromewebstore.google.com/detail/abbey/lajhghkelnmbdapgcgmdbfolbicigeac"

export const ALLOW_SUBSCRIPTION = process.env.NEXT_PUBLIC_ENABLE_SUBSCRIPTION === '1'
export const UPGRADE_SUBSCRIPTION_LINK = "/settings"  // if a user has surpassed his max allowed uploads, he is referred to this link to upgrade

export const MAX_USER_SOURCES = 7  // SHOULD MATCH BACKEND
export const MAX_PDF_PAGES = 250  // SHOULD MATCH BACKEND

export const SHOW_SIGNED_OUT_HOME_PAGE = !(process.env.NEXT_PUBLIC_HIDE_SIGNED_OUT_HOME_PAGE === '1')  // if false, the root path (home page) will display the login page if the user is signed out, rather than the landing page.
// For some import error reason, process.env.NEXT_PUBLIC_HIDE_COLLECTIONS is used directly in template.js for Curriculum hiding
export const HIDE_COLLECTIONS = process.env.NEXT_PUBLIC_HIDE_COLLECTIONS === '1'  // if true, "Collections" will not show up in the nav bar, and it will be to the user as though Collections doesn't exist.
export const DISABLE_OCR = process.env.NEXT_PUBLIC_DISABLE_OCR === '1'  // Should match backend. If true, the user is never prompted about OCR and is never given the option to retry with OCR
export const DISABLE_WEB = process.env.NEXT_PUBLIC_DISABLE_WEB === '1'
export const HIDE_TTS = process.env.NEXT_PUBLIC_HIDE_TTS === '1'

// NOTE: Externally hosted image URLs can be configured in next.config.js!
// NOTE: Templates (and which appear in certain places) can be configured in templates/template.js

/*

Mid-Importance Config Variables

*/

export const DEFAULT_PERMISSIONS = {'emailDomains': [], 'public': 0, 'editDomains': []}  // Default permissions when uploading an asset
export const ALLOW_PUBLIC_UPLOAD = true  // Whether a user is allowed to make an asset publicly available - Should match backend

// These are linked in login/sign up when Clerk is used for auth.
export const PRIVACY_POLICY = "https://us.ai/AbbeyPrivacyPolicy.pdf"
export const TERMS_OF_USE = "https://us.ai/TermsOfUse.pdf"

/*

Least Important Config Variables

*/

export const SignedInHomePage = ({}) => {return (<FaceliftHomePage />)}  // The component for the home page, when a user is signed in
export const LandingPage = ({}) => {return (<SignedOutHomePage />)}  // the component for the home page, when a user is signed out

export const NAV_BAR = (<NavBar />)  // The component for the NavBar

// Should match backend
export const ILLEGAL_SHARE_DOMAINS = [
    'gmail.com',
    'hotmail.com',
    'me.com',
    'outlook.com',
    'aol.com',
    'yahoo.com',
    'hotmail.co.uk',
    'msn.com',
    'concast.net',
    'optonline.net'
]
