import { Auth } from "@/auth/auth";
import { useState, useEffect } from 'react'
import Button from '../form/Button'
import Textarea from '../form/Textarea'
import MarkdownViewer from '../Markdown/MarkdownViewer'
import styles from './Curriculum.module.css'
import { handleGeneralStreaming } from '@/utils/streaming'
import Loading from '../Loading/Loading'
import SyntheticButton from '../form/SyntheticButton'
import MyImage from '../MyImage/MyImage'
import BrainIcon from '../../../public/icons/BrainIcon.png'
import CircleCheckIcon from '../../../public/icons/CircleCheckIcon.png'
import EditIcon from '../../../public/icons/EditIcon.png'
import ControlledInputText from '../form/ControlledInputText'
import Dropdown from '../Dropdown/Dropdown'



export default function BrainstormStep({ manifestRow, brainstormResponse, setBrainstormResponse, brainstormChatRounds, setBrainstormChatRounds, nextCallback }) {

    const [loadingRound, setLoadingRound] = useState(undefined)

    const [level, setLevel] = useState("General Interest")
    const [length, setLength] = useState("3 sections")
    const [background, setBackground] = useState("")

    const { getToken } = Auth.useAuth()

    async function getResponse(roundIndex) {
        if (loadingRound == roundIndex){
            return
        }
        try {
            setLoadingRound(roundIndex)
            setBrainstormResponse({...brainstormResponse, 'ai': ''})

            let context = brainstormChatRounds.filter((_, i) => i < roundIndex)

            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/curriculum/brainstorm"
            const data = {
                'user': brainstormChatRounds[roundIndex].user,
                'id': manifestRow['id'],
                'context': context,
                'level': level,
                'length': length,
                'background': background
            }
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'body': JSON.stringify(data),
                'method': 'POST'
            })

            if (!response.ok){
                throw Error("Response was not OK")
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            
            let thisResponse = ""
            await handleGeneralStreaming({
                reader: reader,
                decoder: decoder,
                onSnippet: (result)=>{
                    setLoadingRound(undefined)
                    let newRounds = [...brainstormChatRounds]
                    brainstormChatRounds[roundIndex].ai = result
                    setBrainstormChatRounds(newRounds)
                    thisResponse = result
                }
            })

            setBrainstormResponse({...brainstormResponse, 'ai': thisResponse})
        }
        catch(e) {
            console.log(e)
        }

    }


    function makeRound(item, i) {

        function handleUserEntry(x) {
            let newRounds = [...brainstormChatRounds]
            newRounds[i].user = x;
            setBrainstormChatRounds(newRounds)
            
            // This is an interesting choice. I think it'll work.
            if (i == 0){
                setBrainstormResponse({...brainstormResponse, 'user': x})
            }
        }

        let textPlaceholder = i == 0 ? "I want to learn about..." : "It should be a bit more..."

        return (
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '10px'}} key={i}>
                <div style={{'flex': '1', 'display': 'flex', 'alignItems': 'stretch', 'flexDirection': 'column'}}>
                    <Textarea
                        value={item.user}
                        setValue={handleUserEntry}
                        placeholder={textPlaceholder}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                getResponse(i);
                                e.preventDefault()
                            }
                        }}
                        style={{'fontFamily': 'var(--font-body)', 'border': '1px solid var(--light-border)', 'borderTopLeftRadius': 'var(--medium-border-radius)', 'borderTopRightRadius': 'var(--medium-border-radius)'}} />
                    <div onClick={() => getResponse(i)} className={`${styles.brainstormButton} _clickable`}>
                        Make Course
                        <MyImage src={BrainIcon} width={20} height={20} alt={"Brain"} />
                    </div>
                </div>
                <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '10px', 'flex': '2', 'backgroundColor': 'var(--light-primary)', 'padding': '1rem', 'border': '1px solid var(--light-border)', 'borderRadius': 'var(--medium-border-radius)'}}>
                    <div style={{'color': 'var(--passive-text)'}}>
                        AI Course Outline:
                    </div>
                    {
                        loadingRound == i || item.ai ? (
                            <div>
                                {
                                    loadingRound == i ? (
                                        <Loading />
                                    ) : (
                                        <div>
                                            <MarkdownViewer>
                                                {item.ai}
                                            </MarkdownViewer>
                                        </div>
                                    )
                                }
                            </div>
                        ) : ""
                    }
                    
                </div>
            </div>
        )
    }

    let proceedButtons = ""
    if (brainstormResponse.ai && brainstormChatRounds && brainstormChatRounds[brainstormChatRounds.length - 1].ai){
        proceedButtons = (
            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                <SyntheticButton value={(
                    <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                        Looks good
                        <MyImage src={CircleCheckIcon} width={20} height={20} alt={"Circle"} />
                    </div>
                )} onClick={nextCallback} />
                <SyntheticButton value={(
                    <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                        Let me refine
                        <MyImage src={EditIcon} width={20} height={20} alt={"Circle"} />
                    </div>
                )} onClick={() => setBrainstormChatRounds([...brainstormChatRounds, {'user': '', 'ai': ''}])} />
            </div>
        )
    }

    const lengthToReadable = {
        '3 sections': "Default",
        '1-2 sections': "1-2 Sections",
        '3-4 sections': '3-4 Sections',
        'a semester or year-long': "Semester or Year-Long"
    }

    return (
        <div className={styles.stepContainer}>
            <div className={styles.brainstormContainer}>
                <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem', 'flex': '2'}}>
                    <div>
                        What do you want to learn about?
                    </div>
                    <div>
                        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1.5rem'}}>
                            {brainstormChatRounds && brainstormChatRounds.map(makeRound)}
                        </div>
                    </div>
                    <div>
                        {
                            brainstormResponse && brainstormResponse.ai ? (
                                proceedButtons
                            ) : ""
                        }
                    </div>
                </div>
                <div style={{'flex': '1'}}>
                    <div className={styles.brainstormSidePanel}>
                        <div style={{'color': 'var(--passive-text)'}}>
                            In this step, you can chat with AI to get an outline of your course. Below are some additional ways to tune its response.
                        </div>
                        <div style={{'color': 'var(--passive-text)', 'fontFamily': 'var(--font-header)'}}>
                            Other Options
                        </div>
                        <div className={styles.otherOptionContainer}>
                            <div className={styles.otherOptionLabel}>
                                Level:
                            </div>
                            <div>
                                <Dropdown
                                    value={level}
                                    initialButtonStyle={{'padding': '5px', 'fontSize': '.9rem'}}
                                    optionsStyle={{'padding': '5px', 'fontSize': '.9rem'}}
                                    options={[
                                        {'value': 'General Interest', 'onClick': ()=>{setLevel('General Interest')}},
                                        {'value': 'Elementary School', 'onClick': ()=>{setLevel('Elementary School')}},
                                        {'value': 'High School', 'onClick': ()=>{setLevel('High School')}},
                                        {'value': 'Undergraduate', 'onClick': ()=>{setLevel('Undergraduate')}},
                                        {'value': 'Graduate', 'onClick': ()=>{setLevel('Graduate')}},
                                        {'value': 'Professional', 'onClick': ()=>{setLevel('Professional')}},
                                    ]} />
                            </div>
                        </div>
                        <div className={styles.otherOptionContainer}>
                            <div className={styles.otherOptionLabel}>
                                Target Length:
                            </div>
                            <div>
                                <Dropdown
                                    value={lengthToReadable[length]}
                                    initialButtonStyle={{'padding': '5px', 'fontSize': '.9rem'}}
                                    optionsStyle={{'padding': '5px', 'fontSize': '.9rem'}}
                                    options={Object.keys(lengthToReadable).map((item) => {
                                        return {'value': lengthToReadable[item], 'onClick': () => {setLength(item)}}
                                    })} />
                            </div>
                        </div>
                        <div className={styles.otherOptionContainer} style={{'flexDirection': 'column', 'alignItems': 'flex-start'}}>
                            <div style={{'width': '100%'}}>
                                <Textarea
                                    value={background}
                                    setValue={setBackground}
                                    rows="3"
                                    style={{'height': 'unset', 'flex': '1', 'backgroundColor': 'var(--light-background)'}}
                                    placeholder={"I have a background in..."}  />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )

}
