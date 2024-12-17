import { useCallback, useEffect, useState } from 'react';
import styles from './Chat.module.css';
import { handleStreamingChat } from '@/utils/streaming';
import { useRef } from 'react';
import ChatRound from './ChatRound';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { formatTimestampIntl, getCurrentUTCTimestamp } from '@/utils/time';
import { Auth } from '@/auth/auth';
import Textarea from '../form/Textarea';
import MyImage from '../MyImage/MyImage';
import SendIcon from '../../../public/icons/SendIcon.png'
import MessageToolbar from './MessageToolbar';
import SummaryToolbar from './SummaryToolbar';
import { CHAT_CONTEXT_METADATA_KEY } from '@/config/strConstants';
import EraseIcon from '../../../public/icons/EraseIcon.png'
import Tooltip from '../Tooltip/Tooltip';
import TextProcessing from './TextProcessing';
import Loading from '../Loading/Loading';
import Dropdown from '../Dropdown/Dropdown';
import shortenText from '@/utils/text';
import useSaveDataEffect from '@/utils/useSaveDataEffect';
import LoadingSkeleton from '../Loading/LoadingSkeleton';
import observeRect from '@reach/observe-rect'
import useKeyboardShortcut from '@/utils/keyboard';
import ImageIcon from '../../../public/icons/ImageIcon.png'
import { DISABLE_WEB, HIDE_TTS } from '@/config/config';

export const defaultRoundState = {
    'ai': '',
    'user': ''
}

export const getDefaultRoundState = (fromExisting) => {
    const tmp = JSON.parse(JSON.stringify(defaultRoundState))
    if (fromExisting){
        tmp.detached = fromExisting.detached;
        tmp.useWeb = fromExisting.useWeb;
        if (fromExisting.temperature !== undefined){
            tmp.temperature = fromExisting.temperature;
        }
        return tmp
    }
    else {
        return tmp
    }
}

export const marginStyle = {'width': 'calc(max(75%, 500px))', 'maxWidth': '90%'}
export const restrictiveMarginStyle = {'width': 'calc(max(50%, 500px))', 'maxWidth': '90%'}

export default function Chat({id,
                            manifestRow,  // Why both? Poor planning - TODO
                            topText="",
                            summarizeEnabled=true,
                            splitSummary=false,
                            splitSummarySources=[],
                            onSourceButtonClick=undefined,
                            detached=false,
                            canEdit=true,
                            autoFocus=true,
                            allowSpeech=true,
                            suggestQuestions=false,
                            controlTextProcessing=true,
                            showFindMore=false,
                            hideStatus=false,
                            invertColor=false,  // light background instead of light primary
                            onAsk=undefined,  // function to send the user text to on ask
                            saveCallback=undefined,  // NOTE: should be wrapped in useCallback. function triggered after a save finishes - passes roundStates.
                            exclude=[],
                            extraButtons=[],
                            allowOCR=false,
                            hideTabBar=false,
                            showClearButton=true,
                            extraToolbarButtons=[],
                            showSignIn=true,
                            ...props}){

    const [qLoading, setQLoading] = useState(undefined);
    const [qAnswering, setQAnswering] = useState(undefined);
    const [previousChatsLoadingState, setPreviousChatsLoadingState] = useState(false)
    const [topBlocksBlurred, setTopBlocksBlurred] = useState(false)
    const [bottomBlocksBlurred, setBottomBlocksBlurred] = useState(false)
    const [syntheticId, setSyntheticId] = useState(id)  // Used for dropdown split doc stuff in folders
    const [roundStates, setRoundStates] = useState([])
    const [suggestions, setSuggestions] = useState({})  // from index to array
    const [suggestLoadingState, setSuggestLoadingState] = useState({})  // not for suggestions at the end of quesitons, but for the one at the top
    const roundsContainerRef = useRef()
    const [userText, setUserText] = useState("")
    const [bottomTextItem, setBottomTextItem] = useState(getDefaultRoundState())
    const [bottomSuggestLoadingState, setBottomSuggestLoadingState] = useState(0)
    const [tabDisplay, setTabDisplay] = useState("")  // e.g. keypoints or summary display
    const [tabState, setTabState] = useState(undefined)
    const [retrieverIssue, setRetrieverIssue] = useState("")

    const [selectedModel, setSelectedModel] = useState({})  // obj of information - does it accept images? etc.
    const [userModelOptions, setUserModelOptions] = useState([])
    const [userModelLoadingState, setUserModelLoadingState] = useState(0)

    const [selectedSearchEngine, setSelectedSearchEngine] = useState({})  // obj of information - does it accept images? etc.
    const [userSearchEngineOptions, setUserSearchEngineOptions] = useState([])
    const [userSearchEngineLoadingState, setUserSearchEngineLoadingState] = useState(0)

    const [draggingFile, setDraggingFile] = useState(false)
    const [badPracticeAutoFocus, setBadPracticeAutoFocus] = useState(1)

    const router = useRouter()
    const { getToken, isSignedIn } = Auth.useAuth();

    const currentUrl = `${router.asPath}`;

    const [editorHeight, setEditorHeight] = useState(0);
    const [isExpanded, setIsExpanded] = useState(undefined);

    const editorContainerRef = useRef()

    function handleScroll(){
        const container = roundsContainerRef.current;
        if (container) {
            const isAtTop = container.scrollTop === 0;
            const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 20;
            setTopBlocksBlurred(!isAtTop);
            setBottomBlocksBlurred(!isAtBottom);
        }
    }

    useEffect(() => {
        const container = roundsContainerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            // Set up a MutationObserver to watch for changes in the container's content
            const observer = new MutationObserver(handleScroll);
            observer.observe(container, { childList: true, subtree: true });

            const resizeObserver = new ResizeObserver(handleScroll);
            resizeObserver.observe(container);
            
            // Clean up
            return () => {
                container.removeEventListener('scroll', handleScroll);
                observer.disconnect();
                resizeObserver.disconnect();
            };
        }
    }, [roundsContainerRef.current]);

    const onKeyboardUseWeb = useCallback(() => {
        if (DISABLE_WEB){
            return
        }
        setBottomTextItem({...bottomTextItem, 'useWeb': !bottomTextItem?.useWeb})
    }, [setBottomTextItem, bottomTextItem])
    useKeyboardShortcut([['Control', 'i'], ['Meta', 'i']], onKeyboardUseWeb)

    // Basically just removing certain items
    function makeContext(item, i){
        return {
            'user': item.user,
            'ai': item.ai,
            'images': item.images
        }
    }

    function goToPrevState(qIndex, newIndex, copyUserText){
        setRoundStates((prev) => {
            let cpy=[...prev];
            let curr = cpy[qIndex]
            let fullPrevStates = [...curr.prevStates]
            fullPrevStates.splice(curr.attemptIndex - 1, 0, {...curr, 'prevStates': []})
            const newState = copyUserText ? {...fullPrevStates[newIndex - 1], 'user': copyUserText} : {...fullPrevStates[newIndex - 1]}
            fullPrevStates.splice(newIndex - 1, 1)
            cpy[qIndex] = {...newState, 'attemptIndex': newIndex, 'prevStates': fullPrevStates}
            return cpy
        })
    }

    async function askQuestion(qIndex, fromExisting) {
        if (qLoading == qIndex || qAnswering == qIndex || !canEdit || !roundStates[qIndex].user){
            return;
        }
        setQLoading(qIndex)
        if (roundStates?.length > qIndex && roundStates[qIndex]?.ai){
            // This is a redo
            const currState = roundStates[qIndex]
            const newPrevStates = roundStates[qIndex].prevStates?.length ? [...roundStates[qIndex].prevStates, {...currState, 'prevStates': []}] : [{...currState, 'prevStates': []}]
            setRoundStates((prev) => { let cpy=[...prev]; cpy[qIndex].aiDisplayedSource=""; cpy[qIndex].searchQuery=""; cpy[qIndex].model=selectedModel?.name; cpy[qIndex].prevStates = newPrevStates; cpy[qIndex].asked=true; cpy[qIndex].attemptIndex = newPrevStates.length + 1; return cpy })
        }
        else {
            // Not a redo
            setRoundStates((prev) => { let cpy=[...prev]; cpy[qIndex].aiDisplayedSource=""; cpy[qIndex].searchQuery=""; cpy[qIndex].model=selectedModel?.name; cpy[qIndex].asked=true; return cpy })
        }
        let url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/chat`

        let context = roundStates.filter((item, i) => i < qIndex).map(makeContext)
        const userTime = formatTimestampIntl(getCurrentUTCTimestamp())

        let data = {
            'id': syntheticId,
            'question': {
                'txt': roundStates[qIndex].user,
                'images': roundStates[qIndex].images,
                'context': context,  // Questions before this one
            },
            'user_time': userTime,
            'batched': false,
            'streaming': true,
            'temperature': roundStates[qIndex].temperature === undefined ? .5 : roundStates[qIndex].temperature,  // no way currently to set temperature with the removal of randomness slider
            'detached': (roundStates[qIndex].detached || detached) ? true : false,
            'use_web': roundStates[qIndex].useWeb ? true : false,
            'exclude': exclude,
        }

        if (onAsk){
            onAsk(data['question'].txt, qIndex)
        }
        if (fromExisting){
            setBadPracticeAutoFocus(badPracticeAutoFocus + 1)
        }
        let token = await getToken()
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                body: JSON.stringify(data)
            });

            if (!response.ok){
                throw Error("Response was not OK")
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            
            await handleStreamingChat({
                reader: reader,
                decoder: decoder,
                onInitial: ()=>{
                    setRoundStates((prev) => { let cpy=[...prev]; cpy[qIndex].autoAsk=false; cpy[qIndex].ai=""; return cpy })
                    setQAnswering(qIndex)
                },
                onSearchQuery: (searchQuery) => {
                    setRoundStates((prev) => { let cpy=[...prev]; cpy[qIndex].searchQuery=searchQuery; return cpy })
                },
                onInitialEnd: (meta)=>{
                    setRoundStates((prev) => { let cpy=[...prev]; cpy[qIndex].meta=meta; return cpy })
                },
                onSnippetStart: () => {
                    setQLoading(undefined)
                    if (suggestQuestions){
                        makeQuestions(qIndex, 3)  // we love hard coding a 3 in there yessir
                    }
                },
                onSnippet: (result)=>{
                    setRoundStates((prev) => {let cpy=[...prev]; cpy[qIndex].ai = result; return cpy})
                }
            })
            setQAnswering(undefined)
            setRetrieverIssue("")  // since the chat seemed to go through, there are no retriever issues.
        }
        catch (error) {
            console.error(error);
            // IMPORTANT: This error text is used in the testing framework (in a diff repo); so if you change it make sure it gets changed elsewhere.
            setRoundStates((prev) => {let cpy=[...prev]; cpy[qIndex].ai = 'Error; try again using a different model backbone?'; return cpy})
            setQLoading(undefined)
            setQAnswering(undefined)
        }
    }

    async function submitNewChat(){
        if (!userText){
            return
        }
        const isFirstChat = roundStates?.length == 0
        setRoundStates((prev) => {
            let newState = {...bottomTextItem, 'user': userText, 'autoAsk': true}
            
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
        setBottomTextItem(getDefaultRoundState())
        if (!isFirstChat){
            scrollToBottom()
        }
        setTabState(undefined)
        setUserText("")
    }

    const saveChat = useCallback(async (newRoundStates) => {
        let toSave = newRoundStates.filter((item) => item.user)
        if (previousChatsLoadingState != 2 && !(previousChatsLoadingState == 3 && toSave?.length)){
            return
        }
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/save-chat"
            const data = {
                'context': toSave,
                'id': id
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
            if (myJson['response'] != 'success'){
                throw Error("Response was not success")
            }
            if (saveCallback) {
                saveCallback(newRoundStates)
            }
        }
        catch (e) {
            console.log(e)
        }
    }, [id, previousChatsLoadingState, saveCallback])
    useSaveDataEffect(roundStates, canEdit && id, saveChat, 500)

    function removeChat(qIndex) {
        if (!qAnswering){
            setRoundStates((prev) => {
                let cpy = [...prev];
                let curr = cpy[qIndex]
                if (!curr){
                    return cpy
                }
                let fullPrevStates = curr.prevStates ? [...curr.prevStates] : []
                if (!fullPrevStates?.length){
                    cpy.splice(qIndex, 1)
                    return cpy
                }
                const newIndex = Math.max(1, curr.attemptIndex - 1)
                const newState = {...fullPrevStates[newIndex - 1]}
                fullPrevStates.splice(newIndex - 1, 1)
                cpy[qIndex] = {...newState, 'attemptIndex': newIndex, 'prevStates': fullPrevStates}
                return cpy
            })
        }
    }

    function clearChat(){
        setRoundStates([])
    }

    function userTextEnter(txt, i) {
        setRoundStates((prev) => {
            let cpy = [...prev]
            cpy[i].user = txt
            if (!cpy[i].user){
                cpy[i].asked = false
            }
            return cpy;
        });
    }

    function setImages(x, i) {
        setRoundStates((prev) => {
            let cpy = JSON.parse(JSON.stringify(prev));
            cpy[i].images = x;
            return cpy
        })
    }

    function toggleDetached(i) {
        setRoundStates((prev) => {
            let cpy = JSON.parse(JSON.stringify(prev));
            cpy[i].detached = !cpy[i].detached;
            return cpy
        })
    }

    function toggleUseWeb(i) {
        setRoundStates((prev) => {
            let cpy = JSON.parse(JSON.stringify(prev));
            cpy[i].useWeb = !cpy[i].useWeb;
            return cpy
        })
    }

    function newVersion(qIndex, newUserText) {
        let cpy=[...roundStates];
        let curr = cpy[qIndex];
        if (!curr.asked){
            return
        }
        let realUserText = curr.user
        if (newUserText){
            realUserText = newUserText
        }
        let fullPrevStates = curr.prevStates ? [...curr.prevStates] : []
        fullPrevStates.splice(curr.attemptIndex - 1, 0, {...curr, 'prevStates': []})
        const newState = {
            ...getDefaultRoundState(),
            'useWeb': curr.useWeb,
            'detached': curr.detached,
            'user': realUserText,
            'images': curr.images
        }
        if (!fullPrevStates[fullPrevStates.length - 1]?.asked){
            goToPrevState(qIndex, fullPrevStates.length, realUserText)
            return
        }
        cpy[qIndex] = {...newState, 'attemptIndex': fullPrevStates.length + 1, 'prevStates': fullPrevStates}
        setRoundStates(cpy)
    }

    function scrollToBottom(){
        const container = roundsContainerRef.current
        if (container) {
            function scroll(){
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: 'smooth'
                });
            }
            setTimeout(() => {
                scroll()
            }, 250)  // done to allow any renders to complete, and the delay is not important. Not the greatest.
        }
    }

    function insertAbove(qIndex) {
        if (!(qLoading === undefined && qAnswering === undefined)){
            return
        }
        let cpy = [...roundStates]
        cpy.splice(qIndex, 0, getDefaultRoundState(cpy[qIndex]));
        setRoundStates(cpy)
    }
    
    function makeRound(item, i){
        // It's so bad to have it like this with all the dependences,
        // but it makes understanding the rendering dynamics a bit easier.
        return (
            <ChatRound
                key={i}
                index={i}
                item={item}
                askQuestion={() => askQuestion(i, true)}
                canEdit={canEdit}
                isLast={i == roundStates.length - 1}
                isLoading={qLoading == i}
                suggestions={suggestions[i]}
                suggestQuestions={suggestQuestions}
                isAnswering={qAnswering === i}
                detached={detached}
                userTextEnter={(x) => userTextEnter(x, i)}
                removeChat={() => removeChat(i)}
                showFindMore={showFindMore}
                setImages={(x) => setImages(x, i)}
                toggleDetached={() => toggleDetached(i)}
                toggleUseWeb={() => toggleUseWeb(i)}
                roundStates={roundStates}
                setRoundStates={setRoundStates}
                suggestLoadingState={suggestLoadingState[i]}
                suggestQuestion={() => suggestQuestion(i)}
                onSourceButtonClick={onSourceButtonClick}
                allowOCR={allowOCR}
                extraButtons={extraButtons}
                goToPrevState={(x) => goToPrevState(i, x)}
                newVersion={(x) => x ? newVersion(i, x) : newVersion(i)}
                scrollToBottom={scrollToBottom}
                invertColor={invertColor}
                selectedModel={selectedModel}
                userModelLoadingState={userModelLoadingState}
                userModelOptions={userModelOptions}
                setUserChatModel={setUserChatModel}
                selectedSearchEngine={selectedSearchEngine}
                userSearchEngineOptions={userSearchEngineOptions}
                userSearchEngineLoadingState={userSearchEngineLoadingState}
                setUserSearchEngine={setUserSearchEngine}
            />
        )
    }

    // Auto ask, like for shorten on summary or question suggestions.
    useEffect(() => {
        let i = roundStates.length - 1
        if (i >= 0 && roundStates[i].autoAsk && !roundStates[i].ai){
            askQuestion(i)
        }
    }, [roundStates])

    const rounds = roundStates.map(makeRound)

    useEffect(() => {
        if (previousChatsLoadingState >= 2){
            setIsExpanded(roundStates?.length <= 0 && previousChatsLoadingState >= 2 && !tabDisplay);
        }
    }, [roundStates, previousChatsLoadingState, tabDisplay]);

    useEffect(() => {
        const updateHeight = () => {
            if (editorContainerRef?.current){
                setEditorHeight(editorContainerRef.current.clientHeight);
            }
        };
        if (editorContainerRef.current){
            updateHeight();
            let rectObserver = observeRect(editorContainerRef.current, updateHeight);
            rectObserver.observe();
            return () => {
                rectObserver.unobserve();
            }
        }            
    }, [editorContainerRef?.current, isExpanded]);

    useEffect(() => {
        if (id) {
            setSyntheticId(id)
        }
    }, [id])

    async function makeQuestions(qIndex, n) {
        let context = roundStates.filter((item, k) => k <= qIndex).map(makeContext)
        let qIsDetached = roundStates[qIndex].detached || detached
        let questions = await getQuestions(context, qIsDetached, n)
        if (questions){
            setSuggestions({...suggestions, [qIndex]: questions})
        }
    }

    // Unlike make questions, which does it for the next question, this function puts in the question itself
    async function suggestQuestion(qIndex) {
        let context = roundStates.filter((item, k) => k < qIndex).map(makeContext)
        let qIsDetached = roundStates[qIndex].detached || detached
        setSuggestLoadingState({...suggestLoadingState, [qIndex]: 1})
        let questions = await getQuestions(context, qIsDetached, 1)
        if (questions && questions.length){
            newVersion(qIndex)
            setRoundStates((prev) => {
                let cpy = [...prev]
                cpy[qIndex].user = questions[0]
                return cpy;
            });
        }
        setSuggestLoadingState({...suggestLoadingState, [qIndex]: 2})
    }

    // Suggest question but for the user text at the bottom
    async function suggestBottomQuestion(){
        let context = roundStates.map(makeContext)
        let qIsDetached = bottomTextItem.detached || detached
        setBottomSuggestLoadingState(1)
        let questions = await getQuestions(context, qIsDetached, 1)
        if (questions && questions.length){
            setUserText(questions[0])
        }
        setBottomSuggestLoadingState(2)
    }

    async function getQuestions(context, detached, n) {
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/questions`
            const data = {
                'id': syntheticId,
                'context': context && context.length ? context : [],
                'detached': detached,
                'n': n
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
            if (myJson['response'] != 'success'){
                console.log(myJson)
                throw Error("Response was not success")
            }
            return myJson['questions']
        }
        catch(e) {
            console.log(e)
        }
    }

    async function loadPreviousChats() {
        try {
            setPreviousChatsLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/metadata?id=${id}&key=${CHAT_CONTEXT_METADATA_KEY}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'GET'
            })
            let myJson = await response.json()
            if (myJson['response'] != 'success'){
                console.log(myJson)
                throw Error("Response was not success")
            }
            const results = myJson['results']
            if (results.length){
                let context = JSON.parse(results[0].value)
                let newRoundStates = []
                for (let i = 0; i < context.length; i++){
                    newRoundStates.push(context[i])
                }        
                newRoundStates = newRoundStates.filter((item) => item.user)  // get rid of any blanks      
                setRoundStates(newRoundStates)
            }
            setPreviousChatsLoadingState(2)
        }
        catch (e) {
            console.log(e)
            setPreviousChatsLoadingState(3)
        }
    }

    useEffect(() => {
        if (id){
            setRoundStates([])
        }
        if (id && isSignedIn !== undefined){
            loadPreviousChats()
        }
        if (id && canEdit && isSignedIn === true){
            getUserModel()
            getUserModelOptions()
            if (!DISABLE_WEB){
                getUserSearchEngine()
                getUserSearchEngineOptions()
            }
        }
    }, [id, isSignedIn])

    async function setUserChatModel(model){
        try {
            setUserModelLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/user/select-chat-model'
            const data = {
                'model': model.code
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
            if (myJson['response'] != 'success'){
                console.log(myJson)
                throw Error("Response was not success")
            }
            setSelectedModel(myJson['model'])
            setUserModelLoadingState(2)
        }
        catch (e) {
            console.log(e)
            setUserModelLoadingState(2)  // on fail, user will notice.
        }
    }

    async function getUserModel(){
        try {
            setUserModelLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/user/chat-model'
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                },
                'method': 'GET'
            })

            let myJson = await response.json()
            let model = myJson['model']
            setSelectedModel(model)
            setUserModelLoadingState(2)
        }
        catch(e) {
            console.log(e)
            setUserModelLoadingState(3)
        }
    }

    async function getUserModelOptions(){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/user/chat-models'
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            if (myJson['response'] != 'success'){
                console.log(myJson)
                throw Error("Response was not success")
            }
            const available = myJson['available'].map((item) => {return {...item, 'available': true}})
            const unavailable = myJson['unavailable'].map((item) => {return {...item, 'available': false}})
            setUserModelOptions([...available, ...unavailable])
        }
        catch (e) {
            console.log(e)
        }
    }

    async function setUserSearchEngine(model){
        try {
            setUserSearchEngineLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/user/select-search-engine'
            const data = {
                'model': model.code
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
            if (myJson['response'] != 'success'){
                console.log(myJson)
                throw Error("Response was not success")
            }
            setSelectedSearchEngine(myJson['model'])
            setUserSearchEngineLoadingState(2)
        }
        catch (e) {
            console.log(e)
            setUserSearchEngineLoadingState(2)  // on fail, user will notice.
        }
    }

    async function getUserSearchEngine(){
        try {
            setUserSearchEngineLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/user/search-engine'
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                },
                'method': 'GET'
            })

            let myJson = await response.json()
            let model = myJson['model']
            setSelectedSearchEngine(model)
            setUserSearchEngineLoadingState(2)
        }
        catch(e) {
            console.log(e)
            setUserSearchEngineLoadingState(3)
        }
    }

    async function getUserSearchEngineOptions(){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/user/search-engines'
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            if (myJson['response'] != 'success'){
                console.log(myJson)
                throw Error("Response was not success")
            }
            const available = myJson['available'].map((item) => {return {...item, 'available': true}})
            const unavailable = myJson['unavailable'].map((item) => {return {...item, 'available': false}})
            setUserSearchEngineOptions([...available, ...unavailable])
        }
        catch (e) {
            console.log(e)
        }
    }

    function onDragImageOver(event){
        event.preventDefault();
        event.stopPropagation();
        // Check if the dragged item is a file and an image
        if (event.dataTransfer.items.length > 0) {
            const item = event.dataTransfer.items[0];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                setDraggingFile(true)
            }
        }
    }

    function onDragImageLeave(event){
        setDraggingFile(false)
    }

    async function onDropImage(event){
        event.preventDefault();
        event.stopPropagation();
        const files = event.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];

            // I tried to refactor this, but it inexplicably broke. Truly mysterious.
            const readFileAsBase64 = (file) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        resolve(reader.result);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            };

            if (file.type.startsWith('image/')) {
                const imageBase64 = await readFileAsBase64(file)
                setBottomTextItem({...bottomTextItem, 'images': [imageBase64]})
            }
        }
        setDraggingFile(false)
    }

    return (
        <div style={{'position': 'relative', 'height': '100%'}}>
            {
                isSignedIn === false && showSignIn ? (
                    <div className={styles.signInOverlay}>
                        <Link href={`${Auth.getSignInURL(currentUrl)}`}>
                            <span style={{'textDecoration': 'underline'}}>Sign in</span> to use chat.
                        </Link>
                    </div>
                ) : ""
            }
            <div className={isSignedIn === false && showSignIn ? styles.chatContainerSignedOut : styles.chatContainer} {...props}>
                {
                    topText ? (
                        <div>
                            {topText}
                        </div>
                    ) : ""
                }
                <div style={{'flex': '1', 'minHeight': '0px', 'display': 'flex', 'flexDirection': 'column', 'backgroundColor': `${invertColor ?  'var(--light-background)' : 'var(--light-primary)'}`, 'borderRadius': 'var(--medium-border-radius)', 'border': '1px solid var(--light-border)', 'position': 'relative'}}>
                    {(detached || hideTabBar) && showClearButton && !isExpanded && previousChatsLoadingState >= 2 && !qLoading && !qAnswering && canEdit ? (
                        <div className={"_touchableOpacity"} onClick={() => clearChat()} style={{'zIndex': '1', 'position': 'absolute', 'top': '0px', 'right': '0px', 'padding': '3px'}}>
                            <MyImage src={EraseIcon} alt={"Erase"} height={15} width={15} />
                        </div>
                    ) : ""}
                    {!detached && !hideTabBar && isExpanded !== undefined ? (
                        <div style={{'display': 'flex', 'justifyContent': 'center', 'padding': '10px'}}>
                            <div style={{...marginStyle, 'display': 'flex', 'gap': '10px', 'alignItems': 'center', 'flexWrap': 'wrap'}}>
                                <div style={{'flex': '1'}}>
                                    {!splitSummarySources?.length || !splitSummary ? (
                                        <SummaryToolbar
                                            manifestRow={manifestRow}
                                            allowSpeech={allowSpeech && !HIDE_TTS}
                                            setRoundStates={setRoundStates}
                                            invertColor={invertColor}
                                            showTitle={false}
                                            scrollToBottom={scrollToBottom}
                                            tabDisplay={tabDisplay}
                                            setTabDisplay={setTabDisplay}
                                            tabState={tabState}
                                            setTabState={setTabState}
                                            onSourceButtonClick={onSourceButtonClick}
                                        />
                                    ) : (
                                        <div style={{'display': 'flex'}}>
                                            <Dropdown
                                                rightAlign={false}
                                                initialButtonStyle={{'fontSize': '.85rem'}}
                                                optionsStyle={{'minWidth': '200px', 'fontSize': '.85rem'}}
                                                options={[{'title': 'All', 'id': id}, ...splitSummarySources].map((x) => {
                                                    return {'value': shortenText(x.title, 4, 35, true), 'onClick': () => setSyntheticId(x['id'])}  
                                                })}
                                                value={syntheticId == id ? 'All' : shortenText(splitSummarySources.filter((x) => x.id == syntheticId)[0]?.title, 4, 35, true)}
                                            />
                                        </div>
                                    )}
                                </div>
                                {!detached && !hideStatus ? <TextProcessing allowOCR={allowOCR} canEdit={canEdit} id={id} retrieverIssue={retrieverIssue} setRetrieverIssue={setRetrieverIssue} /> : ""}
                                {showClearButton && canEdit && !qAnswering && !qLoading ? (
                                    <Tooltip content={"Clear"}>
                                        <MyImage onClick={() => clearChat()} className={"_touchableOpacity"} src={EraseIcon} alt={"Erase"} width={20} height={20} />
                                    </Tooltip>
                                ) : ""}
                                {extraToolbarButtons}
                            </div>
                        </div>
                    ) : ""}
                    {isExpanded !== undefined ? ( /* Same as saying after load */
                        <>
                            <div style={{'flex': '1', 'minHeight': '0px'}}>
                                <div style={{'height': '100%', 'position': 'relative'}}>
                                    <div className={styles.blurTop} style={!topBlocksBlurred || tabState == 'notes' ? {'opacity': '0'} : {}} />
                                    <div className={styles.blurBottom} style={!bottomBlocksBlurred || tabState == 'notes' ? {'opacity': '0'} : {}} />
                                    <div ref={roundsContainerRef} style={{'height': '100%', 'overflow': tabState != 'notes' && !isExpanded ? 'scroll' : '', 'display': 'flex', 'justifyContent': 'center'}}>
                                        {tabDisplay ? (
                                            <div style={{...marginStyle, 'padding': '0px 1rem'}}>
                                                {tabDisplay}
                                                <div style={{'height': '50px'}}></div>
                                            </div>
                                        ) : (!isExpanded ? (
                                            <div style={{'width': '100%'}}>
                                                {rounds.map((round, i) => {
                                                    return (
                                                        <div key={i}>
                                                            {i != 0 && canEdit ? (
                                                                <div key={`${i}_insert`} style={{'width': '100%'}} onClick={() => {insertAbove(i)}}>
                                                                    <Tooltip containerStyle={{'width': '100%', 'height': '100%'}} followCursor={true} content={"Insert Chat"}>
                                                                        <div style={{'display': 'flex', 'alignItems': 'center', 'height': '20px', 'width': '100%'}}>
                                                                            <div style={{'height': '5px', 'width': '100%', 'borderTop': '1px solid var(--light-border)', 'borderBottom': '1px solid var(--light-border)', 'backgroundColor': 'var(--light-background)'}}>
                                                                            </div>
                                                                        </div>
                                                                    </Tooltip>
                                                                </div>
                                                            ) : ""}
                                                            <div key={i} style={{...marginStyle, 'margin': 'auto'}}>
                                                                {round}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                                <div style={{'height': '150px'}}></div>
                                            </div>
                                        ) : (previousChatsLoadingState >= 2 ? (
                                            <div style={{'height': '100%', 'width': '100%', 'display': 'flex', 'alignItems': 'flex-end', 'justifyContent': 'center', 'fontSize': '1.5rem', 'padding': '2rem', 'textAlign': 'center'}}>
                                                {`What would you like to know?`}
                                            </div>
                                        ) : ""))}
                                    </div>
                                </div>
                            </div>
                            {canEdit ? (
                                <div
                                    style={{'position': 'relative', 'padding': '10px', 'borderTop': '1px solid var(--light-border)', 'display': 'flex', 'justifyContent': 'center', 'alignItems': 'flex-start', 'transition': 'all .75s ease-in-out', 'height': isExpanded ? '55%' : (editorHeight ? `calc(${editorHeight}px + 20px)` : 'default')}}
                                    onDragOver={onDragImageOver}
                                    onDragLeave={onDragImageLeave}
                                    onDrop={onDropImage}
                                >
                                    {draggingFile ? (
                                        <>
                                            <div style={{'zIndex': '1', 'position': 'absolute', 'top': '0px', 'left': '0px', 'right': '0px', 'bottom': '0px',  'backgroundColor': 'var(--light-background)', 'opacity': '.5'}}>
                                            </div>
                                            <div style={{'zIndex': '2', 'position': 'absolute', 'top': '0px', 'left': '0px', 'right': '0px', 'bottom': '0px',  'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center', 'gap': '10px'}}>
                                                <div>
                                                    Drop Image
                                                </div>
                                                <MyImage src={ImageIcon} alt={"Image"} width={20} height={20} />
                                            </div>
                                        </>
                                    ) : ""}
                                    <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '10px', 'transition': 'all .75s ease-in-out', ...(!isExpanded ? marginStyle : restrictiveMarginStyle)}} ref={editorContainerRef}>
                                        <div>
                                            <MessageToolbar
                                                detached={detached}
                                                item={bottomTextItem}
                                                canEdit={canEdit}
                                                isLoading={false}
                                                isAnswering={false}
                                                showUseWebTooltip={true}
                                                id={id}
                                                syntheticId={syntheticId}
                                                toggleUseWeb={() => setBottomTextItem({...bottomTextItem, 'useWeb': !bottomTextItem?.useWeb})}
                                                setImages={(x) => setBottomTextItem({...bottomTextItem, 'images': x})}
                                                dropdownGoesUp={true}

                                                selectedModel={selectedModel}
                                                userModelOptions={userModelOptions}
                                                userModelLoadingState={userModelLoadingState}
                                                setUserChatModel={setUserChatModel}

                                                selectedSearchEngine={selectedSearchEngine}
                                                userSearchEngineOptions={userSearchEngineOptions}
                                                userSearchEngineLoadingState={userSearchEngineLoadingState}
                                                setUserSearchEngine={setUserSearchEngine}

                                                suggestQuestion={suggestBottomQuestion}
                                                suggestLoadingState={bottomSuggestLoadingState}
                                                toggleDetached={() => setBottomTextItem({...bottomTextItem, 'detached': !bottomTextItem?.detached})}
                                            />
                                        </div>
                                        <div style={{'display': 'flex'}}>
                                            <div style={{'flex': '1', 'height': '3.5rem'}}>
                                                <Textarea
                                                    placeholder={"I was wondering..."}
                                                    value={userText}
                                                    setValue={setUserText}
                                                    allowResize='none'
                                                    style={{'backgroundColor': `${invertColor ? 'var(--light-primary)' : 'var(--light-background)'}`, 'height': '100%', 'borderTopRightRadius': '0px', 'borderBottomRightRadius': '0px', 'fontFamily': 'var(--font-body)'}}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault(); // Prevents adding a new line in the textarea
                                                            submitNewChat();
                                                        }
                                                    }}
                                                    autoFocus={autoFocus && id && badPracticeAutoFocus /* The && id makes it auto focus again when going from chat to chat directly */}
                                                />
                                            </div>
                                            {/* The role and area-label is for backward compatibility with the testing framework */}
                                            <div className={`${styles.sendButton}`} role={"button"} aria-label={"Ask"} onClick={() => submitNewChat()}>
                                                <MyImage src={SendIcon} alt={"send"} width={15} height={15} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : ""}
                        </>
                    ) : (
                        <div style={{'padding': '20px', 'flex': '1', 'overflow': 'hidden'}}>
                            <LoadingSkeleton numResults={4} type='chat' />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
