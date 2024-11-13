
import { Auth } from "@/auth/auth";
import { useState, useRef, useEffect, useCallback } from "react";
import MyImage from "../MyImage/MyImage";
import useSaveDataEffect from "@/utils/useSaveDataEffect";
import Editor from "./Editor";
import Saving from "../Saving/Saving";
import Modal from "../Modal/Modal";
import AttachIcon from '../../../public/icons/AttachIcon.png'
import PanelSourceSelect from "../PanelSourceSelect/PanelSourceSelect";
import Tooltip from "../Tooltip/Tooltip";


// The idea here is to have an editor that saves to the main file of the asset
// setState = set the saving state, setSave = setValue for redundancy reasons
export default function RichTextSavingEditor({ value, manifestRow, name='', setSave=()=>{}, setState=()=>{}, ext="html", canEditSources=false, editorStyle={}, smallMenuBar, ...props }) {
    
    const { getToken } = Auth.useAuth()

    const [savingState, setSavingState] = useState(0);
    const [textToSave, setTextToSave] = useState(value)
    const [savedText, setSavedText] = useState(value)  // unused currently, but could be if saving is collaborative.

    const [editSourcesModalOpen, setEditSourcesModalOpen] = useState(false)
    const [sources, setSources] = useState([])
    const [selectionsLoadState, setSelectionsLoadState] = useState(0)

    const saveFile = useCallback(async (x) => {
        try {
            setSavingState(1)
            const data = {
                'html_str': x,
                'ext': ext,
                'name': name,
                'id': manifestRow.id
            }
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/text-editor/save"
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
            setSavedText(myJson['html_str'])
            setSave(x)
            setSavingState(2)
        }
        catch(e) {
            console.log(e)
            setSavingState(3)
        }
    }, [manifestRow.id, setSavedText, setSave, setSavingState])
    useSaveDataEffect(textToSave, true, saveFile, 500, setSavingState)

    useEffect(() => {
        setState(savingState)
    }, [savingState])

    const customRightMenu = (
        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
            <Saving saveValueLoading={savingState} />
            {canEditSources ? (
                <Tooltip content={"Edit Sources"}>
                    <MyImage onClick={() => setEditSourcesModalOpen(true)} className="_touchableOpacity" src={AttachIcon} width={20} height={20} />
                </Tooltip>
            ) : ""}
        </div>
    )
    
    return (
        <>
            <Editor
                assetId={manifestRow.id}
                onChangeHTML={(x) => setTextToSave(x)}
                htmlContent={value}
                customRightMenu={customRightMenu}
                style={editorStyle}
                includeSelf={!!name}
                smallMenuBar={smallMenuBar}
            />
            {canEditSources ? (
                <Modal minWidth="75vw" isOpen={editSourcesModalOpen} close={() => setEditSourcesModalOpen(false)} title={"Edit Sources"}>
                    <PanelSourceSelect
                        selections={sources}
                        setSelections={setSources}
                        selectionsLoadState={selectionsLoadState}
                        setSelectionsLoadState={setSelectionsLoadState}
                        canEdit={true}
                        allowUpload={true}
                        manifestRow={manifestRow}
                    />
                </Modal>
            ) : ""}
        </>
    )
}
