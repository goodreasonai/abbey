import { extractSiteName } from "@/utils/text"
import Link from "next/link"
import styles from './ChatSources.module.css'
import Tooltip from "../Tooltip/Tooltip"
import { useState } from "react"
import MyImage from "../MyImage/MyImage"
import LightningIcon from '../../../public/icons/LightningIcon.png'
import Loading from "../Loading/Loading"
import CreateWrapper from "../Quick/CreateWrapper"


export default function WebChatSources({ sources, ...props }){

    const [viewMore, setViewMore] = useState(false)  // used to see more web results

    if(!sources || !sources?.length){
        return ""
    }

    let webSourcesDisplay = ""
    if (sources.filter((x) => x.type == 'web').length){
        function makeWebCard(item, i) {
            return <WebCard item={item} index={i} key={i} />
        }
        const MAX_WEB_SOURCES = 3
        let ogs = sources.filter((x) => x)
        let extras = ogs.filter((_, i) => i >= MAX_WEB_SOURCES)
        let extrasDisplay = extras.map((x, i) => makeWebCard(x, i + MAX_WEB_SOURCES))
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
    
    return (
        <div {...props}>
            {webSourcesDisplay}
        </div>
    )
}


function WebCard({ item, index, ...props }){
    const [createLoading, setCreateLoading] = useState(false)

    return (
        <div className={styles.webCardContainer} {...props}>
            <Link href={item.url} style={{'flex': '1'}} target="_blank">
                <div className={styles.webCard}>
                    <div>
                        {index + 1}
                    </div>
                    <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '10px', 'flex': '1', 'width': '100%', 'minWidth': '0px'}}>
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
                                    Chat
                                </div>
                            </div>
                        </Tooltip>
                    )}
                </CreateWrapper>
            </div>
        </div>
    )
}
