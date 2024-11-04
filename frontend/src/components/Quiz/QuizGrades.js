import { useEffect, useState } from "react";
import CollapsibleMenu from "../CollapsibleMenu/CollapsibleMenu";
import Loading from "../Loading/Loading";
import { Auth } from "@/auth/auth";
import { formatTimestampDefault } from "@/utils/time";
import GradeSection from "./GradeSection";


export default function QuizGrades({ manifestRow, questions, answers }){

    const { getToken } = Auth.useAuth()
    const [grades, setGrades] = useState([])
    const [gradesLoadingState, setGradesLoadingState] = useState(0)

    async function getGrades(){
        try {
            setGradesLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/quiz/grades?id=${manifestRow['id']}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken()
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            setGrades(myJson['results'])
            setGradesLoadingState(2)
        }
        catch(e) {
            console.log(e)
            setGradesLoadingState(3)
        }
    }

    useEffect(() => {
        getGrades()
    }, [manifestRow])

    function makeGrade(item, i){

        function makeScore(grade) {
            return (<GradeSection grade={grade} questions={questions} answers={answers} key={item.id} />)
        }
        
        return (
            <div style={{...{'borderRadius': 'var(--medium-border-radius)', 'padding': '10px', 'display': 'flex', 'flexDirection': 'column', 'gap': '.5rem', 'border': '1px solid var(--light-border)'}, ...(i != 0 ? {'borderTopWidth': '0px'} : {}), ...(i % 2 ? {'backgroundColor': 'var(--light-primary'} : {'backgroundColor': 'var(--light-background'})}}>
                <div style={{'flex': '1'}}>
                    {item.first_name && item.last_name ? `${item.first_name} ${item.last_name}` : item.email}
                </div>
                <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '.5rem', 'color': 'var(--passive-text)'}}>
                    {item.grades.map(makeScore)}
                </div>
            </div>
        )
    }

    let gradesDisplay = ""
    if (gradesLoadingState == 1){
        gradesDisplay = (<Loading />)
    }
    else if (gradesLoadingState == 2){
        if (grades.length == 0){
            gradesDisplay = "No grades yet"
        }
        else {
            gradesDisplay = grades.map(makeGrade)
        }
    }
    else if (gradesLoadingState == 3){
        gradesDisplay = "Error"
    }

    return (
        <div>
            <CollapsibleMenu header={"See Grades"}>
                {gradesDisplay}
            </CollapsibleMenu>
        </div>
    )
}
