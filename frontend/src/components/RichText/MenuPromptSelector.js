import { Auth } from "@/auth/auth"
import { useCallback, useEffect, useRef, useState } from "react"
import LoadingSkeleton from "../Loading/LoadingSkeleton"
import Textarea from "../form/Textarea"
import shortenText from "@/utils/text"
import SyntheticButton from "../form/SyntheticButton"
import MyImage from "../MyImage/MyImage"
import SaveIcon from '../../../public/icons/SaveIcon.png'
import Tooltip from "../Tooltip/Tooltip"
import DeleteIcon from '../../../public/icons/DeleteIcon.png'
import { getRandomId } from "@/utils/rand"
import useSaveDataEffect from "@/utils/useSaveDataEffect"
import Saving from "../Saving/Saving"
import ControlledInputText from "../form/ControlledInputText"


// if selectedPrompt is undefined, the default prompt (gotten from the backend) will appear as chosen
export default function MenuPromptSelector({ selectedPrompt, setSelectedPrompt }) {
    
    const [promptsLoadState, setPromptsLoadState] = useState(0)
    const [userPrompts, setUserPrompts] = useState([])
    const [defaultPrompts, setDefaultPrompts] = useState([])
    const [userPromptsSaveState, setUserPromptsSaveState] = useState(0)
    const selectedPromptId = useRef(selectedPrompt?.id)

    const { getToken } = Auth.useAuth()
    async function getPrompts(){
        try {
            setPromptsLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/text-editor/prompts'
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken()
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            const defs = myJson['default_prompts'].map((item) => createPrompt(item))
            setDefaultPrompts([...defs])
            if (!selectedPrompt){
                selectPrompt(defs[0])
            }
            setUserPrompts(myJson['user_prompts'])
            setPromptsLoadState(2)
        }
        catch(e) {
            setPromptsLoadState(3)
            console.log(e)
        }
    }

    useEffect(() => {
        getPrompts()
    }, [setPromptsLoadState])

    function makePrompt(item, i) {
        const isSelected = (i == 0 && !selectedPrompt) || (item.id == selectedPrompt.id)
        const totalText = `${item.preamble} | ${item.conclusion}`
        
        function onDeleteClick(e) {
            e.stopPropagation()
            if (selectedPrompt.id == item.id){
                selectedPromptId.current = defaultPrompts[0].id
                setSelectedPrompt({...defaultPrompts[0]})
            }
            setUserPrompts((prev) => prev.filter((_, k) => k != i-defaultPrompts.length))
        }
        function selectPrompt(){
            selectedPromptId.current = item.id
            setSelectedPrompt(item)
        }
        return (
            <div
                className="_clickable"
                style={{
                    'display': 'flex',
                    'flexDirection': 'column',
                    'width': 'calc(33% - 7px)',
                    'backgroundColor': 'var(--light-primary',
                    ...(isSelected ? {'border': '3px solid var(--dark-primary)'} : {'border': '1px solid var(--light-border)'})
                }}
                key={item.id}
                onClick={() => selectPrompt()}
            >
                <div>
                    <ControlledInputText
                        readOnly={i < defaultPrompts.length}
                        inputStyle={{...(i < defaultPrompts.length ? {'cursor': 'default', 'pointerEvents': 'none'} : {}), 'fontSize': '.8rem', 'color': 'var(--passive-text)', 'padding': '5px'}}
                        value={item.name}
                        setValue={(newVal) => setUserPrompts((prev) => prev.map(((x) => x.id == item.id ? {...x, 'name': newVal} : x)))}
                    />
                </div>
                <div
                    title={totalText}
                    style={{'display': 'flex', 'gap': '5px', 'padding': '10px'}}
                >
                    
                    {
                        i >= defaultPrompts.length ? (
                            <div>
                                <MyImage onClick={onDeleteClick} src={DeleteIcon} width={20} height={20} alt={"Delete"} />
                            </div>
                        ) : ""
                    }
                    <div className={`_clamped2`}>
                        {item.preamble}
                    </div>
                </div>
            </div>
        )
    }

    function selectPrompt(newPrompt){
        selectedPromptId.current = newPrompt.id
        setSelectedPrompt(newPrompt)
    }

    function createPrompt({preamble='', conclusion='', name='Untitled'}={}){
        let newPrompt = {
            'preamble': preamble,
            'conclusion': conclusion,
            'name': name,
            'id': getRandomId(10)
        }
        setUserPrompts([...userPrompts, newPrompt])
        return newPrompt
    }

    const saveUserPrompts = useCallback(async (ups) => {
        try {
            setUserPromptsSaveState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/text-editor/set-prompts'
            const data = {
                'prompts': ups
            }
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'POST',
                'body': JSON.stringify(data)
            })
            const myJson = await response.json()
            setUserPromptsSaveState(2)
        }
        catch(e) {
            setUserPromptsSaveState(3)
        }
    }, [setUserPromptsSaveState])
    useSaveDataEffect(userPrompts, promptsLoadState == 2, saveUserPrompts, 200)

    function changePrompt(type, val){
        if (selectedPromptId.current == undefined || defaultPrompts.filter((x) => x.id == selectedPromptId.current).length){
            let newPrompt = createPrompt({...selectedPrompt, 'name': 'Untitled', [type]: val})
            selectPrompt(newPrompt)
        }
        else {
            setUserPrompts((up) => {
                return up.map((x) => x.id == selectedPromptId.current ? {...x, [type]: val} : x)
            })
            setSelectedPrompt((prev) => {
                return {...prev, [type]: val}
            })
        }
    }

    if (promptsLoadState < 2){
        return (
            <LoadingSkeleton numResults={5} />
        )
    }
    if (promptsLoadState == 3){
        return "Error"
    }
    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem', 'fontFamily': 'var(--font-body)'}}>
            <div style={{'color': 'var(--passive-text)', 'fontStyle': 'italic'}}>
                This is the system prompt for the LLM that dictates the functionality of the "AI" button. By default, it gives a natural continuation of text. You can modify the prompt below to change how it works, and save your prompt. The user prompt is always the text of your document up to your cursor position.
            </div>
            <hr/>
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem', 'paddingLeft': '10px', 'borderLeft': '4px solid var(--dark-border)'}}>
                <Textarea 
                    value={selectedPrompt.preamble}
                    setValue={(x) => changePrompt('preamble', x)}
                    placeholder={"Preamble"}
                    rows={4}
                />
                <div style={{'fontStyle': 'italic', 'color': 'var(--passive-text)'}}>(Source document excerpts are inserted here if applicable)</div>
                <Textarea 
                    value={selectedPrompt.conclusion}
                    style={{'height': 'unset'}}
                    rows={"2"}
                    setValue={(x) => changePrompt('conclusion', x)}
                    placeholder={"Conclusion"}
                />
            </div>
            <hr/>
            <div>
                <SyntheticButton
                    value={(
                        <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                            <div>
                                New Prompt
                            </div>
                        </div>
                    )}
                    onClick={() => {let x = createPrompt(); selectPrompt(x)}}
                />
            </div>
            <div>
                <Saving saveValueLoading={userPromptsSaveState}  />
            </div>
            <div style={{'display': 'flex', 'width': '100%', 'flexWrap': 'wrap', 'gap': '10px'}}>
                {[...defaultPrompts, ...userPrompts].map(makePrompt)}
            </div>
        </div>
    )
}
