import { toPercentage } from "@/utils/text"
import Hr from "../Hr/Hr"
import { getMaxPoints } from "./InfiniteQuiz"
import Button from "../form/Button"
import SyntheticButton from "../form/SyntheticButton"
import MyImage from "../MyImage/MyImage"
import SpeedUpIcon from '../../../public/icons/SpeedUpIcon.png'
import SlowDownIcon from '../../../public/icons/SlowDownIcon.png'
import styles from './InfiniteQuiz.module.css'


export function getArchive(quizState){
    let points = 0
    let maxPoints = 0
    let num = 0
    let pointsByType = {}
    for (let q of quizState.questions){
        const qMax = getMaxPoints(q.type)
        let qPoints = quizState.grades[q.id]
        if (qPoints === undefined){
            continue
        }
        qPoints = Math.min(qMax, qPoints)
        maxPoints += qMax
        points += qPoints
        num += 1
        if (!pointsByType[q.type]) {
            pointsByType[q.type] = {'points': qPoints, 'maxPoints': qMax, 'num': 1}
        }
        else {
            pointsByType[q.type].points += qPoints
            pointsByType[q.type].maxPoints += qMax
            pointsByType[q.type].num += 1
        }
    }
    return {
        'points': points,
        'maxPoints': maxPoints,
        'num': num,
        'byType': pointsByType
    }
}


export default function RoundModal({ quizState, onNextRound, onStay }) {
    const archive = getArchive(quizState)

    const totalScore = toPercentage(archive['points'], archive['maxPoints'])
    
    function getTotalScoreStyle(score){
        let totalScoreStyle = {}
        if (score > 90){
            totalScoreStyle['color'] = 'green'  // green instead of dark primary due to the brightness against the background in dark mode
        }
        else if (score < 70){
            totalScoreStyle['color'] = 'var(--logo-red)'
        }
        return totalScoreStyle
    }

    const totalScoreStyle = getTotalScoreStyle(totalScore)

    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
            <div className={styles.table}>
                <div className={`${styles.row} ${styles.rowTotal}`} style={{'borderWidth': '0px'}}>
                    <div className={styles.columnTitle}>
                        Total Score
                    </div>
                    <div className={styles.columnValue} style={totalScoreStyle}>
                        {`${totalScore}%`}
                    </div>
                </div>
                {Object.keys(archive['byType']).map((item, i) => {
                    let obj = archive['byType'][item]
                    let score = toPercentage(obj.points, obj.maxPoints)
                    let typeMax = getMaxPoints(item)
                    return (
                        <div className={styles.row}>
                            <div className={styles.columnTitle}>
                                {`${item} (${typeMax} ${typeMax > 1 ? 'pts' : 'pt'})`}
                            </div>
                            <div className={styles.columnNum}>
                                {`${obj.points}/${obj.maxPoints}`}
                            </div>
                            <div className={styles.columnValue}>
                                <div>
                                    {`${score}%`}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
            {
                quizState?.archive?.length ? (
                    <div style={{'display': 'flex', 'gap': '10px', 'flexWrap': 'wrap', 'color': 'var(--passive-text)', 'backgroundColor': 'var(--light-primary)', 'border': '1px solid var(--light-border)', 'padding': '5px', 'fontSize': '.9rem', 'borderRadius': 'var(--medium-border-radius)'}}>
                        <div>
                            Rounds:
                        </div>
                        {quizState.archive.map((item) => {
                            const totalScore = toPercentage(item['points'], item['maxPoints'])
                            const tsStyle = getTotalScoreStyle(totalScore)
                            return (
                                <div style={tsStyle}>
                                    {`${totalScore}%`}
                                </div>
                            )
                        })}
                    </div>
                ) : ""
            }
            <div style={{'display': 'flex', 'gap': '10px', 'justifyContent': 'space-between'}}>
                <SyntheticButton value={(
                    <div style={{'display': 'flex', 'justifyContent': 'space-between', 'gap': '10px', 'alignItems': 'center'}}>
                        <MyImage src={SlowDownIcon} alt={"Back"} width={20} height={20} />
                        <div>
                            Review
                        </div>
                    </div>
                )} onClick={() => onStay()} />
                <SyntheticButton value={(
                    <div style={{'display': 'flex', 'justifyContent': 'space-between', 'gap': '10px', 'alignItems': 'center'}}>
                        <div>
                            Next Round
                        </div>
                        <MyImage src={SpeedUpIcon} alt={"Next"} width={20} height={20} />
                    </div>
                )} onClick={() => onNextRound()} />
            </div>
        </div>
    )
}
