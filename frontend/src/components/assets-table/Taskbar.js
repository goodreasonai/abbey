import { useState, useEffect } from "react";
import Tooltip from "../Tooltip/Tooltip";
import EditIcon from '../../../public/icons/EditIcon.png'
import DeleteIcon from '../../../public/icons/DeleteIcon.png'
import MoveIcon from '../../../public/icons/MoveIcon.png'
import RemoveIcon from '../../../public/icons/RemoveIcon.png'
import CircleCheckIcon from '../../../public/icons/CircleCheckIcon.png'
import CheckedIcon from '../../../public/icons/CheckedIcon.png'
import UncheckedIcon from '../../../public/icons/UncheckedIcon.png'
import Button from "../form/Button";
import styles from './AssetsTable.module.css'
import { getDefaultEditState } from "./Result";
import { confirmEdit } from "./Result";
import { Auth } from "@/auth/auth";
import MyImage from "../MyImage/MyImage";
import MoveToFolder from "./MoveToFolder";
import SyntheticButton from "../form/SyntheticButton";
import PinIcon from '../../../public/icons/PinIcon.png'
import PinnedIcon from '../../../public/icons/PinnedIcon.png'
import Loading from "../Loading/Loading";


export default function Taskbar({ item,
                                  selections,
                                  showEdit,
                                  selectable,
                                  onSelect,
                                  showDelete,
                                  showPin,
                                  pinned,
                                  togglePinCallback,
                                  showMoveToFolder,
                                  setAssets,
                                  setFolders,
                                  resultEditState,
                                  setResultEditState,
                                  subManifest="",
                                  showRemove=true }) {
    
    let toggleSelect = (e) => {onSelect(item)}
    let isSelected = selections.includes(item.id)
    const { getToken } = Auth.useAuth()

    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [showMove, setShowMove] = useState(false)
    const [pinToggleLoadState, setPinToggleLoadState] = useState(0)

    function handleDeleteClick(e){
        setShowDeleteConfirmation(true);
    }

    function handleRemoveClick(e) {
        doRemove(item.id)
        // Close the confirmation modal
        setAssets((prev) => prev.filter(asset => asset.id !== item.id));
    }

    async function doRemove(assetId){
        const token = await getToken();
        let url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/remove`;
        let data = {
            'from': subManifest,
            'id': assetId
        }
        try {
            const response = await fetch(url, {
                method:"POST",
                headers:{
                    'x-access-token': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            const myJson = await response.json(); //extract JSON from the http response
            if (myJson['response'] !== 'success'){
                throw new Error("Server returned failed - " + myJson['reason'])
            }
        }
        catch (error) {
            console.error(error);
        }
    }

    async function doDelete(assetId, delContents){
        const token = await getToken();
        let url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/delete`;
        let formData = new FormData();
        formData.append('id', assetId);
        if (delContents){
            formData.append('delete_contents', 1)
        }
        try {
            const response = await fetch(url, {method:"POST", headers:{'x-access-token': token}, body: formData});
            const myJson = await response.json(); //extract JSON from the http response
            if (myJson['response'] !== 'success'){
                throw new Error("Server returned failed - " + myJson['reason'])
            }
        }
        catch (error) {
            console.error(error);
        }
    }

    const doDeleteFunc = (e, delContents) => {
        doDelete(item.id, delContents)
        // Close the confirmation modal
        setShowDeleteConfirmation(false);
        setAssets((prev) => prev.filter(asset => asset.id !== item.id));
        setFolders((prev) => prev.filter(asset => asset.id !== item.id));
    }

    const openEdit = (e) => {
        setResultEditState(getDefaultEditState(item.title, item.preview_desc, item.author))
    };

    const closeEdit = (e) => {
        setResultEditState({})
    }

    async function onEdit(){
        confirmEdit(resultEditState, await getToken(), setAssets, setFolders, setResultEditState, item)
    } 

    let editInterface = ""
    if (showEdit && item.has_edit_permission) {

        if (Object.keys(resultEditState).length == 0){
            editInterface = (
                <Tooltip content="Edit">
                    <div onClick={openEdit} className={styles.taskbarButton} id='TaskbarEdit'>
                        <MyImage src={EditIcon} width={20} height={20} alt="Edit" style={{'opacity': '50%'}} />
                    </div>
                </Tooltip>
            )
        }
        else {
            editInterface = (
                <div style={{'display': 'flex', 'gap': '5px'}}>
                    <MyImage src={CircleCheckIcon} width={20} height={20} alt="Confirm edit" className='_clickable' onClick={onEdit} />
                    <MyImage src={RemoveIcon} width={20} height={20} alt="Cancel edit" className='_clickable' onClick={closeEdit} />
                </div>
            )
        }
        
    }

    // Modal on mobile stuff
    useEffect(() => {
        const disableScroll = () => {
            if (window.innerWidth < 800) {
                document.body.style.overflow = 'hidden';
            }
        };

        const enableScroll = () => {
            if (window.innerWidth < 800) {
                document.body.style.overflow = 'unset';
            }
        };

        if (showMove) {
            disableScroll();
        }

        return () => {
            enableScroll();
        };
    }, [showMove]);

    let deleteArea = ""
    if (showDelete){
        if (!subManifest && item.has_edit_permission){
            if (item.template == 'folder'){

            }
            deleteArea = (
                showDeleteConfirmation ? (
                    item.template == 'folder' ? (
                        <div style={{'display': 'flex', 'gap': '10px', 'fontSize': '.8rem !important'}}>
                            <SyntheticButton onClick={(e) => doDeleteFunc(e, true)} value={(
                                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px', 'fontSize': '.9rem'}}>
                                    <MyImage src={DeleteIcon} alt={"Delete"} width={15} height={15} />
                                    Contents
                                </div>
                            )} id='TaskbarDeleteConfirm'/>
                            <SyntheticButton onClick={doDeleteFunc} value={(
                                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px', 'fontSize': '.9rem'}}>
                                    <MyImage src={DeleteIcon} alt={"Delete"} width={15} height={15} />
                                    Folder
                                </div>
                            )} />
                        </div>
                    ) : (
                        <SyntheticButton onClick={doDeleteFunc} value={"Confirm"} id='TaskbarDeleteConfirm'/>
                    )
                ) : (
                    <Tooltip content='Delete'>
                        <span onClick={handleDeleteClick} className={styles.taskbarButton} id='TaskbarDelete'>
                            <MyImage src={DeleteIcon} width={20} height={20} alt="Delete" style={{'opacity': '50%'}} />
                        </span>
                    </Tooltip>
                )
            )
        }
        else if (subManifest && showRemove){
            deleteArea = (
                <Tooltip content='Remove'>
                    <span onClick={handleRemoveClick} className={styles.taskbarButton}>
                        <MyImage src={RemoveIcon} width={20} height={20} alt="Remove" style={{'opacity': '50%'}} />
                    </span>
                </Tooltip>
            )
        }
    }

    async function togglePin(){
        try {
            setPinToggleLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/user/toggle-pin"
            const data = {
                'off': pinned,
                'id': item.id
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
                throw Error("Response was not success")
            }
            setPinToggleLoadState(2)
            togglePinCallback()
        }
        catch(e) {
            console.log(e)
            setPinToggleLoadState(3)
        }
    }

    let pinInterface = ""
    if (showPin){
        if (pinToggleLoadState == 1){
            pinInterface = (
                <Loading text={""} />
            )
        }
        else if (pinned){
            pinInterface = (
                <Tooltip content='Pin'>
                    <MyImage onClick={togglePin} src={PinnedIcon} alt={"Pinned"} width={20} height={20} style={{'opacity': '50%'}} />
                </Tooltip>
            )
        }
        else {
            pinInterface = (
                <Tooltip content='Pin'>
                    <MyImage onClick={togglePin} src={PinIcon} alt={"Pin"} width={20} height={20} style={{'opacity': '50%'}} />
                </Tooltip>
            )
        }
        
    }
                    

    return (
        <div className={styles.taskbar}>
            {selectable && (
                <div className={styles.taskbarText} style={{'padding': '5px' /* The padding gives the onclick a little breathing room */}} onClick={toggleSelect}>
                    Select:
                    <span className={styles.taskbarButton} id="SourceSelect">
                        {isSelected ? (
                            <MyImage src={CheckedIcon} alt="Remove" width={20} height={20} />
                        ) : (
                            <MyImage src={UncheckedIcon} alt="Select" width={20} height={20} />
                        )}
                    </span>
                </div>
            )}
            {pinInterface}
            {editInterface}
            {
                showMoveToFolder ? (
                    <div>
                        <Tooltip content={item.template == 'folder' ? 'Put into Another Folder' : 'Put into Folder'}>
                            <span onClick={() => {setShowMove(true)}} className={styles.taskbarButton}>
                                <MyImage src={MoveIcon} width={20} height={20} alt="Add to a Folder" style={{'opacity': '50%'}} />
                            </span>
                        </Tooltip>
                        {
                            showMove ? (
                                <div className={styles.moveToContainer}>
                                    <MoveToFolder assetId={item.id} outsideClickCallback={() => setShowMove(false)} />
                                </div>
                            ) : ""
                        }
                        
                    </div>
                ) : ""
            }
            {deleteArea}
        </div>
    );

}