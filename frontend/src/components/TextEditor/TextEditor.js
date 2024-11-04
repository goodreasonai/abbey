import { useCallback, useEffect, useState } from "react";
import Editor from "../RichText/Editor";
import useSaveDataEffect from "@/utils/useSaveDataEffect";
import { Auth } from "@/auth/auth";
import DocSkeleton from "../Document/DocSkeleton";
import Saving from "../Saving/Saving";
import MyImage from "../MyImage/MyImage";
import ChatIcon from '../../../public/icons/ChatIcon.png'
import Tooltip from "../Tooltip/Tooltip";
import Chat from "../Chat/Chat";
import MinimizeIcon from '../../../public/icons/MinimizeIcon.png'
import DocumentIcon from '../../../public/icons/DocumentIcon.png'
import HTMLIcon from '../../../public/icons/HTMLIcon.png'
import PDFIcon from '../../../public/icons/PDFIcon.png'
import ExportStyleIcon from '../../../public/icons/ExportStyleIcon.png'
import RichTextViewer from "../RichText/Viewer";
import styles from './TextEditor.module.css';
import PanelSourceSelect from "../PanelSourceSelect/PanelSourceSelect";
import { downloadFromBlob } from "@/utils/fileResponse";
import Modal from "../Modal/Modal";
import Textarea from "../form/Textarea";
import RestyleModal from "./RestyleModal";
import Loading from "../Loading/Loading";
import { convertTextEditorHtml } from "@/utils/html";
import SmartHeightWrapper from "../SmartHeightWrapper/SmartHeightWrapper";
import useKeyboardShortcut from "@/utils/keyboard";


export default function TextEditor({ assetManifestRow, canEdit, showChatByDefault=false, showDocsByDefault=false, allowRestyle=false, ...props }){

    const [value, setValue] = useState("")
    const [savingState, setSavingState] = useState(false)
    const [loadingState, setLoadingState] = useState(0)
    const [showChat, setShowChat] = useState(showChatByDefault)
    const [showDocs, setShowDocs] = useState(showDocsByDefault)

    const [restyleLoadState, setRestyleLoadState] = useState(0)
    const [showRestyle, setShowRestyle] = useState(false)
    
    const [sources, setSources] = useState([])
    const [sourcesLoadingState, setSourcesLoadingState] = useState(0)

    const { getToken, isSignedIn } = Auth.useAuth()

    useEffect(() => {
        async function loadData() {
            setLoadingState(1)
            try {
                const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/files?id=${assetManifestRow.id}`
                const response = await fetch(url, {
                    'headers': {
                        'x-access-token': await getToken(),
                    },
                    'method': 'GET'
                })
                if (!response.ok){
                    throw Error("Response was not ok")
                }
                let text = await response.text()
                setValue(text)
                setLoadingState(2)
            }
            catch(e) {
                setLoadingState(3)
                console.log(e)
            }
        }

        if (assetManifestRow.id && isSignedIn !== undefined){
            loadData()
        }
    }, [assetManifestRow && assetManifestRow.id, isSignedIn])

    const requestCb = useCallback(async (htmlContent) => {
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/text-editor/save`
            const data = {
                'id': assetManifestRow['id'],
                'html_str': htmlContent
            }
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'POST',
                'body': JSON.stringify(data)
            })
            if (!response.ok){
                throw Error("Saving failed")
            }
            setSavingState(2)
        }
        catch(e) {
            setSavingState(3)
            console.log(e)
        }
    }, [])
    useSaveDataEffect(value, canEdit && loadingState == 2, requestCb, 500, setSavingState)

    const chatTopText = (
        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
            <div style={{'flex': '1'}}>
                Ask AI about the document.
            </div>
            <div style={{'display': 'flex', 'alignItems': 'center'}}>
                <MyImage src={MinimizeIcon} alt={"Shrink"} onClick={() => setShowChat(false)} width={15} height={15} className={"_clickable"} />
            </div>
        </div>
    )

    const keyboardCallback = useCallback(() => {
        setShowChat(!showChat)
    }, [showChat])
    useKeyboardShortcut([['k']], keyboardCallback, true)

    let rightSide = ""
    if (showChat){
        rightSide = (
            <div className={styles.chatContainer}>
                <SmartHeightWrapper>
                    <div style={{'height': '100%', 'width': '100%', 'paddingBottom': '20px'}}>
                        <Chat
                            manifestRow={assetManifestRow}
                            invertColor={true}
                            hideStatus={true}
                            id={assetManifestRow.id}
                            allowOCR={false}
                            summarizeEnabled={true}
                            topText={chatTopText} />
                    </div>
                </SmartHeightWrapper>
            </div>
        )
    }
    else if (showDocs){
        rightSide = (
            <div className={styles.showDocsRightSide}>
                <PanelSourceSelect allowUpload={true} showMinimize={true} minimized={!showDocs} setMinimized={(x) => setShowDocs(!x)} manifestRow={assetManifestRow} canEdit={canEdit} resultLimit={15} selections={sources} setSelections={setSources} selectionsLoadState={sourcesLoadingState} setSelectionsLoadState={setSourcesLoadingState} theme="light" />
            </div>
        )
    }
    else {  // menu
        rightSide = (
            <div className={styles.rightSideMenu}>
                <Tooltip align="left" content="Chat with document">
                    <MyImage src={ChatIcon} width={20} height={20} alt={"Chat"} onClick={() => setShowChat(true)} />
                </Tooltip>
                <Tooltip align="left" content="Source from documents">
                    <MyImage src={DocumentIcon} width={20} height={20} alt={"Documents"} onClick={() => setShowDocs(true)} />
                </Tooltip>
            </div>
        )
    }

    function downloadHTML(htmlStr) {
        const blob = new Blob([htmlStr], { type: 'text/html' });
        downloadFromBlob(`${assetManifestRow.title}.html`, blob)
    }

    // Uses the "print" strategy
    // May want to change to using html2pdf.js
    // Background colors don't work btw
    function saveToPDF() {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        let html = convertTextEditorHtml(value)
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();
        
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        
        // Remove the iframe after a short delay
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 100);
    }
    
    const customRightMenu = (
        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
            {allowRestyle ? (restyleLoadState == 1 ? (
                <Loading text={""} />
            ) : (
                <Tooltip content={"Style and Export"}>
                    <div className={styles.menuClickable} onClick={() => setShowRestyle(true)}>
                        <MyImage src={ExportStyleIcon} alt={"Export styled"} width={20} height={20} />
                    </div>
                </Tooltip>
            )) : ""}
            <Tooltip content={'Save as PDF'}>
                <div className={styles.menuClickable} onClick={() => saveToPDF()}>
                    <MyImage src={PDFIcon} alt={"PDF"} width={20} height={20} />
                </div>
            </Tooltip>
            <Tooltip content={"Download HTML"}>
                <div className={styles.menuClickable} onClick={() => downloadHTML(value)}>
                    <MyImage src={HTMLIcon} alt={"HTML"} width={20} height={20} />
                </div>
            </Tooltip>
            <Saving saveValueLoading={savingState} />
        </div>
    )
        
    return (
        <div {...props}>
            {
                loadingState <= 1 ? (
                    <div>
                        <DocSkeleton />
                    </div>
                ) : (
                    <div className={styles.mainContainer}>
                        {canEdit ? (
                            <Editor
                                style={{'flex': '1'}}
                                assetId={assetManifestRow.id}
                                htmlContent={value}
                                minHeightOption={'fullScreen'}
                                onChangeHTML={(html) => setValue(html)}
                                showMenu={true}
                                showDelete={false}
                                customRightMenu={customRightMenu} />
                            ) : (
                                <RichTextViewer style={{'flex': '1'}} minHeightOption={'fullScreen'} content={value} />
                            )
                        }
                        {rightSide}
                    </div>
                )
            }
            <RestyleModal setRestyleLoadState={setRestyleLoadState} showRestyle={showRestyle} setShowRestyle={setShowRestyle} manifestRow={assetManifestRow} />
        </div>
    )
}
