import shortenText, { extractSiteName } from "@/utils/text"
import Link from "next/link"
import Info from "../Info/Info"
import styles from './ChatSources.module.css'
import Tooltip from "../Tooltip/Tooltip"
import PassiveTextarea from "../PassiveTextarea/PassiveTextarea"
import { useState } from "react"
import MyImage from "../MyImage/MyImage"
import ExportIcon from '../../../public/icons/ExportIcon.png'
import LightningIcon from '../../../public/icons/LightningIcon.png'
import Loading from "../Loading/Loading"
import CreateWrapper from "../Quick/CreateWrapper"


export default function ChatSources({ obj, roundStates, setRoundStates, i, onSourceButtonClick, usedWeb, allowOCR, ...props }){

    const [viewMore, setViewMore] = useState(false)  // used to see more web results

    function hasPageNum(pageData) {
        const regex = /page (\d+)/;
        const match = pageData.match(regex);
        const val = match ? true : false;
        return val
    }

    function handleGoToSourcePage(pageData) {
        const regex = /page (\d+)/;
        const match = pageData.match(regex);
        const val = match ? Number(match[1]) : 0;
        onSourceButtonClick(val);
    };

    function makeSourceTexts(item, clickIndex){

        let shortenedText = shortenText(item.text, 5, 500)
        let extraStyle = item.text==roundStates[i].aiDisplayedSource ? {'textDecoration': 'underline'} : {}

        function toggle(setEmpty){
            setRoundStates((prev) => {
                // There was a weird thing where setEmpty was being calculated here
                // ... and it was running the state update twice!, thus toggling twice in a single toggle() call
                // I think this had to do with React strict mode enforcing some behavior in development.
                // Apparently, we shouldn't have behavior depending on the set only being run once?
                // But that might break some other stuff.... I don't know.
                let cpy = [...prev]
                if (setEmpty){
                    cpy[i].aiDisplayedSource = ""
                    cpy[i].aiDisplayedSourceName = ""
                }
                else {
                    cpy[i].aiDisplayedSource = item.text
                    cpy[i].aiDisplayedSourceName = item.name
                }
                return cpy
            })
        }

        return (
            <Tooltip content={shortenedText + "..."} style={{'fontSize': '.8rem'}} key={clickIndex}>
                <div style={{'color': 'var(--dark-text)', ...extraStyle}}
                    onClick={() => toggle(roundStates[i].aiDisplayedSource === item.text)}>
                    {clickIndex+1}
                </div>
            </Tooltip>
        )
    }

    if(!obj){
        return ""
    }
    obj = JSON.parse(obj)
    let sourcesDisplay = ""
    let webSourcesDisplay = ""
    if (obj.source_metadata && obj.source_metadata.filter((x) => x.type == 'web').length && obj.source_json){
        function makeWebCard(item, i) {
            return <WebCard item={item} key={i} />
        }
        const MAX_WEB_SOURCES = 3
        let ogs = obj.source_json.filter((x) => x)
        let extras = ogs.filter((_, i) => i >= MAX_WEB_SOURCES)
        let extrasDisplay = extras.map(makeWebCard)
        let ogsDisplay = ogs.length == MAX_WEB_SOURCES + 1 ? ogs.map(makeWebCard) : ogs.filter((_, i) => i < MAX_WEB_SOURCES).map(makeWebCard)
        let viewMoreDisplay = ""
        if (ogs.length > MAX_WEB_SOURCES + 1){
            viewMoreDisplay = (
                <div onClick={()=>{setViewMore(true)}} className={styles.webCard}>
                    <div>
                        View More
                    </div>
                    <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                        {extras.map((item, i) => {
                            return item.favicon ? (
                                <img src={item.favicon} width={20} height={20} key={i} />
                            ) : ""
                        })}
                    </div>
                </div>
            )
        }
        webSourcesDisplay = (
            <div style={{'display': 'flex', 'gap': '1rem', 'flexWrap': 'wrap', 'alignItems': 'stretch', 'marginBottom': '10px'}}>
                {ogsDisplay}
                {viewMore ? extrasDisplay : viewMoreDisplay}
            </div>
        )
    }
    
    const MAX_SOURCES_WARN = 2;

    if (obj.sources && obj.sources.length){
        let combinedNamesAndTexts = obj.sources.map((txt, i) => {return {'text': txt, 'name': obj.source_names[i]}})
        if (!usedWeb && obj.sources.length <= MAX_SOURCES_WARN){
            sourcesDisplay = (
                <>
                    <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                        {combinedNamesAndTexts.map(makeSourceTexts)}
                    </div>
                    <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                        <div style={{'color': 'var(--passive-text)', 'alignItems': 'center', 'fontSize': '.9rem'}}>
                        Warning: only {obj.sources.length} source(s) found. Maybe try OCR?
                        </div>
                        <Info iconStyle={{'opacity': '50%'}} align={'left'} text="OCR=optical character recognition for unreadable PDFs. Click the menu icon in the processing toolbar to process the text with OCR." />
                    </div>
                </>
            )
        }
        else {
            sourcesDisplay = combinedNamesAndTexts.map(makeSourceTexts)
        }
    }
    else if (allowOCR) {
        sourcesDisplay = (
            <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                <div style={{'color': 'var(--passive-text)', 'alignItems': 'center', 'fontSize': '.9rem'}}>
                    Warning: no sources. Maybe try OCR?
                </div>
                <Info iconStyle={{'opacity': '50%'}} align={'left'} text="OCR=optical character recognition for unreadable PDFs. Click the menu icon in the processing toolbar to process the text with OCR." />
            </div>
        )
    }
    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}} {...props}>
            <div style={{'display': 'flex', 'gap': '10px', 'flexWrap': 'wrap', 'alignItems': 'center'}}>
                <span style={{'backgroundColor': 'var(--dark-primary)', 'padding': '5px', 'paddingLeft': '10px', 'paddingRight': '10px', 'fontSize': '.8rem', 'color': 'var(--light-text)', 'borderRadius': 'var(--small-border-radius)'}}>
                    Sources
                </span>
                {sourcesDisplay}
            </div>
            {
                roundStates[i].aiDisplayedSource ? (
                    <div style={{'lineHeight': '1.25rem'}}>
                        <div>
                            <PassiveTextarea readOnly={true} style={{'minHeight': '10rem', 'fontSize': '.8rem'}} value={roundStates[i].aiDisplayedSource} />
                            {roundStates[i].aiDisplayedSourceName ? (
                                <div style={{'display': 'flex', 'backgroundColor': 'var(--dark-primary)', 'padding': '5px', 'justifyContent': 'space-between'}}>
                                    <div style={{'fontSize': '.8rem', 'color': 'var(--light-text)', 'fontFamily': 'var(--font-header)'}}>
                                        From {roundStates[i].aiDisplayedSourceName}
                                    </div>
                                    {onSourceButtonClick !== undefined && hasPageNum(roundStates[i].aiDisplayedSourceName) ? 
                                        <Tooltip content={"Go to Page"} align='left'>
                                            <MyImage src={ExportIcon} alt={"Go to Page"} style={{'filter': 'invert(var(--inverted))'}} onClick={() => handleGoToSourcePage(roundStates[i].aiDisplayedSourceName)} id={"ChatSourceGoToPage"} height={20} width={20}/>  
                                        </Tooltip> : ("")}
                                </div>
                                
                            ) : ""}
                        </div>
                    </div>
                ) : ""
            }
            {webSourcesDisplay}
        </div>
    )
}


function WebCard({ item, ...props }){
    const [createLoading, setCreateLoading] = useState(false)

    return (
        <div className={styles.webCardContainer} {...props}>
            <Link href={item.url} style={{'flex': '1'}} target="_blank">
                <div className={styles.webCard}>
                    <div className={`_clamped2`}>
                        {item.source_name}
                    </div>
                    {item.favicon ? (
                        <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                            <div style={{'display': 'flex', 'alignItems': 'center'}}>
                                <img src={item.favicon} width="20px" height="20px" />
                            </div>
                            <div style={{'textOverflow': 'ellipsis', 'overflow': 'hidden'}}>
                                {extractSiteName(item.url)}
                            </div>
                        </div>
                    ) : ""}
                </div>
            </Link>
            <div style={{'display': 'flex'}}>
                <CreateWrapper templateCode={'website'} noShow={true} noStretch={true} data={{'url': item.url}} loadCallback={() => {setCreateLoading(true)}} callback={() => {setCreateLoading(false)}}>
                    {createLoading ? (
                        <Loading gap={"5px"} size={13} text="Scraping" style={{'fontSize': '.8rem'}} />
                    ) : (
                        <Tooltip tooltipStyle={{'width': '150px'}} content={"Create chat with website"}>
                            <div className={styles.createFrom} style={{'fontSize': '.8rem'}}>
                                <MyImage src={LightningIcon} width={13} height={13} alt={"Create"} />
                                <div>
                                    Create
                                </div>
                            </div>
                        </Tooltip>
                    )}
                </CreateWrapper>
            </div>
        </div>
    )
}
