import styles from './Classroom.module.css';
import { formatTimestampSmall } from "@/utils/time";
import MyImage from "../MyImage/MyImage";
import CircleCheckIcon from '../../../public/icons/CircleCheckIcon.png'
import { useState } from "react";
import Link from "next/link";


export default function Student({ item, processedStudentActivity, assignmentInfo, dueDates, ...props }) {
    
    const [showMoreActivities, setShowMoreActivities] = useState(false)
    const MAX_SHOWN_ACTIVITIES = 7

    let byAsset = {}
    if (processedStudentActivity[item.id]){
        byAsset = processedStudentActivity[item.id]
    }

    function makeAssetActivity(assetId, activityList, i) {
        const assignment = assignmentInfo[assetId]
        if (!assignment || !activityList){
            return <></>
        }

        const activities = [
            {'type': 'view', 'text': 'Viewed', 'getTime': (items) => {
                return formatTimestampSmall(items[0].timestamp)
            }, 'items': [], 'icon': CircleCheckIcon},
            {'type': 'chat', 'text': 'Chatted', 'getTime': false, 'items': [], 'icon': CircleCheckIcon},
            {'type': 'quiz_grade', 'text': (items) => {
                const lastGrade = JSON.parse(items[0].metadata)
                let thisGrade = parseInt(lastGrade['total_points'])
                let available = parseInt(lastGrade['available_points'])
                let percentage = (100 * thisGrade / available).toFixed(1)
                let quizGrade = `${thisGrade}/${available} (${percentage}%)`
                return quizGrade
            }, 'getTime': false, 'items': [], 'icon': undefined},
            {'type': 'curr_start', 'text': 'Started', 'getTime': false, 'items': [], 'icon': CircleCheckIcon},
            {'type': 'curr_complete', 'text': 'Completed', 'getTime': false, 'items': [], 'icon': CircleCheckIcon},
        ]
        for (let entry of activityList){
            for (let i = 0; i < activities.length; i++){
                if (entry.type == activities[i].type){
                    activities[i].items.push(entry)
                }
            }
        }

        function makeBlurb(item, i) {
            if (!item.items.length){
                return <></>
            }
            return (
                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                    <div>
                        {typeof item.text === 'function' ? item.text(item.items) : item.text}
                    </div>
                    {
                        item.icon ? (
                            <MyImage src={item.icon} width={15} height={15} alt={"Check"} />
                        ) : ""
                    }
                    {item.getTime ? (
                        <div>
                            {`(${item.getTime(item.items)})`}
                        </div>
                    ) : ""}
                </div>
            )
        }

        return (
            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                <div style={{'flex': '1'}}>
                    <Link href={`/assets/${assignment.id}`}>{assignment.title}</Link> 
                </div>
                <div style={{'display': 'flex', 'alignItems': 'center', 'flex': '4', 'fontSize': '.9rem', 'gap': '10px'}}>
                    {activities.map(makeBlurb)}
                </div>
            </div>
        )
    }

    let shownActivities = Object.keys(byAsset).sort((a, b) => {
        
        if (!dueDates[a] && !dueDates[b]){
            return 0
        }
        else if (!dueDates[a]){
            return -1
        }
        else if (!dueDates[b]){
            return 1
        }

        let datetime_string1 = new Date(dueDates[a]);
        let datetime_string2 = new Date(dueDates[b]);
        // If both dates are the same, return 0
        if(datetime_string1.getTime() === datetime_string2.getTime()) {
          return 0;
        }
        // If datetime_string1 is later than datetime_string2, return -1 (so 'a' comes first)
        if(datetime_string1 > datetime_string2) {
          return -1;
        }
        // If datetime_string1 is earlier than datetime_string2, return 1 (so 'b' comes first)
        return 1;
    })

    let seeMore = ""
    if (shownActivities.length > MAX_SHOWN_ACTIVITIES){
        seeMore = (
            <div style={{'display': 'flex'}}>
                <div className={`${styles.seeMoreActivities} _clickable`} onClick={() => setShowMoreActivities(!showMoreActivities)}>
                    {`See ${showMoreActivities ? 'less' : 'more'}`}
                </div>
            </div>
        )
    }

    if (!showMoreActivities && shownActivities.length > MAX_SHOWN_ACTIVITIES){
        shownActivities = shownActivities.slice(0, MAX_SHOWN_ACTIVITIES)
    }
    
    const activityElement = Object.keys(byAsset).length ? (
        <div className={styles.activities}>
            { shownActivities.map((assetId, k) => {return makeAssetActivity(assetId, byAsset[assetId], k)}) }
        </div>
    ) : (
        <div className={styles.activities}>
            No activity found.
        </div>
    )
    return (
        <div {...props}>
            <div className={styles.studentHeader}>
                {
                    (item.first_name && item.last_name) ? `${item.first_name} ${item.last_name}` : item.email_address
                }
                {
                    item.cross_auth_state == 0 ? (<span style={{'filter': 'opacity(70%)'}}> (request to join is pending)</span>) : ""
                }
            </div>
            <div>
                {activityElement}
            </div>
            {seeMore}
        </div>
    )
}
