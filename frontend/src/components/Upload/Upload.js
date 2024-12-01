import { useState, useEffect, useRef, useMemo } from "react";
import { Auth } from "@/auth/auth";
import styles from './Upload.module.css'
import TemplateChooser from "@/components/form/TemplateChooser";
import PermissionsEntry from "@/components/form/PermissionsEntry";
import { getTemplateByCode } from "@/templates/template";
import Loading from "@/components/Loading/Loading";
import ControlledInputText from "@/components/form/ControlledInputText";
import { useRouter } from "next/router";
import SyntheticButton from "@/components/form/SyntheticButton";
import EraseIcon from '../../../public/icons/EraseIcon.png'
import ShareIcon from '../../../public/icons/ShareIcon.png'
import { DEFAULT_PERMISSIONS } from "@/config/config";
import MyImage from "@/components/MyImage/MyImage";
import { stripExt } from "@/utils/fileResponse";
import { getUserName } from "@/utils/user";
import BackIcon from '../../../public/icons/BackIcon.png'
import FadeOnLoad from "@/components/visuals/FadeOnLoad";
import CircleCheckIcon from '../../../public/icons/CircleCheckIcon.png'


export function getDefaultDescription(templateCode){
    const templateObj = getTemplateByCode(templateCode)
    const readableName = templateObj.constructor.readableName

    const adj = [
        'elite',
        'honored',
        'esteemed',
        'respected',
        'exceptional',
        'preferred',
        'cherished',
        'valued',
        'revered',
        'distinguished'
    ]

    const noun = [
        'guest',
        'user',
        'human',
        'homie',
        'customer',
        'member',
        'client',
        'patron'
    ]

    const adjIndex = Math.floor(Math.random() * adj.length);
    const nounIndex = Math.floor(Math.random() * noun.length);

    return `${readableName} for ${adj[adjIndex]} ${noun[nounIndex]}`
}


// You set assetId to not null if it's an edit page
export default function Upload({ assetId=null }){

    const router = useRouter();

    const { getToken, isSignedIn } = Auth.useAuth();

    const [errorMessage, setErrorMessage] = useState(null);
    const [uploadedAssetId, setUploadedAssetId] = useState(null);
    const [uploadState, setUploadState] = useState(0);
    const templateContentEntry = useRef()
    const [allowedTemplates, setAllowedTemplates] = useState([])
    const [chosenTemplate, setChosenTemplate] = useState("")
    const [uploadProgress, setUploadProgress] = useState(0)
    const [permissionsChecked, setPermissionsChecked] = useState(false)
    
    const [assetCounts, setAssetCounts] = useState(false)
    const [assetCountsLoadState, setAssetCountsLoadState] = useState(0)

    const [stage, setStage] = useState("chooseTemplate")  // chooseTemplate || tmpSpecific
    const chooserContainerRef = useRef()
    const tmpSpecificContainerRef = useRef()
    const stageContainerRef = useRef()

    const innerTmpSpecificRef = useRef()

    const { user } = Auth.useUser();

    useEffect(() => {
        if (user){
            setGeneralFields((prev) => {return {...prev, 'author': {...prev['author'], defaultValue: getUserName(user)}}})
        }
    }, [user])

    // State for the input fields that are not template specific
    // Template done separately
    const generalFieldsDefault = {
        'title': {name: 'title', mandatory: false, value: "", defaultValue: 'Untitled'},
        'author': {name: 'author', mandatory: false, value: "", defaultValue: 'Me'},
        'preview_desc': {name: 'preview description', mandatory: false, value: "", getDefaultValue: getDefaultDescription},
        'lm_desc': {name: 'language model description', mandatory: false, value: ""},
        'permissions': {name: 'permissions', mandatory: false, value: JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS))}
    }
    const [generalFields, setGeneralFields] = useState(generalFieldsDefault)

    // Used for template specific data
    const [otherData, setOtherData] = useState({});

    // Get allowed templates for user upload
    useEffect(() => {
        async function getAssetTypes() {
            const token = await getToken();
            let url = process.env.NEXT_PUBLIC_BACKEND_URL + `/user/templates`
            try {
                const response = await fetch(url, {headers:{'x-access-token': token}});
                const myJson = await response.json(); //extract JSON from the http response
                if (myJson['response'] !== 'success'){
                    // If it couldn't find the asset, it probably doesn't belong to the user
                    throw new Error("Server error - " + myJson['reason'])
                }
                let loadedTemplates = myJson['results']
                setAllowedTemplates(loadedTemplates)
            }
            catch (error) {
                console.error(error);
            }
        }

        if (!allowedTemplates.length && isSignedIn !== undefined){
            getAssetTypes();
        }
    }, [isSignedIn])


    // note that this function returns quickly (before upload is complete) due to XHR
    // only async due to await getToken()
    async function submit(){

        const formData = new FormData();

        // Template specific form data
        let templateObj = getTemplateByCode(chosenTemplate)
        
        // Note again that this data is only template specific (i.e., doesn't include permissions)
        let templateFormData = templateObj.getUploadData(document, otherData, assetId)  // assetId/"editing" is really a bool
        // Result of getUploadData is expected to be of same form as realFields
        // Poor man's deep copy (the json thing)

        let realFields = {...generalFields, ...templateFormData}

        // Check if all mandatory fields are in and parse objects
        for (let [key, value] of Object.entries(realFields)) {
            if (value.mandatory && !value.value){
                setErrorMessage("Please enter a value for the " + value.name + " field.")
                setUploadState(3);
                return
            }

            if (!value.value && (value.defaultValue || value.getDefaultValue)){
                if (value.defaultValue){
                    formData.set(key, value.defaultValue)
                }
                else if (!value.value && value.getDefaultValue){
                    formData.set(key, value.getDefaultValue(chosenTemplate))
                }

                if (key == 'preview_desc'){
                    formData.set('using_auto_desc', 1)
                }
                else if (key == 'title'){
                    formData.set('using_auto_title', 1)
                    if (chosenTemplate === 'document'){
                        try {
                            let name = stripExt(templateFormData.files.value.name).replaceAll("_", " ")
                            formData.set('using_auto_title', "")
                            formData.set('title', name)
                        }
                        catch {}
                    }
                }
            }

            let newVal = realFields[key].value
            // This is not the best
            // Basically, this was catching "files" in addition to actual objects
            // So now it only applies to things in generalFields (i.e., permissions)
            // Theoretically you can avoid this by stringifying things in the getUploadData function on the non-general fields side
            if (key != 'files' && key != 'file'){
                if (typeof(value.value) === 'object' &&
                !Array.isArray(value.value) &&
                value.value !== null){
                    newVal = JSON.stringify(realFields[key].value)
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
                formData.append(key, newVal)
            }
        }

        formData.append('template', chosenTemplate)

        const token = await getToken({ template: process.env.NEXT_PUBLIC_LONG_TOKEN_NAME });
        const url = new URL(process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/upload`);

        setUploadState(1);
        
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
                            setUploadState(3);
                            // Template may have a specific fixer interface (PDF page selection, for example)
                        }
                        else {
                            throw new Error("Server returned failed with " + myJson['reason'])
                        }
                    }
                    else {
                        const assetId = myJson['asset_id'];
                        setUploadedAssetId(assetId);
                        setUploadState(2);
                        router.push(`/assets/${assetId}`)
                    }
                }
                catch(error) {
                    console.error(error);
                    setErrorMessage("Network error. Try again.");
                    setUploadState(3);
                }
            }
        };

        xhr.send(formData);
    }
    
    useEffect(() => {
        if (assetId){
            router.replace({
                query: { ...router.query, id: assetId, template: chosenTemplate }
            });
        }
    }, [chosenTemplate])

    useEffect(() => {
        if (router.query.template) {
            setChosenTemplate(router.query.template);
        }
    }, [router.query.template]);

    function transitionToTmpSpecific(){
        tmpSpecificContainerRef.current.style.left = '0px'
        chooserContainerRef.current.style.left = `-100%`
        setStage('tmpSpecific')
    }

    function transitionToChooseTemplate(){
        tmpSpecificContainerRef.current.style.left = `100%`
        chooserContainerRef.current.style.left = '0px'
        setStage('chooseTemplate')
    }

    useEffect(() => {
        if (chosenTemplate && stage == 'chooseTemplate'){
            transitionToTmpSpecific()
        }
    }, [chosenTemplate])

    async function getAssetCounts(){
        try {
            setAssetCountsLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/user/asset-counts"
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken()
                }
            })
            const myJson = await response.json()
            setAssetCounts(myJson)
            setAssetCountsLoadState(2)
        }
        catch(e) {
            console.log(e)
            setAssetCountsLoadState(3)
        }
    }
    
    useEffect(() => {
        if (isSignedIn){
            getAssetCounts()
        }
    }, [isSignedIn])

    const totalAssets = useMemo(() => {
        if (!assetCounts){
            return 0
        }
        const total = assetCounts.results?.reduce((accumulator, currentItem) => {
            return accumulator + currentItem.count;
        }, 0);
        return total
    }, [assetCounts])

    let errorDisplay = "";
    if (errorMessage && uploadState == 3){
        errorDisplay = (
            <div className={`${styles.errorDisplay}`}>
                {errorMessage}
            </div>
        );
    }

    const templateObj = chosenTemplate ? getTemplateByCode(chosenTemplate) : undefined

    let submissionText = ("")
    if (uploadState == 1){
        const defaultLoadingText = templateObj.constructor.customUploadProcessingText || 'Processing'
        const submitLoadingText = uploadProgress >= 100 ? defaultLoadingText : `${Math.round(uploadProgress)}% uploaded`
        submissionText = (<Loading text={submitLoadingText} color={"var(--light-text)"} />)
    }
    else if (uploadedAssetId){
        submissionText = (<Loading text={"Taking you there"} color={"var(--light-text)"} />)
    }

    let templateSpecificDisplay = templateObj && !templateObj.constructor.noUploadOptions ? (<templateObj.ExtraUploadFields otherData={otherData} setOtherData={setOtherData} />) : ""

    let textUploadFields = (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '5px'}}>
            <div>
                <ControlledInputText
                    placeholder="Title (optional)"
                    id='CreateTitle'
                    maxChar={75}
                    value={generalFields['title'].value}
                    setValue={(x) => setGeneralFields({...generalFields, 'title': {...generalFields['title'], 'value': x}})} />
            </div>
            <div>
                <ControlledInputText
                    placeholder="Author/Source (optional)"
                    id='CreateAuthor'
                    maxChar={50}
                    value={generalFields['author'].value}
                    setValue={(x) => setGeneralFields({...generalFields, 'author': {...generalFields['author'], 'value': x}})} />
            </div>
            <div className={`${styles.formRow}`}>
                <div>
                    <ControlledInputText placeholder="Description (optional)" id='CreateDescription'
                        value={generalFields['preview_desc'].value}
                        setValue={(x) => setGeneralFields({...generalFields, 'preview_desc': {...generalFields['preview_desc'], 'value': x}})} />
                </div>
            </div>
        </div>
    )

    let permissions = templateObj && !templateObj.constructor.hideShareField ? (
        <div>
            {permissionsChecked ? (
                <PermissionsEntry
                    handleMinimize={() => {setPermissionsChecked(!permissionsChecked)}}
                    optionsVar={generalFields['permissions'].value}
                    setOptionsVar={
                        (x) => {
                            setGeneralFields({...generalFields, 'permissions': {...generalFields['permissions'], 'value': x}})
                        }
                    } />
            ) : (
                <SyntheticButton
                    onClick={() => setPermissionsChecked(true)}
                    value={(
                        <div onClick={() => setPermissionsChecked(true)} style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                            <div>Add People</div>
                            <MyImage src={ShareIcon} id='CreateAddPeople' width={20} length={20} alt="Share"/>
                        </div>
                    )}
                />
            )}
        </div>
    ) : ""

    return (
        <div style={{'height': 'calc(100vh - var(--nav-bar-height))', 'display': 'flex', 'justifyContent': 'center', 'alignItems': 'center'}}>
            <div className={styles.mainContainer}>
                <div style={{'width': '100%', 'height': '100%', 'backgroundColor': 'var(--light-background)', 'border': '1px solid var(--light-border)', 'borderRadius': 'var(--large-border-radius)', 'display': 'flex', 'flexDirection': 'column', 'gap': '0px', 'overflow': 'hidden'}}>
                    <div style={{'width': '100%', 'height': '30px', 'backgroundColor': 'var(--dark-primary)', 'padding': '5px 10px', 'display': 'flex', 'alignItems': 'center', 'position': 'relative', 'justifyContent': 'center'}}>
                        {stage == 'tmpSpecific' ? (
                            <FadeOnLoad style={{'display': 'flex', 'alignItems': 'center', 'position': 'absolute', 'top': '50%', 'left': '10px', 'transform': 'translateY(-50%)'}}>
                                <MyImage className={"_clickable"} onClick={() => {transitionToChooseTemplate()}} src={BackIcon} width={20} height={20} alt={"Back"} />
                            </FadeOnLoad>
                        ) : ""}
                        {stage == 'chooseTemplate' && chosenTemplate ? (
                            <FadeOnLoad style={{'display': 'flex', 'alignItems': 'center', 'position': 'absolute', 'top': '50%', 'right': '10px', 'transform': 'translateY(-50%)'}}>
                                <MyImage className={"_clickable"} onClick={() => {transitionToTmpSpecific()}} src={BackIcon} width={20} height={20} alt={"Back"} style={{'rotate': '180deg'}} />
                            </FadeOnLoad>
                        ) : ""}
                        <div style={{'color': 'var(--light-text)'}}>
                            {chosenTemplate ? `${templateObj.constructor.readableName}` : 'Create'}
                        </div>
                    </div>
                    <div style={{'position': 'relative', 'flex': '1'}} ref={stageContainerRef}>
                        <div className={styles.stage} ref={chooserContainerRef} style={{'backgroundColor': 'var(--light-primary)', 'padding': '20px', 'overflow': 'scroll'}}>
                            <TemplateChooser
                                value={chosenTemplate}
                                setValue={setChosenTemplate}
                                onChange={() => {templateContentEntry && templateContentEntry.current && templateContentEntry.current.scrollIntoView({ behavior: 'smooth' });}}
                                allowedTemplates={allowedTemplates}
                                canChange={!assetId}
                                assetCountsLoadState={assetCountsLoadState}
                                totalLimit={assetCounts?.limit}
                                totalUserCount={totalAssets}
                            />
                        </div>
                        <div ref={tmpSpecificContainerRef} className={styles.stage} style={{'left': '100%'}}>
                            <div style={{'flex': '1', 'position': 'relative', 'overflow': 'scroll'}}>
                                <div ref={innerTmpSpecificRef} style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem', 'padding': '20px', 'height': '100%'}}>
                                    {templateObj && templateObj.ExtraCreateElement ? (<templateObj.ExtraCreateElement />) : ""}
                                    {templateSpecificDisplay ? (
                                        <div style={{'width': '100%'}}>
                                            {templateSpecificDisplay}
                                        </div>
                                    ) : ""}
                                    {chosenTemplate && !templateObj.constructor.hideGeneralFields ? textUploadFields : ("")}
                                    {chosenTemplate ? permissions : ("")}
                                </div>
                            </div>
                            <div style={{'backgroundColor': 'var(--light-primary)', 'position': 'sticky', 'bottom': '0px', 'left': '0px', 'width': '100%', 'display': 'flex', 'justifyContent': 'center', 'gap': '10px', 'alignItems': 'center', 'padding': '10px', 'borderTop': '1px solid var(--light-border)', 'fontSize': '1.25rem'}}>
                                {errorDisplay}
                                {chosenTemplate ? (
                                    <SyntheticButton style={{'fontSize': '1.25rem'}} value={submissionText || (<div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>Create <MyImage src={CircleCheckIcon} alt={"Check"} width={23} height={23} /></div>)} noHighlight={submissionText} onClick={submit} id='CreateSubmit'/>
                                ) : ("")}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
