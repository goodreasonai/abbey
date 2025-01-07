import { useMemo, useState } from "react"
import ControlledTable from "../ControlledTable/ControlledTable"
import SyntheticButton from "../form/SyntheticButton"
import Modal from "../Modal/Modal"
import ControlledInputText from "../form/ControlledInputText"

export default function Crawler({ manifestRow, canEdit }) {
    
    const [websites, setWebsites] = useState([])
    const [websitesLoadState, setWebsitesLoadState] = useState(0)

    const [addWebsiteModalOpen, setAddWebsiteModalOpen] = useState(false)
    const [addWebsiteLoadingState, setAddWebsiteLoadingState] = useState(0)
    const [addWebsiteURL, setAddWebsiteURL] = useState("")

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
                searchBarContainerStyle={searchBarContainerStyle}
                searchBarStyle={{'width': '300px'}}
                rightOfSearchBar={rightOfSearchBar}
            />
        </div>
    )
}
