import { useMemo, useState } from "react"
import ControlledTable from "../ControlledTable/ControlledTable"
import SyntheticButton from "../form/SyntheticButton"
import Modal from "../Modal/Modal"
import ControlledInputText from "../form/ControlledInputText"
import styles from './Crawler.module.css'
import { Auth } from "@/auth/auth"
import Loading from "../Loading/Loading"


export default function Crawler({ manifestRow, canEdit }) {
    
    const [websites, setWebsites] = useState([])
    const [websitesLoadState, setWebsitesLoadState] = useState(0)

    const [addWebsiteModalOpen, setAddWebsiteModalOpen] = useState(false)
    const [addWebsiteLoadingState, setAddWebsiteLoadingState] = useState(0)
    const [addWebsiteURL, setAddWebsiteURL] = useState("")

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
            // TODO
            setAddWebsiteLoadingState(2)
        }
        catch(e) {
            console.log(e)
            setAddWebsiteLoadingState(3)
        }
    }

    function clearWebsiteModal() {
        setAddWebsiteURL("")
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
                onClick={() => setAddWebsiteModalOpen(true)}
            />
            <Modal
                title={"Add URL"}
                isOpen={addWebsiteModalOpen}
                close={() => clearWebsiteModal()}>
                <div>
                    Add URL
                    <div>
                        <ControlledInputText
                            value={setAddWebsiteURL}
                            setValue={setAddWebsiteURL}
                        />
                    </div>
                    <div>
                        <SyntheticButton
                            value={"Add"}
                            onClick={() => addWebsite()}
                        />
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
            {'title': 'Title', 'key': 'title', 'flex': 1},
            {'title': 'URL', 'key': 'url', 'flex': 1},
            {'title': '', 'key': 'scraped_at', 'flex': 1}
        ]
    }, [])

    function makeRow(item, i) {
        return <TableRow assetId={manifestRow?.id} item={item} i={i} tableCols={tableCols} />
    }

    return (
        <div>
            <ControlledTable
                items={websites}
                setItems={setWebsites}
                loadingState={websitesLoadState}
                setLoadingState={setWebsitesLoadState}
                makeRow={makeRow}
                limit={resultLimit}
                getUrl={getUrl}
                loadingSkeleton={'default'}
                searchable={true}
                tableHeader={(<TableHeader cols={tableCols} />)}
                gap={'0px'}
                searchBarContainerStyle={searchBarContainerStyle}
                searchBarStyle={{'width': '300px'}}
                rightOfSearchBar={rightOfSearchBar}
            />
        </div>
    )
}

function TableHeader({ cols }) {
    return (
        <div style={{'display': 'flex'}}>
            {cols.map((item) => {
                return (
                    <div style={{'flex': item.flex}}>
                        {item.title}
                    </div>
                )
            })}
        </div>
    )
}

function TableRow({ assetId, item, setItem, i, tableCols }) {

    const { getToken } = Auth.useAuth()
    const [scrapeLoading, setScrapeLoading] = useState(0)

    async function scrapeSite(item, i) {
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

    return (
        <div style={{'display': 'flex'}}>
            {tableCols.map((x) => {
                let inner = item[x.key]
                if (x.key == 'url'){
                    inner = (<a target="_blank" href={item[x.key]}>{item[x.key]}</a>)
                }
                else if (x.key == 'scraped_at'){
                    if (item[x.key]){
                        inner = "Scraped"
                    }
                    else if (scrapeLoading == 1){
                        inner = (
                            <Loading text="" />
                        )
                    }
                    else {
                        inner = (
                            <div style={{'display': 'flex', 'alignItems': 'center'}}>
                                <div className={styles.tableButton} onClick={() => scrapeSite(item, i)}>
                                    Scrape
                                </div>
                            </div>
                        )
                    }
                }
                return (
                    <div style={{'flex': x.flex}}>
                        {inner}
                    </div>
                )
            })}
        </div>
    )
}
