import { Auth } from "@/auth/auth"
import { useState, useMemo, useCallback, useEffect } from "react"
import fileResponse, { getExtFromMimetype } from "@/utils/fileResponse"
import styles from './Crawler.module.css'
import Loading from "../Loading/Loading"
import MyImage from "../MyImage/MyImage"
import BackIcon from '../../../public/icons/BackIcon.png'
import useKeyboardShortcut from "@/utils/keyboard"
import TwoPanel from "../TwoPanel/TwoPanel"
import { extractSiteWithPath } from "@/utils/text"
import { formatTimestampSmall } from "@/utils/time"
import LoadingSkeleton from "../Loading/LoadingSkeleton"
import BackToCollection from "./BackToCollection"


export default function ScrapePreview({ assetId, item, slideToLeft }){
    const { getToken, isSignedIn } = Auth.useAuth()

    const [screenshotIndex, setScreenshotIndex] = useState(0)
    const [screenshotImages, setScreenshotImages] = useState([])  // holds the retrieved data
    const [screenshotsLoading, setScreenshotsLoading] = useState({})

    const websiteData = useMemo(() => {
        if (item.website_data){
            return JSON.parse(item.website_data)
        }
        return undefined
    }, [item])

    const mainData = useMemo(() => {
        return websiteData[0]  // guaranteed to exist
    }, [websiteData])

    const screenshots = useMemo(() => {
        return websiteData.slice(1)  // might be length 0
    }, [websiteData])

    const downloadData = useCallback(async () => {
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/files?id=${assetId}&name=${mainData.resource_id}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                },
                'method': 'GET'
            })
            await fileResponse(response)
        }
        catch(e) {
            console.log(e)
        }
    }, [assetId, mainData])

    const retrieveScreenshot = useCallback(async (screenshotIndex) => {
        try {
            setScreenshotsLoading((prev) => {return {...prev, [screenshotIndex]: 1}})
            const screenshot = screenshots[screenshotIndex]
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/files?id=${assetId}&name=${screenshot.resource_id}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                },
                'method': 'GET'
            })
            if (!response.ok){
                throw Error("Response was not OK")
            }
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            console.log(imageUrl)
            setScreenshotImages([...screenshotImages, imageUrl]);
            setScreenshotsLoading((prev) => {return {...prev, [screenshotIndex]: 2}})
        }
        catch(e) {
            console.log(e)
            setScreenshotsLoading((prev) => {return {...prev, [screenshotIndex]: 3}})
        }
    }, [screenshotImages, assetId, screenshots])

    useEffect(() => {
        if (isSignedIn !== undefined && screenshots?.length && screenshots?.length > screenshotIndex && screenshotImages?.length <= screenshotIndex){
            retrieveScreenshot(screenshotIndex)
        }
    }, [screenshotIndex, screenshots, downloadData, retrieveScreenshot, screenshotImages, isSignedIn])

    useKeyboardShortcut([['ArrowLeft']], slideToLeft, false)

    const pagesToShow = [...Array(screenshots.length).keys()].map(i => i + 1)

    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem', 'height': '100%'}}>
            <div style={{'display': 'flex', 'fontSize': '1rem'}}>
                <div style={{'flex': '1', 'display': 'flex'}}>
                    <BackToCollection slideToLeft={slideToLeft} />
                </div>
                <div style={{'flex': '5', 'display': 'flex', 'justifyContent': 'center'}}>
                    <div style={{'backgroundColor': 'var(--light-primary)', 'border': '1px solid var(--light-border)', 'padding': '5px 10px', 'borderRadius': 'var(--medium-border-radius)', 'display': 'flex', 'margin': '0px 10px'}}>
                        <div style={{'width': '100%'}} className="_clamped1">
                            {item.title}
                        </div>
                    </div>
                </div>
                <div style={{'flex': '1'}}></div>
            </div>
            <TwoPanel
                stickyPanel="left"
                initialLeftWidth="60%"
                initialRightWidth="40%"
                rightPanel={(<InfoTable assetId={assetId} item={item} mainData={mainData} />)}
                leftPanel={(
                    <div style={{'height': '100%'}}>
                        {screenshots.length ? (
                            <div style={{'display': 'flex', 'flexDirection': 'column', 'height': '100%', 'gap': '.5rem'}}>
                                <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                                    {pagesToShow.map((x, i) => {
                                        return (
                                            <div className={`${styles.pageButton} ${i == screenshotIndex ? styles.pageButtonSelected : ""}`} key={x} onClick={() => setScreenshotIndex(i)}>
                                                {x}
                                            </div>
                                        )
                                    })}
                                </div>
                                <div style={{'flex': '1', 'border': '1px solid var(--light-border)', 'borderRadius': 'var(--medium-border-radius)', 'backgroundColor': 'var(--light-primary)', 'overflow': 'hidden'}}>
                                    {screenshotsLoading[screenshotIndex] <= 1 ? (
                                        <LoadingSkeleton type={"image"} />
                                    ) : (screenshotsLoading[screenshotIndex] === 3 ? (
                                        "Error"
                                    ) : (
                                        <div className={styles.screenshotContainer}>
                                            <img src={screenshotImages[screenshotIndex]} width={200} alt={"Screenshot"} className={styles.screenshot} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : ""}
                    </div>
                )}
            />                
        </div>
    )
}

function InfoTable({ assetId, item, mainData }) {

    const { getToken } = Auth.useAuth()
    const [downloadLoadState, setDownloadLoadState] = useState(0)

    async function downloadData(){
        try {
            setDownloadLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/files?id=${assetId}&name=${mainData.resource_id}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                },
                'method': 'GET'
            })
            await fileResponse(response)
            setDownloadLoadState(2)
        }
        catch(e) {
            setDownloadLoadState(3)
            console.log(e)
        }
    }

    const rows = [
        {'title': 'Title', 'value': item.title, 'isText': true},
        {'title': 'URL', 'value': (
            <a href={item.url} className={styles.urlLink}>
                {item.url}
            </a>
        )},
        {'title': 'Scraped', 'value': formatTimestampSmall(item.scraped_at)},
        {'title': 'Content', 'value': item.content_type, 'isText': true},
        {'title': 'Download', 'value': downloadLoadState == 1 ? (
                <Loading text="" />
            ) : (
            <div style={{'display': 'flex'}}>
                <div className={styles.downloadLink} onClick={() => downloadData()}>
                    Download as {getExtFromMimetype(item.content_type).toUpperCase()}
                </div>
            </div>
        )},
        {'title': 'Description', 'value': (item.desc), 'isText': true},
        {'title': 'Author', 'value': (item.author), 'isText': true}
    ]

    return (
        <div>
            <div className={styles.table}>
                {rows.map((row, i) => {
                    return (
                        <div key={i} className={`${styles.tableRow} ${i == 0 ? styles.tableRowFirst : ''} ${i == rows.length - 1 ? styles.tableRowLast : ''} ${i % 2 ? styles.tableRowOdd : ''}`}>
                            <div className={styles.tableLabel}>
                                {row.title}
                            </div>
                            <div className={`${styles.tabelInfo}`}>
                                <div className="_clamped2">
                                    {row.isText ? (
                                        row.value ? (
                                            <span title={row.value}>{row.value}</span>
                                        ) : (
                                            <span style={{'color': 'var(--passive-text)'}}>None</span>
                                        )
                                    ) : row.value}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}