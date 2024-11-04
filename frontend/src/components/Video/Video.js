import { Auth } from "@/auth/auth"
import { useCallback, useEffect, useState } from "react"
import VideoEmbed from "./VideoEmbed"
import Loading from "../Loading/Loading"
import Chat from "../Chat/Chat"
import TwoPanel from "../TwoPanel/TwoPanel"
import LoadingSkeleton from "../Loading/LoadingSkeleton"
import Modal from "../Modal/Modal"
import SemSearch from "../SemSearch/SemSearch"
import MyImage from "../MyImage/MyImage"
import MinimizeIcon from '../../../public/icons/MinimizeIcon.png'
import ExpandIcon from '../../../public/icons/ExpandIcon.png' 
import DocToolbar, { defaultButtonOptions } from "../Document/DocToolbar"
import SmartHeightWrapper from "../SmartHeightWrapper/SmartHeightWrapper"
import { useIsMobile } from "@/utils/mobile"
import useKeyboardShortcut from "@/utils/keyboard"


export default function Video({ manifestRow, canEdit }) {

    const [url, setUrl] = useState("")
    const [showSearch, setShowSearch] = useState(false)
    const [metadataLoadingState, setMetadataLoadingState] = useState(0)
    const [searchModalSize, setSearchModalSize] = useState("500px")
    const { isMobile } = useIsMobile()

    const [expandChat, setExpandChat] = useState(false)

    const { getToken } = Auth.useAuth()

    const keyboardShortcutCallback = useCallback(() => {
        setExpandChat(!expandChat)
    }, [expandChat])
    useKeyboardShortcut([['k']], keyboardShortcutCallback, true)
    
    async function getMetadata(){
        try{
            setMetadataLoadingState(1)
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
            let videoUrl = myJson['results'].filter((item) => item.key == 'video_url')[0].value
            setUrl(videoUrl)
            setMetadataLoadingState(2)
        }
        catch(e) {
            setMetadataLoadingState(3)
            console.log(e)
        }
    }
    useEffect(() => {
        getMetadata()
    }, [manifestRow])

    const docTopButtonOptions = {
        ...defaultButtonOptions,
        'download': {'disabled': true},
        'scan': {'disabled': false, 'customText': 'Transcript'},
        'search': {'disabled': false},
        'quiz': {'disabled': false},
        'audio': {'disabled': true},
    }

    const hideLeftPanel = expandChat || isMobile
    const toolbarAboveChat = isMobile

    const extraToolbarButtons = !isMobile ? [(
        expandChat ? (
            <MyImage src={MinimizeIcon} alt={"Minimize"} width={20} height={20} className={"_touchableOpacity"} onClick={() => setExpandChat(false)} />
        ) : (
            <MyImage src={ExpandIcon} alt={"Expand"} width={18} height={18} className={"_touchableOpacity"} onClick={() => setExpandChat(true)} />
        )   
    )] : []

    const toolbar = (
        <DocToolbar
            manifestRow={manifestRow}
            buttonOptions={docTopButtonOptions}
            showSearch={showSearch}
            setShowSearch={setShowSearch}
        />
    )

    return (
        <div>
            <div style={{}}>
                <TwoPanel
                    hideLeftPanel={hideLeftPanel}
                    stackOnMobile={false}
                    leftPanel={(
                        <div style={{'paddingLeft': 'var(--std-margin)', 'display': 'flex', 'flexDirection': 'column', 'gap': '20px'}}>
                            {toolbarAboveChat ? "" : toolbar}
                            <div>
                                {
                                    metadataLoadingState == 2 ? (
                                        <VideoEmbed videoUrl={url} />
                                    ) : (metadataLoadingState == 3 ? (
                                        "Error loading video"
                                    ) : (
                                        <LoadingSkeleton type={"video"} />
                                    ))
                                }
                            </div>
                        </div>
                    )}
                    rightPanel={(
                        <div>
                            {toolbarAboveChat ? toolbar : ""}
                            <SmartHeightWrapper style={{'padding': '20px', 'paddingLeft': hideLeftPanel ? 'var(--std-margin)' : '0px', 'paddingRight': 'var(--std-margin)'}}>
                                <Chat
                                    manifestRow={manifestRow}
                                    hideStatus={true}
                                    id={manifestRow.id}
                                    allowOCR={false}
                                    summarizeEnabled={true}
                                    suggestQuestions={true}
                                    extraToolbarButtons={extraToolbarButtons}
                                />
                            </SmartHeightWrapper>
                        </div>
                    )} />
            </div>
            <Modal minWidth={searchModalSize} isOpen={showSearch} close={() => setShowSearch(false)} title={"AI Search"}>
                <SemSearch autoFocus={showSearch} onSearchEnd={(x) => {x.length ? setSearchModalSize("80vw") : setSearchModalSize("500px")}} manifestRow={manifestRow} />
            </Modal>
        </div>
    )
}
