import { useMemo, useState } from "react";
import ControlledTable from "../ControlledTable/ControlledTable";
import BackToCollection from "./BackToCollection";
import { RefreshButton, TableHeader, TableRow } from "./Crawler";
import { formatTimestampSmall } from "@/utils/time";
import { extractSiteWithPath } from "@/utils/text";
import styles from './Crawler.module.css'


export default function Queue({ slideToLeft, manifestRow }) {

    const [websitesLoadState, setWebsitesLoadState] = useState(0)
    const [websites, setWebsites] = useState([])
    const [currPage, setCurrPage] = useState(1)
    const [numResults, setNumResults] = useState(0);
    const [searchText, setSearchText] = useState("")

    const resultLimit = 20

    function getUrl(page, text){
        if (!text){
            text = ""
        }
        let url = new URL(process.env.NEXT_PUBLIC_BACKEND_URL + "/crawler/queue-manifest")
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

    const tableCols = useMemo(() => {
        return [
            {'title': 'Added', 'key': 'created_at', 'flex': 2, 'hook': ({ item }) => {
                return formatTimestampSmall(item['created_at'])
            }},
            {'title': 'URL', 'key': 'url', 'flex': 6, 'hook': ({ item }) => {
                const shortenedUrl = extractSiteWithPath(item['url'])
                return (
                    <a className={styles.urlLink} target="_blank" href={item['url']}>{shortenedUrl}</a>
                )
            }},
        ]
    })

    function makeRow(item, i) {
        return <TableRow item={item} key={i} isFirst={ i == 0} isLast={i == websites?.length - 1} tableCols={tableCols} />
    }

    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem', 'height': '100%'}}>
            <div style={{'display': 'flex'}}>
                <BackToCollection slideToLeft={slideToLeft} />
            </div>
            <div style={{'height': '100%', 'minHeight': '0px'}}>
                <ControlledTable
                    items={websites}
                    setItems={setWebsites}
                    loadingState={websitesLoadState}
                    setLoadingState={setWebsitesLoadState}
                    currPage={currPage}
                    setCurrPage={setCurrPage}
                    searchText={searchText}
                    setSearchText={setSearchText}
                    numResults={numResults}
                    setNumResults={setNumResults}
                    makeRow={makeRow}
                    limit={resultLimit}
                    getUrl={getUrl}
                    loadingSkeleton={'default-small'}
                    searchable={true}
                    tableHeader={(
                        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '10px'}}>
                            <RefreshButton getUrl={getUrl} setWebsites={setWebsites} setCurrPage={setCurrPage} setNumResults={setNumResults} setSearchText={setSearchText} />
                            <TableHeader cols={tableCols} />
                        </div>
                    )}
                    gap={'0px'}
                    searchBarStyle={{'width': '300px'}}
                    flexWrap="noWrap"
                    scroll={true}
                    customNoResults={(
                        <div style={{'height': '100%', 'width': '100%', 'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center', 'fontSize': '1.15rem'}}>
                            Queue is empty.
                        </div>
                    )}
                    customDisplayWrapperStyle={{'borderRadius': 'var(--medium-border-radius)', 'overflow': 'hidden', 'border': '1px solid var(--light-border)', 'backgroundColor': 'var(--light-primary)'}}
                />
            </div>
        </div>
    )
}
