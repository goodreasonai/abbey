import { useCallback, useEffect, useMemo, useState } from "react"
import ControlledTable from "../ControlledTable/ControlledTable"
import SyntheticButton from "../form/SyntheticButton"
import Modal from "../Modal/Modal"
import ControlledInputText from "../form/ControlledInputText"
import styles from './Crawler.module.css'
import { Auth } from "@/auth/auth"
import Loading from "../Loading/Loading"
import MyImage from "../MyImage/MyImage"
import fileResponse, { getExtFromMimetype, readFileAsBase64 } from "@/utils/fileResponse"
import { formatTimestampSmall } from "@/utils/time"
import DeleteIcon from '../../../public/icons/DeleteIcon.png'
import Tooltip from "../Tooltip/Tooltip"
import RestartIcon from '../../../public/icons/RestartIcon.png'
import { extractSiteWithPath } from "@/utils/text"
import SlidingPage from "../SlidingPage/SlidingPage"

const TABLE_COL_GAP='10px'

export default function Crawler({ manifestRow, canEdit }) {
    
    const { getToken } = Auth.useAuth()
    
    const [websites, setWebsites] = useState([])
    const [websitesLoadState, setWebsitesLoadState] = useState(0)

    const [addWebsiteModalOpen, setAddWebsiteModalOpen] = useState(false)
    const [addWebsiteLoadingState, setAddWebsiteLoadingState] = useState(0)
    const [addWebsiteURL, setAddWebsiteURL] = useState("")
    
    const [showRight, setShowRight] = useState(false)
    const [rightViewCode, setRightViewCode] = useState("")
    const [rightViewData, setRightViewData] = useState(undefined)

    const resultLimit = 20

    function getUrl(page, text){
        if (!text){
            text = ""
        }
        let url = new URL(process.env.NEXT_PUBLIC_BACKEND_URL + "/crawler/manifest")
        let params = new URLSearchParams(url.search);
        const offset = resultLimit * (page - 1)
        let paramObj = {
            'query': text,
            'limit': resultLimit,
            'offset': offset,
            'id': manifestRow?.id
        }
        for (let key in paramObj) {
            params.append(key, paramObj[key]);
        }
        url.search = params.toString()
        return url
    }

    async function addWebsite(){
        try {
            setAddWebsiteLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/crawler/add"
            const data = {
                'id': manifestRow?.id,
                'url': addWebsiteURL
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
                throw Error("Response was not OK")
            }
            const myJson = await response.json()
            const newRow = myJson['result']
            setWebsites((prev) => {return [...prev.filter((x) => x.id != newRow.id), newRow] })
            setAddWebsiteURL("")
            setAddWebsiteLoadingState(2)
            clearWebsiteModal()
        }
        catch(e) {
            console.log(e)
            setAddWebsiteLoadingState(3)
        }
    }

    function clearWebsiteModal() {
        setAddWebsiteURL("")
        setAddWebsiteLoadingState(0)
        setAddWebsiteModalOpen(false)
    }

    const rightOfSearchBar = (
        <div style={{'display': 'flex', 'alignItems': 'stretch'}}>
            <SyntheticButton
                value={(
                    <div style={{'display': 'flex', 'alignItems': 'center'}}>
                        Add URL
                    </div>
                )}
                style={{'display': 'flex'}}
                onClick={() => setShowRight(true)}
            />
            <Modal
                title={"Add URL"}
                isOpen={addWebsiteModalOpen}
                close={() => clearWebsiteModal()}>
                <div>
                    <div style={{'display': 'flex', 'gap': '10px'}}>
                        <div style={{'flex': '1'}}>
                            <ControlledInputText
                                value={addWebsiteURL}
                                setValue={setAddWebsiteURL}
                                placeholder="https://example.com/my-page"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        addWebsite();
                                    }
                                }}
                            />
                        </div>
                        {addWebsiteLoadingState == 1 ? (
                            <Loading text="" />
                        ) : (
                            <div>
                                <SyntheticButton
                                    value={"Add"}
                                    onClick={() => addWebsite()}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    )

    const searchBarContainerStyle = useMemo(() => {
        return {
            'display': 'flex',
            'gap': '10px',
        }
    }, [])

    const tableCols = useMemo(() => {
        return [
            {'title': 'Added', 'key': 'created_at', 'flex': 2},
            {'title': 'URL', 'key': 'url', 'flex': 6},
            {'title': 'Title', 'key': 'title', 'flex': 6},
            {'title': 'Content', 'key': 'content_type', 'flex': 2},
            {'title': 'Scrape', 'key': '_scrape', 'flex': 6},
            {'title': 'Visited', 'key': 'scraped_at', 'flex': 2},
            {'title': '', 'key': 'delete', 'flex': 1},
        ]
    }, [])

    async function removeRow(item){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/crawler/remove'
            const data = {
                'id': manifestRow?.id,
                'row_id': item.id
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
                throw Error("Response was not OK")
            }
            setWebsites((prev) => prev.filter((x) => x.id != item.id))  // prev and filter used to prevent issues when two are called at the same time
            return true
        }
        catch(e) {
            console.log(e)
        }
        return false  // means an error occurred, so the website won't be deleted
    }

    // The way this works is:
    // if we want to show a React component in the right,
    // you set the rightVieWCode to correspond with the correct hook
    // and that hook will take the rightViewData as a prop.
    function slideToRight(rightViewCode, rightViewData){
        setRightViewCode(rightViewCode)
        setRightViewData(rightViewData)
        setShowRight(true)
    }

    function slideToLeft(){
        // Notably, leave data and code as is so that during the transition, it's fully displayed
        // Also allows memoizing the data for back and forth moves
        setShowRight(false)
    }

    let rightElement = ""
    if (rightViewCode == 'scrape'){
        rightElement = (
            <div onClick={() => slideToLeft()}>
                This is a scrape of the site with url {rightViewData.url}
            </div>
        )
    }


    function makeRow(item, i) {
        return <TableRow key={i} slideToRight={slideToRight} assetId={manifestRow?.id} setItem={(x) => setWebsites((prev) => prev.map((old) => old.id == x.id ? x : old))} item={item} i={i} isFirst={ i == 0} isLast={i == websites?.length - 1} tableCols={tableCols} removeRow={() => removeRow(item)} />
    }

    return (
        <SlidingPage 
            showRight={showRight}
            main={(
                <div style={{'padding': 'var(--std-margin-top) var(--std-margin)'}}>
                    <ControlledTable
                        items={websites}
                        setItems={setWebsites}
                        loadingState={websitesLoadState}
                        setLoadingState={setWebsitesLoadState}
                        makeRow={makeRow}
                        limit={resultLimit}
                        getUrl={getUrl}
                        loadingSkeleton={'default-small'}
                        searchable={true}
                        tableHeader={(<TableHeader cols={tableCols} />)}
                        gap={'0px'}
                        searchBarContainerStyle={searchBarContainerStyle}
                        searchBarStyle={{'width': '300px'}}
                        rightOfSearchBar={rightOfSearchBar}
                        flexWrap="noWrap"
                    />
                </div>
            )}
            right={rightElement}
        />
    )
}

function TableHeader({ cols }) {
    return (
        <div className={styles.tableHeader}>
            <div style={{'display': 'flex', 'gap': TABLE_COL_GAP}}>
                {cols.map((item) => {
                    return (
                        <div style={{'flex': item.flex}} key={item.key}>
                            {item.title}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function TableRow({ assetId, item, setItem, i, tableCols, isFirst, isLast, removeRow, slideToRight, ...props }) {

    const { getToken } = Auth.useAuth()
    const [scrapeLoading, setScrapeLoading] = useState(0)
    const [downloadLoadState, setDownloadLoadState] = useState(0)
    const [reveal, setReveal] = useState(false)
    const [deleteLoadState, setDeleteLoadState] = useState(0)

    async function clickRemoveRow(){
        setDeleteLoadState(1)
        const removed = await removeRow()
        if (removed){
            setDeleteLoadState(2)
        }
        else {
            // set up a message in the future maybe
            setDeleteLoadState(3)
        }
    }

    async function scrapeSite(item) {
        try {
            setScrapeLoading(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/crawler/scrape'
            const data = {
                'id': assetId,
                'item': item
            }
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': "POST",
                'body': JSON.stringify(data)
            })
            if (response.ok){
                const myJson = await response.json()
                setItem(myJson['result'])
            }
            else {
                throw Error("Response was not OK")
            }
            setScrapeLoading(2)
        }
        catch(e) {
            setScrapeLoading(3)
            console.log(e)
        }
    }

    async function downloadData(resourceId){
        try {
            setDownloadLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/files?id=${assetId}&name=${resourceId}`
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

    const websiteData = useMemo(() => {
        if (item.website_data){
            return JSON.parse(item.website_data)
        }
        return undefined
    }, [item.website_data])

    const needScrapePreview = !!websiteData?.length

    return (
        <div className={`${styles.rowContainer} ${isFirst ? styles.rowContainerFirst : ''} ${isLast ? styles.rowContainerLast : ''} ${i % 2 ? styles.rowContainerOdd : ''}`} {...props}>
            <div style={{'display': 'flex', 'gap': TABLE_COL_GAP}}>
                {tableCols.map((x) => {
                    let inner = item[x.key]
                    if (x.key == 'url'){
                        const shortenedUrl = extractSiteWithPath(item[x.key])
                        inner = (<a className={styles.urlLink} target="_blank" href={item[x.key]}>{shortenedUrl}</a>)
                    }
                    else if (x.key == 'title'){
                        inner = (
                            <span title={item[x.key]}>{item[x.key]}</span>
                        )
                    }
                    else if (x.key == 'created_at'){
                        inner = formatTimestampSmall(item[x.key])
                    }
                    else if (x.key == 'content_type'){
                        if (item.website_data){
                            const websiteData = JSON.parse(item.website_data)
                            const mainData = websiteData.filter((x) => x.data_type == 'data')
                            if (mainData.length){
                                const ext = getExtFromMimetype(item[x.key])
                                inner = downloadLoadState == 1 ? (
                                    <Loading size={15} text="" />
                                ) : (
                                    <div style={{'display': 'flex'}}>
                                        <div className={styles.downloadLink} onClick={() => downloadData(mainData[0].resource_id)}>
                                            {ext}
                                        </div>
                                    </div>
                                )
                            }
                        }
                        else {
                            inner = ""
                        }
                    }
                    else if (x.key == '_scrape'){
                        if (item['scraped_at']){
                            inner = (
                                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}}>
                                    <div className={styles.tableButton} onClick={() => slideToRight('scrape', item)}>
                                        View
                                    </div>
                                    {scrapeLoading == 1 ? (
                                        <Loading text="" />
                                    ) : (
                                        <Tooltip content={"Redo Scrape"}>
                                            <MyImage className={"_touchableOpacity"} src={RestartIcon} width={15} height={15} alt={"Restart"} onClick={() => scrapeSite(item)} />
                                        </Tooltip>
                                    )}
                                </div>
                            )
                        }
                        else if (scrapeLoading == 1){
                            inner = (
                                <Loading text="" />
                            )
                        }
                        else {
                            inner = (
                                <div style={{'display': 'flex', 'alignItems': 'center'}}>
                                    <div className={styles.tableButton} onClick={() => scrapeSite(item)}>
                                        Scrape
                                    </div>
                                </div>
                            )
                        }
                    }
                    else if (x.key == 'scraped_at'){
                        inner = item['scraped_at'] ? (
                            <div>
                                {formatTimestampSmall(item['scraped_at'])}
                            </div>
                        ) : ""
                    }
                    else if (x.key == 'delete'){
                        inner =  (
                            <div style={{'display': 'flex', 'justifyContent': 'flex-end', 'alignItems': 'center'}}>
                                {deleteLoadState == 1 ? (
                                    <Loading text="" />
                                ) : (
                                    <MyImage className={"_clickable"} src={DeleteIcon} width={20} height={20} onClick={() => clickRemoveRow()} alt={"Delete"} />
                                )}
                            </div>
                        )
                    }

                    return (
                        <div style={{'flex': x.flex}} className="_clamped1" key={x.key}>
                            {inner}
                        </div>
                    )
                })}
            </div>
            {needScrapePreview ? (
                <Modal
                    title={"Scrape"}
                    isOpen={reveal}
                    close={() => setReveal(false)}
                >
                    <ScrapePreview item={item} websiteData={websiteData} assetId={assetId} />
                </Modal>
            ) : ""}
        </div>
    )
}

function ScrapePreview({ assetId, item, websiteData }){
    const { getToken } = Auth.useAuth()

    const [screenshotIndex, setScreenshotIndex] = useState(0)
    const [screenshotImages, setScreenshotImages] = useState([])  // holds the retrieved data
    const [screenshotsLoading, setScreenshotsLoading] = useState({})

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
        if (screenshots?.length && screenshots?.length > screenshotIndex && screenshotImages?.length <= screenshotIndex){
            retrieveScreenshot(screenshotIndex)
        }
    }, [screenshotIndex, screenshots, downloadData, retrieveScreenshot, screenshotImages])

    const pagesToShow = [...Array(screenshots.length).keys()].map(i => i + 1)

    return (
        <div>
            <div className="_clickable" onClick={() => downloadData()}>
                Download Scraped Data
            </div>
            {screenshots.length ? (
                <div>
                    <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                        {pagesToShow.map((x, i) => {
                            return (
                                <div style={{'display': 'flex', 'alignItems': 'center', 'padding': '5px 10px', 'border': '1px solid var(--light-border)', 'backgroundColor': 'var(--dark-primary)', 'color': 'var(--light-text)', 'borderRadius': 'var(--small-border-radius)'}} key={x} onClick={() => setScreenshotIndex(i)}>
                                    {x}
                                </div>
                            )
                        })}
                    </div>
                    <div>
                        {screenshotsLoading[screenshotIndex] <= 1 ? (
                            <Loading text="" />
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
    )
}
