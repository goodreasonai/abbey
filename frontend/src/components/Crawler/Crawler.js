import { useState } from "react"
import ControlledTable from "../ControlledTable/ControlledTable"

export default function Crawler({ manifestRow, canEdit }) {
    
    const [websites, setWebsites] = useState([])
    const [websitesLoadState, setWebsitesLoadState] = useState(0)
    const resultLimit = 20

    function makeRow(item, i) {
        return (
            <div>
                {item.title}
            </div>
        )
    }

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
            />
        </div>
    )
}
