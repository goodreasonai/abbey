import { getRandomId } from "@/utils/rand"
import { getCanEdit } from "@/utils/requests"
import { Auth } from "@/auth/auth"
import { useEffect, useState, useRef, useCallback } from "react"
import Loading from "../Loading/Loading"
import Button from "../form/Button"
import ControlledInputText from "../form/ControlledInputText"
import Textarea from "../form/Textarea"
import Dropdown from "../Dropdown/Dropdown"
import ResponsiveTextarea from "../form/ResponsiveTextarea"
import { getLetterFromIndex } from "@/utils/listing"
import MyImage from "../MyImage/MyImage"
import DeleteIcon from '../../../public/icons/DeleteIcon.png'
import Question from "./Question"
import ToggleButtons from "../form/ToggleButtons"
import { handleGeneralStreaming } from "@/utils/streaming"
import GlassesIcon from '../../../public/icons/GlassesIcon.png' 
import styles from './Quiz.module.css'
import GearIcon from '../../../public/icons/GearIcon.png'
import SyntheticButton from "../form/SyntheticButton"
import EditIcon from '../../../public/icons/EditIcon.png'
import QuizIcon from '../../../public/icons/QuizIcon.png'
import AddIcon from '../../../public/icons/AddIcon.png'
import FakeCheckbox from "../form/FakeCheckbox"
import AssetsTable from "../assets-table/AssetsTable"
import SourceSelect from "../form/SourceSelect"
import { DATA_TEMPLATES } from "@/templates/template"
import PanelSourceSelect from "../PanelSourceSelect/PanelSourceSelect"
import useSaveDataEffect from "@/utils/useSaveDataEffect"
import Tooltip from "../Tooltip/Tooltip"
import QuizGrades from "./QuizGrades"
import { MCQ, SA } from "./Question"


// This stuff is dependent on backend in quiz/create endpoint.
export const getDefaultQuestionState = (populate) => {
    return {
        'text': "",
        'points': populate ? 1 : 0,
        'type': populate ? MCQ : '',
        'data': populate ? {'responses': []} : {},
        'id': populate ? getRandomId(10) : 0
    }
}

// dependent on quiz/create endpoint...
export const getDefaultQuizState = () => {
    return {
        'questions': [],
        'show_feedback': true
    }
}


export default function Quiz({ manifestRow, canEdit, ...props }) {

    const { getToken, isSignedIn } = Auth.useAuth()

    const [quizState, setQuizState] = useState(getDefaultQuizState())
    const [quizLoadingState, setQuizLoadingState] = useState(0)

    const [mode, setMode] = useState('quiz')

    const [quizAnswers, setQuizAnswers] = useState({})
    const [quizAnswersLoadingState, setQuizAnswersLoadingState] = useState(0)
    const [showAnswers, setShowAnswers] = useState(false)
    const [quizAnswerKey, setQuizAnswerKey] = useState({})
    const [quizAnswerKeyLoadingState, setQuizAnswerKeyLoadingState] = useState(0)

    const [quizGrades, setQuizGrades] = useState([])
    const [gradeLoadState, setGradeLoadState] = useState(0)
    const [gradeProgress, setGradeProgress] = useState(0)
    const [gradeErrorMessage, setGradeErrorMessage] = useState("")

    const [genQLoadState, setGenQLoadState] = useState(0)

    const [selections, setSelections] = useState([])
    const [quizSourcesLoadingState, setQuizSourcesLoadingState] = useState([])

    const [seeBreakdown, setSeeBreakdown] = useState(false)

    const [amEditing, setAmEditing] = useState({})  // qid -> bool

    useEffect(() => {

        async function getQuizState() {
            try {
                setQuizLoadingState(1)
                setQuizAnswerKeyLoadingState(1)
                setQuizAnswersLoadingState(1)
                const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/metadata?id=${manifestRow['id']}&key=quiz_desc&key=quiz_answers&key=quiz_response&key=quiz_grade`
                const response = await fetch(url, {
                    'headers': {
                        'x-access-token': await getToken()
                    },
                    'method': 'GET'
                })
                
                const myJson = await response.json()
    
                if (myJson['response'] != 'success'){
                    throw Error(`Response was not success: ${myJson[['reason']]}`)
                }
    
                const results = myJson['results']

                const qs = results.filter((item) => item.key == 'quiz_desc')
                const qa = results.filter((item) => item.key == 'quiz_answers')
                const qr = results.filter((item) => item.key == 'quiz_response')
                const qg = results.filter((item) => item.key == 'quiz_grade')

                if (qs.length == 0){
                    setQuizState(getDefaultQuizState())
                    setMode('edit')
                }
                else {
                    let val = JSON.parse(qs[0].value)
                    setQuizState(val)
                    if (!val || !val.questions || !val.questions.length){
                        setMode('edit')
                    }
                }

                if (qa.length != 0){
                    let val = JSON.parse(qa[0].value)
                    setQuizAnswerKey(val)
                }

                if (qr.length != 0){
                    let val = JSON.parse(qr[0].value)
                    setQuizAnswers(val)
                }

                if (qg.length != 0){
                    let vals = qg.map((item) => JSON.parse(item.value))
                    setQuizGrades(vals)
                    setGradeLoadState(2)
                }
                setQuizAnswerKeyLoadingState(2)
                setQuizAnswersLoadingState(2)
                setQuizLoadingState(2)
            }
            catch(e) {
                console.log(e)
                setQuizLoadingState(3)
            }
        }

        if (manifestRow.id && isSignedIn !== undefined){
            getQuizState()
        }
    }, [manifestRow.id, isSignedIn])

    const saveQuizState = useCallback(async (quizState) => {
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/save-metadata"
            const data = {
                'value': JSON.stringify(quizState),  // because it's a string that's being saved.
                'key': 'quiz_desc',
                'additive': false,
                'id': manifestRow['id']
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

            if (myJson['response'] != 'success'){
                throw Error(`Response was not success: ${myJson['reason']}`)
            }
    
        }
        catch(e) {
            console.log(e)
        }
    }, [manifestRow]);
    useSaveDataEffect(quizState, quizLoadingState == 2 && canEdit, saveQuizState)

    const saveQuizAnswers = useCallback(async (quizAnswers) => {
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/save-metadata"
            const data = {
                'value': JSON.stringify(quizAnswers),  // because it's a string that's being saved.
                'key': 'quiz_response',
                'additive': false,
                'id': manifestRow['id']
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

            if (myJson['response'] != 'success'){
                throw Error(`Response was not success: ${myJson['reason']}`)
            }
    
        }
        catch(e) {
            console.log(e)
        }
    }, [manifestRow])
    useSaveDataEffect(quizAnswers, quizAnswersLoadingState == 2, saveQuizAnswers)

    const saveQuizAnswerKey = useCallback(async (quizAnswerKey) => {
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/save-metadata"
            const data = {
                'value': JSON.stringify(quizAnswerKey),  // because it's a string that's being saved.
                'key': 'quiz_answers',
                'additive': false,
                'id': manifestRow['id']
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

            if (myJson['response'] != 'success'){
                throw Error(`Response was not success: ${myJson['reason']}`)
            }
    
        }
        catch(e) {
            console.log(e)
        }
    }, [manifestRow])
    useSaveDataEffect(quizAnswerKey, quizAnswerKeyLoadingState == 2 && canEdit, saveQuizAnswerKey)

    function addQuestion(){
        const prev = {...quizState}
        const newQ = getDefaultQuestionState(true)
        if (prev.questions){
            prev.questions.push(newQ)
        }
        else {
            prev.questions = [newQ]
        }
        setAmEditing({...amEditing, [newQ.id]: true})
        setQuizState(prev)
    }

    async function genQuestion(qtype){
        try {
            setGenQLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/quiz/gen-q`
            const data = {
                'id': manifestRow['id'],
                'type': qtype,
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
                throw Error(`Response was not success: ${myJson}`)
            }
            setQuizState((prev) => {
                // Some complication to allow multiply gen qs at once
                let thisQ = myJson['question']
                let newQs = [...prev['questions'].filter((x) => x.id != thisQ.id), thisQ]
                return {...prev, 'questions': newQs}
            })
            setQuizAnswerKey((prev) => {return {...prev, [myJson['question']['id']]: myJson['answer']}})
            setGenQLoadState(2)
        }
        catch (e) {
            console.log(e)
            setGenQLoadState(3)
        }
    }



    function makeQuestion(item, i) {
        return (
            <Question
                key={i}
                item={item}
                i={i}
                amEditing={amEditing}
                setAmEditing={setAmEditing}
                setQuizState={setQuizState}
                quizState={quizState}
                quizAnswers={quizAnswers}
                setQuizAnswers={setQuizAnswers}
                mode={mode}
                showAnswers={showAnswers}
                setShowAnswers={setShowAnswers}
                setQuizAnswerKey={setQuizAnswerKey}
                quizAnswerKey={quizAnswerKey} />
        )
    }

    let quizDisplay = ""
    if (quizLoadingState == 1){
        quizDisplay = <Loading />
    }
    else if (quizLoadingState == 3){
        quizDisplay = "Error loading quiz"
    }
    else if (quizState && quizState.questions && quizState.questions.length){
        quizDisplay = (
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '2rem'}}>
                {quizState.questions.map(makeQuestion)}
            </div>
        )
    }
    else if (quizState && quizState.questions) {
        quizDisplay = (
            "This quiz is empty."
        )
    }

    async function grade(){
        try {
            setGradeLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/quiz/grade"
            const data = {
                'answers': quizAnswers,
                'id': manifestRow['id']
            }
            const response = await fetch (url, {
                'method': 'POST',
                'headers': {
                    'Content-Type': 'application/json',
                    'x-access-token': await getToken()
                }, 
                'body': JSON.stringify(data)
            })

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');

            let finalQuiz = ""
            
            await handleGeneralStreaming({
                reader: reader,
                decoder: decoder,
                onSnippet: (result)=>{
                    const dividerText = "<START>"
                    let pos = result.indexOf(dividerText)  // dependent on backend
                    if (pos == -1){
                        let completed = result.split(',').filter(x => x)
                        setGradeProgress(completed.length)
                    }
                    else {
                        finalQuiz = result.substring(pos + dividerText.length, result.length)
                    }
                }
            })

            setQuizGrades([JSON.parse(finalQuiz), ...quizGrades])

            setGradeLoadState(2)
        }
        catch(e) {
            setGradeLoadState(3)
            console.log(e)
        }
    }

    let actionButton = ""
    if (mode == 'edit'){
        actionButton = (
            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                <div style={{'display': 'flex'}}>
                    <SyntheticButton
                        value={(
                            <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                Add Question
                                <MyImage src={AddIcon} width={20} height={20} alt={"Add"} />
                            </div>
                        )}
                        onClick={addQuestion} />
                </div>
                {selections && selections.length ? (
                    <div>
                        <Dropdown
                            value={
                                genQLoadState == 1 ? (
                                    <div>
                                        <Loading color="var(--light-text)" text="Generating" />
                                    </div>
                                ) :
                                    (
                                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                    Generate Question
                                    <MyImage src={GearIcon} width={20} height={20} alt={"Generate"} />
                                </div>
                            )}
                            options={[
                                {'onClick': () => genQuestion(MCQ), 'value': (MCQ)},
                                {'onClick': () => genQuestion(SA), 'value': (SA)},
                            ]}
                        />
                        
                    </div>
                ) : ""}
            </div>
        )
    }
    else if (gradeLoadState == 1){
        let progressText = "Grading quiz"
        if (gradeProgress){
            progressText = `${gradeProgress} questions graded`
        }
        actionButton = (
            <Loading text={progressText} />
        )
    }
    else if (gradeLoadState == 2){

        let thisGrade = ""
        let percentage = ""
        let available = ""
        if (quizGrades && quizGrades.length > 0){
            thisGrade = parseInt(quizGrades[0]['total_points'])
            available = parseInt(quizGrades[0]['available_points'])
            percentage = (100 * thisGrade / available).toFixed(1)
        }

        actionButton = (
            <>
                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                    <div>
                        Graded!
                    </div>
                    {
                        thisGrade !== "" ? (
                            <>
                                <div>
                                    {`Score: ${percentage}% (${thisGrade}/${available})`}
                                </div>
                                {
                                    !seeBreakdown ? (
                                        <div className={`_clickable ${styles.seeButton}`} onClick={() => setSeeBreakdown(true)}>
                                            <MyImage src={GlassesIcon} width={30} height={30} alt={"Show"} />
                                        </div>
                                    ) : ""
                                }
                            </>
                        ) : ""
                    }
                </div>
                {seeBreakdown && thisGrade !== "" ? (
                    <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                        {
                            Object.keys(quizGrades[0].q_by_q).sort((a, b) => quizGrades[0].q_by_q[a]['index'] - quizGrades[0].q_by_q[b]['index']).map((key) => {
                                const item = quizGrades[0].q_by_q[key]
                                let extraStyle = {}
                                if (item['points'] == item['total']){
                                    extraStyle['color'] = 'green'
                                }
                                else if (item['points'] == 0){
                                    extraStyle['color'] = 'var(--logo-red)'
                                }
                                else {
                                    extraStyle['color'] = 'orange'
                                }

                                const hasCorrectAnswer = quizGrades[0].correct_answers && quizGrades[0].correct_answers[key]
                                const hasUserAnswer =  quizGrades[0].user_answers && quizGrades[0].user_answers[key]

                                return (
                                    <div key={key} style={{'display': 'flex', 'flexDirection': 'column', 'gap': '10px', ...extraStyle}}>
                                        {`Question ${item['index']+1}: ${item['points']}/${item['total']}`}
                                        { hasCorrectAnswer ? (
                                            <div>
                                                {`Answer: ${quizGrades[0].correct_answers[key]}`}
                                            </div>
                                        ) : "" }
                                        { hasUserAnswer ? (
                                            <div>
                                                {`Your Answer: ${quizGrades[0].user_answers[key]}`}
                                            </div>
                                        ) : "" }
                                    </div>
                                )
                            })
                        }
                    </div>
                ) : ""}
                <div style={{'display': 'flex'}}>
                    <SyntheticButton value={(
                        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}}>
                            Re-Grade
                            <MyImage src={GearIcon} width={15} height={15} alt={"Gears"} />
                        </div>
                    )}
                    onClick={() => { grade() }} />
                </div>
            </>
        )
    }
    else if (gradeLoadState == 3){
        actionButton = (
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                <div>
                    {gradeErrorMessage ? gradeErrorMessage : "An error occurred while grading"}
                </div>
                <div style={{'display': 'flex'}}>
                    <Button value={"Re-grade"} onClick={() => grade()} />
                </div>
            </div>
        )
    }
    else if (quizLoadingState == 2 && quizState && quizState.questions && quizState.questions.length && quizAnswers && Object.values(quizAnswers).filter(x => x).length){
        actionButton = (
            <div>
                <Button value={"Grade"} onClick={() => grade()} />
            </div>
        )
    }

    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '2rem'}}>
            {canEdit ? (
                <div style={{'display': 'flex', 'gap': '1rem', 'flexWrap': 'wrap'}}>
                    <ToggleButtons
                        options={[
                            {'value': 'edit', 'name': 'Edit', 'imageSrc': EditIcon},
                            {'value': 'quiz', 'name': 'Take Quiz', 'imageSrc': QuizIcon}
                        ]}
                        value={mode}
                        setValue={setMode} />
                    {
                        mode == 'edit' ? (
                            <>
                                <div style={{'display': 'flex'}}>
                                    <SyntheticButton
                                        value={!showAnswers ? (
                                            <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}
                                                title={`Show & edit answers to the questions`}>
                                                Show Answers
                                                <MyImage
                                                    src={GlassesIcon}
                                                    height={20}
                                                    alt={"Show"} />
                                            </div>
                                        ) : (
                                            <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                                Hide Answers
                                                <MyImage
                                                    src={GlassesIcon}
                                                    width={20}
                                                    height={20}
                                                    alt={"Show"} />
                                            </div>
                                        )}
                                        onClick={() => setShowAnswers(!showAnswers)} />
                                </div>
                                <div style={{'display': 'flex'}}>
                                    <Tooltip tooltipStyle={{'width': '200px'}} content={"Show answers after submit"}>
                                        <SyntheticButton
                                            value={ (
                                                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                                    Show Feedback
                                                    <FakeCheckbox
                                                        checkedOpacity="100%"
                                                        value={quizState.show_feedback ? true : false}
                                                        setValue={() => setQuizState({...quizState, 'show_feedback': !quizState.show_feedback})}
                                                        height={20}
                                                        alt={"Show"} />
                                                </div>
                                            ) } 
                                            onClick={() => setQuizState({...quizState, 'show_feedback': !quizState.show_feedback})}  />
                                    </Tooltip>
                                </div>
                            </>
                        ) : ""
                    }
                </div>
            ) : ""}
            <div className={styles.mainContainer}>
                <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '2rem', 'flex': '1'}}>
                    {canEdit && mode == 'edit' ? <QuizGrades questions={quizState.questions} answers={quizAnswerKey} manifestRow={manifestRow} /> : ""}
                    {quizDisplay}
                    {actionButton}
                </div>
                {
                    canEdit && mode == 'edit' ? (
                        <div className={styles.materialContainer}>
                            <div style={{'backgroundColor': 'var(--dark-primary)', 'padding': '10px', 'color': 'var(--light-text)', 'borderRadius': 'var(--medium-border-radius)'}}>
                                Related Material
                            </div>
                            <PanelSourceSelect manifestRow={manifestRow} canEdit={canEdit} selectionsLoadState={quizSourcesLoadingState} setSelectionsLoadState={setQuizSourcesLoadingState} selections={selections} setSelections={setSelections} onlyTemplates={DATA_TEMPLATES} />
                        </div>
                    ) : ""
                }
            </div>
        </div>
        
    )
}
