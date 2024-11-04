import '@/styles/globals.css'
import Head from 'next/head'
import { FAVICON_16x16, FAVICON_32x32, COMPANY, SITE_TITLE, NAV_BAR, DESCRIPTION, PREVIEW_IMAGE_URL } from '../config/config'
import { Inter, Lora } from 'next/font/google'
import localFont from 'next/font/local'
import { ThemeProvider } from 'next-themes'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Loading from '@/components/Loading/Loading'
import { Auth } from '@/auth/auth'

const inter = Inter({ subsets: ['latin'] })
const lora = Lora({ subsets: ['latin'] })

const lemonMilk = localFont({
    src: [
      {
        path: '../fonts/LEMONMILK/LEMONMILK-Regular.otf',
        weight: '400',
        style: 'normal',
      },
      {
        path: '../fonts/LEMONMILK/LEMONMILK-RegularItalic.otf',
        weight: '400',
        style: 'italic',
      },
      {
        path: '../fonts/LEMONMILK/LEMONMILK-Bold.otf',
        weight: '700',
        style: 'normal',
      },
      {
        path: '../fonts/LEMONMILK/LEMONMILK-BoldItalic.otf',
        weight: '700',
        style: 'italic',
      },
    ],
})

const louisGeorgeCafe = localFont({
    src: [
      {
        path: '../fonts/LouisGeorgeCafe/Louis George Cafe Bold.ttf',
        weight: '400',
        style: 'normal',
      },
      {
        path: '../fonts/LouisGeorgeCafe/Louis George Cafe Italic.ttf',
        weight: '400',
        style: 'italic',
      },
      {
        path: '../fonts/LouisGeorgeCafe/Louis George Cafe Bold.ttf',
        weight: '700',
        style: 'normal',
      },
      {
        path: '../fonts/LouisGeorgeCafe/Louis George Cafe Bold Italic.ttf',
        weight: '700',
        style: 'italic',
      },
    ],
})

const berkeleyMono = localFont({
    src: [
        {
            path: '../fonts/BerkeleyMono/BerkeleyMono-Regular.woff2',
            weight: '400',
            style: 'normal'
        }
    ]
})


const PageLoading = ({}) => {
    return (
        <div style={{'zIndex': '10000', 'position': 'fixed', 'bottom': '20px', 'right': '20px'}}>
            <Loading text={""} />
        </div>
    )
}


export default function App({ Component, pageProps }) {

    const router = useRouter()
    const [pageLoading, setPageLoading] = useState(false)

    useEffect(() => {
        router.events.on('routeChangeStart', (url, { shallow }) => {
            setPageLoading(true)
        });
        router.events.on('routeChangeComplete', (url, { shallow }) => {
            setPageLoading(false)
        });
    }, []);

    return (
        <>
            
            <style jsx global>{`
                /*
                :root {
                    --font-body: ${inter.style.fontFamily};
                    --font-header: ${louisGeorgeCafe.style.fontFamily};
                }
                */
               :root {
                    --font-body: ${inter.style.fontFamily};
                    --font-header: Trebuchet MS, Tahoma, Verdana, Arial;
                    --font-logo: ${louisGeorgeCafe.style.fontFamily};
               }
            `}
            </style>
            <Auth.Provider pageProps={pageProps}>
                <ThemeProvider>
                    <Head>
                        <title>{SITE_TITLE}</title>
                        <meta name="description" content={DESCRIPTION} />
                        <meta name="viewport" content="width=device-width, initial-scale=1" />
                        <meta name="author" content={COMPANY} />
                        <link rel="icon" type="image/png" sizes="32x32" href={FAVICON_32x32.src} />
                        <link rel="icon" type="image/png" sizes="16x16" href={FAVICON_16x16.src} />
                        <meta property="og:image" content={PREVIEW_IMAGE_URL} />
                    </Head>
                    { pageLoading ? <PageLoading /> : "" }
                    { NAV_BAR }
                    <Component {...pageProps} />
                </ThemeProvider>
            </Auth.Provider>
        </>
    );
}
