import { getTemplateByCode } from "@/templates/template";
import styles from './AssetsTable.module.css'
import Link from "next/link";
import Image from "next/image";
import { useRef, useState, useEffect } from "react";
import ControlledInputText from '../form/ControlledInputText'
import { useDrag, useDrop } from 'react-dnd';
import Taskbar from "./Taskbar";
import MyImage from "../MyImage/MyImage";
import shortenText from "@/utils/text";
import { Auth } from "@/auth/auth";


export const getDefaultEditState = (title, desc, author) => {
    return {
        'title': title,
        'desc': desc,
        'author': author
    }
}

export const confirmEdit = async (resultEditState, token, setAssets, setFolders, setResultEditState, item) => {
    try {
        const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/assets/inline-edit'
        const data = {
            'id': item.id,
            'title': resultEditState.title,
            'preview_desc': resultEditState.desc,
            'author': resultEditState.author
        }
        const response = await fetch(url, {
            'headers': {
                'x-access-token': token,
                'Content-Type': 'application/json'
            },
            'method': 'POST',
            'body': JSON.stringify(data)
        })

        const myJson = await response.json()
        
        if (myJson['response'] != 'success'){
            console.log(myJson)
            throw Error(`Response was not success, said: ${myJson['reason']}`)
        }

        // Update view of assets in table
        if (item.template == 'folder'){
            setFolders((prev) => {
                return prev.map((assetItem) => {
                    if (item.id == assetItem.id){
                        return {...assetItem, 'title': resultEditState.title, 'preview_desc': resultEditState.desc, 'author': resultEditState.author}
                    }
                    return assetItem
                })
            })
        }
        setAssets((prev) => {
            return prev.map((assetItem) => {
                if (item.id == assetItem.id){
                    return {...assetItem, 'title': resultEditState.title, 'preview_desc': resultEditState.desc, 'author': resultEditState.author}
                }
                return assetItem
            })
        })
        
        setResultEditState({})
    }
    catch (e) {
        console.log(e)
    }
}


export default function Result({item,
                                selections,
                                showEdit,
                                showPin,
                                pinned,
                                togglePinCallback,
                                selectable,
                                onSelect,
                                showDelete,
                                subManifest="",
                                showRemove=false,
                                setAssets,
                                maxTitleChar=50,
                                setFolders}){

    const [flashingMessage, setFlashingMessage] = useState("")
    const [resultEditState, setResultEditState] = useState({})

    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'item',
        item: { item },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    }));

    // For folders
    async function onDropItem(draggedItem, droppedId){
        if (droppedId == draggedItem.id){
            return
        }
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/add-resource"
            const data = {
                'id': droppedId,
                'resource_id': draggedItem.id 
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

            if(myJson['response'] != 'success'){
                throw Error(`Response was not success: ${myJson['reason']}`)
            }
            setFlashingMessage(`Added '${draggedItem.title}'`)

            setTimeout(() => {
                setFlashingMessage("")
            }, 2000)
        }
        catch(e){
            console.log(e)
            setFlashingMessage("")
        }
    }

    const [{ canDrop, isOver }, drop] = useDrop(() => ({
        accept: 'item',
        drop: (item, monitor) => {
          onDropItem(item.item, id);
        },
        collect: (monitor) => ({
          isOver: !!monitor.isOver(),
          canDrop: !!monitor.canDrop(),
        }),
    }));

    const { getToken } = Auth.useAuth()

    async function onEdit(){
        confirmEdit(resultEditState, await getToken(), setAssets, setFolders, setResultEditState, item)
    }
    
    let isEditing = Object.keys(resultEditState).length > 0

    let author = shortenText(item.author, 75, 30, true);
    let title = shortenText(item.title, 75, maxTitleChar, true);

    let type = getTemplateByCode(item.template).constructor.readableName;;
    let typeImage = getTemplateByCode(item.template).constructor.icon

    let desc = item.preview_desc;
    if (isEditing){
        desc = (
            <ControlledInputText value={resultEditState.desc} inputStyle={{'backgroundColor': 'var(--light-background)'}}
                setValue={(x) => {
                    setResultEditState((prev) => {
                        return {
                            ...prev,
                            'desc': x
                        }
                    })
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        onEdit();
                    }
                }} />
        )
    }

    let id = item.id;
    
    let taskbar = selectable || showEdit || showDelete || showRemove ? (
        <Taskbar item={item}
            selections={selections}
            showEdit={showEdit}
            showPin={showPin}
            pinned={pinned}
            togglePinCallback={togglePinCallback}
            selectable={selectable}
            onSelect={onSelect}
            showDelete={showDelete}
            resultEditState={resultEditState}
            setResultEditState={setResultEditState}
            setAssets={setAssets}
            setFolders={setFolders}
            showMoveToFolder={showEdit}
            subManifest={subManifest}
            showRemove={showRemove}
        />
    ) : ""

    let titleContent = (
        <div style={{'display': 'flex', 'gap': '10px'}}>
            <div>
                <span>{title}</span>
                <span style={{'color': 'var(--passive-text)', 'fontSize': '.9rem'}}>{` by ${author}`}</span>
            </div>
            <div>
                <i style={{'fontFamily': 'var(--font-header)'}}>
                    {flashingMessage}
                </i>
            </div>
        </div>
    )
    if (isEditing){
        titleContent = (
            <div style={{'display': 'flex', 'gap': '10px'}}>
                <div>
                    <ControlledInputText value={resultEditState.title} inputStyle={{'backgroundColor': 'var(--light-background)'}}
                        setValue={(x) => {
                            setResultEditState((prev) => {
                                return {
                                    ...prev,
                                    'title': x
                                }
                            })
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                onEdit();
                            }
                        }} />
                </div>
                <div>
                    <ControlledInputText value={resultEditState.author} inputStyle={{'backgroundColor': 'var(--light-background)'}}
                        setValue={(x) => {
                            setResultEditState((prev) => {
                                return {
                                    ...prev,
                                    'author': x
                                }
                            })
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                onEdit();
                            }
                        }} />
                </div>
            </div>
            
        )
    }

    function shortenString(str, maxLength) {
        if (str.length <= maxLength) {
            return str;
        }
        
        let trimmedStr = str.substr(0, maxLength);
        trimmedStr = trimmedStr.substr(0, Math.min(trimmedStr.length, trimmedStr.lastIndexOf(" ")));
    
        return trimmedStr + "...";
    }

    let shortenedDesc = shortenString(item.preview_desc, 200)

    let hoverStyle = {}
    if (item.template === 'folder') {
        hoverStyle = isOver ? {
            'backgroundColor': 'var(--light-highlight)',
            'border': '3px solid var(--dark-primary)'
        } : {};
    }
    if (isDragging) {
        hoverStyle['cursor'] = 'grabbing';
    }

    let linkPart = (
        <div className={styles.result} style={hoverStyle}>
            <div style={{'display': 'flex', 'alignItems': 'center'}} className={styles.templateImage}>
                <MyImage title={type} src={typeImage} width={20} height={20} alt={type} style={{'opacity': '50%'}} />
            </div>
            <div className={styles.resultTitleAuthorContainer}>
                {titleContent}
            </div>
            <div className={styles.resultDesc} title={desc}>
                {isEditing ? desc : shortenedDesc}
            </div>
        </div>
    )

    let resultContent = (
        <div className={styles.resultTwoPartContainer}>
            <div style={{'flex': '1'}}>
                {linkPart}
            </div>
            <div className={styles.taskbarContainer}>
                {taskbar}
            </div>
        </div>
    )

    if (!isEditing){
        resultContent = (
            <div className={styles.resultTwoPartContainer}>
                <Link href={"/assets/" + `${id}`} target={selectable ? "_blank" : ""} className={styles.resultLink}>
                    {linkPart}
                </Link>
                {taskbar ? (
                    <div className={styles.taskbarContainer}>
                        {taskbar}
                    </div>
                ) : ""}
            </div>
        )
    }

    // Would be better if we didn't hardcode "folder"
    const ref = useRef(null)
    let realRef = undefined
    realRef = item.template == 'folder' ? drag(drop(ref)) : drag(ref)

    useEffect(() => {
        const handleClickOutside = async (event) => {
            if (realRef && realRef.current && !realRef.current.contains(event.target)) {
                if (JSON.stringify(resultEditState) != '{}'){
                    confirmEdit(resultEditState, await getToken(), setAssets, setFolders, setResultEditState, item)
                }
            }
        };

        // Attach the listeners on component mount.
        document.addEventListener('mousedown', handleClickOutside);
        // Detach the listeners on component unmount.
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [setResultEditState, realRef, resultEditState, setAssets, item]);

    // Just a small signal to show that the drag is doing something.
    let draggingStyle = isDragging ? {
        'filter': 'opacity(10%)',
    } : {}
    
    return (
        <div className={styles.resultWrapper} ref={realRef} onDragStart={isEditing ? (e)=>{e.preventDefault()} : ()=>{}} style={draggingStyle}>
            {resultContent}
        </div>
    )
}
