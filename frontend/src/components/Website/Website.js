import Chat from "../Chat/Chat";
import TwoPanel from "../TwoPanel/TwoPanel";
import WebsiteCard from "./WebsiteCard";
import { useState, useEffect } from "react";
import { Auth } from "@/auth/auth";
import { dataConverters } from "../Document/Document";
import { getMimetypeFromResponse } from "@/utils/fileResponse";
import RichTextSavingEditor from "../RichText/SavingEditor";
import Sidebar from "./Sidebar";
import RichTextViewer from "../RichText/Viewer";
import SmartHeightWrapper from "../SmartHeightWrapper/SmartHeightWrapper";
import { useIsMobile } from "@/utils/mobile";


export default function Website({ manifestRow, canEdit }) {
    const [scrapedData, setScrapedData] = useState("")
    const [dataLoadingState, setDataLoadingState] = useState(0)
    const [dataSaveState, setDataSaveState] = useState(0)
    const [showScraped, setShowScraped] = useState(false)
    const [mimetype, setMimetype] = useState()
    const { isSignedIn, getToken } = Auth.useAuth()
    const { isMobile } = useIsMobile()

    useEffect(() => {
        async function getDocData(){
            setDataLoadingState(1)
            try{
                const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/x-ray?id=${manifestRow['id']}`, {
                    method: 'GET',
                    headers: {
                        'x-access-token': await getToken(),
                    },
                });
                const blob = await response.blob()
                const mimetype = getMimetypeFromResponse(response)
                const data = await dataConverters[mimetype](blob)  // using dataConverters so we can handle html, markdown, or text (whatever it is)
                setMimetype(mimetype)
                setScrapedData(data)
                setDataLoadingState(2)
            }
            catch(e) {
                console.log(e)
                setDataLoadingState(3)
            }
            
        }
        if (isSignedIn !== undefined){
            getDocData()
        }
    }, [manifestRow.id, isSignedIn])

    const webCard = (
        <WebsiteCard
            manifestRow={manifestRow}
            canEdit={canEdit}
            mimetype={mimetype}
            showScraped={showScraped}
            setShowScraped={setShowScraped}
            dataSaveState={dataSaveState}
            canEditMimetypes={["text/plain", "text/html"]}
        />
    )
    const leftPanel = isMobile ? webCard : (
        <SmartHeightWrapper>
            {webCard}
        </SmartHeightWrapper>
    )

    const rightPanel = (
        <div style={{'display': 'flex', 'position': 'relative', 'height': '100%', 'minHeight': '0px', 'minWidth': '0px'}}>
            <div style={{'padding': '20px', 'flex': '1', 'backgroundColor': 'var(--light-background)', 'minWidth': '0px'}}>
                {!showScraped ? (
                    <SmartHeightWrapper>
                        <div style={{'width': '100%', 'height': "100%", 'padding': '20px', 'paddingTop': '0px', 'minHeight': '400px'}}>
                            <Chat
                                id={manifestRow.id}
                                manifestRow={manifestRow}
                                suggestQuestions={true}
                                summarizeEnabled={true}
                                hideStatus={true}
                                allowOCR={false}
                            />
                        </div>
                    </SmartHeightWrapper>
                    
                ) : (
                    <RichTextViewer
                        content={scrapedData}
                    />
                )}
            </div>
            <Sidebar manifestRow={manifestRow} />
        </div>
    )

    return (
        <div style={{'height': '100%', 'display': 'flex'}}>
            <TwoPanel
                stickyPanel="left"
                leftPanel={leftPanel}
                rightPanel={rightPanel}
                initialLeftWidth="20%"
                initialRightWidth="80%"
                resizerStyle={{
                    'display': 'none'}}
                />
        </div>
    )
}
