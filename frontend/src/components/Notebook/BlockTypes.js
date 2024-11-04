import RichTextViewer from "../RichText/Viewer";
import Editor from "../RichText/Editor";
import { getTemplateByCode } from "@/templates/template";
import Link from "next/link";
import styles from './Notebook.module.css'
import MyImage from "../MyImage/MyImage";
import MarkdownViewer from "../Markdown/MarkdownViewer";
import { useMemo, useState } from "react";
import GearIcon from '../../../public/icons/GearIcon.png'
import KeyIcon from '../../../public/icons/KeyIcon.png'
import { Auth } from "@/auth/auth";
import { makeBlock } from "./Notebook";
import { handleGeneralStreaming } from "@/utils/streaming";
import Loading from "../Loading/Loading";
import ShareArrowIcon from '../../../public/icons/ShareArrowIcon.png'
import { removeHTMLTags } from "@/utils/html";
import { addCitations } from "@/utils/text";


export class BlockType {
    constructor(code, editable, maxShortenedRetrieval, hasText) {
        this.code = code;
        this.editable = editable  // Editable means whether the block is of an editable type, not whether a specific user can edit it.
        this.maxShortenedRetrieval = maxShortenedRetrieval  // When the user opts for shorter retrieval, how many can we use?
        this.hasText = hasText  // Does it have independent note text (i.e. not just an asset)? Can we make an outline/key points out of it?
    }

    View({ manifestRow, item, setItem, amEditing, setAmEditing, canEdit, blocks, setBlocks, highlightNote, scrollBlocksToBottom }) { 
        return (`No block type specific view for ${this.code}`)
    }

    hasSearchMatch(block, lcText) {
        return false
    }

    onDelete(item, setItems, getBlockById) {
        // Maybe clean up source links, if any? (if this is a summary, call onDeleteBacklink for its source asset)
    }

    onDeleteBacklink(backlink, item, setItems){
        // Maybe remove reference to link?
        // i.e., an asset block might have this called when its summary gets deleted.
    }

    // The text that shows as a preview in replies
    // Can return the full text (it gets shortened later)
    getReplyText(){
        return "..."
    }

    // When we need to exclude the block from retrieval, what do we include in the array?
    // Modified for blocks with sources.
    makeExclusions(block){
        return [`${this.code}:${block.id}`]
    }

    // for detecting edits
    compare(block1, block2) {
        return JSON.stringify(block1?.data) != JSON.stringify(block2?.data)
    }
}

export class NoteBlock extends BlockType {
    constructor(){
        super('note', true, 10, true)
    }

    View({ manifestRow, item, setItem, amEditing, setAmEditing, canEdit, blocks, setBlocks, highlightNote, scrollBlocksToBottom }) { 
        let typeSpecific = ""
        if (amEditing){
            typeSpecific = (
                <div>
                    <Editor
                        assetId={manifestRow['id']}
                        minHeightOption="none"
                        htmlContent={item.data.html}
                        onChangeHTML={(x) => {setItem({...item, 'data': {...item.data, 'html': x}})}}
                        customRightMenu={(
                            <div className={`${styles.closeEditButton} _clickable`} onClick={() => setAmEditing(false)}>
                                Close
                            </div>
                        )}
                    />
                </div>
            )
        }
        else {
            typeSpecific = (
                <div>
                    <RichTextViewer minHeightOption="none" viewerPaddingOption="none" content={item.data.html} key={item.data.html} />
                </div>
            )
        }
        return typeSpecific
    }

    hasSearchMatch(block, lcText) {
        const match = block['data']['html'].toLowerCase().includes(lcText)
        return match
    }

    getReplyText(block) {
        return removeHTMLTags(block.data.html)
    }

}

export class AssetBlock extends BlockType {
    constructor(){
        super('asset', false, 3, false)
    }

    View({ manifestRow, item, setItem, amEditing, setAmEditing, canEdit, blocks, setBlocks, highlightNote, scrollBlocksToBottom }) { 
        const { getToken } = Auth.useAuth()
        const [loadingSummary, setLoadingSummary] = useState(false)
        const [loadingKeyPoints, setLoadingKeyPoints] = useState(false)

        async function summarize(){
            if (loadingSummary){
                return
            }
            try {
                setLoadingSummary(true)
                // TODO call a quick summarize endpoint.
                const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/quick-summary"
                const data = {
                    'id': item.data.assetRow.id
                }
                const response = await fetch(url, {
                    'headers': {
                        'x-access-token': await getToken(),
                        'Content-Type': 'application/json'
                    },
                    'body': JSON.stringify(data),
                    'method': 'POST'
                })
                const newBlock = makeBlock('ai', {'ai': '', 'blockSources': [item.id]}, 'AI')
                // Insert new directly after current block
                setBlocks((prev) => {
                    const newBlocks = []
                    for (let bl of prev){
                        if (bl.id !== newBlock.id){  // due to the double calling of the set function
                            newBlocks.push(bl)
                            if (bl.id == item.id){
                                newBlocks.push(newBlock)
                            }
                        }
                    }
                    return newBlocks
                })
                setTimeout(() => {
                    highlightNote(newBlock.id)
                }, 100)
                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
                await handleGeneralStreaming({
                    reader: reader,
                    decoder: decoder,
                    onSnippet: (result)=>{
                        setBlocks((prev) => {
                            return prev.map((x) => x.id == newBlock.id ? {...newBlock, 'data': {...newBlock.data, 'ai': result}} : x)
                        })
                    }
                })
                setLoadingSummary(false)
                setItem((prev) => {return {...prev, 'data': {...prev.data, 'summaryBlockId': newBlock.id}}})
            }
            catch(e) {
                setLoadingSummary(false)
                console.log(e)
            }
        }
        function goToSummary(){
            highlightNote(item.data.summaryBlockId)
        }
        async function getKeyPoints(){
            if (loadingKeyPoints){
                return
            }
            try {
                setLoadingKeyPoints(true)
                // TODO call a quick summarize endpoint.
                const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/key-points"
                const data = {
                    'id': item.data.assetRow.id
                }
                const response = await fetch(url, {
                    'headers': {
                        'x-access-token': await getToken(),
                        'Content-Type': 'application/json'
                    },
                    'body': JSON.stringify(data),
                    'method': 'POST'
                })
                const myJson = await response.json()

                if (myJson['bullets']?.length){
                    const bullets = myJson['bullets']
                    const refined = addCitations(bullets)
                    let txt = ""
                    for (let x of refined){
                        txt += `- ${x.text}\n`
                    }
                    const newBlock = makeBlock('ai', {'ai': txt, 'blockSources': [item.id]}, 'AI')
                    // Insert new directly after current block
                    setBlocks((prev) => {
                        const newBlocks = []
                        for (let bl of prev){
                            if (bl.id !== newBlock.id){  // due to the double calling of the set function
                                newBlocks.push(bl)
                                if (bl.id == item.id){
                                    newBlocks.push(newBlock)
                                }
                            }
                        }
                        return newBlocks
                    })
                    setTimeout(() => {
                        highlightNote(newBlock.id)
                    }, 100)
                    setItem((prev) => {return {...prev, 'data': {...prev.data, 'keyPointsBlockId': newBlock.id}}})
                }
                setLoadingKeyPoints(false)
            }
            catch(e) {
                setLoadingKeyPoints(false)
                console.log(e)
            }
        }
        function goToKeyPoints(){
            highlightNote(item.data.keyPointsBlockId)
        }

        const hasSummary = useMemo(() => {
            let id = item.data.summaryBlockId
            if (!id){
                return false
            }
            // return blocks.filter((x) => x.id == id).length
            return true
        }, [blocks, item])
        const hasKeyPoints = useMemo(() => {
            let id = item.data.keyPointsBlockId
            if (!id){
                return false
            }
            // return blocks.filter((x) => x.id == id).length
            return true
        }, [blocks, item])

        let tmp = getTemplateByCode(item.data.assetRow['template'])
        let typeSpecific = (
            <div>
                <Link href={`/assets/${item.data.assetRow.id}`} target="_blank" className={styles.assetBlockContainer}>
                    <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                        <MyImage src={tmp.constructor.icon} width={20} height={20} alt={tmp.constructor.readableName} />
                        <div style={{'fontSize': '1.2rem'}}>
                            {item.data.assetRow.title}
                        </div>
                    </div>
                    <div style={{'color': 'var(--passive-text)'}}>
                        {item.data.assetRow.preview_desc}
                    </div>
                </Link>
                <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                    {
                        hasSummary ? (
                            <div style={{'display': 'flex', 'fontSize': '.9rem'}}>
                                <div className="_touchableOpacity" onClick={() => goToSummary()} style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}}>
                                    <div>
                                        Summary
                                    </div>
                                    <MyImage src={ShareArrowIcon} width={15} height={15} alt={"Arrow"} />
                                </div>
                            </div>
                        ) : (canEdit && tmp.constructor.summarizable ? (
                            <div style={{'display': 'flex', 'fontSize': '.9rem'}}>
                                <div onClick={() => summarize()} className="_touchableOpacity" style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}}>
                                    <div>
                                        Summarize
                                    </div>
                                    {
                                        loadingSummary ? (
                                            <Loading size={15} text="" />
                                        ) : (
                                            <MyImage src={GearIcon} width={15} height={15} alt={"Gear"} />
                                        )
                                    }
                                </div>
                            </div>
                        ) : "")
                    }
                    {
                        hasKeyPoints ? (
                            <div style={{'display': 'flex', 'fontSize': '.9rem'}}>
                                <div className="_touchableOpacity" onClick={() => goToKeyPoints()} style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}}>
                                    <div>
                                        Key Points
                                    </div>
                                    <MyImage src={ShareArrowIcon} width={15} height={15} alt={"Arrow"} />
                                </div>
                            </div>
                        ) : (canEdit && tmp.constructor.summarizable ? (
                            <div style={{'display': 'flex', 'fontSize': '.9rem'}}>
                                <div onClick={() => getKeyPoints()} className="_touchableOpacity" style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}}>
                                    <div>
                                        Key Points
                                    </div>
                                    {
                                        loadingKeyPoints ? (
                                            <Loading size={15} text="" />
                                        ) : (
                                            <MyImage src={KeyIcon} width={15} height={15} alt={"Key"} />
                                        )
                                    }
                                </div>
                            </div>
                        ) : "")
                    }
                </div>
            </div>
        )

        return typeSpecific
    }

    hasSearchMatch(block, lcText) {
        let ar = block['data']['assetRow']
        const match = ar['title'].toLowerCase().includes(lcText) || ar['preview_desc'].toLowerCase().includes(lcText) || ar['author'].toLowerCase().includes(lcText)
        return match
    }

    makeExclusions(block) {
        return [block['data']['assetRow']['id']]
    }

    onDelete(item, setItems, getBlockById) {
        const summary = item.data.summaryBlockId
        // Notify sources of our deletion
        if (summary){
            const blockItem = getBlockById(summary)
            if (blockItem){
                const blockType = getBlockTypeByCode(blockItem.type)
                blockType.onDeleteBacklink(item.id, blockItem, setItems)
            }
        }
        const keyPoints = item.data.keyPointsBlockId
        if (keyPoints){
            const blockItem = getBlockById(keyPoints)
            if (blockItem){
                const blockType = getBlockTypeByCode(blockItem.type)
                blockType.onDeleteBacklink(item.id, blockItem, setItems)
            }
        }
    }

    getReplyText(item){
        return item.data.assetRow['title']
    }

    onDeleteBacklink(backlink, item, setItems) {
        if (item.data.summaryBlockId == backlink){
            // Remove summary link
            setItems((prev) => prev.map((x) => x.id == item.id ? {...item, 'data': {...item.data, 'summaryBlockId': undefined}} : x))
        }
        if (item.data.keyPointsBlockId == backlink){
            // Remove summary link
            setItems((prev) => prev.map((x) => x.id == item.id ? {...item, 'data': {...item.data, 'keyPointsBlockId': undefined}} : x))
        }
    }

    compare(block1, block2) {
        return JSON.stringify({...block1?.data, 'assetRow': block1?.data?.assetRow?.id}) != JSON.stringify({...block2?.data, 'assetRow': block2?.data?.assetRow?.id})
    }
}


export class AIBlock extends BlockType {
    constructor(){
        super('ai', false, 10, true)
    }

    View({ manifestRow, item, setItem, amEditing, setAmEditing, canEdit, blocks, setBlocks, highlightNote, scrollBlocksToBottom }) { 
        const aiText = useMemo(() => {
            return item.data.ai
        }, [item?.data?.ai])
        const userText = useMemo(() => {
            return item.data.user
        }, [item?.data?.user])
        return (
            <div>
                {item?.data?.user ? (
                    <div style={{'color': 'var(--passive-text)', 'lineHeight': '1.5rem', 'paddingTop': '1rem'}}>
                        {item.data.user}
                    </div>
                ) : ""}
                <MarkdownViewer>
                    {aiText}
                </MarkdownViewer>
                {item.data?.blockSources?.length ? (
                    <div style={{'display': 'flex'}}>
                        <div className="_touchableOpacity" onClick={() => highlightNote(item.data.blockSources[0])} style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px', 'fontSize': '.9rem'}}>
                            <div>
                                Source
                            </div>
                            <MyImage src={ShareArrowIcon} width={15} height={15} alt={"Arrow"} />
                        </div>
                    </div>
                ) : ""}
            </div>
        )        
    }

    hasSearchMatch(block, lcText) {
        const match = block['data']['ai'].toLowerCase().includes(lcText)
        return match
    }

    onDelete(item, setItems, getBlockById) {
        const sources = item.data.blockSources
        // Notify sources of our deletion
        if (sources){
            for (let x of sources){
                const blockItem = getBlockById(sources)
                if (blockItem){
                    const blockType = getBlockTypeByCode(blockItem.type)
                    blockType.onDeleteBacklink(item.id, blockItem, setItems)
                }
            }
        }
    }

    onDeleteBacklink(backlink, item, setItems) {
        if (item.data.blockSources){
            // Remove from sources
            setItems((prev) => prev.map((x) => x.id == item.id ? {...item, 'data': {...item.data, 'blockSources': item.data.blockSources.filter((y) => y != backlink)}} : x))
        }
    }

    getReplyText(item){
        return item.data.ai + ""
    }
}


export const BLOCK_TYPES = [
    new NoteBlock(),
    new AssetBlock(),
    new AIBlock()
]

export function getBlockTypeByCode(code) {
    let correct = BLOCK_TYPES.filter((x) => x.code == code)
    if (correct.length){
        return correct[0]
    }
    else {
        throw Error(`Unrecognized block type '${code}'`)
    }
}