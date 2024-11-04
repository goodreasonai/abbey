import MyImage from '../MyImage/MyImage'
import DownloadIcon from '../../../public/icons/DownloadIcon.png'
import Loading from '../Loading/Loading'
import MagnifyingGlassIcon from '../../../public/icons/MagnifyingGlassIcon.png'
import { useState } from 'react'
import fileResponse from '@/utils/fileResponse'
import { Auth } from '@/auth/auth'
import Link from 'next/link'
import Tooltip from '../Tooltip/Tooltip'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import QuizIcon from '../../../public/icons/QuizIcon.png'
import SpeakerIcon from '../../../public/icons/SpeakerIcon.png'
import AudioControls from '../Audio/AudioControls'
import { useRef } from 'react'
import styles from './DocToolbar.module.css'


const stdIconGap = '10px'
const stdIconSize = 15

export const defaultButtonOptions = {
    'download': {'disabled': false},
    'scan': {'disabled': false},
    'search': {'disabled': false},
    'quiz': {'disabled': false},
    'audio': {'disabled': false},
}

export default function DocToolbar({manifestRow, buttonOptions=defaultButtonOptions, showSearch=false, setShowSearch=()=>{}}){
    
    // Download file & text
    const [downloadFileState, setDownloadFileState] = useState(0)
    const [downloadTextState, setDownloadTextState] = useState(0)

    // Quiz
    const [quizLoadingState, setQuizLoadingState] = useState(0)
    const [quizId, setQuizId] = useState(undefined)

    // Audio revise
    const [reviseLoadState, setReviseLoadState] = useState(0)  // The initial button press loading
    const [reviseLoadProgress, setReviseLoadProgress] = useState(0)
    const [audioLoadText, setAudioLoadText] = useState("Audio")
    const [revisedText, setRevisedText] = useState("")
    const [reviseStage, setReviseStage] = useState(0)
    const [listenClicked, setListenClicked] = useState(false)
    const REVISE_AUDIO_NAME = "revise_audio"
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true
        return () => {
            // Set isMounted to false when the component unmounts
            isMountedRef.current = false;
        };
    }, []);

    const { getToken, isSignedIn } = Auth.useAuth()
    const router = useRouter()
    const currentUrl = `${router.asPath}`;

    const buttonsRef = useRef([])
    const containerRef = useRef()
    const [scrollPosition, setScrollPosition] = useState(0)
    const [amOverflowingRight, setAmOverflowingRight] = useState(false)

    // Download functions
    const initiateDownload = async () => {
        try {
            setDownloadFileState(1)
            const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/files?id=${manifestRow['id']}`, {
                method: 'GET',
                headers: {
                    'x-access-token': await getToken(),
                },
            });
        
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
        
            fileResponse(response)
            setDownloadFileState(2)
        }
        catch (error) {
            setDownloadFileState(3)
            console.error('There was a problem fetching the file:', error);
        }
    };
    const initiateDownloadTxt = async () => {
        try {
            setDownloadTextState(1)
            const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/x-ray?id=${manifestRow['id']}`, {
                method: 'GET',
                headers: {
                    'x-access-token': await getToken(),
                },
            });
        
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
        
            fileResponse(response)
            setDownloadTextState(2)
        }
        catch (error) {
            console.error('There was a problem fetching the file:', error);
            setDownloadTextState(3)

        }
    };

    // Quiz functions
    async function makeQuiz(){
        try {
            setQuizLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/quiz/create"
            const data = {
                'ids': [manifestRow['id']],
                'title': `Quiz for ${manifestRow['title']}`
            }
            const response = await fetch(url, {
                'method': "POST",
                'headers': {
                    'Content-Type': 'application/json',
                    'x-access-token': await getToken(),
                },
                'body': JSON.stringify(data)
            })

            const myJson = await response.json()
            if (myJson['response'] != 'success'){
                throw Error("Response was not success")
            }

            setQuizId(myJson['asset_id'])
            setQuizLoadingState(2)
        }
        catch(e){
            console.log(e)
            setQuizLoadingState(3)
        }
    }

    async function loadQuiz() {
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/quiz/find?id=${manifestRow['id']}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken()
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            if (myJson['response'] != 'success'){
                throw Error("Couldn't load previous thing.")
            }
            if (myJson['result']){
                setQuizId(myJson['result'].id)
            }
        }
        catch(e) {
            console.log(e)
        }
    }

    useEffect(() => {
        if (manifestRow['id'] && isSignedIn === true){
            loadQuiz()
        }
    }, [manifestRow.id, isSignedIn])

    // Audio revise functions
    async function startRevise() {
        try {
            setReviseLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/revise`
            const data = {
                'id': manifestRow.id
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
            await pingReviseJobUntilComplete(myJson['job_id'])
        }
        catch(e) {
            console.log(e)
            setReviseLoadState(3)
        }
    }

    async function getRevised(reviseJobId){
        setReviseLoadState(1)
        try {
            const resultUrl = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/get-revised`
            const resultData = {
                'id': manifestRow.id,
                'job_id': reviseJobId
            }
            const resultResponse = await fetch(resultUrl, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'POST',
                'body': JSON.stringify(resultData)
            })
            const txt = await resultResponse.text()
            setRevisedText(txt)
            setReviseLoadState(2)
        }
        catch(e) {
            console.log(e)
            setReviseLoadState(3)
        }
    }


    async function pingReviseJob(reviseJobId){
        let condition = ""
        if (reviseJobId){
            condition = `job_id=${reviseJobId}`
        }
        else {
            condition = `kind=revise`
        }
        const checkUrl = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/jobs?id=${manifestRow.id}&${condition}`
        const checkResponse = await fetch(checkUrl, {
            'headers': {
                'x-access-token': await getToken(),
                'Content-Type': 'application/json',
                'Connection': 'close'
            },
            'method': 'GET'
        })

        if (!checkResponse.ok){
            throw Error("Couldn't check job")
        }

        const checkMyJson = await checkResponse.json()
        return checkMyJson.results
    }

    async function pingReviseJobUntilComplete(reviseJobId){

        // Pings job every 2 seconds for update
        setReviseStage(1)
        while (true){

            await new Promise(r => setTimeout(r, 2000));  // sleep for two seconds
            try {
                if (!isMountedRef.current){
                    throw Error("Checking aborted by unmount")
                }
                const jobs = await pingReviseJob(reviseJobId)
                if (jobs.length > 0){
                    let job = jobs[0]
                    if (job.progress){
                        setReviseLoadProgress(job.progress)
                    }
                    if (job.is_complete){  // should avoid the zero string
                        setReviseStage(2)
                        await getRevised(reviseJobId)
                        break
                    }
                    if (job.error){
                        throw Error("Note-taking failed")
                    }
                }
            }
            catch(e) {
                console.log(e)
                break
            }
        }
    }

    useEffect(() => {
        async function checkPrevious(){
            try {
                const jobs = await pingReviseJob()
                if (jobs.length > 0){
                    let job = jobs[0]
                    if (job.is_complete){  // should avoid the zero string
                        setReviseStage(2)
                        setReviseLoadState(2)
                        await getRevised(job.id)
                    }
                    else if (job.progress){
                        setReviseStage(1)
                        setReviseLoadState(2)
                        setReviseLoadProgress(job.progress)
                        pingReviseJobUntilComplete(job.id)
                    }
                }
            }
            catch(e) {
                console.log(e)
            }
        }
        if (manifestRow.id && reviseStage == 0 && isSignedIn !== undefined){
            checkPrevious()
        }
    }, [manifestRow.id, reviseStage, isSignedIn])

    useEffect(() => {
        if (reviseStage == 1 && reviseLoadProgress){
            setAudioLoadText(`Progress ${Math.round(100 * reviseLoadProgress)}%`)
        }
        else {
            setAudioLoadText('Audio')
        }
    }, [reviseStage, reviseLoadProgress, setAudioLoadText])

    let reviseAudioValue = ""
    if (reviseStage == 2){
        if (!listenClicked){
            reviseAudioValue = (
                <div style={{'display': 'flex', 'gap': stdIconGap, 'alignItems': 'center'}}>
                    <div>
                        Listen
                    </div>
                    <MyImage src={SpeakerIcon} width={stdIconSize} height={stdIconSize} alt={"Speaker"} />
                </div>
            )
        }
        else {
            reviseAudioValue = (
                <AudioControls loadingText='Audio' loadingFlipped={true} iconSize={stdIconSize} text={revisedText} assetId={manifestRow['id']} name={REVISE_AUDIO_NAME} />
            )
        }
    }
    else {
        reviseAudioValue = (
            <div style={{'display': 'flex', 'gap': stdIconGap, 'alignItems': 'center'}}>
                <div>
                    Audio
                </div>
                <MyImage src={SpeakerIcon} width={stdIconSize} height={stdIconSize} alt={"Speaker"} />
            </div>
        )
    }

    // Options are: download, scan, hideSearch, search, quiz, audio, hideChat, editFile
    const options = [
        {
            'code': 'download',
            'value': (
                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': stdIconGap, 'flex': '1'}}>
                    <div style={{'flex': '1'}}>
                        Download
                    </div>
                    <MyImage src={DownloadIcon} alt={"Download"} width={stdIconSize} height={stdIconSize} />
                </div>
            ),
            'onClick': initiateDownload,
            'loadState': downloadFileState,
            'loadText': 'Downloading'
        },
        {
            'code': 'scan',
            'value': (
                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': stdIconGap, 'flex': '1'}}>
                    <div style={{'flex': '1'}}>
                        { buttonOptions['scan'].customText || 'Scanned Text' }
                    </div>
                    <MyImage src={DownloadIcon} alt={"Download"} width={stdIconSize} height={stdIconSize} />
                </div>
            ),
            'onClick': initiateDownloadTxt,
            'loadState': downloadTextState,
            'loadText': 'Downloading',
        },
        {
            'code': 'search',
            'value': (
                <div style={{'display': 'flex', 'gap': stdIconGap, 'alignItems': 'center', 'flex': '1'}}>
                    <div style={{'flex': '1'}}>
                        {showSearch ? "Hide Search" : "AI Search"}
                    </div>
                    <MyImage src={MagnifyingGlassIcon} width={stdIconSize} height={stdIconSize} alt="Show Search" />
                </div>
            ),
            'onClick': () => setShowSearch(!showSearch),
        },
        {
            'code': 'quiz',
            'value': (
                <div style={{'display': 'flex', 'gap': stdIconGap, 'alignItems': 'center', 'flex': '1'}}>
                    <div style={{'flex': '1'}}>
                        Make Quiz
                    </div>
                    <MyImage src={QuizIcon} width={stdIconSize} height={stdIconSize} alt={"Make quiz"} />
                </div>
            ),
            'linkValue': (
                <div style={{'display': 'flex', 'gap': stdIconGap, 'alignItems': 'center', 'flex': '1'}}>
                    <div style={{'flex': '1'}}>
                        Take Quiz
                    </div>
                    <MyImage src={QuizIcon} width={stdIconSize} height={stdIconSize} alt={"Take quiz"} />
                </div>
            ),
            'onClick': !quizId ? ()=>{makeQuiz()} : "",
            'link': quizId ? `/assets/${quizId}` : "",
            'needsSignInText': 'Sign in to make quiz',
            'loadState': quizLoadingState,
            'loadText': 'Quiz',
        },
        {
            'code': 'audio',
            'value': (reviseAudioValue),
            'onClick': () => {
                if (reviseStage == 2 && !listenClicked){
                    setListenClicked(true)
                }
                if (reviseLoadState != 1 && reviseLoadState != 2 && reviseStage != 2){
                    startRevise()
                }
                reviseLoadState != 1 && reviseLoadState != 2 && startRevise()
            },
            'needsSignInText': 'Sign in to make audio version',
            'loadState': reviseLoadState,
            'loadText': audioLoadText,
        },
    ]

    const shownOptions = options.filter((x) => {
        return !(buttonOptions[x.code].disabled)
    })

    function makeButton(item, i){

        const hidden = item.needsSignInText && !isSignedIn
        const isLinkVersion = item.link && !hidden

        let inner = item.value
        if (isLinkVersion){
            inner = item.linkValue
        }

        if (item.loadState == 1){
            inner = (<Loading flipped={true} size={stdIconSize} text={item.loadText} />)
        }
        else if (item.loadState == 3){
            inner = "Error"
        }

        inner = (
            <div onClick={!isLinkVersion && !hidden ? item.onClick : ()=>{}} className={`${styles.buttonContainer} ${item.loadState == 1 ? styles.loadingButtonContainer : ''}`}>
                {inner}
            </div>
        )

        if (hidden){
            inner = (
                <Tooltip content={item.needsSignInText} tooltipStyle={{'width': '150px'}} >
                    <Link style={{'opacity': '.5'}} href={`${Auth.getSignInURL(currentUrl)}`}>
                        {inner}
                    </Link>
                </Tooltip>
            )
        }

        if (isLinkVersion){
            inner = (
                <Link href={item.link} target='_blank'>
                    {inner}
                </Link>
            )
        }

        return <div className={`${styles[`${item.code}Style`]}`} key={item.code}>{inner}</div>
    }

    function getHiddenButtons() {
        if (!buttonsRef.current || !buttonsRef.current.length || !containerRef.current) return {'left': [], 'right': []};

        const containerRect = containerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width;

        const hiddenLeft = []
        const hiddenRight = []
        buttonsRef.current.forEach((button, index) => {
            const buttonLeft = button.offsetLeft;
            const buttonRight = buttonLeft + button.offsetWidth;
            if (buttonLeft < 0) {
                hiddenLeft.push(button)
            }
            else if (buttonRight > containerWidth) {
                hiddenRight.push(button)
            }
        });

        return {'left': hiddenLeft, 'right': hiddenRight}
    }
    
    useEffect(() => {
        function checkButtons() {
            const { right } = getHiddenButtons();
            if (right?.length) {
                setAmOverflowingRight(true);
            } else {
                setAmOverflowingRight(false);
            }
        }

        checkButtons();

        window.addEventListener('resize', checkButtons);
        const resizeObserver = new ResizeObserver(() => {
            checkButtons();
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            window.removeEventListener('resize', checkButtons);
            resizeObserver.disconnect();
        };
    }, [scrollPosition]);


    function moveBarTo(moveToRight) {
        if (!containerRef.current) return;
        const { left, right } = getHiddenButtons()
        // make the rightmost button fully visible
        if (moveToRight && right?.length){
            let minHiddenPos = Infinity
            for (let button of right){
                const buttonLeft = button.offsetLeft;
                minHiddenPos = Math.min(minHiddenPos, buttonLeft)
            }
            setScrollPosition(-1 * minHiddenPos)
        }
        else {
            setScrollPosition(0)
        }
    }

    return (
        <div style={{'backgroundColor': 'var(--light-primary)', 'padding': '5px 10px', 'width': '100%', 'border': '1px solid var(--light-border)', 'borderTopWidth': '0px', 'borderRadius': 'var(--medium-border-radius)', 'borderTopLeftRadius': '0px', 'borderTopRightRadius': '0px', 'position': 'relative', 'overflow': 'hidden'}}>
            <div
                ref={containerRef}
                style={{
                    'display': 'flex',
                    'gap': '10px',
                    'alignItems': 'center',
                    'position': 'relative',
                    'transition': 'left .25s ease-in-out',
                    'left': `${scrollPosition}px`
                }}
            >
                {shownOptions.map((x, i) => {
                    // initialize buttons ref if not done already
                    if (buttonsRef && buttonsRef.current && buttonsRef.current.length < i + 1){
                        buttonsRef.current.push(undefined)
                    }
                    return (
                        <div key={x.code} ref={(el) => (buttonsRef.current[i] = el)}>
                            {makeButton(x, i)}
                        </div>
                    )
                })}
            </div>
            {scrollPosition < 0 || amOverflowingRight ? (
                <div style={{'position': 'absolute', 'right': '0px', 'top': '0px', 'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center', 'height': '100%', 'padding': '3px', 'height': '100%', 'backgroundColor': 'var(--light-primary)', 'borderLeft': '1px solid var(--light-border)', 'gap': '5px', 'fontSize': '.8rem'}}>
                    {scrollPosition < 0 ? (
                        <MoveButton dir="right" callback={() => {moveBarTo(false)}} />
                    ) : ""}
                    {amOverflowingRight ? (
                        <MoveButton dir="left" callback={() => {moveBarTo(true)}} />
                    ) : ""}
                </div>
            ) : ""}
        </div>
    )
}

function MoveButton({ callback, dir }) {
    return (
        <div onClick={() => callback()} className='_touchableOpacity' style={{'transform': dir == 'left' ? 'rotate(180deg)' : '', 'backgroundColor': 'var(--light-background)', 'padding': '1px 3px', 'borderRadius': 'var(--small-border-radius)', 'border': '1px solid var(--light-border)'}}>
            {`◀`}
        </div>
    )
}
