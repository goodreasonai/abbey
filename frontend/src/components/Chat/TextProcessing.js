import Info from "../Info/Info";
import { Auth } from "@/auth/auth";
import { useCallback, useEffect, useState } from "react";
import Dropdown from "../Dropdown/Dropdown";
import Loading from "../Loading/Loading";
import useKeyboardShortcut from "@/utils/keyboard";

export default function TextProcessing({ id, canEdit, retrieverIssue, setRetrieverIssue, allowOCR }) {

    const { getToken, isSignedIn } = Auth.useAuth()
    const [retrieverStatus, setRetrieverStatus] = useState({})
    const [retrieverLoadState, setRetrieverLoadState] = useState(0)

    async function getRetrieverStatus(loadAttempt){
        try {
            setRetrieverLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/get-retriever-status`
            const data = {
                'id': id
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
            if (myJson['response'] != 'success'){
                console.log(myJson)
                throw Error("Response was not success")
            }
            setRetrieverStatus(myJson)
            // If a job is in progress, keep pinging
            if (myJson['retriever_job'] && myJson['retriever_job'].is_running){
                setTimeout(() => {getRetrieverStatus(loadAttempt+1)}, 1.25**loadAttempt * 1000)
                return
            }
            else if (myJson?.retriever?.chunk_names?.length === 0){
                setRetrieverIssue("Warning: No text found in document.")
            }
            else if (!myJson?.retriever){
                setRetrieverIssue("Text unprocessed.")
            }
            else if (retrieverIssue) {
                setRetrieverIssue("Made retriever.")
            }
            setRetrieverLoadState(2)
        }
        catch (e) {
            console.log(e)
            setRetrieverLoadState(3)
            setRetrieverIssue("Warning: Something went wrong processing your document.")
        }
    }

    async function makeRetriever(forceOcr, forceMathpix){
        try {
            setRetrieverLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/make-retriever`
            const data = {
                'id': id,
                'force_ocr': forceOcr,
                'force_mathpix': forceMathpix
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
            if (myJson['response'] != 'success'){
                console.log(myJson)
                throw Error("Response was not success")
            }
            setRetrieverStatus(myJson)
            // If a job is in progress, keep pinging
            if (myJson['retriever_job'] && myJson['retriever_job'].is_running){
                setTimeout(() => {getRetrieverStatus(1)}, 500)
                return
            }
            else if (myJson?.retriever?.chunk_names?.length === 0){
                setRetrieverIssue("Warning: No text found in document.")
            }
            setRetrieverLoadState(2)
        }
        catch (e) {
            console.log(e)
            setRetrieverIssue("Failed to make retriever")
            setRetrieverLoadState(3)
        }
    }

    useEffect(() => {
        if (id && isSignedIn){
            getRetrieverStatus(0)
        }
    }, [id, isSignedIn])

    const showProcessingShortcut = useCallback(() => {
        if (retrieverIssue){
            setRetrieverIssue("")
        }
        else {
            setRetrieverIssue("Retriever seems normal")
        }
    }, [retrieverIssue])
    useKeyboardShortcut([['p']], showProcessingShortcut, true)

    const ocrOptions = []
    if (allowOCR){
        const ocrOption = (
            <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                Retry with OCR
                <Info align={'left'} text={"Optical Character Recognition for non-highlightable PDFs"} />
            </div>
        )
        ocrOptions.push({
            'value': ocrOption,
            'onClick': () => makeRetriever(true)
        })
    }
    const dropdownOptions = [
        {'value': ("Retry"), 'onClick': () => makeRetriever(false)}, ...ocrOptions
    ]

    if (retrieverIssue){
        if (retrieverLoadState == 1){
            return <Loading text="" />
        }
        return (
            <div style={{'backgroundColor': 'var(--logo-red)', 'borderRadius': '50%', 'padding': '3px'}}>
                <Dropdown
                    rightAlign={true}
                    style={{'backgroundColor': 'unset'}}
                    initialButtonStyle={{'all': 'unset', 'display': 'flex', 'alignItems': 'center'}}
                    value={
                        <Info iconSize={17} content={retrieverIssue} />
                    }
                    options={dropdownOptions}
                    optionsStyle={{'minWidth': '150px'}}
                />
            </div>
        ) 
    }
    return ""
}
