import MyImage from "../MyImage/MyImage";
import GearIcon from '../../../public/icons/GearIcon.png'
import KeyIcon from '../../../public/icons/KeyIcon.png'
import { useEffect, useState, useCallback, useMemo } from "react";
import { Auth } from "@/auth/auth";
import MarkdownViewer from "../Markdown/MarkdownViewer";
import Loading from "../Loading/Loading";
import { handleGeneralStreaming } from "@/utils/streaming";
import DocumentIcon from '../../../public/icons/DocumentIcon.png'
import CopyButton from "../CopyButton/CopyButton";
import { getDefaultRoundState } from "./Chat";
import Tooltip from "../Tooltip/Tooltip";
import HairClipperIcon from '../../../public/icons/HairClipperIcon.png';
import AIWriteIcon from '../../../public/icons/AIWriteIcon.png';
import SpeakerIcon from '../../../public/icons/SpeakerIcon.png'
import AudioControls from "../Audio/AudioControls";
import { addCitations, removeCitations } from "@/utils/text";
import LoadingIcon from '../../../public/icons/LoadingIcon.png'
import EditIcon from '../../../public/icons/EditIcon.png'
import RichTextSavingEditor from "../RichText/SavingEditor";
import { NOTES_FILE } from "@/config/strConstants";


export default function SummaryToolbar({ manifestRow, allowSpeech, setRoundStates, invertColor, chatContainerRef, onSourceButtonClick, showTitle, scrollToBottom, tabDisplay, setTabDisplay, tabState, setTabState, ...props}){

    const { getToken } = Auth.useAuth()
    const [summary, setSummary] = useState("")
    const [summaryLoadState, setSummaryLoadState] = useState(0)
    const [keyPointsBullets, setKeyPointsBullets] = useState([])
    const [keyPointsLoadState, setKeyPointsLoadState] = useState(0)
    const [notes, setNotes] = useState("")
    const [notesLoadState, setNotesLoadState] = useState(0)
    const [notesSaveState, setNotesSaveState] = useState(0)

    async function doSummary(noCreate, redo){
        if (summary && (summaryLoadState == 2 || summaryLoadState == 1) && !(redo && summaryLoadState != 1)){
            return
        }
        try{
            if (!noCreate){
                setSummaryLoadState(1)
            }
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/assets/quick-summary'
            const data = {
                'id': manifestRow.id,
                'no_create': noCreate,
                'redo': redo
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
                throw Error("Repsonse was not OK")
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let gotFirst = false
            await handleGeneralStreaming({
                reader: reader,
                decoder: decoder,
                onSnippet: (result)=>{
                    if (!noCreate && !gotFirst){
                        setTabState('summary')
                        gotFirst = true
                    }
                    setSummary(result)
                }
            })
            setSummaryLoadState(2)
        }
        catch(e){
            console.log(e)
            setSummaryLoadState(3)
        }
    }

    async function doKeyPoints(noCreate, redo){
        if (keyPointsBullets?.length && (keyPointsLoadState == 2 || keyPointsLoadState == 1) && !(redo && keyPointsLoadState != 1)){
            return
        }
        try{
            if (!noCreate){
                setKeyPointsLoadState(1)
            }
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/assets/key-points'
            const data = {
                'id': manifestRow.id,
                'no_create': noCreate,
                'redo': redo
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
                throw Error("Repsonse was not OK")
            }
            const myJson = await response.json()
            if (noCreate){
                if (!myJson['bullets']){
                    setKeyPointsLoadState(2)
                    return
                }
            }
            if (!noCreate){
                setTabState('keys')
            }
            setKeyPointsBullets(myJson['bullets'])
            setKeyPointsLoadState(2)
        }
        catch(e){
            console.log(e)
            setKeyPointsLoadState(3)
        }
    }

    async function getNotes() {
        setNotesLoadState(1)
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/files?id=${manifestRow.id}&name=${NOTES_FILE}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                },
                'method': 'GET'
            })

            // Means that there are no notes yet
            if (response.status == 204){
                setNotesLoadState(2)
                return
            }

            // Otherwise not O?
            if (!response.ok){
                throw Error("Response was not ok")
            }

            let text = await response.text()
            setNotes(text)
            setNotesLoadState(2)
        }
        catch(e) {
            setNotesLoadState(3)
            console.log(e)
        }
    }

    useEffect(() => {
        doSummary(true)
        doKeyPoints(true)
        getNotes()
    }, [manifestRow])

    const tabs = useMemo(() => {
        return [
            {
                'title': "Summarize",
                'doneText': 'Summary',
                'hideText': 'Hide',
                'img': (GearIcon),
                'doneImg': (DocumentIcon),
                'code': 'summary',
                'isLoading': summaryLoadState == 1,
                'isDone': summaryLoadState == 2 && summary,
                'tabDisplay': <SummaryTab onSourceButtonClick={onSourceButtonClick} redoCallback={() => {doSummary(false, true)}} setTabState={setTabState} scrollToBottom={scrollToBottom} manifestRow={manifestRow} allowSpeech={allowSpeech} text={summary} isDone={summaryLoadState == 2 && summary} setRoundStates={setRoundStates} chatContainerRef={chatContainerRef} />,
                'onClick': ()=>doSummary(),
            },
            {
                'title': "Key Points",
                'doneText': 'Key Points',
                'hideText': 'Hide',
                'doneImg': (KeyIcon),
                'img': (KeyIcon),
                'code': 'keys',
                'isLoading': keyPointsLoadState == 1,
                'isDone': keyPointsLoadState == 2 && keyPointsBullets?.length,
                'tabDisplay': <KeyPointsTab redoCallback={() => {doKeyPoints(false, true)}} onSourceButtonClick={onSourceButtonClick} manifestRow={manifestRow} bullets={keyPointsBullets} />,
                'onClick': ()=>{doKeyPoints()}
            },
            {
                'title': '',
                'doneText': '',
                'doneImg': (EditIcon),
                'img': (EditIcon),
                'code': 'notes',
                'isLoading': false,
                'isDone': notesLoadState === 2,
                'tabDisplay': notesLoadState == 2 ? <NotesTab notes={notes} setNotes={setNotes} setSaveState={setNotesSaveState} manifestRow={manifestRow} /> : "",  // this business keeps from saving notes before they can save properly
                'onClick': ()=>{},
                'tooltip': 'Open notepad'
            }
        ]
    }, [keyPointsLoadState, keyPointsBullets, summaryLoadState, summary, notes, notesLoadState])

    useEffect(() => {
        let tabDisplay = ""
        const chosenTabs = tabs.filter((x) => x.code == tabState)
        if (chosenTabs?.length){
            tabDisplay = chosenTabs[0].tabDisplay
        }
        setTabDisplay(tabDisplay)
    }, [tabState, tabs])
    
    return (
        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
            {showTitle ? (
                <div style={{'flex': '1'}}>{showTitle}</div>
            ) : ""}
            <div style={{'display': 'flex', 'gap': '20px', 'flexWrap': 'wrap', 'alignItems': 'center'}}>
                {tabs.map((item) => {

                    const onTabClick = ()=>{
                        if (tabState == item.code){
                            setTabState(undefined)
                        }
                        else if (item.isDone){
                            setTabState(item.code)
                        }
                        else {
                            item.onClick()
                        }
                    }

                    const inner = (
                        <div
                            className={`_touchableOpacity`}
                            style={{'display': 'flex', 'gap': '5px', 'alignItems': 'center', ...((tabState == item.code || item.isLoading) ? {'opacity': 1} : {})}}
                            onClick={onTabClick}
                            key={item.code}
                        >
                            {item.isDone ? item.doneText : item.title}
                            {item.isLoading ? (
                                <Loading text="" />
                            ) : (
                                <MyImage src={item.isDone ? item.doneImg : item.img} alt={"Icon"} width={20} height={20} />
                            )}
                        </div>
                    )

                    if (item.tooltip){
                        return (
                            <Tooltip key={item.code} tooltipStyle={{'fontSize': '.75rem'}} content={item.tooltip}>
                                {inner}
                            </Tooltip>
                        )
                    }
                    return inner
                })}
            </div>
        </div>
    )
}


function SummaryTab({ manifestRow, text = "", isDone, allowSpeech, setRoundStates, setTabState, chatContainerRef, redoCallback, onSourceButtonClick, scrollToBottom, ...props}){

    const [listenClicked, setListenClicked] = useState(false)
    const SUMMARY_AUDIO_NAME = 'summary_audio'

    const onCitationClick = useCallback((citation) => {
        function handleGoToSourcePage(pageData) {
            const regex = /.*?(?:Page|page) (\d+)/;
            const match = pageData.match(regex);
            const val = match ? Number(match[1]) : 0;
            onSourceButtonClick(val);
        };
    
        function hasPageNum(pageData) {
            const regex = /.*?(?:Page|page) (\d+)/;
            return regex.test(pageData);
        }
    
        if(onSourceButtonClick !== undefined && hasPageNum(citation)){
            handleGoToSourcePage(citation)
        }
    }, [onSourceButtonClick])

    async function makeShorter(){
        // note: are we worried about a double trigger here?
        setRoundStates((prev) => {
            let newState = {...getDefaultRoundState(), 'user': `Make the following summary shorter, and eliminate redundancy.\n\n${text}\n\nNow, make this summary shorter.`, 'autoAsk': true}
            
            let lastIndex = prev.length - 1
            // Don't want to add to already fresh state
            if (prev.length > 0){
                if (!prev[lastIndex].user){
                    lastIndex -= 1
                }
            }
            // make new states variable list of states including previous up to lastIndex plus newState
            let newStates = [...prev.slice(0, lastIndex + 1), newState];

            return newStates
        })
        setTabState(undefined)
        scrollToBottom()
    }

    async function makeLonger(){
        // note: are we worried about a double trigger here?
        setRoundStates((prev) => {
            let newState = {...getDefaultRoundState(), 'user': `Give a detailed essay summarizing the document. Do not be brief; instead, be comprehensive. Start your response, 'This work is about...'`, 'autoAsk': true}
            
            let lastIndex = prev.length - 1
            // Don't want to add to already fresh state
            if (prev.length > 0){
                if (!prev[lastIndex].user){
                    lastIndex -= 1
                }
            }
            // make new states variable list of states including previous up to lastIndex plus newState
            let newStates = [...prev.slice(0, lastIndex + 1), newState];

            return newStates
        })
        setTabState(undefined)
        scrollToBottom()
    }

    return (
        <div style={{'paddingTop': '1.5rem'}}>
            {isDone ? (
                <div style={{'display': 'flex', 'flexWrap': 'wrap', 'gap': '10px', 'alignItems': 'center'}}>
                    <Tooltip content={"Make a Shorter Summary"}>
                        <div className="_touchableOpacity" onClick={() => makeShorter()} style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}}>
                            <div>
                                Shorter
                            </div>
                            <MyImage src={HairClipperIcon} alt={"Shorten"} height={20} />
                        </div>
                    </Tooltip>
                    <Tooltip content={"Make a Longer Summary"}>
                        <div className="_touchableOpacity" onClick={() => makeLonger()} style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}}>
                            <div>
                                Longer
                            </div>
                            <MyImage src={AIWriteIcon} alt={"Longer"} height={20} />
                        </div>
                    </Tooltip>
                    {allowSpeech ? (
                        listenClicked ? (
                            <AudioControls text={removeCitations(text)} assetId={manifestRow.id} name={SUMMARY_AUDIO_NAME} />
                        ) : (
                            <Tooltip content={"Listen"}>
                                <MyImage className={"_touchableOpacity"} width={20} height={20} src={SpeakerIcon} alt={"Speaker"} onClick={() => setListenClicked(true)} />
                            </Tooltip>
                        )
                    ) : ""}
                    <CopyButton text='' textToCopy={removeCitations(text)} />
                </div>
            ) : ""}
            <MarkdownViewer onCitationClick={onCitationClick}>
                {text}
            </MarkdownViewer>
            {isDone ? (
                <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                    <CopyButton text='' textToCopy={removeCitations(text)} />
                    <Tooltip content={"Redo"}>
                        <MyImage onClick={() => {redoCallback()}} className={"_touchableOpacity"} src={LoadingIcon} width={20} height={20} alt={"Redo"} />
                    </Tooltip>
                </div>
            ) : ""}            
        </div>
    )
}


function KeyPointsTab({manifestRow, bullets, onSourceButtonClick, redoCallback, ...props}){

    const onCitationClick = useCallback((citation) => {
        function handleGoToSourcePage(pageData) {
            const regex = /.*?(?:Page|page) (\d+)/;
            const match = pageData.match(regex);
            const val = match ? Number(match[1]) : 0;
            onSourceButtonClick(val);
        };
    
        function hasPageNum(pageData) {
            const regex = /.*?(?:Page|page) (\d+)/;
            return regex.test(pageData);
        }
    
        if(onSourceButtonClick !== undefined && hasPageNum(citation)){
            handleGoToSourcePage(citation)
        }
    }, [onSourceButtonClick])
    

    if (!bullets){
        return ""
    }

    const refined = addCitations(bullets)

    let txt = ""
    for (let x of refined){
        txt += `- ${x.text}\n`
    }
    return (
        <div style={{'paddingTop': '1rem', 'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
            <MarkdownViewer onCitationClick={onCitationClick}>
                {txt}
            </MarkdownViewer>
            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                <CopyButton text='' textToCopy={removeCitations(txt)} />
                <Tooltip content={"Redo"}>
                    <MyImage onClick={() => {redoCallback()}} className={"_touchableOpacity"} src={LoadingIcon} width={20} height={20} alt={"Redo"} />
                </Tooltip>
            </div>
        </div>
    )

}

function NotesTab({ notes, setNotes, manifestRow, setSaveState }) {

    return (
        <div style={{'paddingTop': '1rem', 'paddingBottom': '1rem', 'height': '100%'}}>
            <RichTextSavingEditor
                value={notes}
                setState={setSaveState}
                setSave={(x) => {setNotes(x)}}
                manifestRow={manifestRow}
                canEditSources={false}
                name={NOTES_FILE}
                smallMenuBar={true}
                editorStyle={{'height': '100%', 'borderRadius': 'var(--medium-border-radius)', 'overflow': 'scroll'}}
            />
        </div>
    )
}
