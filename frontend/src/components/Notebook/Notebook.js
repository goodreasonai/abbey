import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "../RichText/Editor";
import TwoPanel from "../TwoPanel/TwoPanel";
import MyImage from "../MyImage/MyImage";
import SendIcon from '../../../public/icons/SendIcon.png'
import { DATA_TEMPLATES, getTemplateByCode } from "@/templates/template";
import styles from './Notebook.module.css'
import { getCurrentUTCTimestamp } from "@/utils/time";
import { getRandomId } from "@/utils/rand";
import { Auth } from "@/auth/auth";
import CreateWrapper from "../Quick/CreateWrapper";
import Block from "./Block";
import Loading from "../Loading/Loading";
import useSaveDataEffect from "@/utils/useSaveDataEffect";
import SelectAssetWrapper from "../SelectAssetWrapper/SelectAssetWrapper";
import AddIcon from '../../../public/icons/AddIcon.png'
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import RightPanel from "./RightPanel/RightPanel";
import MinimizeIcon from '../../../public/icons/MinimizeIcon.png'
import ExpandIcon from '../../../public/icons/ExpandIcon.png'
import MagnifyingGlassIcon from '../../../public/icons/MagnifyingGlassIcon.png'
import SearchBar from "../form/SearchBar";
import { boldWordsInHtml } from "../RichText/Viewer";
import shortenText, { toWords } from "@/utils/text";
import RemoveIcon from '../../../public/icons/RemoveIcon.png'
import Tooltip from "../Tooltip/Tooltip";
import ChatIcon from '../../../public/icons/ChatIcon.png'
import NotebookIcon from '../../../public/icons/NotebookIcon.png'
import { getBlockTypeByCode } from "./BlockTypes";
import AttachIcon from '../../../public/icons/AttachIcon.png'
import { getUserName } from "@/utils/user";
import CurvedArrow from "../CurvedArrow/CurvedArrow";
import { useIsMobile } from "@/utils/mobile";
import useKeyboardShortcut, { getModKey } from "@/utils/keyboard";


const getNotebookState = ({
    blocks=[],
    keyPoints={
        'bullets': [],
        'numBlocks': 0,
        'timestamp': getCurrentUTCTimestamp()
    },
    outline={
        'outline': [],
        'numBlocks': 0,
        'timestamp': getCurrentUTCTimestamp()
    }} = {}) => {
    
    return {
        'blocks': blocks,
        'keyPoints': keyPoints,
        'outline': outline
    }
}

export function getAssetsToExclude(blocks){
    let included = {}
    const newExclude = []
    for (let i = blocks.length - 1; i >= 0; i--){
        const blockType = getBlockTypeByCode(blocks[i]['type'])
        const currNum = included[blocks[i]['type']]
        if (currNum >= blockType.maxShortenedRetrieval){
            newExclude.push(...blockType.makeExclusions(blocks[i]))
        }
        else {
            included[blocks[i]['type']] = currNum === undefined ? 1 : currNum + 1
        }
    }
    return newExclude
}


// Has a backend analog
export function makeBlock(type, data, author, replyTo) {
    let blockType = getBlockTypeByCode(type)
    if (!blockType){
        throw Error(`Type ${type} not in allowed block types`)
    }
    return {
        'type': type,
        'timestamp': getCurrentUTCTimestamp(),
        'id': getRandomId(10),
        'author': author || 'Me',
        'data': data,
        'replyTo': replyTo
        // may want to do "replies" in the future.
    }
}


export default function Notebook({ manifestRow, canEdit, collabSocket }) {

    const [inputText, setInputText] = useState("")
    const [inReplyTo, setInReplyTo] = useState(undefined)
    const { user } = Auth.useUser()

    const [notebookState, setNotebookState] = useState(getNotebookState())

    const blocks = notebookState.blocks
    const setBlocks = useCallback((x) => {
        setNotebookState((prev) => {return {...prev, 'blocks': typeof x == 'function' ? x(prev.blocks) : x}})
    }, [setNotebookState])

    const keyPoints = notebookState.keyPoints
    const setKeyPoints = useCallback((x) => {
        setNotebookState((prev) => {return {...prev, 'keyPoints': typeof x == 'function' ? x(prev.keyPoints) : x}})
    }, [setNotebookState])

    const outline = notebookState.outline
    const setOutline = useCallback((x) => {
        setNotebookState((prev) => {return {...prev, 'outline': typeof x == 'function' ? x(prev.outline) : x}})
    }, [setNotebookState])

    const [clearContentCounter, setClearContentCounter] = useState(0)  // a way to trigger a clear content inside editor
    const [notebookLoadState, setNotebookLoadState] = useState(0)
    const [notebookSaveState, setNotebookSaveState] = useState(0)

    const [topBlocksBlurred, setTopBlocksBlurred] = useState(false)
    const [editorMinimized, setEditorMinimized] = useState(false)
    const [bottomBlocksBlurred, setBottomBlocksBlurred] = useState(false)
    
    const [showSearch, setShowSearch] = useState(false)
    const [searchText, setSearchText] = useState("")
    const [searchResults, setSearchResults] = useState([])
    const [artificiallyBolded, setArtificiallyBolded] = useState([])
    const [currSearchResultIndex, setCurrSearchResultIndex] = useState(0)
    const lastSearchText = useRef("")

    const [showRightPanelMobile, setShowRightPanelMobile] = useState(false)
    
    const { isMobile } = useIsMobile()

    const [showOnlyBlockType, setShowOnlyBlockType] = useState(undefined)

    const lastSavedVersion = useRef(undefined)
    const savedHashRef = useRef("")
    const saveQueue = useRef([])

    const { getToken, isSignedIn } = Auth.useAuth()

    async function getState(){
        try {
            setNotebookLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/notebook/get?id=${manifestRow['id']}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            if (myJson['result']){
                lastSavedVersion.current = myJson['result']
                savedHashRef.current = myJson['hash']
                setNotebookState(getNotebookState({ ...myJson['result'] }))
            }
            else {
                setNotebookState(getNotebookState())
            }
            setNotebookLoadState(2)
        }
        catch(e) {
            setNotebookLoadState(3)
        }
    }

    useEffect(() => {
        if (manifestRow.id && isSignedIn !== undefined){
            getState()
        }
    }, [setNotebookLoadState, isSignedIn])

    function mergeVersions(serverVersion, clientVersion){
        // To avoid loops (ping/pong between clients), mergeVersions must defer to server version on merge conflicts.

        // We have: serverVersion, lastSavedVersion.current, and clientVersion
        // calculate diffs for blocks

        // Go through the blocks and get diffs for (saved, server) and (saved, client)

        function getDiffs(newVersion) {

            const oldVersion = lastSavedVersion.current

            let diffs = []  // can be inefficient to use a list based on the comparisons made later.
            function addDiff(type, blockId, oldValue, newValue){
                if (type != 'reorder' && type != 'delete' && type != 'insert' && type != 'edit' && type != 'outline' && type != 'keyPoints'){
                    console.log(`Diff type ${type} not recognized; not including it.`)
                    return
                }
                diffs.push({'type': type, 'blockId': blockId, 'oldValue': oldValue, 'newValue': newValue})
            }

            // transform lists into dictionaries with index info
            const sDict = {}
            const nDict = {}
            const maxBlocksLen = Math.max(oldVersion?.blocks?.length, newVersion?.blocks?.length)
            for (let i = 0; i < maxBlocksLen; i++){
                if (oldVersion?.blocks?.length > i){
                    sDict[oldVersion.blocks[i].id] = {...oldVersion.blocks[i], 'index': i}
                }
                if (newVersion?.blocks?.length > i){
                    nDict[newVersion.blocks[i].id] = {...newVersion.blocks[i], 'index': i}
                }
            }

            // get reordering diffs, edits, and deletions
            for (let key of Object.keys(sDict)){
                if (nDict[key]){  // both exist
                    // reordering?
                    if (nDict[key].index != sDict[key].index){
                        addDiff('reorder', nDict[key].id, sDict[key].index, nDict[key].index)
                    }

                    // edit?
                    const blockType = getBlockTypeByCode(nDict[key].type)
                    if (blockType.compare(nDict[key], sDict[key])){
                        addDiff('edit', nDict[key].id, sDict[key].data, nDict[key].data)
                    }
                }
                else {
                    // if it's in server but not new, then it's a deletion
                    addDiff('delete', sDict[key].id)
                }
            }
            // get insertions
            for (let key of Object.keys(nDict)){
                if (!sDict[key]){
                    addDiff('insert', nDict[key].id, nDict[key].index, nDict[key])
                }
            }

            // Key points and outlines diffs (default to server version)
            if (JSON.stringify(oldVersion?.keyPoints) != JSON.stringify(newVersion.keyPoints)){
                addDiff('keyPoints', undefined, oldVersion?.keyPoints, newVersion.keyPoints)
            }
            if (JSON.stringify(oldVersion?.outline) != JSON.stringify(newVersion.outline)){
                addDiff('outline', undefined, oldVersion?.outline, newVersion.outline)
            }

            return diffs
        }

        const cDiffs = getDiffs(clientVersion)
        const sDiffs = getDiffs(serverVersion)

        // Find non conflicting diffs to serverVersion
        let clearedChangesReorder = []
        let clearedChangesInsert = []
        let clearedChangesEdit= []
        let clearedChangesDelete= []
        let clearedChangesKeyPoints= []
        let clearedChangesOutline= []
        let canDoReordering = undefined  // If there's any reordering at all, default to the server version (more complicated logic TODO)
        for (let cDiff of cDiffs){
            if (cDiff.type == 'reorder'){
                if (canDoReordering === undefined){
                    for (let sDiff of sDiffs){
                        if (sDiff.type == 'reorder'){
                            canDoReordering = 0
                        }
                    }
                }
                if (canDoReordering === undefined){
                    canDoReordering = 1
                }

                if (canDoReordering == 1){
                    clearedChangesReorder.push(cDiff)
                }
            }
            else if (cDiff.type == 'edit'){
                // good only if there's no delete of same block
                const edits = sDiffs.filter((x) => x.type == 'delete' && x.blockId == cDiff.blockId)
                if (!edits.length){
                    clearedChangesEdit.push(cDiff)
                }
            }
            else if (cDiff.type == 'insert'){
                // inserts are cool unless they have the same index, in which case we need to move one to the end.
                const edits = sDiffs.filter((x) => x.type == 'insert' && x.oldValue == cDiff.oldValue)  // note oldValue means index in this case
                if (!edits.length){
                    clearedChangesInsert.push(cDiff)
                }
                else {
                    clearedChangesInsert.push({...cDiff, 'oldValue': undefined})
                }
            }
            else if (cDiff.type == 'delete'){
                // good as long as there's no edit of the same block
                const edits = sDiffs.filter((x) => x.type == 'edit' && x.blockId == cDiff.blockId)
                if (!edits.length){
                    clearedChangesDelete.push(cDiff)
                }
            }
            else if (cDiff.type == 'keyPoints'){
                const keyPointsEdits = sDiffs.filter((x) => x.type == 'keyPoints' && x.blockId == cDiff.blockId)
                if (!keyPointsEdits.length){
                    clearedChangesKeyPoints.push(cDiff)
                }
            }
            else if (cDiff.type == 'outline'){
                const outlineEdits = sDiffs.filter((x) => x.type == 'outline' && x.blockId == cDiff.blockId)
                if (!outlineEdits.length){
                    clearedChangesOutline.push(cDiff)
                }
            }
            
        }

        // Default to server version and add non conflicting diffs
        let newVersion = {...serverVersion}

        let newBlocks = [...serverVersion?.blocks]
        const newBlocksLengthDiff = clearedChangesInsert?.length - clearedChangesDelete?.length
        for (let i = 0; i < newBlocksLengthDiff; i++){  // provision new blocks
            newBlocks.push(undefined)
        }

        // do reorderings first
        for (let diff of clearedChangesReorder){
            let oldIndex = diff.oldValue
            let newIndex = diff.newValue
            newBlocks[newIndex] = serverVersion[oldIndex]
        }

        // edits
        for (let diff of clearedChangesEdit){
            newBlocks = newBlocks.map((x) => x?.id == diff.blockId ? {...x, 'data': diff.newValue} : x)
        }

        // deletions
        for (let diff of clearedChangesDelete){
            newBlocks = newBlocks.filter((x) => x?.id != diff.blockId)
        }

        // insertions
        for (let diff of clearedChangesInsert){
            if (diff.oldValue === undefined){  // oldValue here is actually the index (see above)
                newBlocks.push(diff.newValue)
            }
            else {
                newBlocks[diff.oldValue] = diff.newValue
            }
        }

        newBlocks = newBlocks.filter((x) => x)

        // keypoints / outline
        for (let diff of clearedChangesKeyPoints){
            newVersion.keyPoints = diff.newValue
        }
        for (let diff of clearedChangesOutline){
            newVersion.outline = diff.newValue
        }

        newVersion.blocks = newBlocks

        lastSavedVersion.current = serverVersion
        setNotebookState(newVersion)

        if (newVersion?.blocks?.length > clientVersion?.blocks?.length){
            scrollBlocksToBottom(true)
        }
    }

    const saveNotebook = useCallback(async (notebook) => {
        if (!collabSocket){
            return
        }
        // We do this queue business in case the user double saves before the server can respond to the first one.
        const mySaveId = getRandomId(5)
        saveQueue.current.push(mySaveId)
        while (saveQueue.current[0] != mySaveId){
            await new Promise(r => setTimeout(r, 100));
        }
        try {
            setNotebookSaveState(1)
            const data = {
                'type': 'save',
                'id': manifestRow.id,
                'token': await getToken(),
                'data': {
                    'last_saved_hash': savedHashRef.current,
                    'value': notebook
                }
            }

            // Create a promise that resolves when the server confirms the save
            const savePromise = new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    collabSocket.off('save_response');
                    reject(new Error('Save operation timed out'));
                }, 10000);
    
                collabSocket.once('save_response', (response) => {
                    clearTimeout(timeoutId);
                    if (response.status === 'success') {
                        savedHashRef.current = response.hash
                        lastSavedVersion.current = notebook
                        resolve();
                    }
                    else if (response.value){  // server is returning a new version for us to merge
                        if (savedHashRef.current != response.hash){
                            // The server just told us that our hash is out of date. So why check?
                            // Because we might've gotten an update and merged already.
                            savedHashRef.current = response.hash
                            mergeVersions(response.value, notebook)
                        }
                        resolve()
                    }
                    else {
                        reject(new Error(response.reason || 'Save failed'));
                    }
                });

                // note that the "off" and "once" stuff basically just means that the event handler will disable after receiving one response or timing out.
    
                collabSocket.emit('action', data);
            });
        
            // Wait for the server response
            await savePromise
            setNotebookSaveState(2) // Save successful
        }
        catch(e) {
            console.log(e)
            setNotebookSaveState(3)
        }
        saveQueue.current.shift()
    }, [setNotebookSaveState, collabSocket])
    useSaveDataEffect(notebookState, canEdit && notebookLoadState == 2 && collabSocket, saveNotebook, 250)

    useEffect(() => {
        // Handler for "value_update" events
        if (!collabSocket){
            return
        }

        const handleValueUpdate = (data) => {
            if (data.hash != savedHashRef.current){
                savedHashRef.current = data.hash
                mergeVersions(data.value, notebookState)
            }
        };
    
        // Add event listener for "value_update" events
        collabSocket.on('value_update', handleValueUpdate);
    
        return () => {
            collabSocket.off('value_update', handleValueUpdate);
        };
    }, [collabSocket, notebookState]);

    const blocksAndBlurContainerRef = useRef()
    const blocksContainerRef = useRef()
    const addNoteContainerRef = useRef()
    // We need to set the height of the scrollable blocks so that we don't have any overflow issues (and it scrolls).
    // Unfortunately it's a bit complicated.
    useEffect(() => {
        const adjustTopHeight = () => {
            if (blocksAndBlurContainerRef.current && addNoteContainerRef.current) {
                const bottomRect = addNoteContainerRef.current.getBoundingClientRect();
                blocksAndBlurContainerRef.current.style.bottom = `calc(${bottomRect.height}px + var(--std-margin))`
            }
        };
        // Adjust height on initial render
        adjustTopHeight();
        const resizeObserver = new ResizeObserver(() => {
            adjustTopHeight();
        });
        if (addNoteContainerRef.current) {
            resizeObserver.observe(addNoteContainerRef.current);
        }
        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    function submitNote(){
        let authorName = getUserName(user)
        let newNote = makeBlock('note', {'html': inputText}, authorName, inReplyTo)
        setBlocks([...blocks, newNote])
        setClearContentCounter(clearContentCounter + 1)
        setInputText("")
        setInReplyTo(undefined)
        scrollBlocksToBottom()
    }

    function handleUpload(asset){
        if (asset) {
            let newNote = makeBlock('asset', {'assetRow': asset}, asset.author)
            setBlocks([...blocks, newNote])
            scrollBlocksToBottom()
        }
    }

    // Unfortunately complicated due to loading delays in RichTextViewer
    function scrollBlocksToBottom(onlyScrollIfNearBottom){
        const container = blocksContainerRef.current
        if (container) {
            function scroll(){
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: 'smooth'
                });
            }
            if (onlyScrollIfNearBottom){
                const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
                if (distanceFromBottom > 100){
                    return
                }
            }
            setTimeout(() => {
                scroll()
            }, 250)
        }
    }

    // TODO: change to load listener
    useEffect(() => {
        if (notebookLoadState == 2){
            scrollBlocksToBottom()
        }
    }, [notebookLoadState])

    function handleScroll(){
        const container = blocksContainerRef.current;
        if (container) {
            const isAtTop = container.scrollTop === 0;
            const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 20;
            setTopBlocksBlurred(!isAtTop);
            setBottomBlocksBlurred(!isAtBottom);
        }
    }
    useEffect(() => {
        const container = blocksContainerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            handleScroll();
        }
        return () => {
            if (container) {
                container.removeEventListener('scroll', handleScroll);
            }
        };
    }, [blocksContainerRef]);

    const shortcutRef = useRef()
    useEffect(() => {
        shortcutRef.current = () => {
            submitNote()
        }
    }, [submitNote])
    const shortcuts = [{
        'key': 'Mod-Enter',
        'fnRef': shortcutRef
    }]
    
    // Callback for select sources in the Add Existing modal
    function addExistingCallback(assets){
        if (assets.length){
            let newBlocks = []
            for (let asset of assets){
                let newBlock = makeBlock('asset', {'assetRow': asset}, asset.author)
                newBlocks.push(newBlock)
            }
            setBlocks([...blocks, ...newBlocks])
            scrollBlocksToBottom()
        }
    }

    const moveBlock = useCallback((dragIndex, hoverIndex) => {
        // The reason we do this instead of using setBlocks((x) => ...) is that in dev, setBlocks gets triggered twice, and theoretically shouldn't count on just a single update in prod
        const draggedBlock = blocks[dragIndex]
        const newBlocks = [...blocks]
        newBlocks.splice(dragIndex, 1)
        newBlocks.splice(hoverIndex, 0, draggedBlock)
        setBlocks(newBlocks);
    }, [setBlocks, blocks]);

    function highlightNote(blockId){
        if (blocksContainerRef.current) {
            const blockElement = document.getElementById(`_${blockId}`);
            if (blockElement) {
                blockElement.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'start' });
                blockElement.classList.add(`${styles.pulseNote}`);
                setTimeout(() => {
                    blockElement.classList.remove(`${styles.pulseNote}`);
                }, 1000); // Duration should match the CSS animation duration
            }
            else {
                console.log(`No block element found for block with id ${blockId}`)
            }
        }
    }

    useEffect(() => {
        if (searchResults?.length){
            highlightNote(searchResults[0]['id'], searchText)
        }
    }, [searchResults])

    function unboldAll(){
        for (let blockId of artificiallyBolded){
            const blockElement = document.getElementById(`_${blockId}`);
            if (blockElement) {
                // Remove the <b class="__bolded"> tags
                blockElement.innerHTML = blockElement.innerHTML.replace(/<b class="__bolded">(.*?)<\/b>/g, '$1');
            }
        }
        setArtificiallyBolded([])
    }

    function doBolding(matches, text){
        for (let match of matches){
            const blockElement = document.getElementById(`_${match['id']}`);
            blockElement.innerHTML = boldWordsInHtml(blockElement.innerHTML, toWords(text), "__bolded")
        }
        setArtificiallyBolded([...artificiallyBolded, ...(matches.map((x) => x.id))])
    }

    function handleSearch(x){
        if (!x){
            setCurrSearchResultIndex(0)
            setSearchResults([])
            lastSearchText.current = ""
            return
        }
        if (searchText == lastSearchText.current){
            if (!searchResults.length){
                return
            }
            let nextIndex = (currSearchResultIndex + 1) % searchResults.length
            setCurrSearchResultIndex(nextIndex)
            highlightNote(searchResults[nextIndex]['id'])
            return
        }
        // unboldAll()
        const lc = x.toLowerCase()
        const results = []
        for (let block of blocks){
            const blockType = getBlockTypeByCode(block['type'])
            const match = blockType.hasSearchMatch(block, lc)
            if (match){
                results.push({'id': block['id']})
            } 
        }
        setCurrSearchResultIndex(0)
        setSearchResults(results)
        // doBolding(results, searchText)
        if (results.length){
            highlightNote(results[0]['id'], searchText)
        }
        lastSearchText.current = searchText
    }

    const searchShortcutCallback = useCallback((event) => {
        setShowSearch(!showSearch);
    }, [showSearch])
    useKeyboardShortcut([['Meta', 'f'], ['Control', 'f']], searchShortcutCallback)

    const excludeFromAutocomplete = useMemo(() => {
        let exclude = getAssetsToExclude(blocks)
        return exclude
    }, [blocks])

    function getBlockById(blockId){
        let filtered = blocks.filter((x) => x.id == blockId)
        if (filtered.length){
            return filtered[0]
        }
        return undefined
    }

    function deleteBlock(item){
        const blockType = getBlockTypeByCode(item.type)
        blockType.onDelete(item, setBlocks, getBlockById)
        setBlocks((bl) => {return bl.filter((x) => x.id != item.id)})
    }

    function reply(block){
        setInReplyTo(block)
    }

    const blocksDisplay = useMemo(() => {
        let blocksToShow = blocks
        if (showOnlyBlockType){
            blocksToShow = blocksToShow.filter((x) => x.type == showOnlyBlockType)
        }
        return blocksToShow.map((item, i) => {
            return (
                <Block
                    manifestRow={manifestRow}
                    item={item}
                    i={i}
                    moveBlock={moveBlock}
                    setItem={(x) => setBlocks((bl) => bl.map((y) => y.id == item.id ? (typeof x == 'function' ? x(y) : x) : y))}
                    key={item.id}
                    isLast={i == blocks.length - 1}
                    isFirst={i == 0}
                    deleteBlock={() => deleteBlock(item)}
                    reply={() => reply(item)}
                    canEdit={canEdit}
                    blocks={blocks}
                    setBlocks={setBlocks}
                    highlightNote={highlightNote}
                    scrollBlocksToBottom={scrollBlocksToBottom} />
            )
        })
    }, [manifestRow, moveBlock, setBlocks, blocks, showOnlyBlockType])

    const leftPanel = (
        <div style={{'position': 'absolute', 'top': '0px', 'bottom': '0px', 'left': '0px', 'right': '0px'}}>
            <div style={{'position': 'absolute', 'top': '0px', 'right': '12px', 'zIndex': '10'}}> {/* 12px unfortunately being the size of the scrollbar */}
                {
                    showSearch ? (
                        <div style={{'display': 'flex', 'alignItems': 'center', 'width': '300px'}}>
                            {searchResults.length && searchText ? (
                                <div style={{'color': 'var(--passive-text)', 'padding': '10px'}}>
                                    {`${currSearchResultIndex+1}/${searchResults.length}`}
                                </div>
                            ) : ""}
                            <div style={{'border': '1px solid var(--light-background)', 'flex': '1', 'borderRadius': 'var(--small-border-radius)'}}>
                                <SearchBar autoFocus={true} handleSearch={handleSearch} searchOnErase={false} size="small" value={searchText} setValue={setSearchText} />
                            </div>
                            <div style={{'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center', 'padding': '10px'}}>
                                <MyImage className={"_clickable"} onClick={() => {unboldAll(); setShowSearch(false)}} src={RemoveIcon} width={15} height={15} alt={"Close"} />
                            </div>
                        </div>
                    ) : (
                        <div style={{'paddingRight': '5px', 'paddingTop': '10px'}}>
                            <MyImage onClick={() => setShowSearch(!showSearch)} className={"_touchableOpacity"} src={MagnifyingGlassIcon} width={15} height={15} alt={"Search"} />
                        </div>
                    )
                }
                {blocks?.length ? (
                    <div style={{'display': 'flex', 'justifyContent': 'flex-end'}}>
                        <Tooltip content={"Show Attachments Only"} align="left" verticalAlign="bottom">
                            <div style={{'marginRight': '5px', 'marginTop': '10px', 'position': 'relative'}} onClick={() => setShowOnlyBlockType(showOnlyBlockType ? undefined : 'asset')}>
                                <MyImage className={"_touchableOpacity"} src={AttachIcon} width={20} height={20} alt={"Search"} />
                                {showOnlyBlockType == 'asset' ? (
                                    <div style={{'position': 'absolute', 'bottom': '0px', 'right': '0px', 'backgroundColor': 'var(--dark-primary)', 'width': '10px', 'height': '10px', 'borderRadius': '50%'}}>
                                    </div>
                                ) : ""}
                            </div>
                        </Tooltip>
                    </div>
                ) : ""}
                
                {
                    isMobile ? (
                        <div style={{'paddingRight': '5px', 'paddingTop': '10px'}}>
                            <MyImage onClick={() => setShowRightPanelMobile(!showRightPanelMobile)} className={"_touchableOpacity"} src={ChatIcon} width={17} height={17} alt={"Chat"} />
                        </div>
                    ) : ""
                }
            </div>
            <div ref={blocksAndBlurContainerRef} style={{'position': 'absolute', 'top': '0px', 'left': '0px', 'right': '0px'}} >
                <div className={`${topBlocksBlurred ? styles.blurTop : styles.blurHidden}`} />
                <div className={`${bottomBlocksBlurred ? styles.blurBottom : styles.blurHidden}`} />
                <div ref={blocksContainerRef} style={{'position': 'absolute', 'top': '0px', 'left': '0px', 'right': '0px', 'bottom': '0px'}} className={styles.customScroll}>
                    {notebookLoadState < 2 ? (
                        <div style={{'display': 'flex', 'justifyContent': 'center', 'alignItems': 'center', 'height': '100%'}}>
                            <Loading />
                        </div>
                    ) : (notebookLoadState == 3 ? (
                        <div style={{'display': 'flex', 'justifyContent': 'center', 'alignItems': 'center', 'height': '100%'}}>
                            Error loading data
                        </div>
                    ) : (!blocks.length ? (
                        <div style={{'height': '100%', 'width': '100%', 'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center'}}>
                            Nothing yet! Try adding notes or files.
                        </div>
                    ) : (
                        <DndProvider backend={HTML5Backend}>
                            <div style={{'display': 'flex', 'flexDirection': 'column'}}>
                                {blocksDisplay}
                            </div>
                        </DndProvider>
                    )))}
                </div>
            </div>
            <div ref={addNoteContainerRef} style={{'position': 'absolute', 'left': '0px', 'right': '0px', 'bottom': 'var(--std-margin)', 'display': 'flex', 'flexDirection': 'column', 'gap': '5px', 'paddingLeft': 'var(--std-margin)', 'paddingTop': '1rem', 'paddingRight': 'var(--std-margin)', 'borderTop': '1px solid var(--light-border)'}}>
                {canEdit ? (
                    <>
                        <div className={styles.editorMinimize}>
                            {
                                !editorMinimized ? (
                                    <MyImage className={"_clickable"} onClick={() => setEditorMinimized(true)} src={MinimizeIcon} width={15} height={15} alt={"Minimize"} />
                                ) : (
                                    <MyImage className={"_clickable"} onClick={() => setEditorMinimized(false)} src={ExpandIcon} width={15} height={15} alt={"Expand"} />
                                )
                            }
                        </div>
                        {!editorMinimized ? (
                            <>
                                <div className={styles.customTemplatesScroll} style={{'overflowX': 'scroll', 'overflowY': 'hidden', 'display': 'flex', 'gap': '10px', 'alignItems': 'center', 'overflow': 'scroll', 'paddingBottom': '5px'}}>
                                    {!blocks?.length && notebookLoadState == 2 ? (
                                        <div style={{'position': 'absolute', 'top': '0px', 'left': '100px', 'display': 'flex', 'flexDirection': 'column', 'gap': '10px', 'transform': 'translateY(-100%)', 'fontSize': '1.25rem'}}>
                                            Upload Files
                                            <CurvedArrow />
                                        </div>
                                    ) : ""}
                                    <div style={{'flexShrink': '0'}}>
                                        <SelectAssetWrapper selectCallback={addExistingCallback} manifestRow={manifestRow}>
                                            <div className={styles.addExistingButton}>
                                                <div>
                                                    Add Existing
                                                </div>
                                                <MyImage src={AddIcon} alt="Add" width={15} height={15} />
                                            </div>
                                        </SelectAssetWrapper>
                                    </div>
                                    {DATA_TEMPLATES.map((item) => getTemplateByCode(item)).filter((item) => item.constructor.code != manifestRow['template'] && item.constructor.uploadable).map((tmp) => {
                                        return (
                                            <div style={{'flexShrink': '0'}} key={tmp.constructor.code}>
                                                <CreateWrapper noRedirect={true} callback={handleUpload} templateCode={tmp.constructor.code}>
                                                    <div className={styles.templateButton}>
                                                        <div>
                                                            {tmp.constructor.readableName}
                                                        </div>
                                                        <MyImage src={tmp.constructor.icon} width={15} height={15} alt={tmp.constructor.readableName} />
                                                    </div>
                                                </CreateWrapper>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div style={{'display': 'flex'}}>
                                    <div style={{'flex': '1', 'position': 'relative'}}>
                                        <Editor
                                            assetId={manifestRow['id']}
                                            exclude={excludeFromAutocomplete}
                                            shortcuts={shortcuts}
                                            clearContentCounter={clearContentCounter}
                                            style={{'maxHeight': '50vh', 'overflow': 'scroll', 'borderTopLeftRadius': 'var(--medium-border-radius)', 'borderBottomLeftRadius': 'var(--medium-border-radius)', 'zIndex': 2}}
                                            editable={true}
                                            minHeightOption={'small'}
                                            onChangeHTML={(x) => {setInputText(x)}}
                                            htmlContent={inputText}
                                            disablePromptSelector={true}
                                            placeholder="Write notes..."
                                        />
                                        {inReplyTo ? (
                                            <div style={{'position': 'absolute', 'bottom': 'var(--medium-border-radius)', 'left': '0px', 'backgroundColor': 'var(--dark-primary)', 'color': 'var(--light-text)', 'transform': 'translateY(100%)', 'padding': '3px 10px', 'paddingTop': 'calc(var(--medium-border-radius) + 3px)', 'fontSize': '.8rem', 'borderBottomLeftRadius': 'var(--small-border-radius)', 'borderBottomRightRadius': 'var(--small-border-radius)', 'display': 'flex', 'gap': '10px'}}>
                                                <div>
                                                    {`Reply to: ${getReplyText(inReplyTo)}`}
                                                </div>
                                                <MyImage className={'_clickable'} onClick={() => {setInReplyTo(undefined)}} src={RemoveIcon} width={13} height={13} alt={"Cancel"} />
                                            </div>
                                        ) : ""}
                                    </div>
                                    <Tooltip content={`${getModKey()}+Enter`}>
                                        <div onClick={() => submitNote()} className={`${styles.sendButton} _clickable`}>
                                            <MyImage src={SendIcon} width={15} height={15} alt={"Send"} />
                                        </div>
                                    </Tooltip>
                                </div>
                            </>
                        ) : ""}
                    </>
                ) : ""}
            </div>
        </div>
    )

    const rightPanel = (
        <div style={{'position': 'absolute', 'top': '0px', 'bottom': '0px', 'left': '0px', 'right': '0px', 'overflowY': 'scroll'}}>
            <RightPanel
                canEdit={canEdit}
                manifestRow={manifestRow}
                blocks={blocks}
                setBlocks={setBlocks}
                notebookLoadState={notebookLoadState}
                keyPoints={keyPoints}
                setKeyPoints={setKeyPoints}
                outline={outline}
                setOutline={setOutline}
                highlightNote={highlightNote} />
            {isMobile ? (
                <div style={{'position': 'absolute', 'right': '0px', 'top': '0px', 'padding': '5px 10px', 'zIndex': 100}}>
                    <MyImage onClick={() => setShowRightPanelMobile(false)} className={"_touchableOpacity"} src={NotebookIcon} width={15} height={15} alt={"Notebook"} />
                </div>
            ) : ""}
        </div>
    )

    return (
        <div style={{'height': '100%', 'display': 'flex'}}>
            <TwoPanel
                leftPanel={showRightPanelMobile ? rightPanel : leftPanel}
                rightPanel={rightPanel}
                initialLeftWidth="65%"
                initialRightWidth="35%"
                resizerStyle={{
                    'backgroundColor': 'var(--light-border)', 
                    'width': '3px', 'minWidth': 'unset', 'margin': '0px', 'border': 'unset'}}
                />
        </div>
    )
}

export function getReplyText(block){
    const blType = getBlockTypeByCode(block['type'])
    const txt = shortenText(blType.getReplyText(block), 5, 50, true)
    return txt
}
