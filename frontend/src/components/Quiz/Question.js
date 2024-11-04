import { getLetterFromIndex } from "@/utils/listing"
import { useRef, useState, useEffect } from "react"
import Textarea from "../form/Textarea"
import MyImage from "../MyImage/MyImage"
import DeleteIcon from '../../../public/icons/DeleteIcon.png'
import Dropdown from "../Dropdown/Dropdown"
import ResponsiveTextarea from "../form/ResponsiveTextarea"
import Button from "../form/Button"
import ControlledInputText from "../form/ControlledInputText"
import MCQResponse from "./MCQResponse"
import SyntheticButton from "../form/SyntheticButton"
import AddIcon from '../../../public/icons/AddIcon.png'
import styles from './Quiz.module.css'
import CollapsibleMenu from "../CollapsibleMenu/CollapsibleMenu"
import LightbulbIcon from '../../../public/icons/LightbulbIcon.png'
import { Auth } from "@/auth/auth"
import Loading from "../Loading/Loading"
import MarkdownViewer from "../Markdown/MarkdownViewer"
import { handleGeneralStreaming } from "@/utils/streaming"
import LinkedSelectorItem from "../LinkedSelectorItem/LinkedSelectorItem"
import shortenText from "@/utils/text"
import Link from "next/link"


export const MCQ = "Multiple Choice"  // Also in backend (see str_constants)
export const SA = "Short Answer"

// To allow a get explanation, you need to set allowExplanation=true, include sources (full rows) as a key in item, and pass a manifest row.
export default function Question({ item, i, amEditing, setAmEditing, quizState, setQuizState, quizAnswers, setQuizAnswers, mode, showAnswers, setShowAnswers, quizAnswerKey, setQuizAnswerKey, showCorrectAnswerAs, onAnswer, autoFocus=false, allowExplanation=false, explanation="", setExplanation=()=>{}, matchingAssets=[], setMatchingAssets=()=>{}, explainClickedCallback=()=>{}, manifestRow=undefined, ...props }) {
    let editMode = amEditing && amEditing[item.id] && mode == 'edit'

    const [needNotHidden, setNeedNotHidden] = useState(false)
    const [explanationIsLoading, setExplanationIsLoading] = useState(false)
    const { getToken } = Auth.useAuth()
    const boxRef = useRef()


    async function getMatchingAssets(answer){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/quiz/matching-assets"
            const sources = item.sources || []
            const data = {
                'sources': sources,
                'answer': answer,
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
            setMatchingAssets(myJson['results'])
        }
        catch(e) {
            setExplanationIsLoading(false)
        }
    }

    async function getExplanation(){
        if (explanationIsLoading){
            return
        }
        explainClickedCallback()
        try {
            setExplanationIsLoading(true)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/quiz/explain"
            const sources = item.sources || []
            const data = {
                'id': manifestRow.id,
                'sources': sources,
                'question': item,
                'user_answer': quizAnswers[item.id],
                'correct_answer': showCorrectAnswerAs
            }
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'body': JSON.stringify(data),
                'method': 'POST'
            })
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let copiedResult = ""
            await handleGeneralStreaming({
                reader: reader,
                decoder: decoder,
                onSnippet: (result)=>{
                    setExplanation(result)
                    copiedResult = result
                }
            })
            setExplanationIsLoading(false)
            getMatchingAssets(copiedResult)
        }
        catch(e) {
            setExplanationIsLoading(false)
        }
    }

    let response = ""
    let editAnswer = ""
    if (item.type == MCQ){
        let canChoose = item.data.responses && item.data.responses.length
        let ansProps = {}
        if (!canChoose) {
            ansProps = {
                'className': '_clickable',
                'onClick': () => {setAmEditing({...amEditing, [item.id]: true})}
            }
        }
        editAnswer = amEditing ? (
            <div style={{'display': 'flex', 'gap': '5px', 'alignItems': 'center'}} {...ansProps}>
                <div>
                    Answer:
                </div>
                {canChoose ? (
                    <Dropdown
                        options={item.data.responses.map((resp, ri) => {
                            return {
                                'value': getLetterFromIndex(ri),
                                'onClick': () => setQuizAnswerKey({...quizAnswerKey, [item.id]: getLetterFromIndex(ri)})
                            }
                        })}
                        openCallback={() => {setNeedNotHidden(true)}}
                        closeCallback={() => {setNeedNotHidden(false)}}
                        value={quizAnswerKey[item.id] || "None"}  />
                ) : "None"}
                
            </div>
        ) : ""
        response = (
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                <div style={{'display': 'flex', 'gap': '10px', 'flexDirection': 'column'}}>
                    {item.data.responses.map((resp, ri) => {
                        return (
                            <MCQResponse
                                key={ri}
                                item={item}
                                i={i}
                                mode={mode}
                                resp={resp}
                                editMode={editMode}
                                amEditing={amEditing}
                                setAmEditing={setAmEditing}
                                onAnswer={onAnswer}
                                showCorrectAnswerAs={showCorrectAnswerAs}
                                ri={ri}
                                quizState={quizState} 
                                setQuizState={setQuizState}
                                quizAnswers={quizAnswers}
                                setQuizAnswers={setQuizAnswers}
                                allowExplanation={allowExplanation}
                                explainCallback={getExplanation}
                                explanationIsLoading={explanationIsLoading}
                            />
                        )
                    })}
                    {editMode ? (
                        <div>
                            <div style={{'display': 'flex', 'alignItems': 'center'}} onClick={() => {
                                let oldQs = quizState.questions
                                oldQs[i].data.responses = [...oldQs[i].data.responses, {'text': ''}]
                                setQuizState({...quizState, 'questions': oldQs})
                            }} className="_clickable">
                                <MyImage src={AddIcon} width={20} height={20} alt={"Add"} />
                            </div>
                        </div>
                    ) : ""}
                    {explanation ? (
                        <div className={styles.explanationContainer}>
                            <MarkdownViewer>
                                {explanation}
                            </MarkdownViewer>
                        </div>
                    ) : ""}
                    {matchingAssets ? (
                        <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'stretch'}}>
                            {matchingAssets.map((item) => {
                                return (
                                    <Link title={item.title} href={`/assets/${item.id}`} target="_blank" className={`${styles.matchingAsset} _touchableOpacity`} key={item.id}>
                                        {shortenText(item.title, 5, 100, true)}
                                    </Link>
                                )
                            })}
                        </div>
                    ) : ""}
                </div>
            </div>
        )
    }
    else if (item.type == SA){
        const hasAnswer = quizAnswerKey && quizAnswerKey[item.id]
        let ansProps = {}
        if (!hasAnswer && amEditing) {
            ansProps = {
                'onClick': () => {
                    setAmEditing({...amEditing, [item.id]: true})
                    setShowAnswers(true)
                },
                'className': '_clickable'
            }
        }
        editAnswer = amEditing ? (
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}} {...ansProps}>
                <div>
                    Answer key:
                </div>
                <ResponsiveTextarea
                    placeholder={"The answer should contain..."}
                    value={quizAnswerKey[item.id]}
                    onInput={(event) => setQuizAnswerKey({...quizAnswerKey, [item.id]: event.target.value})}
                />
            </div>
        ) : ""
        let taprops = mode == 'edit' ? {
            'value': ''
        } : {
            'value': quizAnswers[item.id],
            'onInput': (event) => setQuizAnswers((prev) => {prev[item.id] = event.target.value; return {...prev}}),
            'onKeyDown': (e) => {
                if (e.key === 'Enter' && onAnswer) {
                    onAnswer(e.target.value);
                    e.preventDefault()
                }
            }
        }
        response = (
            <div>
                <ResponsiveTextarea
                    placeholder={"Answer..."}
                    readOnly={mode == 'edit' || showCorrectAnswerAs}
                    autoFocus={autoFocus}
                    {...taprops} 
                />
                {showCorrectAnswerAs ? (
                    <CollapsibleMenu openByDefault={true} noHeader={true}>
                        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '.5rem', 'paddingTop': '1rem'}}>
                            <div style={{'display': 'flex', 'gap': '10px', 'justifyContent': 'space-between', 'alignItems': 'flex-start'}}>
                                <div className={styles.explanationContainer}>
                                    <div>
                                        {`Answer: ${showCorrectAnswerAs}`}
                                    </div>
                                </div>
                                <div style={{'display': 'flex'}}>
                                    <div className="_touchableOpacity" onClick={() => getExplanation()} style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px', 'fontSize': '.9rem'}}>
                                        <div>
                                            Explain
                                        </div>
                                        {explanationIsLoading ? (
                                            <Loading text="" />
                                        ) : (
                                            <MyImage src={LightbulbIcon} width={20} height={20} alt={"Lightbulb"} />
                                        )}
                                    </div>
                                </div>
                            </div>
                            {explanation ? (
                                <div className={styles.explanationContainer}>
                                    <MarkdownViewer>
                                        {explanation}
                                    </MarkdownViewer>
                                </div>
                            ) : ""}
                            {matchingAssets ? (
                                <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'stretch'}}>
                                    {matchingAssets.map((item) => {
                                        return (
                                            <Link title={item.title} href={`/assets/${item.id}`} target="_blank" className={`${styles.matchingAsset} _touchableOpacity`} key={item.id}>
                                                {shortenText(item.title, 5, 100, true)}
                                            </Link>
                                        )
                                    })}
                                </div>
                            ) : ""}
                        </div>
                    </CollapsibleMenu>
                ) : ""}
            </div>
        )
    }

    const handleClickOutside = (event) => {
        if (boxRef.current && !boxRef.current.contains(event.target) && item.text) {
            if (setAmEditing){
                setAmEditing(prevEditMode => {
                    const newEditMode = {...prevEditMode, [item.id]: false};
                    return newEditMode;
                });
            }
        }
    };

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
    
        // Cleanup: remove the event listener on unmount
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (item && !item.text && mode == 'edit'){
            setAmEditing({...amEditing, [item.id]: true})
        }
    }, [item.text, mode])

    function deleteQuestion(){
        let newQs = [...quizState.questions]
        newQs.splice(i, 1)
        setQuizState({...quizState, 'questions': newQs})
    }

    return (
        <div key={i} ref={boxRef} className={styles.questionContainer} {...props}>
            <CollapsibleMenu openByDefault={true} noHeader={true} transitionSpeed=".1s"
                bodyContainerStyle={needNotHidden ? {'overflow': 'visible'} : {} }>
                <div style={{'display': 'flex', 'alignItems': 'center', 'color': 'var(--dark-text)', 'gap': '10px'}}>
                    <div style={{'borderTopLeftRadius': 'var(--medium-border-radius)', 'borderTopRightRadius': 'var(--medium-border-radius)', 'display': 'flex', 'flex': '1', 'backgroundColor': 'var(--dark-primary)', 'color': 'var(--light-text)', 'padding': '10px', 'gap': '10px', 'alignItems': 'center'}}>
                        <div style={mode != 'edit' ? {'flex': '1'} : {}}>
                            {`Question ${i+1}.`}
                        </div>
                        { mode == 'edit' ? (
                            <div style={{'display': 'flex', 'flex': '1'}}>
                                <Dropdown value={item.type} options={[
                                    {'value': MCQ, 'onClick': () => {
                                        setAmEditing({...amEditing, [item.id]: true})
                                        setQuizState((prev) => {
                                            let oldQs = prev.questions
                                            oldQs[i].type = MCQ
                                            oldQs[i].data = {'responses': []}
                                            setQuizAnswerKey({...quizAnswerKey, [item.id]: ''})
                                            return {...prev, 'questions': oldQs}
                                        })
                                    }},
                                    {'value': SA, 'onClick': () => {
                                        setAmEditing({...amEditing, [item.id]: true})
                                        setQuizState((prev) => {
                                            let oldQs = prev.questions
                                            oldQs[i].type = SA
                                            oldQs[i].data = {}
                                            setQuizAnswerKey({...quizAnswerKey, [item.id]: ''})
                                            return {...prev, 'questions': oldQs}
                                        })
                                    }}
                                ]} />
                            </div>
                        ) : "" }
                        {
                            mode == 'edit' ? (
                                <div style={{'display': 'flex', 'alignItems': 'center'}}>
                                    <MyImage alt={"Delete"} width={20} height={20} src={DeleteIcon} className={"_clickable"} onClick={() => {deleteQuestion()}} />
                                </div>
                            ) : ""
                        }
                        <div>
                            {
                                amEditing && amEditing[item.id] ? (
                                    <ControlledInputText
                                        value={item.points}
                                        setValue={(x) => {
                                            setQuizState((prev) => {
                                                let oldQs = prev.questions
                                                oldQs[i].points = x
                                                return {...prev, 'questions': oldQs}
                                            })
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                setAmEditing({...amEditing, [item.id]: false})
                                            }
                                        }} />
                                ) : (
                                    <div className={mode == 'edit' ? "_clickable" : ""} onClick={() => {mode == 'edit' && setAmEditing({...amEditing, [item.id]: true})}}>
                                        {`${item.points} ${item.points == 1 ? 'pt' : 'pts'}`}
                                    </div>
                                )
                            }
                        </div>
                    </div>
                </div>
                <div style={{'borderBottomLeftRadius': 'var(--medium-border-radius)', 'borderBottomRightRadius': 'var(--medium-border-radius)', 'border': '1px solid var(--light-border)', 'borderTopWidth': '.5px /* to make the question container height an integer so Collapsible doesnt cut off any of it */', 'display': 'flex', 'flexDirection': 'column', 'gap': '1rem', 'padding': '1rem', 'fontFamily': 'var(--font-body)', 'backgroundColor': 'var(--light-primary)'}}>
                    <div>
                        {
                            !editMode ? (
                                <div
                                    className={mode == 'edit' ? `_clickable` : ''}
                                    onClick={() => {mode == 'edit' && setAmEditing({...amEditing, [item.id]: true})}}
                                    style={{'paddingBottom': '1rem', 'borderBottom': '2px solid rgba(1, 1, 1, .1)', 'fontSize': '1.05rem'}}
                                    >
                                    {item.text}
                                </div>
                            ) : (
                                <div>
                                    <Textarea value={item.text} setValue={(x) => {
                                            setQuizState((prev) => {
                                                let oldQs = prev.questions
                                                oldQs[i].text = x
                                                return {...prev, 'questions': oldQs}
                                            })
                                        }}
                                        placeholder={"Enter question..."}
                                        style={{'backgroundColor': 'var(--light-background)', 'height': '4rem'}} />
                                </div>
                            )
                        }
                    </div>
                    <div>
                        {response}
                    </div>
                    {
                        (mode == 'edit' && (showAnswers || !quizAnswerKey[item.id])) ? editAnswer : ""
                    }
                </div>
            </CollapsibleMenu>
        </div>
    )
}
