import Chat from "../Chat/Chat"
import styles from './Document.module.css'
import Head from 'next/head';
import { useEffect, useState, useRef, useImperativeHandle, forwardRef, useMemo, useCallback } from "react";
import { Auth } from '@/auth/auth';
import MarkdownViewer from "../Markdown/MarkdownViewer";
import DocSkeleton from "./DocSkeleton";
import Loading from "../Loading/Loading";
import ChatIcon from '../../../public/icons/ChatIcon.png'
import { Worker, Viewer } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import MyImage from "../MyImage/MyImage";
import { useTheme } from 'next-themes';
import MarkdownSavingEditor from "./MarkdownSavingEditor";
import { getTemplateByCode } from "@/templates/template";
import RichTextViewer from "../RichText/Viewer";
import RichTextSavingEditor from "../RichText/SavingEditor";
import { convertToHTMLContent } from '../../utils/html'
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { convertAbbeyHtmlToHtml } from "../../utils/html";
import EditIcon from '../../../public/icons/EditIcon.png'
import CircleCheckIcon from '../../../public/icons/CircleCheckIcon.png'
import Tooltip from "../Tooltip/Tooltip";
import { useIsMobile } from "@/utils/mobile";
import { DISABLE_OCR, HIDE_TTS } from "@/config/config";
import DocToolbar, { defaultButtonOptions } from "./DocToolbar";
import TwoPanel from "../TwoPanel/TwoPanel";
import SmartHeightWrapper from "../SmartHeightWrapper/SmartHeightWrapper";
import Modal from "../Modal/Modal";
import SemSearch from "../SemSearch/SemSearch";
import MinimizeIcon from '../../../public/icons/MinimizeIcon.png'
import ExpandIcon from '../../../public/icons/ExpandIcon.png'
import useKeyboardShortcut from "@/utils/keyboard";


export default function Document({ manifestRow, objectSrc, mimetype, canEdit, showQuiz=true, showRevise=true, controlTextProcessing=true, ...props }){

    const { getToken, isSignedIn } = Auth.useAuth();
    const { theme } = useTheme()
    const { isMobile } = useIsMobile()

    const [mobileShowChat, setMobileShowChat] = useState(false);  // whether user requested chat should be shown (on mobile)
    const [desktopExpandChat, setDesktopExpandChat] = useState(false)  // stores whether the user has maximized the chat component (on desktop)
    const [showSearch, setShowSearch] = useState(false)
    const [searchModalSize, setSearchModalSize] = useState("500px")
    const [docData, setDocData] = useState("")
    const [docDataLoadingState, setDocDataLoadingState] = useState(0)
    const [isEditing, setIsEditing] = useState(false)
    const [saveState, setSaveState] = useState(0)
    const [editingData, setEditingData] = useState("")    

    const pdfViewerRef = useRef();

    const templateObj = getTemplateByCode(manifestRow['template'])

    // Adds token to objectSrc
    async function getObjectSrc(){
        let tok = await getToken()
        if (tok) {
            return `${objectSrc}&token=${tok}`
        }
        else {
            return objectSrc
        }
    }

    useEffect(() => {
        async function getDocData(){
            setDocDataLoadingState(1)
            const response = await fetch(await getObjectSrc(), {
                'headers': {
                    'x-access-token': await getToken(),
                },
                'method': 'GET'
            })
            const blob = await response.blob()
            const data = await dataConverters[mimetype](blob)
            setDocData(data)
            setEditingData(data)
            setDocDataLoadingState(2)
        }
        if (objectSrc && mimetype && dataConverters[mimetype] && isSignedIn !== undefined){
            getDocData()
        }
    }, [objectSrc, mimetype, setDocDataLoadingState, isSignedIn])

    const ALLOWED_MIMETYPES = ["application/pdf", "text/plain", 'text/markdown', 'text/html', 'abbey/html']
    const SKELETON_NEEDED_MIMETYPES = ["text/plain", 'text/markdown', 'text/html', 'abbey/html']
    const CAN_EDIT_MIMETYPES = ["text/plain", "text/markdown"]
    const NO_DOC_TOP_MIMETYPES = ["abbey/html"]

    const abbeyHtmlDocData = useMemo(() => {
        if (mimetype != 'abbey/html'){
            return ""
        }
        const trueDocData = convertAbbeyHtmlToHtml(docData, theme)
        return trueDocData
    }, [docData, theme])

    let docEl = ""
    if (mimetype && ALLOWED_MIMETYPES.includes(mimetype) && docDataLoadingState != 2 && SKELETON_NEEDED_MIMETYPES.includes(mimetype)){
        docEl = (
            <div style={{'height': '100%', 'width': '100%', 'padding': '10px'}}>
                <DocSkeleton />
            </div>
        )   
    }
    else if (mimetype == 'application/pdf'){
        docEl = (
            <MyPdfViewer ref={pdfViewerRef} pdfUrl={objectSrc} />
        )
    }
    else if (mimetype == 'text/plain'){        
        docEl = isEditing ? (
            <div style={{'height': '100%', 'overflow': 'scroll'}}>
                <RichTextSavingEditor editorStyle={{'border': '0px'}} manifestRow={manifestRow} setState={setSaveState} setSave={setEditingData} value={editingData} />
            </div>
        ) : (
            <RichTextViewer style={{'height': '100%', 'overflow': 'scroll'}} content={docData} />
        )
    }
    else if (mimetype == 'text/html'){
        docEl = isEditing ? (
            "Editing is disabled for HTML documents for now; check back sometime, ok?"
        ) : (
            <iframe srcDoc={docData} className={styles.htmlIframe}></iframe>
        )
    }
    else if (mimetype == 'abbey/html'){
        docEl = isEditing ? (
            <div style={{'height': '100%', 'overflow': 'scroll'}}>
                <RichTextSavingEditor editorStyle={{'border': '0px'}} canEditSources={true} ext="ahtml" manifestRow={manifestRow} setState={setSaveState} setSave={setEditingData} value={editingData} />
            </div>
        ) : (
            <iframe srcDoc={abbeyHtmlDocData} className={styles.htmlIframe}></iframe>
        )
    }
    else if (mimetype == 'text/markdown'){
        docEl = (
            <div className={styles.markdownDisplay}>
                {isEditing ? (
                    <MarkdownSavingEditor value={editingData} assetId={manifestRow['id']} setSave={setEditingData} setState={setSaveState}/>
                ) : (
                    <MarkdownViewer>
                        {docData}
                    </MarkdownViewer>
                )}
            </div>
        )
    }
    
    // Only for PDFs
    const handleGoToSourcePage = (mimetype != 'application/pdf') ? undefined : ((pageNumber) => {
        try{
            pdfViewerRef.current.jumpToPage(pageNumber-1); // 0 indexed
            if (isMobile){ // doesnt include scrollbar vs window.innerwidth
                setMobileShowChat(false)
            }
        }
        catch (e){
            console.error(e)
        }
    });

    const changeEditing = useCallback((x) => {
        if (saveState != 1){
            setIsEditing(x)
        }
    }, [saveState])

    const editKeyboardShortcut = useCallback(() => {
        if (canEdit){
            if (isEditing){
                changeEditing(false)
            }
            else {
                changeEditing(true)
            }
        }
    }, [isEditing, canEdit])
    useKeyboardShortcut([['e']], editKeyboardShortcut, true)

    const expandChatKeyboardShortcut = useCallback(() => {
        setDesktopExpandChat(!desktopExpandChat)
    }, [desktopExpandChat])
    useKeyboardShortcut([['k']], expandChatKeyboardShortcut, true)
    
    const docTopButtonOptions = {
        ...defaultButtonOptions,
        'scan': {'disabled': mimetype != 'application/pdf'},
        'search': {'disabled': false},
        'quiz': {'disabled': !showQuiz},
        'audio': {'disabled': !showRevise || HIDE_TTS || isMobile},
    }

    const showDocToolbar = !NO_DOC_TOP_MIMETYPES.includes(mimetype)
    const hideAssetData = !(mimetype && ALLOWED_MIMETYPES.includes(mimetype))
    const hideLeftPanel =  hideAssetData || (!isMobile && desktopExpandChat) || (isMobile && mobileShowChat)  // either the user has requested that the chat be full screen on desktop, or it's on mobile and the user has clicked the chat button
    const hideRightPanel = !hideLeftPanel && (isMobile && !mobileShowChat)
    const showDocToolbarLeft = showDocToolbar && !hideAssetData  // doctoolbar appears above chat if there's no asset data shown
    const showDocToolbarRight = showDocToolbar && !showDocToolbarLeft
    const showMobileChatButton = isMobile && !hideAssetData
    const showFloatingEditButton = canEdit && !showDocToolbar
    const showChatSizeButton = !isMobile && !hideAssetData

    // Extra button shown inside chat toolbar (expand chat)
    const extraToolbarButtons = showChatSizeButton ? [(
        desktopExpandChat ? (
            <MyImage key={"Minimize"} src={MinimizeIcon} alt={"Minimize"} width={20} height={20} className={"_touchableOpacity"} onClick={() => setDesktopExpandChat(false)} />
        ) : (
            <MyImage key={"Expand"} src={ExpandIcon} alt={"Expand"} width={18} height={18} className={"_touchableOpacity"} onClick={() => setDesktopExpandChat(true)} />
        )   
    )] : []

    // doctoolbar either appears above chat (in right panel) or above the doc data (in left panel) - thus refactored out here.
    const docToolbar = (
        <DocToolbar
            manifestRow={manifestRow}
            buttonOptions={docTopButtonOptions}
            showSearch={showSearch}
            setShowSearch={setShowSearch}
        />
    )

    return (
        <div style={{'height': '100vh', 'display': 'flex'}}>
            <Head>
                <title>{`${manifestRow['title']} - Doc`}</title>
            </Head>
            <TwoPanel
                initialLeftWidth="65%"
                initialRightWidth="35%"
                hideLeftPanel={hideLeftPanel}
                hideRightPanel={hideRightPanel}
                stackOnMobile={false}
                leftPanel={(
                    <SmartHeightWrapper key={hideLeftPanel}>
                        <div style={{'width': '100%', 'paddingBottom': '20px', 'paddingLeft': 'var(--std-margin)', 'display': 'flex', 'flexDirection': 'column', 'gap': '20px', 'height': '100%', 'paddingRight': hideRightPanel ? 'var(--std-margin)' : '0px'}}>
                            {showDocToolbarLeft ? docToolbar : <div></div> /* the gap means that this is a 20px space. */}
                            <div style={{'border': '1px solid var(--light-border)', 'borderRadius': 'var(--medium-border-radius)', 'flex': '1', 'minHeight': '0px', 'minWidth': '0px', 'width': '100%'}}>
                                <div style={{'height': '100%'}}>
                                    {docEl}
                                </div>
                            </div>
                        </div>
                    </SmartHeightWrapper>
                )}
                rightPanel={(
                    <SmartHeightWrapper key={hideRightPanel}>
                        <div style={{'width': '100%', 'paddingBottom': '20px', 'paddingRight': 'var(--std-margin)', 'display': 'flex', 'flexDirection': 'column', 'gap': '20px', 'height': '100%', 'paddingLeft': hideLeftPanel ? 'var(--std-margin)' : '0px', 'minHeight': '0px'}}>
                            {showDocToolbarRight ? docToolbar : <div></div> /* the gap means that this is a 20px space. */}
                            <div style={{'flex': '1', 'minHeight': '0px'}}>
                                <Chat
                                    manifestRow={manifestRow}
                                    controlTextProcessing={controlTextProcessing}
                                    suggestQuestions={true}
                                    summarizeEnabled={templateObj && templateObj.constructor.summarizable}
                                    id={manifestRow['id']}
                                    allowOCR={mimetype=='application/pdf' && !DISABLE_OCR}
                                    onSourceButtonClick={handleGoToSourcePage}
                                    topText={""}
                                    extraToolbarButtons={extraToolbarButtons}
                                />
                            </div>
                        </div>
                    </SmartHeightWrapper>
                )}
            />
            {showMobileChatButton ? (
                <div className={styles.floatingChatButton} onClick={() => {setMobileShowChat(!mobileShowChat)}}>
                    <MyImage src={ChatIcon} height={24} width={24} alt='Chat'/>
                </div>
            ) : ""}
            {showFloatingEditButton ? (
                !isEditing ? (
                    <div className="_touchableOpacity" style={{'position': 'fixed', 'left': '10px', 'bottom': '10px', 'zIndex': 1}} onClick={() => changeEditing(true)}>
                        <Tooltip content={"Edit (e)"}>
                            <MyImage src={EditIcon} width={20} height={20} alt={"Edit"} />
                        </Tooltip>
                    </div>
                ) : (
                    <div className="_clickable" style={{'position': 'fixed', 'left': '10px', 'bottom': '10px', 'zIndex': 1, 'backgroundColor': 'var(--light-background)'}} onClick={() => changeEditing(false)}>
                        <Tooltip content={"Close (e)"}>
                            <MyImage src={CircleCheckIcon} width={20} height={20} alt={"Check"} />
                        </Tooltip>
                    </div>
                )
            ) : ""}
            <Modal minWidth={searchModalSize} isOpen={showSearch} close={() => setShowSearch(false)} title={"AI Search"}>
                <SemSearch autoFocus={showSearch} onSearchEnd={(x) => {x.length ? setSearchModalSize("80vw") : setSearchModalSize("500px")}} manifestRow={manifestRow} />
            </Modal>
        </div>
    )
}


// Exported so that Website can use it too – for Website, there are potentially different options for storing the website data.
export const dataConverters = {
    'text/plain': (blob) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
        
            reader.onloadend = function() {
                let res = convertToHTMLContent(reader.result)
                resolve(res);
            };
        
            reader.onerror = function() {
                reject(new Error("Failed to read blob as string"));
            };
    
            reader.readAsText(blob);
        });
    },
    'text/html': (blob) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
        
            reader.onloadend = function() {
                resolve(reader.result);
            };
        
            reader.onerror = function() {
                reject(new Error("Failed to read blob as string"));
            };
    
            reader.readAsText(blob);
        });
    },
    'abbey/html': (blob) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
        
            reader.onloadend = function() {
                resolve(reader.result);
            };
        
            reader.onerror = function() {
                reject(new Error("Failed to read blob as string"));
            };
    
            reader.readAsText(blob);
        });
    },
    'text/markdown': (blob) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
        
            reader.onloadend = function() {
                    resolve(reader.result);
            };
        
            reader.onerror = function() {
                    reject(new Error("Failed to read blob as string"));
            };
    
            reader.readAsText(blob);
        });
    }
}

const customToolbar = (Toolbar) => (
    <Toolbar>
        {({ ZoomIn, ZoomOut, CurrentPageInput, GoToNextPage, GoToPreviousPage, NumberOfPages, Print, ShowSearchPopover, Zoom, Rotate, ...otherProps }) => (
            <>
                <div style={{'display': 'flex', 'alignItems': 'center'}}>
                    <ShowSearchPopover />
                    <GoToPreviousPage />
                    <CurrentPageInput />
                    {`/ `}
                    <NumberOfPages />
                    <GoToNextPage />
                </div>
                <div style={{'display': 'flex', 'alignItems': 'center', 'flex': '1', 'justifyContent': 'right'}}>
                    <ZoomOut />
                    <Zoom />
                    <ZoomIn />
                    <Rotate />
                </div>
            </>
        )}
    </Toolbar>
);

const MyPdfViewer = forwardRef(({ pdfUrl }, ref) => {
    const defaultLayoutPluginInstance = defaultLayoutPlugin({
        'sidebarTabs': ()=>[],
        'renderToolbar': customToolbar,
    });
    const pageNavigationPluginInstance = pageNavigationPlugin();
    
    const [token, setToken] = useState("")
    const [tokenLoaded, setTokenLoaded] = useState(false)
    const { getToken, isSignedIn } = Auth.useAuth()

    const { jumpToPage } = pageNavigationPluginInstance;

    const { theme } = useTheme()

    useImperativeHandle(ref, () => ({
        jumpToPage
    }));

    useEffect(() => {
        const fetchToken = async () => {
            const fetchedToken = await getToken();
            setToken(fetchedToken);
            setTokenLoaded(true)
        };

        if (isSignedIn !== undefined){
            fetchToken();
        }
    }, [isSignedIn]);

    if(!tokenLoaded) {
        return ""
    }
    const darkThemes = ['dark']
    let viewerTheme = darkThemes.includes(theme) ? 'dark' : 'light';

    return (
        <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}>
            <Viewer
                fileUrl={pdfUrl}
                plugins={[defaultLayoutPluginInstance, pageNavigationPluginInstance]}
                httpHeaders={{'x-access-token': token}}
                theme = {viewerTheme}
                renderError={() => {
                    return (
                        <div style={{'width': '100%', 'height': '100%', 'padding': '20px'}}>
                            An error occurred while loading the PDF; refresh the page?
                        </div>
                    )
                }}
                renderLoader={(percentages) => {
                    // Combine download and rendering progress
                    const totalProgress = Math.round(percentages);
                    const loadingBug = totalProgress > 0 ? <Loading text={`Rendering ${totalProgress}`} /> : <Loading text={"Fetching Document"} />
                    return (
                        <div style={{'width': '100%', 'height': '100%', 'padding': '20px', 'position': 'relative', 'overflow': 'hidden'}}>
                            <DocSkeleton />
                            <div style={{'position': 'absolute', 'width': '100%', 'height': '100%', 'top': '0px', 'left': '0px', 'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center'}}>
                                <div style={{'backgroundColor': 'var(--light-background)', 'borderRadius': 'var(--medium-border-radius)', 'padding': '10px', 'border': '1px solid var(--light-primary)'}}>
                                    {loadingBug}
                                </div>
                            </div>
                        </div>
                    )
                }}
            />
        </Worker>
    )
});
