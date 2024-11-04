import Loading from "../Loading/Loading"
import { useEffect, useState, useRef, useCallback } from "react"
import { Auth } from "@/auth/auth"
import Button from "../form/Button"
import styles from './InfiniteQuiz.module.css'
import useSaveDataEffect from "@/utils/useSaveDataEffect"
import Dropdown from "../Dropdown/Dropdown"
import Question from "../Quiz/Question"
import RangeSlider from "../form/RangeSlider"
import SpeedUpIcon from '../../../public/icons/SpeedUpIcon.png'
import SlowDownIcon from '../../../public/icons/SlowDownIcon.png'
import MenuIcon from '../../../public/icons/MenuIcon.png'
import Info from "../Info/Info"
import MyImage from "../MyImage/MyImage"
import CheckIcon from '../../../public/icons/CheckIcon.png'
import XIcon from '../../../public/icons/XIcon.png'
import PanelSourceSelect from "../PanelSourceSelect/PanelSourceSelect"
import { DATA_TEMPLATES } from "@/templates/template"
import Modal from "../Modal/Modal"
import Timeline from "./Timeline"
import Hr from "../Hr/Hr"
import MoreSidewaysNotSquareIcon from '../../../public/icons/MoreSidewaysNotSquareIcon.png'
import RoundModal, { getArchive } from "./RoundModal"
import { animateTitle } from "@/utils/autoName"
import Head from "next/head"
import ChocolateRain from "./ChocolateRain/ChocolateRain"
import BigLoading from "../Loading/BigLoading"
import ToggleButtons from "../form/ToggleButtons"
import shortenText from "@/utils/text"
import { ASSET_STATE } from "@/config/strConstants"
import useKeyboardShortcut from "@/utils/keyboard"

const ROUND_LENGTH = 20

export const getDefaultInfQuizState = () => {
    return {
        'questions': [], // [{“text”: “…”, “points”: int, “type”: “Short Answer”|”Multiple Choice”, “id”: “…”, “data”:…}, …] If it’s a MCQ, “data”:{“responses”: [{“text”: “”}]}
        'answers': {},  // Correct answers: {questionId: text, ...}
        'responses': {},  // User responses: {questionId: text, ...}
        'grades': {},  // {questionId: pts, ...}
        'saBias': 20,  // 0-100, probability that a question is a Short Answer (as opposed to MCQ)
        'archive': [], // Archived rounds: [{}, ...] - see getArchived in RoundModal.js
        'difficulty': 'easier',  // easier or harder
        'explanations': {}, // questionId -> text (shown on explain question)
        'matchingAssets': {},  // questionId -> list of assetRows (basically like sourced assets that get calculated off of an explanation)
        'currIndex': 0  // The question the user is on
    }
}

export function getMaxPoints(qType){
    if (qType == 'Multiple Choice'){
        return 1
    }
    else if (qType == 'Short Answer'){
        return 2
    }
    else {
        throw Error(`Couldn't recognize question type ${qType}`)
    }
}

export default function InfiniteQuiz({ manifestRow, canEdit, ...props}) {
    const { getToken, isSignedIn } = Auth.useAuth()

    const [ quizState, setQuizState ] = useState(getDefaultInfQuizState())
    const [ quizLoadingState, setQuizLoadingState ] = useState(0)
    const [ isGenerating, setIsGenerating ] = useState(false)
    const [ gradingLoadState, setGradingLoadState ] = useState(0)
    const [quizSourcesLoadingState, setQuizSourcesLoadingState] = useState([])
    const [selections, setSelections] = useState([])
    const [ showSourcePanel, setShowSourcePanel ] = useState(false)
    const [ showRoundModal, setShowRoundModal ] = useState(false)
    const [focusSource, setFocusSource] = useState(undefined)  // the source that is currently being used to create questions

    const [quizTitle, setQuizTitle] = useState(manifestRow['title'])  // for auto creating a title

    const introRef = useRef()  // for the initial page
    const mainRef = useRef()  // for the page shown while taking the quiz
    const [showIntro, setShowIntro] = useState(true)

    const [timeLeft, setTimeLeft] = useState(0)  // countdown timer to next question
    const timerIntervalRef = useRef()

    const setResponses = useCallback((x) => {
        setQuizState((prev) => {return {...prev, 'responses': typeof x == 'function' ? x(prev.responses) : x}})
    }, [setQuizState])
    const setGrades = useCallback((x) => {
        setQuizState((prev) => {return {...prev, 'grades': typeof x == 'function' ? x(prev.grades) : x}})
    }, [setQuizState])
    const setCurrIndex = useCallback((x) => {
        setQuizState((prev) => {return {...prev, 'currIndex': typeof x == 'function' ? x(prev.currIndex) : x}})
    }, [setQuizState])
    const setSaBias = useCallback((x) => {
        setQuizState((prev) => {return {...prev, 'saBias': typeof x == 'function' ? x(prev.saBias) : x}})
    }, [setQuizState])
    const setDifficulty = useCallback((x) => {
        setQuizState((prev) => {return {...prev, 'difficulty': typeof x == 'function' ? x(prev.difficulty) : x}})
    }, [setQuizState])
    const setExplanations = useCallback((x) => {
        setQuizState((prev) => {return {...prev, 'explanations': typeof x == 'function' ? x(prev.explanations) : x}})
    }, [setQuizState])
    const setMatchingAssets = useCallback((x) => {
        setQuizState((prev) => {return {...prev, 'matchingAssets': typeof x == 'function' ? x(prev.matchingAssets) : x}})
    }, [setQuizState])

    const QGEN = 5

    const arrowRightCallback = useCallback(() => {
        handleNext()
    }, [quizState])
    useKeyboardShortcut([['ArrowRight']], arrowRightCallback, true)
    const arrowLeftCallback = useCallback(() => {
        handlePrevious()
    }, [quizState])
    useKeyboardShortcut([['ArrowLeft']], arrowLeftCallback, true)

    // On load
    useEffect(() => {
        async function getQuizState() {
            try {
                setQuizLoadingState(1)
                const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/metadata?id=${manifestRow['id']}&key=${ASSET_STATE}`;
                const response = await fetch(url, {
                    'headers': {
                        'x-access-token': await getToken()
                    },
                    'method': 'GET'
                }) 
                const myJson = await response.json()
                if (myJson['response'] != 'success'){
                    throw Error(`Response was not a success: ${myJson['reason']}`)
                }
                const results = myJson['results']

                if (results.length == 0){
                    setQuizState(getDefaultInfQuizState())
                }
                else {
                    const saved = JSON.parse(results[0].value)
                    const updated = {...getDefaultInfQuizState(), ...saved}  // in case the properties of the state have changed between versions
                    setQuizState(updated)
                }      
                setQuizLoadingState(2)          
            }   
            catch(e) {
                console.log(e)
                setQuizLoadingState(3)
            }
        }

        async function getSources(){
            try {
                setQuizSourcesLoadingState(1)
                const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/sources-info?id=${manifestRow['id']}`
                const response = await fetch(url, {
                    'headers': {
                        'x-access-token': await getToken()
                    },
                    'method': 'GET'
                })
                const myJson = await response.json()
                setSelections(myJson['results'] || [])
                setQuizSourcesLoadingState(2)
            }
            catch (e) {
                console.log(e)
                setQuizSourcesLoadingState(3)
            }
        }

        if (manifestRow.id && isSignedIn !== undefined){
            getQuizState()
            getSources()
        }
    }, [manifestRow.id, isSignedIn])

    const saveData = useCallback(async (value) => {
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/save-metadata";
            const data = {
                'value': JSON.stringify(value),
                'key': 'state',
                'id': manifestRow['id'],
                'additive': false
            };
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'body': JSON.stringify(data),
                'method': 'POST'
            });
    
            const myJson = await response.json();
    
            if (myJson['response'] !== 'success') {
                throw Error(`Response was not success: ${myJson['reason']}`);
            }
    
        } catch (e) {
            console.log(e);
        }
    }, [manifestRow]);
    useSaveDataEffect(quizState, quizLoadingState == 2, saveData, 500)

    async function makeTitle(){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/inf-quiz/make-title'
            const data = {
                'id': manifestRow['id'],
                'sources': selections
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

            let newTitle = myJson['title']
            if (newTitle != quizTitle){
                setQuizTitle(newTitle)
                animateTitle(newTitle, 75)
            }
        }
        catch(e) {
            console.log(e)
        }
    }

    async function generateQuestion(batchSize=1, focusSourceArg) {
        if (canEdit && !quizState?.questions?.length && !quizState?.archive?.length && selections?.length){
            makeTitle()
        }
        setIsGenerating(true)
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/inf-quiz/gen-q"
            const data = { 
                'id': manifestRow['id'],
                'random': quizState.saBias,
                'batch_size': batchSize,
                'difficulty': quizState.difficulty,
                'prev': quizState?.questions,
                'focus_source_id': focusSourceArg ? focusSourceArg.id : focusSource?.id
            }
            const response = await fetch(url, {
                'headers' : {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'POST',
                'body' : JSON.stringify(data)
            })
            const myJson = await response.json()
            if (myJson['response'] != 'success'){
                throw Error(`Response was not a success ${myJson}`)
            }
            const newQuestions = myJson['questions'].filter((x) => x?.id && x?.type);  // some cleansing to make sure that each question was generated properly
            setQuizState((prev) => {
                const updatedQuizQuestions = [...prev.questions, ...newQuestions];
                const updatedAnswerKey = {...prev.answers, ...myJson['answers']};
                const newQuizState = {...prev, 'questions': updatedQuizQuestions, 'answers': updatedAnswerKey}
                return newQuizState
            })
        }
        catch(e) {
            console.log(e)
        }
        setIsGenerating(false)
    }

    function handleNextDelayed(delay){
        if (timerIntervalRef.current){
            clearInterval(timerIntervalRef.current)
        }
        setTimeLeft(100)
        timerIntervalRef.current = setInterval(() => {
            setTimeLeft((prevTime) => {
                if (prevTime <= delay / 200) {
                    clearInterval(timerIntervalRef.current);
                    handleNext();
                    return 0;
                }
                return prevTime - 100 / (delay / 5);
            });
        }, 10)
    }

    function abortHandleNext(){
        clearInterval(timerIntervalRef.current)
        setTimeLeft(0)
    }

    async function gradeQuestion(myResponse) {
        const currQ = quizState.questions[quizState.currIndex]
        const currId = currQ.id
        const answer = quizState.answers[currId]

        if (!myResponse){
            setGrades((prev) => {return {...prev, [currId]: 0}})
            return
        }

        if (currQ.type === 'Multiple Choice'){
            let points = 0
            let isCorrect = answer == myResponse
            if (isCorrect){
                points = getMaxPoints(currQ.type)
            }
            setGrades((prev) => {return {...prev, [currId]: points}})

            if (isCorrect){
                handleNextDelayed(1000)
            }
        }

        else {
            setGradingLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/inf-quiz/grade"
            const data = {
                'id': manifestRow['id'],
                'answer': answer,
                'response': myResponse,
                'max_points': getMaxPoints(currQ.type)
            }
            try {
                const response = await fetch(url, {
                    'headers': {
                        'x-access-token': await getToken(),
                        'Content-Type': 'application/json'
                    },
                    'method': 'POST',
                    'body': JSON.stringify(data)
                })
                const myJson = await response.json()
                if (myJson['response'] != 'success') {
                    throw Error(`Response was not a success ${myJson}`)
                }
                const points = myJson['points']
                setGrades((prev) => {return {...prev, [currId]: points}})
                setGradingLoadState(2)
                if (points == getMaxPoints(currQ.type)){
                    handleNextDelayed(1500);
                }
            }
            catch(e) {
                console.log(`Grading Failed: ${e}`)
                setGradingLoadState(3)
            }
        }
    }

    function handleNext() {
        if (!quizState?.questions?.length){
            return
        }
        if (!isGenerating && quizState.currIndex >= quizState?.questions?.length - 4) {
            generateQuestion(QGEN);
        }
        if (quizState.currIndex >= ROUND_LENGTH - 1){
            setShowRoundModal(true)
        }
        else {
            const currentLength = quizState.questions.length
            const newIndex = quizState.currIndex + 1;
            if (newIndex < currentLength) {
                setCurrIndex(newIndex);
            }
        }
        if (timerIntervalRef.current){
            clearInterval(timerIntervalRef.current);
            setTimeLeft(0)
        }
    }

    function handlePrevious() {
        if (!quizState?.questions?.length || !quizState?.currIndex){
            return
        }
        setCurrIndex(quizState.currIndex-1)
    }

    function giveUp(){
        gradeQuestion("")
    }

    let quest = (
        <BigLoading />
    )
    let midButton = (
        <div className={styles.buttonContainer} style={{'cursor': 'auto'}}>
            <MyImage src={MoreSidewaysNotSquareIcon} alt="Waiting" height={5} />
        </div>
    )
    if (quizState.currIndex < quizState.questions.length){
        const currQ = quizState.questions[quizState.currIndex]
        const currId = currQ.id
        quest = (
            <div className={styles.questContainer} style={{'display': 'flex', 'flexDirection': 'column', 'alignItems': 'center', 'justifyContent': 'center'}}>
                <Question
                    autoFocus={true}
                    item={quizState.questions[quizState.currIndex]}
                    i={quizState.currIndex}
                    showCorrectAnswerAs={quizState.grades[currId] !== undefined ? quizState.answers[currId] : ""}
                    quizAnswers={quizState.responses}
                    setQuizAnswers={setResponses}
                    onAnswer={(x)=>{gradeQuestion(x)}}
                    allowExplanation={true}
                    explanation={quizState.explanations[currId]}
                    setExplanation={(x) => setExplanations((prev) => {return {...prev, [currId]: x}})}
                    matchingAssets={quizState.matchingAssets[currId]}
                    setMatchingAssets={(x) => setMatchingAssets((prev) => {return {...prev, [currId]: x}})}
                    explainClickedCallback={() => abortHandleNext()}
                    manifestRow={manifestRow}
                    mode={'quiz'}
                    style={{'width': '100%'}}
                />
                <div className="_touchableOpacity" onClick={giveUp} style={{'backgroundColor': 'var(--light-primary)', 'padding': '2px 10px', 'border': '1px solid var(--light-border)', 'borderTop': '0px', 'fontSize': '.8rem'}}>
                    Pass
                </div>
            </div>
        )

        let grade = quizState.grades[currId]
        if (grade !== undefined){
            if (grade >= getMaxPoints(currQ.type)){
                midButton = (
                    <div className={`${styles.buttonContainer} ${styles.correct}`}>
                        Correct!
                        <MyImage src={CheckIcon} width={20} height={20} alt="Correct" />
                    </div>
                )
            }
            else if (grade > 0){
                midButton = (
                    <div className={`${styles.buttonContainer} ${styles.partialCredit}`}>
                        Partial Credit
                    </div>
                )
            }
            else {
                midButton = (
                    <div className={`${styles.buttonContainer} ${styles.incorrect}`}>
                        Incorrect
                        <MyImage src={XIcon} width={20} height={20} alt="Incorrect" />
                    </div>
                )
            }
        }
        else if (gradingLoadState == 1){
            midButton = (
                <div className={`${styles.buttonContainer}`}>
                    <Loading flipped={true} text="Grading" />
                </div>
            )
        }
        else if (currQ.type == 'Short Answer'){
            midButton = (
                <div className={`${styles.buttonContainer} _clickable`} onClick={()=>{gradeQuestion(quizState.responses[currId])}}>
                    Submit
                </div>
            )
        }
    }

    function startQuiz(){
        if (selections.length){
            generateQuestion(QGEN)
        }
        else {
            setShowSourcePanel(true)
        }
    }

    function nextRound(){
        const archive = getArchive(quizState)
        const newState = getDefaultInfQuizState()
        newState.archive = [...(quizState.archive.length ? quizState.archive : []), archive]
        newState.questions = quizState.questions.slice(ROUND_LENGTH)
        for (let q of newState.questions){
            newState.answers[q.id] = quizState.answers[q.id]
        }
        newState.saBias = quizState.saBias
        newState.difficulty = quizState.difficulty
        setQuizState(newState)
        setShowRoundModal(false)
    }

    useEffect(() => {
        function transition(){
            let time = 1  // in seconds
            introRef.current.style.transition = `opacity ${time}s ease-in-out`
            mainRef.current.style.transition = `opacity ${time}s ease-in-out`
            introRef.current.style.opacity = 0
            mainRef.current.style.opacity = 1
            setTimeout(() => {
                try{
                    introRef.current.style.display = 'none'
                    mainRef.current.style.display = 'flex'
                }catch(e){}
                setShowIntro(false)
            }, time * 800)
        }
        if (mainRef.current && introRef.current){
            let mainDisplay = mainRef.current.style.display
            let introDisplay = introRef.current.style.display
            if (quizState?.questions?.length && introDisplay != 'none'){
                mainRef.current.style.display = 'none'
                transition()
            }
            else if (!quizState?.questions?.length && mainDisplay != 'none'){
                mainRef.current.style.display = 'none'
                introRef.current.style.display = 'flex'
                setShowIntro(true)
            }
        }
    }, [quizState])

    useEffect(() => {
        // If the focusSource got removed, we need to remove the focus source.
        if (focusSource && !selections.map((x) => x.id).includes(focusSource.id)){
            setFocusSource(undefined)
        }
    }, [selections, focusSource])

    function onFocusChange(newFocus){
        if (focusSource == newFocus){
            return
        }
        setFocusSource(newFocus)
        if (newFocus !== undefined){
            // Remove all future questions and start generating more
            setQuizState((prev) => {
                const updatedQuizQuestions = prev?.questions?.slice(0, prev.currIndex + 1);
                // OK not to remove answers... just some memory junk. 
                const newQuizState = {...prev, 'questions': updatedQuizQuestions}
                return newQuizState
            })
            generateQuestion(QGEN, newFocus);
        }
    }

    const focusDropdown = (
        <Dropdown
            rightAlign={true}
            optionsStyle={{'minWidth': '200px', 'fontSize': '.9rem'}}
            className={styles.focusDropdown}
            initialButtonStyle={{'fontSize': '.9rem'}}
            value={focusSource ? shortenText(focusSource.title, 5, 30, true) : "All"}
            options={[...selections.map((item, i) => {
                    return {'value': shortenText(item.title, 5, 75, true), 'onClick': ()=>{onFocusChange(item)}}
                }),
                {'value': 'All Sources', 'onClick': ()=>{onFocusChange(undefined)}},
            ]}
            direction="up"
        />
    )

    return (
        <div>
            <Head>
                <title>{quizTitle}</title>
            </Head>
            <div className={styles.settingsContainer}>
                {!quizState?.archive?.length && quizState?.questions?.length && quizState?.currIndex < 10 ? (
                    <div className={styles.settingsTip}>
                        Change difficulty
                    </div>
                ) : ""}
                <Dropdown
                    initialButtonStyle={{'all': 'unset', 'display': 'flex', 'alignItems': 'center'}}
                    value={
                        <MyImage src={MenuIcon} width={25} height={25} alt={"Menu"}/>
                    }
                    rightAlign={true}
                    closeOnSelect={true}
                    options={[
                        {'value': (
                            <div style={{'display': 'flex', 'alignItems': 'center', 'flexWrap': 'wrap', 'gap': '0.5em'}}>
                                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}}>
                                    <div style={{'fontSize': 'small'}}>
                                        Question Type:
                                    </div>
                                    <Info iconStyle={{'width': '15px', 'height': '15px'}} text={"Generate more multiple choice or short answer questions. Note that your next few question(s) may already be created."}/>
                                </div>
                                <div style={{'flex': '1', 'display': 'flex', 'alignItems': 'center'}}>
                                    <div style={{'marginRight': '10px', 'minWidth': '150px', 'display': 'flex', 'alignItems': 'center', 'gap': '0.5em'}}>
                                        <div>MCQ</div>
                                        <RangeSlider
                                            value={quizState.saBias}
                                            onChange={(x) => setSaBias(x)}
                                        />
                                        <div>SA</div>
                                    </div>
                                </div>
                            </div>
                        )},
                        {'value': (
                            <div style={{'display': 'flex', 'alignItems': 'center', 'flexWrap': 'wrap', 'gap': '0.5em'}}>
                                <div style={{'fontSize': 'small'}}>
                                    Difficulty:
                                </div>
                                <div style={{'flex': '1', 'display': 'flex', 'alignItems': 'center'}}>
                                    <ToggleButtons
                                        options={[
                                            {'value': 'easier', 'name': 'Easier'},
                                            {'value': 'harder', 'name': 'Harder'}
                                        ]}
                                        theme="light"
                                        value={quizState.difficulty}
                                        setValue={setDifficulty} />
                                </div>
                            </div>
                        )},
                        ...(canEdit ? [{'value': 'Select Sources', 'onClick': () => {setShowSourcePanel(true)}}] : [])
                    ]}
                />
            </div>
            {quizLoadingState < 2 ? (
                <div className={styles.mainBox}>
                    <div style={{'width': '100%', 'height': '100%', 'display': 'flex', 'justifyContent': 'center', 'alignItems': 'center'}}>
                        <BigLoading />
                    </div>
                </div>
            ) : (
                <>
                    <div className={styles.mainBox} ref={mainRef}>
                        <div>
                            <Timeline
                                quizState={quizState}
                                setCurrIndex={setCurrIndex}
                                roundLength={ROUND_LENGTH} />
                        </div>
                        <div style={{'flex': '1', 'display': 'flex', 'justifyContent': 'center', 'alignItems': 'center'}}>
                            {quest}
                        </div>
                        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '10px', 'alignItems': 'center'}}>
                            <div style={{'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center', 'gap': '1em'}}>
                                <div className={`${styles.buttonContainer} _clickable`} onClick={() => handlePrevious()}>
                                    <MyImage src={SlowDownIcon} width={30} height={30} alt="Previous" />
                                </div>
                                <div>
                                    <div style={{'backgroundColor': 'var(--dark-primary)', 'opacity': '.5', 'width': `calc(${timeLeft}% - 2px)`, 'height': `${timeLeft ? '5px' : '0px'}`, 'position': 'relative', 'left': '1px', 'top': '1px'}}>
                                    </div>
                                    {midButton}
                                </div>
                                <div className={`${styles.buttonContainer} _clickable`} onClick={() => handleNext()}>
                                    {quizState.currIndex == quizState.questions.length - 1 && isGenerating ? (
                                        <Loading text="" />
                                    ) : (
                                        <MyImage src={SpeedUpIcon} width={30} height={30} alt="Next" />
                                    )}
                                </div>
                            </div>
                            {selections?.length ? (
                                <div className={styles.focusDropdownCentered}>
                                   {focusDropdown}
                                </div>
                            ) : ""}
                        </div>
                        {selections?.length > 1 ? (
                            <div className={styles.focusDropdownRight}>
                                {!quizState?.archive?.length && quizState?.questions?.length && quizState?.currIndex < 10 && !focusSource ? (
                                    <div className={styles.focusTip}>
                                        Choose focus
                                    </div>
                                ) : ""}
                                {focusDropdown}
                            </div>
                        ) : ""}
                    </div>
                    {showIntro ? (
                        <div className={styles.mainBox} ref={introRef}>
                            <div style={{'height': '90%', 'width': '100%', 'display': 'flex', 'justifyContent': 'center', 'alignItems': 'center'}}>
                                <div style={{'zIndex': 0}}><ChocolateRain /></div>
                                <div style={{'zIndex': 1, 'width': '100%', 'display': 'flex', 'justifyContent': 'center'}}>
                                    <div style={{'display': 'flex', 'padding': '25px 50px', 'borderRadius': 'var(--large-border-radius)', 'flexDirection': 'column', 'justifyContent': 'center', 'alignItems': 'center', 'backgroundColor': 'var(--light-primary)', 'border': '1px solid var(--light-shadow)', 'gap': '2rem'}}>
                                        <div style={{'fontSize': '2rem'}}>
                                            Infinite Quiz
                                        </div>
                                        <div style={{'width': '300px', 'textAlign': 'center', 'fontSize': '1.1rem', 'color': 'var(--passive-text)'}}>
                                            Get auto-generated questions on any source, from now until eternity.
                                        </div>
                                        {isGenerating ? (
                                            <Loading size={25} text='Generating Questions' style={{'fontSize': 'x-large'}} />
                                        ) : (
                                            selections?.length && quizSourcesLoadingState == 2 ? (
                                                <div>
                                                    <Button value="Start" style={{'fontSize': '1.5rem'}} onClick={() => startQuiz()} />
                                                </div>
                                            ) : (
                                                <div>
                                                    <Button value="Select Sources" style={{'fontSize': '1.25rem'}} onClick={() => {setShowSourcePanel(true)}} />
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : ""}
                   
                </>
            )}
            <Modal minWidth='60vw' isOpen={showSourcePanel} close={() => setShowSourcePanel(false)} title={"Quiz Sources"}>
                <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                    <div style={{'display': 'flex', 'justifyContent': 'space-between', 'alignItems': 'center'}}>
                        <div style={{'fontSize': '1.25rem'}}>
                            What is your quiz based on?
                        </div>
                        {selections?.length ? (
                            <Button value="Done" onClick={() => setShowSourcePanel(false)} />
                        ) : ""}
                    </div>
                    <Hr />
                    <PanelSourceSelect allowUpload={true} manifestRow={manifestRow} canEdit={canEdit} selectionsLoadState={quizSourcesLoadingState} setSelectionsLoadState={setQuizSourcesLoadingState} selections={selections} setSelections={setSelections} onlyTemplates={DATA_TEMPLATES}/>
                </div>
            </Modal>
            <Modal isOpen={showRoundModal} close={() => setShowRoundModal(false)} title={`Round ${quizState.archive.length + 1} Results`}>
                <RoundModal quizState={quizState} onNextRound={() => nextRound()} onStay={()=>{setShowRoundModal(false)}} />
            </Modal>
        </div>
    )
}