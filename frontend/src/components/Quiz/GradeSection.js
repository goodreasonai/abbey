import { useState } from "react"
import { formatTimestampDefault } from "@/utils/time"
import styles from './Quiz.module.css'

export default function GradeSection({ grade, answers, questions, ...props }) {

    const [expanded, setExpanded] = useState(false)
    const val = JSON.parse(grade['value'])

    const timestr = formatTimestampDefault(grade['time_uploaded'])

    const thisGrade = parseInt(val['total_points'])
    const available = parseInt(val['available_points'])
    const percentage = (100 * thisGrade / available).toFixed(1)
    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}} {...props}>
            <div style={{'display': 'flex', 'flex': '1', 'flexWrap': 'wrap', 'gap': '10px'}}>
                <div className={styles.gradeText} onClick={() => setExpanded(!expanded)}>
                    {`${thisGrade}/${available} (${percentage}%)`}
                </div>
                <div style={{'flex': '1', 'textAlign': 'right'}}>
                    {timestr}
                </div>
            </div>
            {
                expanded ? (
                    questions.map((item, i) => {
                        const ptsAvailable = val.q_by_q[item.id].total
                        const ptsScored = val.q_by_q[item.id].points
                        const userAnswer = val.user_answers[item.id]
                        return (
                            <div key={item.id} style={{'display': 'flex', 'flexWrap': 'wrap', 'gap': '10px'}}>
                                <div>
                                    {`${i+1}.`}
                                </div>
                                <div style={{'flex': '1', 'color': (ptsScored == ptsAvailable ? 'green' : (ptsScored > 0 ? 'orange' : 'var(--logo-red)'))}}>
                                    {`${userAnswer} ${ptsAvailable > ptsScored ? `(${answers[item.id]})` : ""}`}
                                </div>
                                <div>
                                    {`${ptsScored}/${ptsAvailable}`}
                                </div>
                            </div>
                        )
                    })
                ) : ""
            }
        </div>
    )
}
