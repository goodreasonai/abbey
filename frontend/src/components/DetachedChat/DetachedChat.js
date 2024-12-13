import Chat from "@/components/Chat/Chat";
import { Auth } from "@/auth/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import ChatSearch from "./ChatSearch";
import styles from './DetachedChat.module.css';
import Head from "next/head";
import { animateTitle } from "@/utils/autoName";
import TwoPanel from "../TwoPanel/TwoPanel";
import SmartHeightWrapper from "../SmartHeightWrapper/SmartHeightWrapper";
import { useIsMobile } from "@/utils/mobile";


export default function DetachedChat({manifestRow, canEdit, ...props}) {

    const { isSignedIn, getToken } = Auth.useAuth()
    const { isMobile } = useIsMobile()

    const [chatTitle, setChatTitle] = useState(manifestRow['title'])
    const calledMakeDescription = useRef(false)

    useEffect(() => {
        if (manifestRow.title != chatTitle){
            setChatTitle(manifestRow.title)

            // I don't quite know why this title won't display correctly
            // It happens in only one circumstance I can find:
            //      Go to untitled chat --> chat with auto make title --> quick create new chat
            // Otherwise - links, no chat with auto make, anything else - works correctly.
            // So anyway, bit of a braindead fix.
            animateTitle(manifestRow.title, 0)
        }
    }, [manifestRow])

    async function makeTitle(txt){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/detached-chat/make-title'
            const data = {
                'id': manifestRow['id'],
                'txt': txt
            }
            const response = await fetch(url, {
                'method': 'POST',
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'body': JSON.stringify(data)
            })
            const myJson = await response.json()
            if (myJson['response'] != 'success'){
                throw Error(`Response was not success: ${myJson['reason']}`)
            }

            let newTitle = myJson['title']
            if (newTitle != chatTitle){
                setChatTitle(newTitle)
                animateTitle(newTitle, 75)
            }
        }
        catch(e) {
            console.log(e)
        }
    }

    async function makeDescription(){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/detached-chat/make-description'
            const data = {
                'id': manifestRow['id'],
            }
            const response = await fetch(url, {
                'method': 'POST',
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'body': JSON.stringify(data)
            })
            const myJson = await response.json()
            if (myJson['response'] != 'success'){
                throw Error(`Response was not success: ${myJson['reason']}`)
            }
        }
        catch(e) {
            console.log(e)
        }
    }

    async function onAsk(txt, i){
        if (i == 0){
            makeTitle(txt)         
        }
    }

    const saveCallback = useCallback((newRoundStates) => {
        console.log("SAVE CALLBACK")
        console.log(newRoundStates.length)
        console.log(calledMakeDescription.current)
        if (newRoundStates?.length >= 2 && !calledMakeDescription.current ){
            calledMakeDescription.current = true
            makeDescription()
        }
    }, [manifestRow])

    const hideLeftPanel = isSignedIn === false

    return (
        <div style={{'height': '100%'}}>
            <Head>
                <title>{chatTitle}</title>
            </Head>
            <TwoPanel
                initialLeftWidth="25%"
                initialRightWidth="75%"
                resizerStyle={{'display': 'none'}}
                hideLeftPanel={hideLeftPanel}
                leftPanel={(
                    isMobile ? (
                        <div style={{'padding': '20px', 'paddingBottom': '0px', 'height': '100%', 'minHeight': '0px'}}>
                            <ChatSearch id={manifestRow['id']} />
                        </div>
                    ) : (
                        <SmartHeightWrapper>
                            <div style={{'padding': '20px', 'height': '100%', 'minHeight': '0px'}}>
                                <ChatSearch id={manifestRow['id']} />
                            </div>
                        </SmartHeightWrapper>
                    )
                )}
                rightPanel={(
                    <SmartHeightWrapper>
                        <div style={{'padding': '20px', 'paddingLeft': isMobile || hideLeftPanel ? '20px' : '0px', 'paddingTop': isMobile === true ? '0px' : '20px', 'height': '100%', 'minHeight': '0px'}}>
                            <Chat
                                id={manifestRow['id']}
                                manifestRow={manifestRow}
                                topText={""}
                                detached={true}
                                showFindMore={true}
                                onAsk={onAsk}
                                saveCallback={saveCallback}
                                canEdit={canEdit}
                                showSignIn={false}
                            />
                        </div>
                    </SmartHeightWrapper>
                )}
            />
        </div>
    )
}
