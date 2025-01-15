import { useMemo, useState } from "react";
import BackToCollection from "./BackToCollection";
import { TableHeader, TableRow } from "./Crawler";
import ControlledTable from "../ControlledTable/ControlledTable";
import useKeyboardShortcut from "@/utils/keyboard";


export default function SearchEngine({ assetId, slideToLeft }) {

    const [websites, setWebsites] = useState([])
    const [websitesLoadState, setWebsitesLoadState] = useState(0)
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
            'id': assetId
        }
        for (let key in paramObj) {
            params.append(key, paramObj[key]);
        }
        url.search = params.toString()
        return url
    }

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

    useKeyboardShortcut([['ArrowLeft']], slideToLeft, false)

    function makeRow(item, i) {
        return <TableRow key={i} slideToRight={()=>{}} assetId={assetId} setItem={() => {}} item={item} i={i} isFirst={ i == 0} isLast={i == websites?.length - 1} tableCols={tableCols} removeRow={() => removeRow(item)} />
    }

    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'height': '100%', 'gap': '1rem'}}>
            <div style={{'display': 'flex'}}>
                <BackToCollection slideToLeft={slideToLeft} />
            </div>
            <div style={{'height': '100%', 'minHeight': '0px'}}>
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
                    flexWrap="noWrap"
                    scroll={true}
                    customNoResults={(
                        <div style={{'height': '100%', 'width': '100%', 'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center', 'fontSize': '1.15rem'}}>
                            Nothing yet.
                        </div>
                    )}
                    customDisplayWrapperStyle={{'borderRadius': 'var(--medium-border-radius)', 'overflow': 'hidden', 'border': '1px solid var(--light-border)', 'backgroundColor': 'var(--light-primary)'}}
                />
            </div>
        </div>
    )
}
