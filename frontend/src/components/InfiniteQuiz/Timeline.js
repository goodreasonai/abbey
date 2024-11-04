import { getMaxPoints } from './InfiniteQuiz'
import styles from './InfiniteQuiz.module.css'

export default function Timeline({quizState, setCurrIndex, roundLength=20}){

    const qsWithPlaceholders = []
    for (let i = 0; i < roundLength; i++){
        if (i < quizState.questions?.length){
            qsWithPlaceholders.push(quizState.questions[i])
        }
        else {
            qsWithPlaceholders.push({})
        }
    }

    return (
        <div className={styles.timeline}>
            {qsWithPlaceholders.map((item, i) => {
                let classString = `${styles.questionNumber}`
                let onClick = ()=>{}
                if (quizState.currIndex == i){
                    classString += ` ${styles.current}`
                }
                if (item.id){
                    onClick = ()=>{setCurrIndex(i)}
                    if (quizState.grades[item.id] !== undefined){
                        if (quizState.grades[item.id] >= getMaxPoints(item.type)){
                            classString += ` ${styles.correct}`
                        }
                        else if (quizState.grades[item.id]){
                            classString += ` ${styles.partialCredit}`
                        }
                        else {
                            classString += ` ${styles.incorrect}`
                        }
                    }
                }
                return (
                    <div key={i} className={classString} onClick={onClick}>
                        {i+1}
                    </div>
                )
            })}
        </div>
    )
}
