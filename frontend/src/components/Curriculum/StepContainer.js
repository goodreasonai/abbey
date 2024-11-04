import styles from './Curriculum.module.css'
import EditIcon from '../../../public/icons/EditIcon.png'
import MyImage from '../MyImage/MyImage'
import { useEffect, useState } from 'react'
import ControlledInputText from '../form/ControlledInputText'
import { Auth } from "@/auth/auth";
import SyntheticButton from '../form/SyntheticButton'
import FlagIcon from '../../../public/icons/FlagIcon.png'
import ArrowIcon from '../../../public/icons/ShareArrowIcon.png'
import CircleCheckIcon from '../../../public/icons/CircleCheckIcon.png'


export default function StepContainer({ canEdit, userValue, setUserValue, continueCourse, manifestRow, allTitles, step, stepsToReady, finalStepIndex, backCallback, nextCallback, children }){

    const [editingTitle, setEditingTitle] = useState(false)
    const [newTitle, setNewTitle] = useState(manifestRow['title'])
    
    const { getToken } = Auth.useAuth()

    async function editTitle(){

        const token = await getToken()
        let url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/inline-edit`;
        let data = {
            'title': newTitle,
            'author': manifestRow['author'],
            'id': manifestRow['id']
        }
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                body: JSON.stringify(data)
            });
            const myJson = await response.json(); //extract JSON from the http response
            if (myJson['response'] !== 'success'){
                throw new Error("Server returned failed: " + myJson['reason'])
            }
            else {
                setEditingTitle(false)
                document.getElementById("titleFromIndex").innerHTML = newTitle;
            }
        }
        catch (error) {
            console.error(error);
        }
    }

    let header = ""
    if (step < finalStepIndex){
        header = (
            <div style={{'display': 'flex', 'gap': '5px'}}>
                {allTitles.slice(0, allTitles.length - 1).map((title, i) => {
                    return (
                        <div style={i == step ? {} : {'opacity': '.5'}}>
                            {`${title}${i < allTitles.length - 2 ? ' > ' : ''}`}
                        </div>
                    )
                })}
            </div>
        )
    }
    else {
        header = allTitles[allTitles.length - 1]
    }

    let el = ""
    if (finalStepIndex == step){

        function startCourse(){
            setUserValue((prev) => {return {...prev, 'stage': 1}})
        }

        let startButton = ""
        if (userValue.stage){
            if (userValue.stage == 1){
                
                startButton = (
                    <SyntheticButton
                        className={styles.startButton}
                        value={(
                            <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                Continue
                                <MyImage src={ArrowIcon} width={17} height={17} alt={"Continue"} />
                            </div>
                        )}
                        onClick={() => continueCourse()} />
                )
            }
            else if (userValue.stage == 2){
                startButton = (
                    <SyntheticButton
                        className={styles.startButton}
                        value={(
                            <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                Completed
                                <MyImage src={CircleCheckIcon} width={17} height={17} alt={"Check"} />
                            </div>
                        )}
                        onClick={() => {alert("Congrats from the development team! We hope you enjoyed your course.")}} />
                )
            }
        }
        else {
            startButton = (
                <SyntheticButton
                    className={styles.startButton}
                    value={(
                        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                            Start 
                            <MyImage src={FlagIcon} width={17} height={17} alt={"Start"} />
                        </div>
                    )}
                    onClick={startCourse} />
            )
        }

        el = (
            <>
                <div className={styles.finalStepContainer}>
                    <div className={styles.finalStepContainerLeft}>
                        {header}
                    </div>
                    <div className={`${styles.finalStepContainerMiddle} ${canEdit ? '_clickable' : ''}`} onClick={() => canEdit && setEditingTitle(true)}>
                        {
                            editingTitle ? (
                                <ControlledInputText
                                    value={newTitle}
                                    setValue={setNewTitle}
                                    onKeyPress = {(e) => {
                                        if (e.key === 'Enter') {
                                            editTitle();
                                            e.preventDefault();  // Prevents the default form submission behavior
                                        }
                                    }}
                                    outsideClickCallback={() => editTitle()} />
                            ) : newTitle
                        }
                    </div>
                    <div className={styles.finalStepContainerRight}>
                        {startButton}
                        {
                            canEdit ? (
                                <div
                                    style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}
                                    onClick={backCallback}
                                    className='_clickable'>
                                    Back
                                    <MyImage src={EditIcon} height={20} width={20} alt={"Edit"} />
                                </div>
                            ) : ""
                        }
                    </div>
                </div>
            </>
        )
    }
    else {
        el = (
            <>
                <div style={{'flex': '1'}}>
                    {header}
                </div>
                {
                    step > 1 ? (
                        <div onClick={backCallback} className={styles.dirButton}>
                            Back
                        </div>
                    ) : ""
                }
                {
                    stepsToReady[step] ? (
                        <div onClick={nextCallback} className={styles.dirButton}>
                            Next
                        </div>
                    ) : ""
                }
            </>
        )
    }

    return (
        <div>
            <div className={styles.stepContainerHeader}>
                {el} 
            </div>
            {children}
        </div>
    )

}
