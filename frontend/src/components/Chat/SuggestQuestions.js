import styles from './SuggestQuestions.module.css'
import AskIcon from '../../../public/icons/AskIcon.png'
import MyImage from "../MyImage/MyImage"
import { getDefaultRoundState } from './Chat'


export default function SuggestQuestions({questions, roundStates, setRoundStates, scrollToBottom, ...props}) {

    function submitQuestion(text) {
        setRoundStates((prev) => {
            let newState = {...getDefaultRoundState(), 'user': text, 'autoAsk': true}
            
            let lastIndex = prev.length - 1
            // Don't want to add to already fresh state
            if (prev.length > 0){
                if (!prev[lastIndex].user){
                    lastIndex -= 1
                }
            }
            // make new states variable list of states including previous up to lastIndex plus newState
            let newStates = [...prev.slice(0, lastIndex + 1), newState];

            return newStates
        })
        scrollToBottom()
    }

    function makeQuestion(item, i) {
        return (
            <div key={i} style={{'display': 'flex'}}>
                <div className={`${styles.question} _clickable`} onClick={() => submitQuestion(item)}>
                    <MyImage src={AskIcon} width={20} height={20} alt={"Ask"} />
                    <div>
                        {item}
                    </div>
                </div>
            </div>
        )
    }

    if (!questions || !questions.length){
        return ""
    }
    
    return (
        <div className={styles.container} {...props}>
            {questions.map(makeQuestion)}
        </div>
    )
}
