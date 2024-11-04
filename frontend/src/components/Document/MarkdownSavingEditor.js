import { Auth } from "@/auth/auth";
import { useState, useRef, useEffect } from "react";
import MarkdownEditor from "../Markdown/MarkdownEditor";
import CircleCheckIcon from '../../../public/icons/CircleCheckIcon.png'
import Image from "next/image";
import Loading from "../Loading/Loading";
import MyImage from "../MyImage/MyImage";


export default function MarkdownSavingEditor({ value, assetId, setSave=()=>{}, setState=()=>{}, ...props }) {
    
    const { getToken } = Auth.useAuth()

    const [savingState, setSavingState] = useState(0);
    const [textToSave, setTextToSave] = useState(value)
    const [savedText, setSavedText] = useState(value)

    async function saveFile(x){
        try {
            setSavingState(1)
            const data = {
                'data': x,
                'id': assetId
            }
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/document/save-markdown"
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'POST',
                'body': JSON.stringify(data)
            })
            if (!response.ok){
                throw Error("Response was not OK")
            }
            const myJson = response.json()
            setSavedText(myJson['data'])
            setSave(x)
            setSavingState(2)
        }
        catch(e) {
            console.log(e)
            setSavingState(3)
        }
    }

    useEffect(() => {
        setState(savingState)
    }, [savingState])

    const timeoutRef = useRef(null);
    useEffect(() => {
        if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
        }

        if (textToSave != savedText){
            setSavingState(1)
        }

        timeoutRef.current = setTimeout(() => {
            saveFile(textToSave)
            timeoutRef.current = null;
        }, 2000);

        return () => {
            if (timeoutRef.current !== null) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [textToSave]);

    let savingText = "Saved"
    let savingDecoration = <MyImage src={CircleCheckIcon} width={20} height={20} alt={"Saved"} />
    if (savingState == 0){
        // Defaults should be good
    }
    else if (savingState == 1){
        savingText = "Saving"
        savingDecoration = (
            <Loading text="" />
        )
    }
    else if (savingState == 2){
        // Defaults should be good
    }
    else if (savingState == 3){
        savingText = "Error Saving"
        savingDecoration = ""
    }

    const savingBug = (
        <div style={{'display': 'flex', 'gap': '5px', 'alignItems': 'center', 'fontFamily': 'var(--font-header)'}}>
            <div style={{'display': 'flex', 'alignItems': 'center'}}>
                {savingText}
            </div>
            <div style={{'display': 'flex', 'alignItems': 'center'}}>
                {savingDecoration}
            </div>
        </div>
    )
    
    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '10px'}} {...props}>
            <div>
                {savingBug}
            </div>
            <MarkdownEditor onChange={(x) => setTextToSave(x)} value={value} />
        </div>
    )
}
