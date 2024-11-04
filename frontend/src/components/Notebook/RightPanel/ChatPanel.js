import Chat from "@/components/Chat/Chat";
import Checkbox from "@/components/form/Checkbox";
import FakeCheckbox from "@/components/form/FakeCheckbox";
import { useEffect, useMemo, useState } from "react";
import { getAssetsToExclude, makeBlock } from "../Notebook";
import MyImage from "@/components/MyImage/MyImage";
import AddIcon from '../../../../public/icons/AddIcon.png'
import Tooltip from "@/components/Tooltip/Tooltip";
import { removeCitations } from "@/utils/text";
import CircleCheckIcon from '../../../../public/icons/CircleCheckIcon.png'


export default function ChatPanel({ blocks, manifestRow, setBlocks, highlightNote }) {

    const [useRecents, setUseRecents] = useState(true)
    const [addedToWorkspace, setAddedToWorkspace] = useState(false)
    

    const assetsToExclude = useMemo(() => {
        return getAssetsToExclude(blocks)
    }, [blocks])

    let chatTopper = assetsToExclude.length > 0 ? (
        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px', 'color': 'var(--passive-text)', 'fontSize': '.9rem'}}>
            <div>
                Ignore older notes
            </div>
            <div>
                <FakeCheckbox iconSize={15} value={useRecents} setValue={setUseRecents} />
            </div>
        </div>
    ) : ""

    const addToBlocksButton = (
        <Tooltip content={"Add to Workspace"}>
            <div className={addedToWorkspace ? '' : `_touchableOpacity`} style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}}>
                <div>
                    Workspace
                </div>
                <MyImage src={addedToWorkspace ? CircleCheckIcon : AddIcon} width={20} height={20} alt={"Add"} />
            </div>
        </Tooltip>
    )

    function addToBlocksCallback(chatObj) {
        let newBlock = makeBlock('ai', {'ai': chatObj.ai, 'user': chatObj.user}, chatObj.model || 'AI')
        setBlocks([...blocks, newBlock])
        setTimeout(() => {  // not the greates to use a timeout here, but don't see another way.
            highlightNote(newBlock.id)
        }, 100)
        setAddedToWorkspace(true)
        setTimeout(() => setAddedToWorkspace(false), 2000);
    }

    return (
        <div style={{'height': '100%', 'width': '100%'}}>
            <Chat
                manifestRow={manifestRow}
                invertColor={true}
                hideStatus={true}
                id={manifestRow.id}
                allowOCR={false}
                summarizeEnabled={false}
                exclude={useRecents ? assetsToExclude : []}
                autoFocus={false}
                topText={chatTopper}
                detached={blocks?.length == 0}
                extraButtons={[{'value': addToBlocksButton, 'callback': addToBlocksCallback}]}
                hideTabBar={true}
            />
        </div>
    )
}

