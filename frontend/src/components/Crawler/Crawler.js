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
import ScrapePreview from "./ScrapePreview"
import SmartHeightWrapper from "../SmartHeightWrapper/SmartHeightWrapper"
import SearchEngine from "./SearchEngine"
import useKeyboardShortcut from "@/utils/keyboard"
import Queue from "./Queue"
import FakeCheckbox from "../form/FakeCheckbox"
import PassiveTextarea from "../PassiveTextarea/PassiveTextarea"
import Textarea from "../form/Textarea"
import Saving from "../Saving/Saving"
import useSaveDataEffect from "@/utils/useSaveDataEffect"
import RemoveIcon from '../../../public/icons/RemoveIcon.png'
import SlidingBar from "../SlidingBar/SlidingBar"
import Info from "../Info/Info"

const TABLE_COL_GAP='10px'
const RESEARCH_TOPIC='topic'

export const QUALITY_CODE_TO_NAME = {
    'COL': 'Fully Collected',
    'OBS': 'Obscured',
    'POBS': 'Partially Obscured',
    'RLOG': 'Requires Login',
    'NJ': 'No Judgement',
    'ACOL': 'Assume Collected'
}

export const SOURCE_TYPE_CODE_TO_NAME = {
    'NEWS': 'News Article',
    'GOV': 'Government Report',
    'SOC': 'Social Media',
    'EDU': 'Academic Article',
    'WIKI': 'Wiki Entry',
    'BUS': 'Business',
    'OTH': 'Other',
    'UNK': 'Unknown'
}


export default function Crawler({ manifestRow, canEdit }) {
    
    const { getToken, isSignedIn } = Auth.useAuth()
    
    const [websites, setWebsites] = useState([])
    const [websitesLoadState, setWebsitesLoadState] = useState(0)
    const [currPage, setCurrPage] = useState(1)
    const [numResults, setNumResults] = useState(0);
    const [searchText, setSearchText] = useState("")

    const [addWebsiteModalOpen, setAddWebsiteModalOpen] = useState(false)
    const [addWebsiteLoadingState, setAddWebsiteLoadingState] = useState(0)
    const [addWebsiteURL, setAddWebsiteURL] = useState("")
    
    const [showRight, setShowRight] = useState(false)
    const [rightViewCode, setRightViewCode] = useState("")
    const [rightViewData, setRightViewData] = useState(undefined)
    
    const [selected, setSelected] = useState({})  // URL -> item or undefined
    const [stats, setStats] = useState({})
    const [statsLoading, setStatsLoading] = useState(0)

    const [orderBy, setOrderBy] = useState(undefined)
    const [asc, setAsc] = useState(undefined)

    const [showTopic, setShowTopic] = useState(false)
    const [topicLoading, setTopicLoading] = useState(0)
    const [topicSaving, setTopicSaving] = useState(0)
    const [topic, setTopic] = useState("")

    const resultLimit = 20

    function getUrl(page, text, order_by, local_asc){
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
            'id': manifestRow?.id,
            'asc': local_asc ? '1' : '0'
        }
        if (order_by){
            paramObj['order_by'] = order_by
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
            setWebsites((prev) => {return [newRow, ...prev.filter((x) => x.id != newRow.id)] })
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

    useEffect(() => {

        async function getStats(){
            try{
                setStatsLoading(1)
                const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/crawler/stats?id=${manifestRow?.id}`
                const response = await fetch(url, {
                    'headers': {
                        'x-access-token': await getToken(),
                    },
                    'method': 'GET'
                })
                const myJson = await response.json()
                setStats({
                    'queued': myJson['queued'],
                    'errors': myJson['errors'],
                    'scraped': myJson['scraped'],
                    'total': myJson['total']
                })
                setStatsLoading(2)
            }
            catch(e){
                console.log(e)
                setStatsLoading(3)
            }
        }

        if (manifestRow?.id && isSignedIn !== undefined){
            getStats()
        }
    }, [manifestRow, isSignedIn, websites])

    const rightOfSearchBar = (
        <div style={{'display': 'flex', 'alignItems': 'stretch', 'flex': '1', 'gap': '10px', 'minWidth': '0px'}}>
            <SyntheticButton
                value={(
                    <div style={{'display': 'flex', 'alignItems': 'center'}}>
                        Add URL
                    </div>
                )}
                style={{'display': 'flex'}}
                onClick={() => setAddWebsiteModalOpen(true)}
            />
            <SyntheticButton
                value={(
                    <div style={{'display': 'flex', 'alignItems': 'center'}}>
                        Search
                    </div>
                )}
                style={{'display': 'flex'}}
                onClick={() => slideToRight('search')}
            />
            <SyntheticButton
                value={(
                    <div style={{'display': 'flex', 'alignItems': 'center'}}>
                        Queue
                    </div>
                )}
                style={{'display': 'flex'}}
                onClick={() => slideToRight('queue')}
            />
            <SyntheticButton
                value={(
                    <div style={{'display': 'flex', 'alignItems': 'center'}}>
                        Topic
                    </div>
                )}
                style={{'display': 'flex'}}
                onClick={() => setShowTopic(true)}
            />
            <div style={{'fontSize': '1.25rem', 'display': 'flex', 'flex': '1', 'justifyContent': 'right', 'alignItems': 'center', 'color': 'var(--passive-text)'}}>
                Website Collection
            </div>
            <Modal
                title={"Add URL"}
                isOpen={addWebsiteModalOpen}
                close={() => clearWebsiteModal()}
            >
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
                                autoFocus={true}
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
            <Modal
                isOpen={showTopic}
                close={() => setShowTopic(false)}
                title={"Research Topic"}
                closeButton={(
                    <div style={{'display': 'flex', 'gap': '5px', 'alignItems': 'center'}}>
                        <Saving saveValueLoading={topicSaving} />
                        <MyImage className={"_clickable"} src={RemoveIcon} alt={"Close"} width={15} height={15} onClick={() => setShowTopic(false)} />
                    </div>
                )}
            >
                <Textarea
                    value={topic}
                    setValue={setTopic}
                />
            </Modal>
        </div>
    )

    const searchBarContainerStyle = useMemo(() => {
        return {
            'display': 'flex',
            'gap': '10px',
        }
    }, [])

    useKeyboardShortcut([['ArrowRight']], ()=>{rightViewCode && slideToRight(rightViewCode, rightViewData)}, false)

    useEffect(() => {
        async function getTopic(){
            try{
                setTopicLoading(1)
                const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/metadata?id=${manifestRow.id}&key=${RESEARCH_TOPIC}`
                const response = await fetch(url, {
                    'headers': {
                        'x-access-token': await getToken()
                    },
                    'method': 'GET'
                })
                const myJson = await response.json()
                if (myJson['results']?.length){
                    setTopic(myJson['results'][0].value)
                    if (myJson['results'].length > 1){
                        console.log(`Bad: multiple research topics found (${myJson['results'].length})`)
                    }
                }
                setTopicLoading(2)
            }
            catch(e) {
                console.log(e)
                setTopicLoading(3)
            }
        }

        if (isSignedIn !== undefined && manifestRow?.id){
            getTopic()
        }
    }, [manifestRow, isSignedIn])

    const saveTopic = useCallback(async () => {
        setTopicSaving(1)
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/assets/save-metadata'
            const data = {
                'id': manifestRow?.id,
                'additive': false,
                'key': RESEARCH_TOPIC,
                'value': topic
            }
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'body': JSON.stringify(data),
                'method': 'POST'
            })
            if (!response.ok){
                throw Error("Response was not Ok")
            }

            setTopicSaving(2)
        }
        catch(e) {
            setTopicSaving(3)
        }
    }, [topic, manifestRow, isSignedIn])
    useSaveDataEffect(topic, canEdit && topicLoading == 2 && isSignedIn !== undefined, saveTopic, 250, setTopicSaving)

    // The way this works is:
    // if we want to show a React component in the right,
    // you set the rightVieWCode to correspond with the correct hook
    // and that hook will take the rightViewData as a prop.
    const slideToRight = useCallback((rightViewCode, rightViewData) => {
        setRightViewCode(rightViewCode)
        setRightViewData(rightViewData)
        setShowRight(true)
    }, [])

    const slideToLeft = useCallback(() => {
        // Notably, leave data and code as is so that during the transition, it's fully displayed
        // Also allows memoizing the data for back and forth moves
        setShowRight(false)
    }, [])

    let rightElement = ""
    if (rightViewCode == 'scrape'){
        rightElement = (
            <ScrapePreview assetId={manifestRow?.id} item={rightViewData?.item} slideToLeft={slideToLeft} setItem={(x) => setWebsites((prev) => prev.map((old) => old.id == x.id ? x : old))} />
        )
    }
    else if (rightViewCode == 'search'){
        function addCallback(results) {
            setWebsites([...results, ...websites])
        }
        rightElement = (
            <SearchEngine topic={topic} assetId={manifestRow?.id} slideToLeft={slideToLeft} addCallback={addCallback} />
        )
    }
    else if (rightViewCode == 'queue'){
        rightElement = (
            <Queue slideToLeft={slideToLeft} manifestRow={manifestRow} />
        )
    }

    function makeRow(item, i) {
        return <TableRow key={i} slideToRight={slideToRight} setItem={(x) => setWebsites((prev) => prev.map((old) => old.id == x.id ? x : old))} item={item} i={i} isFirst={ i == 0} isLast={i == websites?.length - 1} tableCols={tableCols} />
    }

    async function refresh(localOrderBy, localAsc){
        let realOrderBy = localOrderBy
        if (!realOrderBy){
            realOrderBy = orderBy
        }
        let realAsc = localAsc
        if (localAsc === undefined){
            realAsc = asc
        }
        try {
            setWebsitesLoadState(1)
            const url = getUrl(currPage, searchText, realOrderBy, realAsc)
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                },
                'method': 'GET'
            })
            if (!response.ok){
                throw Error("Response was not OK")
            }
            const myJson = await response.json()
            const websites = myJson['results']
            const total = myJson['total']
            if (orderBy != realOrderBy){
                setOrderBy(realOrderBy)
            }
            if (asc != realAsc){
                setAsc(realAsc)
            }
            setWebsitesLoadState(2)
            setWebsites(websites)
            setNumResults(total)
        }
        catch(e) {
            setWebsitesLoadState(3)
            console.log("Error refreshing")
        }
    }

    const tableCols = useMemo(() => {
        return [
            {'title': '', 'key': 'selected', 'flex': 1, 'hook': ({ item }) => {
                const isSelected = selected[item['url']]
                return (
                    <div style={{'display': 'flex', 'alignItems': 'center'}}>
                        <FakeCheckbox value={isSelected} setValue={(x) => {setSelected({...selected, [item['url']]: x ? item : undefined})}} />
                    </div>
                )
            }, 'headerHook': ({}) => {
                const allSelected = websites.filter((x) => selected[x.url]).length == websites.length && websites.length
                return (
                    <div style={{'display': 'flex', 'alignItems': 'center'}}>
                        <FakeCheckbox value={allSelected} setValue={(x) => {
                            const newSelected = {...selected}
                            for (const site of websites){
                                newSelected[site.url] = x ? site : undefined
                            }
                            setSelected(newSelected)
                        }} />
                    </div>
                )
            }},
            {'title': 'Added', 'key': 'created_at', 'flex': 2, 'hook': ({ item }) => {
                return formatTimestampSmall(item['created_at'])
            }, 'headerHook': () => {
                return (
                    <div className="_clickable" style={{'display': 'flex', 'gap': '5px'}} onClick={() => refresh('created_at', !asc)}>
                        <div>
                            Added
                        </div>
                        {orderBy == 'created_at' ? (
                            asc ? (
                                "▲"
                            ) : "▼"
                        ) : ""}
                    </div>
                )
            }},
            {'title': 'URL', 'key': 'url', 'flex': 6, 'hook': ({ item }) => {
                const shortenedUrl = extractSiteWithPath(item['url'])
                return (
                    <a className={styles.urlLink} target="_blank" href={item['url']}>{shortenedUrl}</a>
                )
            }},
            {'title': 'Title', 'key': 'title', 'flex': 7, 'hook': ({ item }) => {
                return (
                    <span title={item['title']}>{item['title']}</span>
                )
            }},
            {'title': 'Type', 'key': 'content_type', 'flex': 1, 'hook': ({ item }) => {
                const { getToken } = Auth.useAuth()

                const [downloadLoadState, setDownloadLoadState] = useState(0)

                async function downloadData(resourceId){
                    try {
                        setDownloadLoadState(1)
                        const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/files?id=${manifestRow?.id}&name=${resourceId}`
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
                
                let inner = ""
                if (item.website_data){
                    const websiteData = JSON.parse(item.website_data)
                    const mainData = websiteData.filter((x) => x.data_type == 'data')
                    if (mainData.length){
                        const ext = getExtFromMimetype(item['content_type'])
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
                return inner
            }},
            {'title': 'Scrape', 'key': '_scrape', 'flex': 2, 'hook': ({ item, setItem }) => {
                const { getToken } = Auth.useAuth()
                const [queueLoading, setQueueLoading] = useState(0)
                const [showError, setShowError] = useState(false)
                
                async function queueSite() {
                    try {
                        setQueueLoading(1)
                        const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/crawler/queue'
                        const data = {
                            'id': manifestRow?.id,
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
                        if (!response.ok){
                            throw Error("Response was not OK")
                        }
                        setItem({...item, 'queued': true})
                        setQueueLoading(2)
                    }
                    catch(e) {
                        setQueueLoading(3)
                        console.log(e)
                    }
                }
                
                let inner = ""
                if (item['scraped_at']){
                    inner = (
                        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}}>
                            <div className={styles.tableButtonView} onClick={() => slideToRight('scrape', {'item': item})}>
                                View
                            </div>
                        </div>
                    )
                }
                else if (queueLoading == 1){
                    inner = (
                        <div style={{'display': 'flex', 'alignItems': 'center'}}>
                            <div className={styles.tableButton} onClick={() => queueSite()}>
                                <Loading size={15} text="" />
                            </div>
                        </div>
                    )
                }
                else if (item['errors'] && JSON.parse(item['errors'])?.length){
                    const errors = JSON.parse(item['errors'])
                    const recentError = errors[errors.length - 1]
                    inner = (
                        <div style={{'display': 'flex', 'alignItems': 'center'}}>
                            <div className={styles.errorButton} onClick={() => {setShowError(true)}}>
                                Error
                            </div>
                            <Modal
                                isOpen={showError}
                                close={() => setShowError(false)}
                                title={"Error"}
                                minWidth="600px"
                            >
                                <div>
                                    <InfoTable clamp={false} rows={[
                                        {'title': 'Stage', 'value': recentError['stage']},
                                        {'title': 'Status', 'value': recentError['status']},
                                        {'title': 'Traceback', 'value': (
                                            <PassiveTextarea style={recentError['traceback'] ? {'minHeight': '10rem', 'fontFamily': 'var(--font-body)'} : {}} value={recentError['traceback']} readOnly={true} /> 
                                        )},
                                    ]} />
                                </div>
                            </Modal>
                        </div>
                    )
                }
                else if (item['queued'] || queueLoading == 2){
                    inner = ""  // Queued
                }
                else {
                    inner = (
                        <div style={{'display': 'flex', 'alignItems': 'center'}}>
                            <div className={styles.tableButton} onClick={() => queueSite()}>
                                Queue
                            </div>
                        </div>
                    )
                }
                return inner
            }},
            {'title': '', 'key': 'code', 'flex': 2, 'hook': ({ item, setItem }) => {
                const code = item.scrape_quality_code
                return code ? (
                    <div style={{'display': 'flex'}}>
                        <Tooltip content={QUALITY_CODE_TO_NAME[code]}>
                            <div className={`${styles.qualityCode} ${styles[`qualityCode_${code}`]}`}>
                                {code}
                            </div>
                        </Tooltip>
                    </div>
                ) : ""
            }, 'headerHook': () => {
                return (
                    <Info content="These codes help understand the quality of the scrape, such as whether login was required (RLOG) or if the content was fully collected (COL), etc." />
                )
            }},
            {'title': 'Visited', 'key': 'scraped_at', 'flex': 2, 'hook': ({ item }) => {
                return item.scraped_at ? (
                    <div>
                        {formatTimestampSmall(item['scraped_at'])}
                    </div>
                ) : ""
            }, 'headerHook': () => {
                return (
                    <div className="_clickable" style={{'display': 'flex', 'gap': '5px'}} onClick={() => refresh('scraped_at', !asc)}>
                        <div>
                            Visited
                        </div>
                        {orderBy == 'scraped_at' ? (
                            asc ? (
                                "▲"
                            ) : "▼"
                        ) : ""}
                    </div>
                )
            }},
            {'title': '', 'key': 'delete', 'flex': 1, 'hook': ({ item }) => {
                const [deleteLoadState, setDeleteLoadState] = useState(0)
                const { getToken } = Auth.useAuth()

                async function removeRow(){
                    try {
                        setDeleteLoadState(1)
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
                        setDeleteLoadState(2)
                    }
                    catch(e) {
                        console.log(e)
                        setDeleteLoadState(3)
                    }
                }
                return (
                    <div style={{'display': 'flex', 'justifyContent': 'flex-end', 'alignItems': 'center'}}>
                        {deleteLoadState == 1 ? (
                            <Loading text="" />
                        ) : (
                            <MyImage className={"_clickable"} src={DeleteIcon} width={20} height={20} onClick={() => removeRow()} alt={"Delete"} />
                        )}
                    </div>
                )
            }},
        ]
    }, [slideToRight, setWebsites, websites, manifestRow, selected, orderBy, asc])

    return (
        <SmartHeightWrapper>
            <div style={{'height': '100%', 'width': '100%', 'overflow': 'hidden'}}>
                <SlidingPage 
                    showRight={showRight}
                    main={(
                        <ControlledTable
                            items={websites}
                            setItems={setWebsites}
                            loadingState={websitesLoadState}
                            setLoadingState={setWebsitesLoadState}
                            searchText={searchText}
                            setSearchText={setSearchText}
                            currPage={currPage}
                            setCurrPage={setCurrPage}
                            numResults={numResults}
                            setNumResults={setNumResults}
                            makeRow={makeRow}
                            limit={resultLimit}
                            getUrl={getUrl}
                            loadingSkeleton={'default-small'}
                            searchable={true}
                            tableHeader={(
                                <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '10px'}}>
                                    <TableControls manifestRow={manifestRow} refresh={refresh} stats={stats} selected={selected} setSelected={setSelected} websites={websites} setWebsites={setWebsites} />
                                    <TableHeader cols={tableCols} />
                                </div>
                            )}
                            gap={'0px'}
                            searchBarContainerStyle={searchBarContainerStyle}
                            searchBarStyle={{'width': '300px'}}
                            rightOfSearchBar={rightOfSearchBar}
                            flexWrap="noWrap"
                            scroll={true}
                            customNoResults={(
                                <div style={{'height': '100%', 'width': '100%', 'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center', 'fontSize': '1.15rem'}}>
                                    Nothing yet.
                                </div>
                            )}
                            customDisplayWrapperStyle={{'borderRadius': 'var(--medium-border-radius)', 'overflow': 'hidden', 'border': '1px solid var(--light-border)', 'backgroundColor': 'var(--light-primary)'}}
                        />
                    )}
                    keepRightRendered={rightViewCode == 'search'}
                    right={rightElement}
                />
            </div>
        </SmartHeightWrapper>
    )
}

export function TableHeader({ cols }) {
    return (
        <div className={`${styles.tableHeader} _customScroll`}> {/* Custom scroll to match width of body stuff */}
            <div style={{'display': 'flex', 'gap': TABLE_COL_GAP}}>
                {cols.map((item) => {
                    return item.headerHook ? (
                        <div className="_clamped1" style={{'flex': item.flex}} key={item.key}>
                            <item.headerHook />
                        </div>
                    ) : (
                        <div className="_clamped1" style={{'flex': item.flex, 'cursor': 'default'}} key={item.key}>
                            {item.title}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export function TableRow({ item, setItem, i, tableCols, isFirst, isLast, slideToRight, ...props }) {
    
    return (
        <div className={`${styles.rowContainer} ${isFirst ? styles.rowContainerFirst : ''} ${isLast ? styles.rowContainerLast : ''} ${i % 2 ? styles.rowContainerOdd : ''}`} {...props}>
            <div style={{'display': 'flex', 'gap': TABLE_COL_GAP}}>
                {tableCols.map((x) => {
                    let inner = item[x.key]
                    if (x.hook){
                        inner = (
                            <x.hook item={item} setItem={setItem} />
                        )
                    }
                    return (
                        <div style={{'flex': x.flex}} className="_clamped1" key={x.key}>
                            {inner}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function TableControls({ manifestRow, refresh, stats, websites, setWebsites, selected, setSelected }) {
   
    const { getToken, isSignedIn } = Auth.useAuth()
    const [bulkQueueLoadingState, setBulkQueueLoadingState] = useState(0)

    const needQueue = useMemo(() => {
        const needed = []
        for (const item of Object.values(selected)){
            if (item && !item.queued && !item.scraped_at){
                needed.push(item)
            }
        }
        return needed
    }, [selected])

    const nSelected = useMemo(() => {
        return Object.values(selected).filter((x) => x).length
    }, [selected])

    async function bulkQueue(){
        try {
            setBulkQueueLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/crawler/bulk-queue'
            const data = {
                'id': manifestRow?.id,
                'items': needQueue
            }
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'body': JSON.stringify(data),
                'method': 'POST'
            })
            if (!response.ok){
                throw Error("Response was not OK")
            }
            const neededIds = needQueue.map((x) => x.id)
            setWebsites((prev) => {return prev.map((item) => neededIds.includes(item.id) ? {...item, 'queued': true} : item)})
            setSelected((prev) => {
                const newSelected = {...prev}
                for (const needed of needQueue){
                    newSelected[needed.url] = undefined
                }
                return newSelected
            })
            setBulkQueueLoadingState(2)
        }
        catch(e) {
            setBulkQueueLoadingState(3)
            console.log(e)
        }
    }

    const divider = <div style={{'color': 'var(--passive-text)'}}>{`|`}</div>

    return (
        <div style={{'display': 'flex', 'gap': '10px'}}>
            <RefreshButton refresh={refresh} />
            {divider}
            {stats?.total ? (
                <>
                    <ControlLabel label={"Queued"} value={stats?.queued} />
                    <ControlLabel label={"Errors"} value={stats?.errors} color={"var(--logo-red)"} />
                    <ControlLabel label={"Scraped"} value={stats?.scraped} />
                    <ControlLabel label={"Total"} value={stats?.total} color="var(--light-background)" fontColor={"var(--dark-text)"} />
                    {divider}
                </>
            ) : ""}
            <ControlLabel label={"Selected"} value={nSelected} color="var(--light-background)" fontColor="var(--dark-text)" />
            {needQueue.length ? (
                <div style={{'display': 'flex'}} onClick={() => bulkQueue()}>
                    <div className={styles.tableButton}>
                        {bulkQueueLoadingState == 1 ? (
                            <Loading size={15} text="" />
                        ) : `Queue ${needQueue.length}`}
                    </div>
                </div>
            ) : ""}
        </div>
    )
}

export function RefreshButton({ refresh }) {    
    return (
        <div style={{'display': 'flex'}}>
            <div className={styles.tableButton} onClick={() => {refresh()}}>
                Refresh
            </div>
        </div>
    )
}


// rows are [{'title': '', 'value': ()}, ...]
export function InfoTable({ rows, title="", clamp=true }) {
    return (
        <div className={styles.tableContainer}>
            <div className={styles.tableTitle}>
                {title}
            </div>
            <div className={styles.table}>
                {rows.map((row, i) => {
                    return (
                        <div key={i} className={`${styles.tableRow} ${i == rows.length - 1 ? styles.tableRowLast : ''} ${i % 2 ? styles.tableRowOdd : ''}`}>
                            <div className={styles.tableLabel}>
                                {row.title}
                            </div>
                            <div className={`${styles.tabelInfo}`}>
                                <div className={clamp ? "_clamped2" : ""}>
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


export function ControlLabel({ label, value, color="var(--dark-primary)", fontColor="var(--light-text)" }) {
    return (
        <div style={{'cursor': 'default', 'display': 'flex', 'alignItems': 'center', 'overflow': 'hidden', 'border': '1px solid var(--light-border)', 'borderRadius': 'var(--small-border-radius)', 'fontSize': '.8rem'}}>
            <div style={{'height': '100%', 'display': 'flex', 'alignItems': 'center', 'padding': '2px 5px', 'backgroundColor': color, 'color': fontColor}}>
                {label}
            </div>
            <div style={{'height': '100%', 'display': 'flex', 'alignItems': 'center', 'padding': '2px 5px', 'backgroundColor': 'var(--light-primary)'}}>
                {value}
            </div>
        </div>
    )
}
