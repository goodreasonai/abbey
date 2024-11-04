import MyImage from "../MyImage/MyImage"
import DeleteIcon from '../../../public/icons/DeleteIcon.png'
import { getLetterFromIndex } from "@/utils/listing"
import ControlledInputText from "../form/ControlledInputText"
import styles from './Quiz.module.css'
import Loading from "../Loading/Loading"
import Tooltip from "../Tooltip/Tooltip"


export default function MCQResponse({ item, i, mode, editMode, resp, ri, quizState, setQuizState, quizAnswers, setQuizAnswers, amEditing, setAmEditing, showCorrectAnswerAs, showAnswerOnSubmit=false, onAnswer, allowExplanation, explainCallback, explanationIsLoading, ...props }) {

    const amSelected = quizAnswers[item.id] == getLetterFromIndex(ri)

    function deleteAnswer(){
        let oldQs = quizState.questions
        oldQs[i].data.responses.splice(ri, 1)
        setQuizState({...quizState, 'questions': oldQs})
    }

    function handleResponseClick(){
        if (mode == 'quiz'){
            if (!showCorrectAnswerAs){
                setQuizAnswers({...quizAnswers, [item.id]: getLetterFromIndex(ri)})
                if (onAnswer){
                    onAnswer(getLetterFromIndex(ri))
                }
            }
        }
    }

    let containerClass = ""
    let explainClickable = ""
    if (mode == 'quiz'){
        containerClass = `${showCorrectAnswerAs ? styles.mcqResponseContainerDud : styles.mcqResponseContainer}`
        if (showCorrectAnswerAs){
            if (showCorrectAnswerAs == getLetterFromIndex(ri)){
                containerClass += ` ${styles.mcqResponseContainerCorrect}`
                if (allowExplanation){
                    if (explanationIsLoading){
                        explainClickable = (<Loading size={12} text="" />)
                    }
                    else {
                        explainClickable = (
                            <Tooltip align="left" content={"Get Explanation"}>
                                <div className="_clickable" onClick={() => {explainCallback()}} style={{'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center', 'width': '1rem', 'height': '1rem', 'borderRadius': '50%', 'backgroundColor': 'var(--dark-primary)', 'color': 'var(--light-text)', 'fontSize': '.8rem'}}>
                                    ?
                                </div>
                            </Tooltip>
                        )
                    }
                }
            }
            else if (amSelected){
                containerClass += ` ${styles.mcqResponseContainerIncorrect}`
            }
        }
        else if (amSelected) {
            containerClass += ` ${styles.mcqResponseContainerSelected}`
        }
        
    }

    return (
        <div key={ri} style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}} className={containerClass} onClick={handleResponseClick}>
            <div className={mode == 'edit' ? `_clickable` : ``} onClick={() => {mode == 'edit' && setAmEditing({...amEditing, [item.id]: true})}}>
                {`${getLetterFromIndex(ri)}.`}
            </div>
            {
                editMode ? (
                    <div style={{'display': 'flex', 'gap': '5px', 'alignItems': 'center', 'flex': '1'}}>
                        <ControlledInputText
                            value={resp.text}
                            inputStyle={{'backgroundColor': 'var(--light-background)'}}
                            style={{'flex': '1'}}
                            setValue={(x) => {
                                setQuizState((prev) => {
                                    let oldQs = prev.questions
                                    oldQs[i].data.responses[ri] = {...oldQs[i].data.responses[ri], 'text': x}
                                    return {...prev, 'questions': oldQs}
                                })
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    setAmEditing({...amEditing, [item.id]: false})
                                }
                            }} />
                        <MyImage alt={"Delete"} width={20} height={20} src={DeleteIcon} className={"_clickable"} onClick={() => {deleteAnswer()}} />
                    </div>
                ) : (
                    <div className={mode == 'edit' ? "_clickable" : ''} onClick={() => {mode == 'edit' && setAmEditing({...amEditing, [item.id]: true})}}>
                        {explainClickable ? (
                            <div style={{'display': 'flex', 'gap': '10px'}}>
                                <div>
                                    {resp.text}
                                </div>
                                {explainClickable}
                            </div>
                        ) : (resp.text)}
                    </div>
                )
            }
        </div>
    )
}
