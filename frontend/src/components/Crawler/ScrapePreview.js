import { Auth } from "@/auth/auth"
import { useState, useMemo, useCallback, useEffect, useRef } from "react"
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
import { InfoTable, SOURCE_TYPE_CODE_TO_NAME } from "./Crawler"
import { MyPdfViewer } from "../Document/Document"
import SyntheticButton from "../form/SyntheticButton"
import Link from 'next/link';
import Tooltip from "../Tooltip/Tooltip"


export default function ScrapePreview({ assetId, item, slideToLeft, setItem }){
    const { getToken, isSignedIn } = Auth.useAuth()

    const [screenshotIndex, setScreenshotIndex] = useState(0)
    const [screenshotImages, setScreenshotImages] = useState([])  // holds the retrieved data
    const [screenshotsLoading, setScreenshotsLoading] = useState({})

    const pdfRef = useRef()

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

    const evaluation = useMemo(() => {
        if (!item?.evaluations){
            return undefined
        }
        const evals = JSON.parse(item.evaluations)
        if (evals && evals.length){
            return evals[0]
        }
        return undefined
    }, [item])

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

    // May want to merge with logic in <Document /> to support more file types.
    let hideLeftPanel = false
    let leftPanel = ""
    if (item?.content_type == 'application/pdf') {
        const pdfUrl = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/files?id=${assetId}&name=${mainData.resource_id}`
        leftPanel = (
            <div style={{'border': '1px solid var(--light-border)', 'height': '100%', 'width': '100%', 'borderRadius': 'var(--medium-border-radius)'}}>
                <div style={{'height': '100%', 'minHeight': '0px'}}>
                    <MyPdfViewer pdfUrl={pdfUrl} ref={pdfRef} />
                </div>
            </div>
        )
    }
    else if (screenshots.length)(
        leftPanel = (
            <div style={{'height': '100%'}}>
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
            </div>
        )
    )
    else {
        hideLeftPanel=true
    }

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
                hideLeftPanel={hideLeftPanel}
                rightPanel={(
                    <div style={{'display': 'flex', 'flexDirection': "column", 'gap': '1rem'}}>
                        <ScrapeInfoTable assetId={assetId} item={item} mainData={mainData} />
                        {evaluation ? (
                            <ScrapeEvalTable evaluation={evaluation} />
                        ) : (
                            <div style={{'color': 'var(--passive-text)'}}>
                                No LM evaluation available
                            </div>
                        )}
                        <CreateAssetButton assetId={assetId} website={item} setWebsite={setItem} />
                    </div>
                )}
                leftPanel={leftPanel}
            />                
        </div>
    )
}

function ScrapeInfoTable({ assetId, item, mainData }) {

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
            <a href={item.url} className={`${styles.urlLink} _clamped1`}>
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
            <InfoTable title={"Scrape Metadata"} rows={rows} />
        </div>
    )
}

function CreateAssetButton({ assetId, website, setWebsite }) {

    const { getToken } = Auth.useAuth()

    const [findAssetLoading, setFindAssetLoading] = useState(0)
    const [createAssetLoading, setCreateAssetLoading] = useState(0)
    const [createdId, setCreatedId] = useState(undefined)

    async function createAsset(){
        try {
            setCreateAssetLoading(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/crawler/create-asset'
            const data = {
                'id': assetId,
                'website_id': website?.id
            }
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'POST',
                'body': JSON.stringify(data)
            })
            if (!response.ok){
                throw Error("Response was not ok")
            }
            const myJson = await response.json()
            setCreatedId(myJson['id'])
            setWebsite({...website, 'asset_id': myJson['id']})
            setCreateAssetLoading(2)
        }
        catch(e) {
            console.log(e)
            setCreateAssetLoading(3)
        }
    }

    async function findAsset(){
        try {
            setFindAssetLoading(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/manifest-row?id=${website?.asset_id}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                },
                'method': 'GET',
            })
            if (!response.ok){
                throw Error("Response was not ok")
            }
            const myJson = await response.json()
            if (myJson.result?.id){
                setCreatedId(myJson['result']['id'])
            }
            setFindAssetLoading(2)
        }
        catch(e) {
            console.log(e)
            setFindAssetLoading(3)
        }
    }

    useEffect(() => {
        if (website?.asset_id){
            findAsset()
        }
    }, [website])

    return (
        <div style={{'display': 'flex'}}>
            {createdId ? (
                <Link href={`/assets/${createdId}`}>
                    <SyntheticButton value={"Go to Asset"} onClick={() => {}} />
                </Link>
            ) : createAssetLoading == 1 ? (
                <SyntheticButton value={(<Loading text="Uploading" color={'var(--light-text)'} size={15} />)} onClick={() => {}} />
            ) : (
                <SyntheticButton value={"Create Asset"} onClick={() => createAsset()} />
            )}
        </div>
    )
}

function ScrapeEvalTable({ evaluation }){
    const relevanceRatio = evaluation.relevance / evaluation.max_relevance
    let relevanceClass = ""
    if (relevanceRatio > .75){
        relevanceClass = styles.highScore
    }
    else if (relevanceRatio < .25){
        relevanceClass = styles.highScore
    }

    const trustRatio = evaluation.trustworthiness / evaluation.max_trustworthiness
    let trustClass = ""
    if (trustRatio > .75){
        trustClass = styles.highScore
    }
    else if (trustRatio < .25){
        trustClass = styles.lowScore
    }
    const rows = useMemo(() => {
        return [
            {'title': 'Type', 'value': (
                <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                    <div>
                        {SOURCE_TYPE_CODE_TO_NAME[evaluation.source_type]}
                    </div>
                    <div className={`${styles.sourceCode}`}>
                        {evaluation.source_type}
                    </div>
                </div>
            )},
            {'title': 'Relevance', 'value': (
                <div style={{'display': 'flex'}}>
                    <Tooltip content={`${evaluation.relevance}/${evaluation.max_relevance}`}>
                        <div className={`${styles.score} ${relevanceClass}`}>
                            {`${evaluation.relevance}`}
                        </div>
                    </Tooltip>
                </div>
            ), 'isText': true},
            {'title': 'Trust', 'value': (
                <div style={{'display': 'flex'}}>
                    <Tooltip content={`${evaluation.trustworthiness}/${evaluation.max_trustworthiness}`}>
                        <div className={`${styles.score} ${trustClass}`}>
                            {`${evaluation.trustworthiness}`}
                        </div>
                    </Tooltip>
                </div>
            ), 'isText': true},
            {'title': 'Title', 'value': evaluation.title, 'isText': true},
            {'title': 'Author', 'value': evaluation.author, 'isText': true},
            {'title': 'Description', 'value': evaluation.desc, 'isText': true},
        ]
    }, [evaluation])
    return (
        <InfoTable title={"Language Model Eval"} rows={rows} />
    )
}
