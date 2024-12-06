import MyImage from "../MyImage/MyImage"
import Dropdown from "../Dropdown/Dropdown";
import EditIcon from '../../../public/icons/EditIcon.png'
import DeleteIcon from '../../../public/icons/DeleteIcon.png'
import { formatTimestampDefault, getCurrentUTCTimestamp } from "@/utils/time";
import MoreNotSquareIcon from '../../../public/icons/MoreNotSquareIcon.png'
import styles from './Notebook.module.css'
import { memo, useRef, useState } from "react";
import { useDrag, useDrop } from 'react-dnd';
import DragIcon from '../../../public/icons/DragIcon.png'
import ShareArrowIcon from '../../../public/icons/ShareArrowIcon.png'
import { getBlockTypeByCode } from "./BlockTypes";
import { getReplyText } from "./Notebook";
import { useIsMobile } from "@/utils/mobile";


const Block = memo(({ item, i, isLast, isFirst, deleteBlock, moveBlock, reply, setItem, manifestRow, canEdit, blocks, setBlocks, highlightNote, scrollBlocksToBottom, ...props }) => {
    const [amEditing, setAmEditing] = useState(false)

    const { isMobile } = useIsMobile()

    const [{ isDragging }, drag, preview] = useDrag({
        'item': { 'id': item.id, index: i },
        'type': 'block',
        'collect': (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    const [, drop] = useDrop({
        accept: 'block',
        hover(item, monitor) {
            if (!ref.current) {
                return;
            }
            const dragIndex = item.index;
            const hoverIndex = i;
            if (dragIndex === hoverIndex) {
                return;
            }
            const hoverBoundingRect = ref.current.getBoundingClientRect();
            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            const clientOffset = monitor.getClientOffset();
            const hoverClientY = clientOffset.y - hoverBoundingRect.top;
            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
                return;
            }
            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
                return;
            }
            moveBlock(dragIndex, hoverIndex);
            item.index = hoverIndex;
        },
    });

    
    let typeSpecific = `Item type ${item.type} not recognized.`
    let typeDropdownOptions = [
        {
            'value': (
                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px', 'justifyContent': 'space-between'}}>
                    Delete
                    <MyImage src={DeleteIcon} alt={"Delete"} width={15} height={15} />
                </div>
            ),
            'onClick': ()=>{deleteBlock()}
        },
        {
            'value': (
                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px', 'justifyContent': 'space-between'}}>
                    Reply
                    <MyImage src={ShareArrowIcon} alt={"Reply"} width={15} height={15} />
                </div>
            ),
            'onClick': ()=>{reply()}
        }
    ]
    
    let blockType = getBlockTypeByCode(item.type)
    typeSpecific = (
        <blockType.View
            manifestRow={manifestRow}
            item={item}
            setItem={setItem}
            amEditing={amEditing}
            setAmEditing={setAmEditing}
            canEdit={canEdit}
            blocks={blocks}
            setBlocks={setBlocks}
            highlightNote={highlightNote}
            scrollBlocksToBottom={scrollBlocksToBottom}
        />
    )

    if (blockType.editable){
        typeDropdownOptions = [...typeDropdownOptions, 
            {'value': (
                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px', 'justifyContent': 'space-between'}}>
                    Edit
                    <MyImage src={EditIcon} alt={"Edit"} width={15} height={15} />
                </div>
            ), 'onClick': ()=>{setAmEditing(!amEditing)}},
        ]
    }

    let containerStyle = {}
    if (isLast){
        containerStyle['borderBottom'] = '1px solid var(--light-border)'
    }
    if (!isFirst){
        containerStyle['borderTop'] = '1px solid var(--light-border)'
    }

    // For draggina and dropping
    const ref = useRef();
    const previewRef = useRef()
    const opacity = isDragging ? 0.5 : 1;
    return (
        <div ref={drop(preview(previewRef))} id={`_${item.id}` /* For scrolling into view */} className={`${styles.blockContainer} ${item.replyTo ? styles.blockContainerWithReplyTo : ''}`} style={{...containerStyle, 'opacity': opacity}} {...props}>
            {item.replyTo ? (
                <div className={styles.replyText} onClick={() => highlightNote(item.replyTo.id)}>
                    {`Reply to: ${getReplyText(item.replyTo)}`}
                </div>
            ) : ""}
            <div className={styles.innerBlockContainer}>
                {!isMobile && canEdit ? (
                    <div>
                        <div className={styles.dragHandle} ref={drag(ref)}>
                            <MyImage src={DragIcon} height={15} alt={"Drag"} />
                        </div>
                    </div>
                ) : ""}
                {
                    canEdit ? (
                        <div>
                            <Dropdown
                                initialButtonStyle={{'all': 'unset', 'display': 'flex', 'alignItems': 'center'}}
                                value={(
                                    <div className={styles.blockOptions} style={{'cursor': 'pointer'}}>
                                        <MyImage src={MoreNotSquareIcon} height={15} alt={"options"} />
                                    </div>
                                )}
                                options={typeDropdownOptions} />
                        </div>
                    ) : ""
                }    
                <div className={styles.blockContentContainer} id={`_content_${item.id}`}>
                    <div className={styles.blockHeader}>
                        <div>
                            {item.author}
                        </div>
                        <div style={{'flex': '1'}}></div>
                        <div suppressHydrationWarning={true}>
                            {/* The timestamp will almost inevitably be different on client / server; see: https://nextjs.org/docs/messages/react-hydration-error */}
                            {formatTimestampDefault(item.timestamp, true) /* isLocalTime=true because a Z is already added to the timestsamp (signifying UTC), not because it's actually local time. */}
                        </div>
                    </div>
                    <div className={styles.blockBodyContainer}> 
                        {typeSpecific}
                    </div>
                </div>
            </div>
        </div>
    )
})

export default Block;