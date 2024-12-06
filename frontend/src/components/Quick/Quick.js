import LightningIcon from '../../../public/icons/LightningIcon.png'
import { useRouter } from 'next/router'
import Dropdown from '../Dropdown/Dropdown'
import Image from 'next/image'
import { useRef, useEffect, useState, useMemo, memo } from 'react'
import Loading from '../Loading/Loading'
import { DEFAULT_PERMISSIONS } from "@/config/config";
import styles from './Quick.module.css'
import Tooltip from '../Tooltip/Tooltip'
import MyImage from '../MyImage/MyImage'
import { getTemplateByCode } from '@/templates/template'
import { stripExt } from '@/utils/fileResponse'
import ControlledInputText from '../form/ControlledInputText'
import CircleCheckIcon from '../../../public/icons/CircleCheckIcon.png'
import SyntheticButton from '../form/SyntheticButton'
import Modal from '../Modal/Modal'
import { getDefaultDescription } from '../Upload/Upload'
import { getUserName } from '@/utils/user'
import { Auth } from '@/auth/auth'


// Intended to fix some problems with <Quick />
export default function Quick({ ...props }) {
    
    const router = useRouter()
    const { getToken, isSignedIn } = Auth.useAuth();
    const [uploadState, setUploadState] = useState(0)
    const [showModal, setShowModal] = useState(false)
    const [otherData, setOtherData] = useState({})
    const [errorMessage, setErrorMessage] = useState("")
    const [alertModalOpen, setAlertModalOpen] = useState(false)  // in the event of an error with no modal, a modal will nevertheless appear
    const [createdAssetId, setCreatedAssetId] = useState(undefined)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [isLoading, setIsLoading] = useState(false)    
    const { user } = Auth.useUser();

    const [selectedItem, setSelectedItem] = useState(undefined)

    const quickObjects = [
        {
            'name': 'No-Doc Chat',
            'code': 'detached_chat',
            'noShow': true,
            'newTab': false,
            'noRedirect': false
        },
        {
            'name': 'Upload Doc',
            'code': 'document',
            'noShow': false,
            'newTab': false,
            'noRedirect': false
        },
        {
            'name': 'Workspace',
            'code': 'notebook',
            'noShow': true,
            'newTab': false,
            'noRedirect': false
        }
    ]


    // State for the input fields that are not template specific
    // Template done separately
    const generalFieldsDefault = {
        'title': {name: 'title', mandatory: false, value: "", defaultValue: 'Untitled'},
        'author': {name: 'author', mandatory: false, value: "", defaultValue: 'Me'},
        'preview_desc': {name: 'preview description', mandatory: false, value: "", getDefaultValue: getDefaultDescription},
        'lm_desc': {name: 'language model description', mandatory: false, value: ""},
        'using_auto_title': {name: 'using autofill title', mandatory: false, value: ""},
        'using_auto_desc': {name: 'using autofill desc', mandatory: false, value: ""},
        'permissions': {name: 'permissions', mandatory: false, value: JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS))},
    }
    const [generalFields, setGeneralFields] = useState(generalFieldsDefault)

    useEffect(() => {
        setGeneralFields(generalFieldsDefault)
        if (isSignedIn){
            setGeneralFields((prev) => {return {...prev, 'author': {...prev['author'], defaultValue: getUserName(user)}}})
        }
        setUploadState(0)
        setOtherData({})
        setErrorMessage("")
        setCreatedAssetId(undefined)
        setUploadProgress(0)
        setIsLoading(false)
    }, [showModal, isSignedIn])

    // this code is duplicated in some other places (CreateWrapper for one). Attempts to refactor have failed. 
    async function upload(item) {
        const tmpObj = getTemplateByCode(item.code)
        const tmp = item.code
        const data = item.data || {}
        setErrorMessage("")
        try {
            const formData = new FormData();
            // Note again that this data is only template specific (i.e., doesn't include permissions)
            let templateFormData = tmpObj.getUploadData(document, otherData)
            // Result of getUploadData is expected to be of same form as realFields
    
            if (tmp === 'document' && generalFields.title.value === ""){
                let name = 'Untitled'
                generalFields['using_auto_title'].value = 1
                try {
                    name = stripExt(templateFormData.files.value.name).replaceAll("_", " ")
                    generalFields['using_auto_title'].value = ""
                    formData.set('title', name)
                }
                catch {}
            }
    
            // for prop supplied upload data
            let transformedData = {}
            for (let key of Object.keys(data)){
                transformedData[key] = {'name': key, 'mandatory': false, 'value': data[key], 'defaultValue': data[key]}
            }

            let realFields = {...generalFields, ...templateFormData, ...transformedData}
    
            // Check if all mandatory fields are in and parse objects
            for (let [key, value] of Object.entries(realFields)) {
                if (value.mandatory && !value.value){
                    setErrorMessage("Please enter a value for the " + value.name + " field.")
                    return
                }
    
                if (!value.value && value.defaultValue){
                    value.value = value.defaultValue
                    if (key == 'title'){
                        generalFields['using_auto_title'].value = 1
                    }
                }
                else if (!value.value && value.getDefaultValue){
                    value.value = value.getDefaultValue(tmp)
                    if (key == 'preview_desc'){
                        realFields['using_auto_desc'].value = 1
                    }
                    if (key == 'title'){
                        generalFields['using_auto_title'].value = 1
                    }
                }
    
                // This is not the best
                // Basically, this was catching "files" in addition to actual objects
                // So now it only applies to things in generalFields (i.e., permissions)
                // Theoretically you can avoid this by stringifying things in the getUploadData function on the non-general fields side
                if (generalFields[key]){
                    if (typeof(value.value) === 'object' &&
                    !Array.isArray(value.value) &&
                    value.value !== null){
                        realFields = {...realFields, [key]: {...realFields[key], 'value': JSON.stringify(value.value)}}
                    }
                }
    
                // Arcane chicanery used for multiple file uploads
                if (value.split){
                    if (realFields[key].value){
                        for (let i = 0; i < realFields[key].value.length; i++){
                            formData.append(key, realFields[key].value[i])
                        }
                    }
                }
                else {
                    formData.append(key, realFields[key].value)
                }
            }
    
            formData.append('template', tmp)
    
            const token = await getToken({ template: process.env.NEXT_PUBLIC_LONG_TOKEN_NAME });
            const url = new URL(process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/upload`);
    
            setUploadState(1);
            loadCallback()
            
            // This is used to make tracking uplaod progress a little easier
            // A GPT special.
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
    
            xhr.upload.addEventListener("progress", (event) => {
                if (event.lengthComputable) {
                    const percentage = (event.loaded / event.total) * 100;
                    // Update the state or props to reflect the progress
                    setUploadProgress(percentage);
                }
            });
    
            xhr.setRequestHeader('x-access-token', token);
    
            xhr.onreadystatechange = async function() {
                if (xhr.readyState === 4) {
                    try {
                        const myJson = JSON.parse(xhr.responseText);
    
                        if (myJson['response'] !== 'success'){
                            if (myJson['reason']){
                                setErrorMessage(myJson['reason'])
                                setUploadState(2);
                                createCallback(undefined)
                                // Template may have a specific fixer interface (PDF page selection, for example)
                            }
                            else {
                                throw new Error("Server returned failed with " + myJson['reason'])
                            }
                        }
                        else {
                            const assetId = myJson['asset_id'];
                            setCreatedAssetId(assetId);
                            setUploadState(2);
                            createCallback(myJson['asset_row'])
                            if (!item.noRedirect){
                                if (item.newTab){
                                    window.open(`/assets/${assetId}`)
                                }
                                else {
                                    await router.push(`/assets/${assetId}`)
                                    setShowModal(false)
                                }
                            }
                            else {
                                setShowModal(false)
                            }
                        }
                    }
                    catch(error) {
                        console.error(error);
                        setErrorMessage("Network error. Try again.");
                        setUploadState(3);
                        createCallback(undefined)
                    }
                }
            };
    
            xhr.send(formData);        
        }
        catch(e) {
            console.log(e)
            setUploadState(3)
        }
    }

    function handleCreateClick(item){
        upload(item)
    }

    function handleClick(item){
        if (item.noShow){
            handleCreateClick(item)
        }
        else {
            setShowModal(true)
        }
    }

    function loadCallback() {
        setIsLoading(true)
    }
    function createCallback() {
        setIsLoading(false)
    }
    function closeCallback() {
        setIsLoading(false)
    }

    const quickOptions = quickObjects.map((item) => {
        const temp = getTemplateByCode(item.code)
        const val = (
            <div style={{'display': 'flex', 'justifyContent': 'space-between', 'alignItems': 'center'}}>
                <div>
                    {item.name}
                </div>
                {isLoading && selectedItem?.code == item.code ? (
                    <Loading text="" color='var(--light-text)' />
                ) : (
                    <MyImage src={temp.constructor.icon} alt={temp.constructor.readableName} width={20} height={20} />
                )}
            </div>
        )

        return {
            'value': val,
            'onClick': ()=>{
                if (isLoading){
                    return
                }
                setSelectedItem(item)
                handleClick(item)
            }
        }
    })

    useEffect(() => {
        if (errorMessage && selectedItem?.noShow){
            setAlertModalOpen(true)
        }
    }, [errorMessage, selectedItem])

    const templateObj = selectedItem ? getTemplateByCode(selectedItem.code) : undefined

    const submitLoadingText = uploadProgress >= 100 ? "Loading" : `${Math.round(uploadProgress)}% uploaded`

    return (
        <>
            {!isLoading || !selectedItem?.noShow ? (
                <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                    <Dropdown
                        value={(
                            <div style={{'display': 'flex', 'gap': '5px', 'alignItems': 'center', 'fontSize': '.9rem'}}>
                                <div>
                                    Quick
                                </div>
                                <div style={{'display': 'flex', 'alignItems': 'center'}}>
                                    <MyImage src={LightningIcon} width={15} height={15} alt={"Quick"} style={{'filter': 'invert(var(--inverted))'}} />
                                </div>
                            </div>
                        )}
                        options={quickOptions}
                        closeOnSelect={true}
                        optionsStyle={{'minWidth': '150px', 'fontSize': '.9rem'}}
                        rightAlign={true}
                        initialButtonStyle={{'padding': '5px', 'paddingLeft': '10px', 'paddingRight': '10px'}}
                    />
                </div>
            ) : (<Loading text="" />)}
            
            {templateObj ? (
                <>
                    <Modal minWidth="50vw" isOpen={showModal} close={() => {setShowModal(false); closeCallback()}} title={`Create ${templateObj.constructor.readableName}`}>
                        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem', 'marginBottom': '100px'}}>
                            <templateObj.ExtraUploadFields otherData={otherData} setOtherData={setOtherData} />
                        </div>
                        <div style={{
                            'position': 'absolute',
                            'bottom': '0px',
                            'left': '0px',
                            'width': '100%',
                            'display': 'flex', 
                            'justifyContent': 'center',
                            'alignItems': 'center',
                            'gap': '10px',
                            'backgroundColor': 'var(--light-primary)',
                            'borderBottomRightRadius': 'var(--medium-border-radius)',
                            'borderBottomLeftRadius': 'var(--medium-border-radius)',
                            'padding': '10px',
                            'borderTop': '1px solid var(--light-border)'
                        }}>
                            {errorMessage ? (
                                <div>
                                    {errorMessage}
                                </div>
                            ) : ""}
                            {
                                uploadState == 1 ? (
                                    <SyntheticButton noHighlight={true} value={<div style={{'minWidth': '100px', 'display': 'flex', 'justifyContent': 'center'}}><Loading color="var(--light-text)" text={submitLoadingText} /></div>} />
                                ) : uploadState == 2 && !errorMessage ? (
                                    <SyntheticButton noHighlight={true} value={<div style={{'minWidth': '100px', 'display': 'flex', 'justifyContent': 'center'}}><Loading color="var(--light-text)" text={selectedItem.noRedirect ? submitLoadingText : "Redirecting"} /></div>} />
                                ) : (
                                    <SyntheticButton value={"Create"} onClick={() => handleCreateClick(selectedItem)} />
                                )
                            }
                        </div>
                    </Modal>
                    <Modal isOpen={alertModalOpen} close={() => {setAlertModalOpen(false); closeCallback()}} title={"Alert"}>
                        {errorMessage}
                    </Modal>
                </>
            ) : ""}
            
        </>
    )
}

