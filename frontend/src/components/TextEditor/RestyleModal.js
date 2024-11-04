import { useState } from "react";
import Textarea from "../form/Textarea";
import { downloadFromBlob } from "@/utils/fileResponse";
import Modal from "../Modal/Modal";
import Button from "../form/Button";
import { Auth } from "@/auth/auth";
import Hr from "../Hr/Hr";
import { abbeyHtmlStyle } from "@/utils/html";

export default function RestyleModal({ manifestRow, showRestyle, setShowRestyle, setRestyleLoadState }) {

    const [styleText, setStyleText] = useState(abbeyHtmlStyle)
    const { getToken } = Auth.useAuth()

    async function getFullHTML(){
        try {
            setRestyleLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/text-editor/restyle-export'
            const data = {
                'css': styleText,
                'id': manifestRow.id
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
            const blob = new Blob([myJson['result']], { type: 'text/html' });
            downloadFromBlob(`${manifestRow.title}.html`, blob)
            setRestyleLoadState(2)
            setShowRestyle(false)
        }
        catch(e) {
            console.log(e)
            setRestyleLoadState(3)
        }
    }

    function submit(){
        getFullHTML()
        setShowRestyle(false)
    }

    return (
        <Modal minHeight="75vh" minWidth="75vw" isOpen={showRestyle} close={() => setShowRestyle(false)} title={"Style and Export"}>
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                <div style={{'color': 'var(--passive-text)', 'fontStyle': 'italic', 'fontFamily': 'var(--font-body)'}}>
                    Export your text file as a stylized HTML file. Customize the default CSS below and then download the file.
                </div>
                <div style={{'display': 'flex', 'justifyContent': 'flex-start', 'alignItems': 'center'}}>
                    <Button value={"Download"} onClick={submit} />
                </div>
                <Hr />
                <Textarea
                    value={styleText}
                    setValue={setStyleText}
                    placeholder={"(CSS)"}
                    style={{'fontFamily': 'var(--font-body)', 'height': '50vh'}}
                />
            </div>
        </Modal>
    )
}
