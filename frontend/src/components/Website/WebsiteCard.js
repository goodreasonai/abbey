import { useRef, useState } from "react"
import { useEffect } from "react"
import { formatTimestampDefault } from "@/utils/time"
import Link from "next/link"
import SyntheticButton from "../form/SyntheticButton"
import MyImage from "../MyImage/MyImage"
import EyeballIcon from '../../../public/icons/EyeballIcon.png'
import { Auth } from "@/auth/auth"
import { extractSiteName, extractRootUrl } from "@/utils/text"
import CopyButton from "../CopyButton/CopyButton"
import styles from './Website.module.css'
import ShareArrowIcon from '../../../public/icons/ShareArrowIcon.png'
import Tooltip from "../Tooltip/Tooltip"
import RestartIcon from '../../../public/icons/RestartIcon.png'
import Loading from "../Loading/Loading"
import HideIcon from '../../../public/icons/HideIcon.png'


export default function WebsiteCard({ manifestRow, mimetype, canEditMimetypes, canEdit, showScraped, setShowScraped, dataSaveState }) {

    const [webMetadata, setWebMetadata] = useState([])
    const [rescrapeState, setRescrapeState] = useState(0)
    const containerRef = useRef()
    const [containerElement, setContainerElement] = useState()

    const { getToken } = Auth.useAuth()

    useEffect(() => {
        setContainerElement(containerRef.current)
    }, [containerRef.current])

    let url = ""
    let webDesc = ""
    let faviconUrl = ""
    let imageUrl = ""
    let scrapeDateText = ""
    for (let res of webMetadata){
        if (res.key == 'description'){
            webDesc = res.value
        }
        else if (res.key == 'favicon'){
            faviconUrl = res.value
        }
        else if (res.key == 'image_url'){
            imageUrl = res.value
        }
        else if (res.key == 'url'){
            url = res.value
            scrapeDateText = `${formatTimestampDefault(res.time_uploaded)}`
        }
    }
    
    const siteUrl = extractRootUrl(url)
    const siteName = extractSiteName(url)

    // Rescrape button for website template
    async function runRescrape() {
        setRescrapeState(1) // 1 is doing 
        try {
            const data = { 
                'id': manifestRow['id'],
                'url': url,
                'title': manifestRow['title']
            }
            const reqUrl = process.env.NEXT_PUBLIC_BACKEND_URL + "/website/rescrape"
            const response = await fetch(reqUrl, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'POST',
                'body': JSON.stringify(data)
            })
            if (!response.ok){
                throw Error('Error Rescraping')
            }
            const myJson = await response.json()
            getMetadata()
            setRescrapeState(2) // 2 is done
        }
        catch(e) {
            console.log(e)
            setRescrapeState(3) // 4 is error msg
        }

    }

    let rescrapeInner = ""
    if (rescrapeState == 0) {
        rescrapeInner = (
            <Tooltip content={'Rerun the website scrape'} tooltipStyle={{'width': '150px'}}>
                <MyImage className={"_touchableOpacity"} src={RestartIcon} width={20} height={20} alt="Redo Scrape" onClick={() => runRescrape()}/>
            </Tooltip>
        )
    }
    else if (rescrapeState == 1){
        rescrapeInner = <Loading text='Rescraping'/>
    }
    else if (rescrapeState == 2) {
        rescrapeInner = 'Scrape finished, please refresh.'
    }
    else if (rescrapeState == 3) {
        rescrapeInner = 'Error'
    }
    

    async function getMetadata(){
        try{
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/metadata?id=${manifestRow['id']}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'GET'
            })
            if (!response.ok){
                throw Error('Error getting metadata')
            }
            const myJson = await response.json()
            setWebMetadata(myJson['results'])
        }
        catch(e) {
            console.log(e)
        }
    }
    useEffect(() => {
        getMetadata()
    }, [manifestRow])
    
    let websiteButtons = ""
    if (canEditMimetypes.includes(mimetype)){
        websiteButtons = (
            <div style={{display: 'flex', 'gap': '10px'}}>
                {showScraped ? (
                    <div className={styles.showScrapedButton} onClick={() => dataSaveState !== 1 && setShowScraped(false)}>
                        <MyImage src={HideIcon} width={20} height={20} alt="Hide Text" />
                        <div>
                            Hide Scraped Text
                        </div>
                    </div>
                ) : (
                    <div className={styles.showScrapedButton} onClick={() => setShowScraped(true)}>
                        <MyImage src={EyeballIcon} width={20} height={20} alt="Show Text" />
                        <div>
                            Show Scraped Text
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div ref={containerRef} className={styles.websiteCardContainer}>
            <div style={{'display': 'flex', 'gap': '1rem', 'flexDirection': 'column', 'backgroundColor': 'var(--light-primary)', 'border': '1px solid var(--light-border)', 'width': '100%', 'height': '100%', 'borderRadius': 'var(--medium-border-radius)', 'padding': '20px', 'overflow': 'scroll'}}>
                <div style={{'display': 'flex', 'gap': '5px', 'fontSize': '1.75rem'}}>
                    <Link href={siteUrl} target="_blank" className="_clamped1">{siteName}</Link>
                </div>
                <div style={{'display': 'flex', 'gap': '10px', 'flexDirection': 'column'}}>
                    <div>
                        <Link href={url} style={{'textDecoration': 'underline'}} target="_blank" className="_clamped1 _touchableOpacity">
                            <div>
                                {url}
                            </div>
                        </Link>
                    </div>
                    <div style={{'display': 'flex', 'gap': '10px'}}>
                        <div className={'_touchableOpacity'}>
                            <a href={url} target='_blank'>
                                <MyImage src={ShareArrowIcon} width={20} height={20} alt='Go to URL'/>
                            </a>
                        </div>
                        <div>
                            <CopyButton textToCopy={url} grayed={true} />
                        </div> 
                    </div>                   
                </div>
                <div className={styles.websiteInfoBox}>
                    <div className={styles.websiteInfoHeader}>
                        <div className={styles.websiteBoxLabel}>Time Scraped </div>
                        <div className={styles.websiteBoxItem}>{scrapeDateText}</div>
                        {canEdit ? (<div className={styles.websiteBoxButton}>{rescrapeInner}</div>) : ""}
                    </div>         
                </div>
                {
                    webDesc ? (
                        <div style={{'color': 'var(--passive-text)'}}>
                            {webDesc}
                        </div>
                    ) : ""
                }
                <div>
                    {websiteButtons}
                </div>
                {
                    imageUrl ? (
                        <div style={{'width': '100%'}}>
                            <img className={styles.websiteImage} src={imageUrl} />
                        </div>
                    ) : ""
                }
            </div>
        </div>
    )
}
