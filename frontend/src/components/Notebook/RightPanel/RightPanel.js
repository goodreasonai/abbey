import { Auth } from "@/auth/auth";
import KeyPoints from "./KeyPoints";
import { useCallback, useEffect, useState } from "react";
import styles from './RightPanel.module.css'
import Outline from "./Outline";
import ChatPanel from "./ChatPanel";
import { getBlockTypeByCode } from "../BlockTypes";
import useSaveDataEffect from "@/utils/useSaveDataEffect";
import { useRef } from "react";
import { animateTitle } from "@/utils/autoName";

export default function RightPanel({ manifestRow, notebookLoadState, blocks, setBlocks, keyPoints, setKeyPoints, outline, setOutline, highlightNote, canEdit }) {
    
    const [selectedPanel, setSelectedPanel] = useState("chat")
    const { getToken } = Auth.useAuth()
    const [keyPointsLoadingState, setKeyPointsLoadingState] = useState(0)
    const [outlineLoadingState, setOutlineLoadingState] = useState(0)

    const getKeyPoints = useCallback(async () => {
        try {
            setKeyPointsLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/notebook/key-points`
            const data = {
                'id': manifestRow['id'],
                'blocks': blocks
            }
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'POST',
                'body': JSON.stringify(data)
            })
            const myJson = await response.json()
            setKeyPoints(myJson['result'])
            setKeyPointsLoadingState(2)
        }
        catch(e) {
            console.log(e)
            setKeyPointsLoadingState(3)
        }
    }, [blocks])

    const getOutline = useCallback(async () => {
        try {
            setOutlineLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/notebook/outline`
            const data = {
                'id': manifestRow['id'],
                'blocks': blocks
            }
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'POST',
                'body': JSON.stringify(data)
            })
            const myJson = await response.json()
            setOutline(myJson['result'])
            if (myJson['new_title']){
                animateTitle(myJson['new_title'], 75)
            }
            setOutlineLoadingState(2)
        }
        catch(e) {
            console.log(e)
            setOutlineLoadingState(3)
        }
    }, [blocks])

    // We can actually use the same debouncing as in useSaveDataEffect in this case to make sure we're calling key points / outline at the right times
    const timeoutRef = useRef(null);
    useEffect(() => {

        if (!notebookLoadState == 2 || !canEdit){
            return
        }
        if (!(blocks?.length >= 2 && blocks?.filter((x) => getBlockTypeByCode(x.type).hasText).length >= 2)){
            return
        }

        // Clear any existing timeout
        if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
        }

        // Schedule a new timeout
        timeoutRef.current = setTimeout(() => {
            if (!keyPoints?.bullets?.length && keyPointsLoadingState != 1){
                getKeyPoints()
            }
            if (!outline?.outline?.length && outlineLoadingState != 1){
                getOutline()
            }
            // Clear the timeout ref so we know the code has run
            timeoutRef.current = null;
        }, 1000);

        // Clear the timeout when the component is unmounted or the data changes
        return () => {
            if (timeoutRef.current !== null) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [blocks, keyPoints, outline, outlineLoadingState, keyPointsLoadingState, notebookLoadState, canEdit]);
    
    // according to most recent browser specs, order should be preserved here.
    const menuItems = {
        'chat': {'value': 'Chat'},
        'keys': {'value': "Key Points"},
        'outline': {'value': 'Outline'},
    }

    function makeMenuOption(key, i){
        const item = menuItems[key]
        return (
            <div key={key} onClick={() => setSelectedPanel(key)} className={`${styles.menuOption} _clickable ${selectedPanel == key ? styles.menuOptionSelected : ''}`}>
                {item.value}
            </div>
        )
    }

    return (
        <div style={{'width': '100%', 'height': '100%', 'display': 'flex', 'flexDirection': 'column', 'overflow': 'scroll'}}>
            <div className={styles.menuOptionContainer}>
                {Object.keys(menuItems).map(makeMenuOption)}
            </div>
            <div style={{'padding': '1rem', 'paddingRight': 'var(--std-margin)', 'flex': '1', 'width': '100%', 'height': '100%', 'minHeight': '0px'}}>
                <div style={{'width': '100%', 'height': '100%', 'display': selectedPanel === 'chat' ? 'block' : 'none'}}>
                    <ChatPanel manifestRow={manifestRow} blocks={blocks} setBlocks={setBlocks} highlightNote={highlightNote} />
                </div>
                <div style={{'width': '100%', 'height': '100%', 'display': selectedPanel === 'keys' ? 'block' : 'none' }}>
                    <KeyPoints canEdit={canEdit} keyPoints={keyPoints} refresh={() => getKeyPoints()} highlightNote={highlightNote} keyPointsLoadingState={keyPointsLoadingState} />
                </div>
                <div style={{'width': '100%', 'height': '100%', 'display': selectedPanel === 'outline' ? 'block' : 'none' }}>
                    <Outline canEdit={canEdit} outline={outline} refresh={() => getOutline()} highlightNote={highlightNote} outlineLoadingState={outlineLoadingState} />
                </div>
            </div>
        </div>
        
    )
}
