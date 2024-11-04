import { useEffect, useState } from "react"
import Modal from "../Modal/Modal"
import SourceSelect from "../form/SourceSelect"
import styles from './SelectAssetWrapper.module.css'
import MyImage from "../MyImage/MyImage"
import AddIcon from '../../../public/icons/AddIcon.png'
import CreateWrapper from "../Quick/CreateWrapper"
import { getTemplateByCode } from "@/templates/template"
import SyntheticButton from "../form/SyntheticButton"


export default function SelectAssetWrapper({ manifestRow, verb="Add", noun="Notes", preposition="to", selectCallback=()=>{}, allowCreateTemplates=[], className, style, ...props }) {
    
    const [selections, setSelections] = useState([])
    const [showModal, setShowModal] = useState(false)

    // Doesn't actually do anything except close! Selections are added via the use effect on any close.
    function handleConfirm(){
        setShowModal(false)
    }

    useEffect(() => {
        if (!showModal && selections.length){
            selectCallback(selections)
            setSelections([])
        }
    }, [showModal, selections, setSelections])

    return (
        <>
            <div className={`_clickable ${className}`} onClick={()=>{setShowModal(true)}} style={{'width': '100%', 'height': '100%', 'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center', ...style}} {...props}>
                {props.children}
            </div>
            <Modal minWidth="80vw" isOpen={showModal} close={() => setShowModal(false)} title={`Choose Existing Asset`}>
                <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '10px', 'position': 'relative'}}>
                    <div className={`${styles.confirmButton} _clickable`} onClick={() => handleConfirm()}>
                        <div>
                            {selections.length ? `${verb} ${selections.length} ${preposition} ${noun}` : 'Nothing Selected'}
                        </div>
                        {selections.length ? (
                            <MyImage src={AddIcon} alt={"Add"} width={20} height={20} />
                        ) : ""}
                    </div>
                    {allowCreateTemplates.map((item) => {
                        const tmp = getTemplateByCode(item)
                        return (
                            <div style={{'display': 'flex'}} key={item}>
                                <div>
                                    <CreateWrapper callback={(x) => {x && setSelections([x, ...selections])}} noRedirect={true} templateCode={item}>
                                        <SyntheticButton
                                            value={(
                                                <div style={{'display': 'flex', 'gap': '10px'}}>
                                                    New {tmp.constructor.readableName}
                                                    <MyImage src={tmp.constructor.icon} width={20} height={20} alt={tmp.constructor.readableName} />
                                                </div>
                                            )}
                                        />
                                    </CreateWrapper>
                                </div>
                            </div>
                        )
                    })}
                    {/* The use of key here is bad and due to earlier missteps dealing with how SourceSelect and AssetTable manage state. */}
                    <SourceSelect key={showModal} setSelectionRows={setSelections} selfId={manifestRow?.id} />
                </div>
            </Modal>
        </>
    )
}
