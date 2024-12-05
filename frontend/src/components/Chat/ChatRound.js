import styles from './Chat.module.css'
import Textarea from "../form/Textarea"
import MarkdownViewer from "../Markdown/MarkdownViewer"
import CopyButton from "../CopyButton/CopyButton"
import SuggestQuestions from './SuggestQuestions';
import MyImage from "../MyImage/MyImage"
import RemoveIcon from '../../../public/icons/RemoveIcon.png'
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Loading from "../Loading/Loading"
import CollapsibleMenu from "../CollapsibleMenu/CollapsibleMenu"
import Tooltip from "../Tooltip/Tooltip"
import LinkedSelectorItem from "../LinkedSelectorItem/LinkedSelectorItem"
import { Auth } from "@/auth/auth"
import Link from "next/link"
import ChatSources from "./ChatSources"
import { removeCitations } from "@/utils/text"
import EditIcon from '../../../public/icons/EditIcon.png'
import { HIDE_COLLECTIONS } from "@/config/config"
import MessageToolbar from "./MessageToolbar"
import SendIcon from '../../../public/icons/SendIcon.png'
import ExpandIcon from '../../../public/icons/ExpandIcon.png'
import MinimizeIcon from '../../../public/icons/MinimizeIcon.png'


export default function ChatRound({ item, askQuestion, isLast, isFirst, canEdit,
                                    isLoading, suggestQuestions, suggestions, isAnswering, detached, userTextEnter,
                                    removeChat, syntheticId, toggleDetached, roundStates, setRoundStates,
                                    invertColor, suggestLoadingState, suggestQuestion,
                                    showFindMore, toggleUseWeb, index, onSourceButtonClick=undefined, setUserChatModel,
                                    setImages, selectedModel, extraButtons, goToPrevState, userModelLoadingState, userModelOptions,
                                    newVersion, allowOCR, scrollToBottom, selectedSearchEngine, userSearchEngineLoadingState, userSearchEngineOptions, setUserSearchEngine, ...props }){

    const { getToken } = Auth.useAuth()
    const [findMoreLoadState, setFindMoreLoadState] = useState(0)
    const [findMoreAssets, setFindMoreAssets] = useState([])
    const [findMoreGroup, setFindMoreGroup] = useState(undefined)
    const [userExpanded, setUserExpanded] = useState(false)

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
    

    // This in particular is slow... so this memo really increases performance!
    const aiMarkdown = useMemo(() => {
        // Changing onCitationClick={(x) => onCitationClick(x)} to onCitationClick={onCitationClick} made it so that it doesn't re-render constantly.
        return (
            <MarkdownViewer onCitationClick={onCitationClick}>
                {item.ai}
            </MarkdownViewer>
        )
    }, [item.ai, onCitationClick])

    async function recommend(ai, user) {
        try {
            setFindMoreLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/assets/recommend'
            const data = {
                'txt': `${user} ${ai}`,
                'n': 3
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

            if (!myJson.results){
                throw Error("Results was undefined")
            }

            if (!myJson.results.length){
                console.log(myJson)
            }

            setFindMoreAssets(myJson.results)  // not necessarily a full asset - holds just the basic info.
            setFindMoreGroup(myJson.group)
            setFindMoreLoadState(2)
        }
        catch(e) {
            setFindMoreLoadState(3)
            console.log(e)
        }
    }

    function resetCollections(){
        setFindMoreLoadState(0)
        setFindMoreAssets([])
        setFindMoreGroup(undefined)
    }

    let extraBottomStyle = {}
    let findMoreElement = ""
    if (showFindMore && !HIDE_COLLECTIONS){
        if (findMoreLoadState == 0){
            findMoreElement = (
                <Tooltip tooltipStyle={{'width': '125px', 'fontSize': '.9rem'}} verticalAlign="top" align="left" content={"Search Collections for related content"}>
                    <div className={`${styles.findMore} _clickable`} onClick={() => recommend(item.ai, item.user)}>
                        Search in Collections
                    </div>
                </Tooltip>
            )
        }
        else if (findMoreLoadState == 1){
            findMoreElement = (
                <Loading text="" />
            )
        }
        else if (findMoreLoadState == 2){
            if (!findMoreAssets.length){
                findMoreElement = "Could not find anything to recommend."
            }
            else {
                extraBottomStyle = {'flexDirection': 'column', 'alignItems': 'flex-start', 'gap': '1rem'}
                findMoreElement = (
                    <CollapsibleMenu noHeader={true} openByDefault={true} expand={true}>
                        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '.5rem'}}>
                            {
                                findMoreGroup ? (
                                    <div style={{'display': 'flex', 'gap': '5px', 'alignItems': 'center'}}>
                                        <div style={{'opacity': '.5', 'fontSize': '.9rem'}}>
                                            From
                                        </div>
                                        <div>
                                            <Link target={"_blank"} href={`/groups/${findMoreGroup.id}`} className={styles.findMore}>
                                                {`${findMoreGroup.title}`}
                                            </Link>
                                        </div>
                                    </div>
                                ) : ""
                            }
                            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'stretch', 'flexWrap': 'wrap'}}>
                                {findMoreAssets.map((item, i) => (
                                    <LinkedSelectorItem 
                                        style={{'flex': '1'}}
                                        showButton={false}
                                        item={item}
                                        key={item.id} />
                                ))}
                            </div>
                        </div>
                    </CollapsibleMenu>
                )
            }
        }
        else {
            // error
            findMoreElement = "Could not find anything to recommend."
        }
    }

    function onEditUserClick(event){
        if (!canEdit){
            return
        }
        if (!isAnswering && !isLoading){
            if (event){
                newVersion(event.target.value)
            }
            else {
                newVersion()
            }
        }
    }

    const noWebSourcesFound = item.useWeb && item.meta && !JSON.parse(item.meta).sources?.length
    const usesInlineCitations = item.meta && JSON.parse(item.meta).inline_citations

    const isEditing = !item?.asked && canEdit && !item?.autoAsk

    return (
        <div className={styles.round} style={{...(isLast ? {'borderBottomWidth': '0px'} : {})}} {...props}>
            <div style={{'display': 'flex', 'flexDirection': 'column', 'alignItems': 'flex-end', 'gap': '10px'}}>
                <div style={{'display': 'flex', 'width': userExpanded ? '100%' : 'calc(max(50%, 400px))', 'maxWidth': '100%', 'alignItems': isEditing ? 'flex-end' : 'flex-start', 'gap': '5px'}}>
                        {isEditing ? (
                            <div style={{'paddingRight': '5px'}}>
                                {userExpanded ? (
                                    <MyImage src={MinimizeIcon} alt={"Minimize"} onClick={() => setUserExpanded(false)} width={13} height={13} className={"_touchableOpacity"} />
                                ) : (
                                    <MyImage src={ExpandIcon} alt={"Expand"} onClick={() => setUserExpanded(true)} width={12} height={12} className={"_touchableOpacity"} />
                                )}
                            </div>
                        ) : ""}
                    <div style={{'display': 'flex', 'flexDirection': 'column', 'width': '100%', 'gap': '5px'}}>
                        {isEditing ? (
                            <MessageToolbar
                                detached={detached}
                                selectedModel={selectedModel}
                                userModelLoadingState={userModelLoadingState}
                                setUserChatModel={setUserChatModel}
                                userModelOptions={userModelOptions}

                                selectedSearchEngine={selectedSearchEngine}
                                userSearchEngineOptions={userSearchEngineOptions}
                                userSearchEngineLoadingState={userSearchEngineLoadingState}
                                setUserSearchEngine={setUserSearchEngine}

                                canEdit={canEdit}
                                item={item}
                                isLoading={isLoading}
                                isAnswering={isAnswering}
                                syntheticId={syntheticId}
                                toggleUseWeb={toggleUseWeb}
                                suggestQuestion={suggestQuestion}
                                suggestLoadingState={suggestLoadingState}
                                removeChat={removeChat}
                                toggleDetached={toggleDetached}
                                dropdownGoesUp={false}
                                setImages={setImages}
                            />
                        ) : ""}
                        <div style={{'display': 'flex'}}>
                            <div style={{'flex': '1', 'height': userExpanded ? '10rem' : '3.5rem'}}>
                                <Textarea
                                    placeholder={"I was wondering..."}
                                    value={item.user}
                                    setValue={isEditing ? userTextEnter : ()=>{}}
                                    style={{'backgroundColor': `${invertColor ? 'var(--light-primary)' : 'var(--light-background)'}`, 'height': '100%', ...(isEditing ? {'borderTopRightRadius': '0px', 'borderBottomRightRadius': '0px'} : {}), 'fontFamily': 'var(--font-body)'}}
                                    onKeyDown={e => {
                                        if (isEditing && e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault(); // Prevents adding a new line in the textarea
                                            resetCollections();
                                            askQuestion();
                                        }
                                    }}
                                    onChange={(event) => {
                                        if (!isEditing){
                                            onEditUserClick(event)
                                        }
                                    }}
                                    allowResize='none'
                                />
                            </div>
                            {isEditing ? (
                                <div className={styles.sendButton} onClick={() => askQuestion()}>
                                    <MyImage src={SendIcon} alt={"send"} width={15} height={15} />
                                </div>
                            ) : ""}
                        </div>
                    </div>
                    {!isAnswering && !isLoading && !isEditing && canEdit ? (
                        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '5px', 'padding': '2px 0px'}}>
                            <MyImage className="_touchableOpacity" src={RemoveIcon} onClick={() => removeChat()} width={15} height={15} alt={"Remove"} />
                            <CopyButton iconSize={15} text="" textToCopy={item.user} />
                            <MyImage className="_touchableOpacity" onClick={() => onEditUserClick()} src={EditIcon} width={15} height={15} alt={"Edit"} />
                        </div>
                    ) : ""}
                </div>
            </div>
            <div className={styles.aiResponse}>
                {item?.asked || item.prevStates?.length ? (
                    <div className={styles.aiResponseHeader}>
                        <div style={{'display': 'flex', 'gap': '5px', 'alignItems': 'center'}}>
                            {!isLoading && !isAnswering && item.prevStates?.length && item.attemptIndex > 1 ? (
                                <div className="_touchableOpacity" onClick={() => {goToPrevState(item.attemptIndex - 1)}}>
                                    {`◀`}
                                </div>
                            ) : ""}
                            <div>
                                {`${item?.model ? item.model : 'AI Response'}${item.prevStates?.length ? (` (${item.attemptIndex || '1'}/${item.prevStates.length + 1})`) : ""}:`}
                            </div>
                            {!isLoading && !isAnswering && item.prevStates?.length && item.attemptIndex <= item.prevStates.length ? (
                                <div className="_touchableOpacity" style={{'transform': 'scale(-1)'}} onClick={() => {goToPrevState(item.attemptIndex + 1)}}>
                                    {'◀'}
                                    {/* Did you know that the left and right pointing unicode characters aren't the same size? Now you do! */}
                                </div>
                            ) : ""}
                        </div>
                    </div>
                ) : ""}
                {isLoading ? (
                    <div style={{'marginTop': '1rem'}}>
                        {item.searchQuery ? (
                            <Loading style={{'fontStyle': 'italic', 'color': 'var(--passive-text)'}} text={`Searching "${item.searchQuery}"`} />
                        ) : (
                            <Loading />
                        )}
                    </div>
                ) : (item.ai ? (
                    <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '.5rem'}}>
                        {aiMarkdown}
                        {(!isAnswering && item.ai) ? (
                            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center', ...extraBottomStyle}}>
                                <div style={{'display': 'flex', 'alignItems': 'center', 'flex': '1', 'gap': '10px'}}>
                                    <CopyButton textToCopy={removeCitations(item.ai)} />
                                    {extraButtons.map((x, k) => {
                                        return (
                                            <div key={k} onClick={() => x.callback(item)}>
                                                {x.value}
                                            </div>
                                        )
                                    })}
                                </div>
                                {findMoreElement}
                            </div>
                        ) : ""}
                        {(!item.useWeb && (item.detached || detached)) || noWebSourcesFound || usesInlineCitations ? "" : (
                            <div>
                                <ChatSources
                                    roundStates={roundStates}
                                    setRoundStates={setRoundStates}
                                    obj={item.meta}
                                    key={item.id}
                                    i={index}
                                    allowOCR={allowOCR}
                                    usedWeb={item.useWeb}
                                    onSourceButtonClick={onSourceButtonClick}
                                />
                            </div>
                        )}
                    </div>
                ) : "")}
            </div>
            {
                (suggestQuestions && !isLoading && !isAnswering && item.ai && suggestions && suggestions.length) ? (
                    <div style={{'marginTop': '10px'}}>
                        <CollapsibleMenu noHeader={true} openByDefault={true} expand={true} >
                            <SuggestQuestions scrollToBottom={scrollToBottom} questions={suggestions} roundStates={roundStates} setRoundStates={setRoundStates} />
                        </CollapsibleMenu>
                    </div>
                ) : ""
            }
        </div>
    )
}

