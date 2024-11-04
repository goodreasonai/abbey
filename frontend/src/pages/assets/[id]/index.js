import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import DefaultPage from '@/components/DefaultPage';
import { ADD_TO_WORKSPACE_TEMPLATES, DATA_TEMPLATES, getTemplateByCode } from '@/templates/template';
import Loading from '@/components/Loading/Loading';
import SyntheticButton from '@/components/form/SyntheticButton';
import EditIcon from '../../../../public/icons/EditIcon.png'
import DeleteIcon from '../../../../public/icons/DeleteIcon.png'
import CircleCheckIcon from '../../../../public/icons/CircleCheckIcon.png'
import RemoveIcon from '../../../../public/icons/RemoveIcon.png'
import ShareIcon from '../../../../public/icons/ShareIcon.png'
import Head from 'next/head';
import ControlledInputText from '@/components/form/ControlledInputText';
import PermissionsEntry from '@/components/form/PermissionsEntry';
import MyImage from '@/components/MyImage/MyImage';
import { deleteAsset } from '@/utils/requests';
import UsedBy from '@/components/UsedBy/UsedBy';
import CollapsibleMenu from '@/components/CollapsibleMenu/CollapsibleMenu';
import MoveIcon from '../../../../public/icons/MoveIcon.png'
import MoveToFolder from '@/components/assets-table/MoveToFolder';
import styles from './Asset.module.css'
import io from 'socket.io-client';
import shortenText from '@/utils/text';
import FadeOnLoad from '@/components/visuals/FadeOnLoad';
import Modal from '@/components/Modal/Modal';
import { Auth } from '@/auth/auth';

export default function Asset({ assetManifestRow, assetManifestRowLoadState }){

    const router = useRouter()
    const { id } = router.query
    const { getToken, isSignedIn } = Auth.useAuth()
    const { user } = Auth.useUser()

    const [isEditing, setIsEditing] = useState(false)
    const [editedTitle, setEditedTitle] = useState(assetManifestRow?.title)
    const [editedAuthor, setEditedAuthor] = useState(assetManifestRow?.author)
    const [editedDesc, setEditedDesc] = useState(assetManifestRow?.preview_desc)

    const [isEditingPermissions, setIsEditingPermissions] = useState(false)
    const [permissionsOptions, setPermissionsOptions] = useState([])
    const [jointPermissionsOptions, setJointPermissionsOptions] = useState([])
    const [userIdsToEmails, setUserIdsToEmails] = useState({})
    const [changePermissionsLoadState, setChangePermissionsLoadState] = useState(0)

    const [needNotHidden, setNeedNotHidden] = useState(false)
    
    const [clickedDelete, setClickedDelete] = useState(false)
    const [deleteLoadingState, setDeleteLoadingState] = useState(0)

    const [showMove, setShowMove] = useState(false)
    const [showDescription, setShowDescription] = useState(false)

    const [collabSocket, setCollabSocket] = useState(undefined)
    const [collabUsers, setCollabUsers] = useState([])
    const [collabErrorState, setCollabErrorState] = useState(false)

    const [alertData, setAlertData] = useState()

    const canEdit = assetManifestRow?.can_edit && assetManifestRowLoadState == 2

    const handleTitleClick = async () => {
        if (assetManifestRow['template']==='detached_chat'){
            setEditedTitle(document.getElementById("titleFromIndex").innerHTML)
            assetManifestRow['title'] = document.getElementById("titleFromIndex").innerHTML
        }
        if (canEdit) setIsEditing(true);
    }

    useEffect(() => {
        setIsEditingPermissions(false)
        setClickedDelete(false)
        setShowDescription(false)
        setDeleteLoadingState(0)
    }, [id])

    const handleInlineEdit = async () => {
        const token = await getToken()
        let url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/inline-edit`;
        let data = {
            'title': editedTitle,
            'author': editedAuthor,
            'preview_desc': editedDesc,
            'id': id
        }
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                body: JSON.stringify(data)
            });
            const myJson = await response.json(); //extract JSON from the http response
            if (myJson['response'] !== 'success'){
                throw new Error("Server returned failed: " + myJson['reason'])
            }
            else {
                assetManifestRow['title'] = editedTitle
                assetManifestRow['author'] = editedAuthor
                assetManifestRow['preview_desc'] = editedDesc
            }
        }
        catch (error) {
            console.error(error);
        }
        setIsEditing(false)
    }

    async function handleDeleteConfirmClick(deleteContents) {
        await deleteAsset(assetManifestRow['id'], await getToken(), deleteContents, setDeleteLoadingState)
    }

    // Log asset view
    useEffect(() => {
        async function makeLog(){
            if (!id){
                return;
            }
            const token = await getToken();
            let url = process.env.NEXT_PUBLIC_BACKEND_URL + `/activity/log`
            const args = {
                'asset_id': id,
                'type': 'view'
            }
            try {
                const response = await fetch(url, {
                    method:'POST',
                    headers:{'x-access-token': token, 'Content-Type': 'application/json'},
                    body: JSON.stringify(args)
                });
                const myJson = await response.json(); //extract JSON from the http response
                if (myJson['response'] !== 'success'){
                    throw new Error("Server returned failed - " + myJson['reason'])
                }
            }
            catch (error) {
                console.error("Log failed");
            }
        }
        makeLog();
    }, [id])

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleInlineEdit();
            e.preventDefault();  // Prevents the default form submission behavior
        }
    };

    useEffect(() => {
        setEditedTitle(assetManifestRow?.title);
        setEditedAuthor(assetManifestRow?.author);
        setEditedDesc(assetManifestRow?.preview_desc);
    }, [assetManifestRow, isEditing]); // should reset these if the inline edit is closed

    useEffect(() => {
        setIsEditing(false)
    }, [assetManifestRow])

    useEffect(() => {
        async function getAssetPermissions() {
            const token = await getToken();
            let url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/permissions?id=${id}`
            try {
                const response = await fetch(url, {headers:{'x-access-token': token}});
                const myJson = await response.json(); //extract JSON from the http response
                if (myJson['response'] !== 'success'){
                    // If it couldn't find the asset, it probably doesn't belong to the user
                    throw new Error("Server returned failed - " + myJson['reason'])
                }
                let loadedPermissions = myJson['results']
                let loadedJointPermissions = myJson['joints']
                setUserIdsToEmails(myJson['user_ids_to_emails'])

                let newPermissions = {public: 0, emailDomains: [], editDomains: [], users: []}
                let jointPermissions = {public: 0, emailDomains: [], editDomains: [], users: []}

                for (let [perms, newPerms] of [[loadedPermissions, newPermissions], [loadedJointPermissions, jointPermissions]]) {
                    for(let i = 0; i < perms.length; i++){
                        if (perms[i].public){
                            newPerms.public = perms[i].public;
                        }
                        if (perms[i].email_domain){
                            newPerms.emailDomains.push(perms[i].email_domain)
                        }
                        if (perms[i].can_edit && perms[i].can_edit === 1){
                            newPerms.editDomains.push(perms[i].email_domain)
                        }
                        if (perms[i].user_id){
                            newPerms.users.push(perms[i].user_id)
                        }
                    }
                }
                
                setPermissionsOptions(newPermissions)
                setJointPermissionsOptions(jointPermissions)
            }
            catch (error) {
                console.error(error);
            }
        }
        if (id && isSignedIn === true){
            getAssetPermissions()
        }
    }, [id, isSignedIn])
        

    async function handlePermissionsSubmit() {
        const token = await getToken();
        let url = process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/set-permissions"
        let data = {
            'id': id,
            'edit_domains': permissionsOptions['editDomains'],
            'email_domains': permissionsOptions['emailDomains'],
            'public': permissionsOptions['public'],
        }

        try {
            setChangePermissionsLoadState(1)
            const response = await fetch(url, {
                method: 'POST', 
                headers: {'Content-Type': 'application/json', "x-access-token": token},
                body: JSON.stringify(data)
            });
            const myJson = await response.json(); //extract JSON from the http response
            setChangePermissionsLoadState(2)
            if (myJson['response'] !== 'success'){
                throw new Error("Server returned failed")
            }
        }
        catch (e) {
            setChangePermissionsLoadState(3)
            console.error(e)
        }
    }

    useEffect(() => {
        if (permissionsOptions && isEditingPermissions){
            handlePermissionsSubmit()
        }
    }, [permissionsOptions])

    useEffect(() => {
        if (!assetManifestRow){
            return ()=>{}
        }
        const assetTemplate = getTemplateByCode(assetManifestRow['template'])
        if (!assetTemplate.constructor.collab){
            return ()=>{}
        }
        if (isSignedIn === undefined){  // isSignedIn will be true or false once that's resolved.
            return ()=>{}
        }
        
        // Connect to the WebSocket server
        const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL + '/collab');
        newSocket.on('connect', async function() {
            console.log('Collab socket connected to the server.');
            setCollabErrorState(false)
            newSocket.emit('join', {'asset_id': id, 'token': await getToken()})

            newSocket.on('user_update', (data) => {
                setCollabUsers(data.users);
            });
            // TODO emit join room
            setCollabSocket(newSocket)
        });
        return async () => {
            // TODO emit close room
            setCollabSocket(undefined)
            newSocket.close()
        };
    }, [id, isSignedIn]);

    // Socket error handling
    useEffect(() => {
        if (!collabSocket){
            return
        }
        // Function to handle socket errors
        const handleSocketError = (error) => {
            console.log("Socket error:")
            console.log(error)
            setCollabErrorState(true)
        };

        const handleReconnect = (attemptNumber) => {
            console.log('Socket reconnected after', attemptNumber, 'attempts');
            setCollabErrorState(false);
        };
    
        collabSocket.on('connect', () => setCollabErrorState(false));
        collabSocket.on('disconnect', () => {console.log("Socket disconnect?"); setCollabErrorState(true)});
        collabSocket.on('error', handleSocketError);
        collabSocket.on('reconnect', handleReconnect);
    
        return () => {
            try {
                collabSocket.off('connect');
                collabSocket.off('disconnect');
                collabSocket.off('error', handleSocketError);
                collabSocket.off('reconnect', handleReconnect);
            }
            catch(e){}            
        };
    }, [collabSocket]);

    useEffect(() => {

        async function checkForAlert(){
            try {
                const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/user/alert"
                const response = await fetch(url, {
                    'headers': {
                        'x-access-token': await getToken(),
                        'Content-Type': 'application/json'
                    },
                    'method': 'GET'
                })
                const myJson = await response.json()
                if (myJson.data){
                    setAlertData(myJson.data)
                }
            }
            catch(e) {
                console.log(e)
            }
        }

        if (assetManifestRow?.id && isSignedIn){
            function wasRecentlyUploaded(timeUploaded){
                const uploadedTime = new Date(timeUploaded.replace('Z', '') + 'Z'); // Append 'Z' to treat it as UTC
                const currentTime = new Date();
                const timeDifference = currentTime - uploadedTime;                    
                const msDiff = 5 * 60 * 1000;  // has to be uploaded within last 5 minutes
                return timeDifference < msDiff;
            }
            const wasRecent = wasRecentlyUploaded(assetManifestRow.time_uploaded)
            const isRelevantTemplate = ADD_TO_WORKSPACE_TEMPLATES.includes(assetManifestRow.template)
            if (isRelevantTemplate && wasRecent){
                checkForAlert()
            }
        }
    }, [assetManifestRow, isSignedIn])
    

    if (!assetManifestRow){
        console.log("No asset manifest row.")

        // I don't think this error log actually gets through ... but can't hurt to try?
        async function sendErrorLog(){
            try {
                const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/activity/log"
                const data = {
                    'asset_id': id,
                    'type': 'manifest-undefined-error',
                    'metadata': JSON.stringify({'assetManifestRowLoadState': assetManifestRowLoadState})
                }
                const response = await fetch(url, {
                    'headers': {
                        'x-access-token': await getToken(),
                        'Content-Type': 'application/json'
                    },
                    'body': JSON.stringify(data),
                    'method': 'POST'
                })
                const myJson = await response.json()
                console.log(myJson)
            }
            catch(e) {
                console.log(e)
            }
        }

        sendErrorLog()

        setTimeout(() => {
            try {
                window.location.reload()
            }
            catch(e){}
        }, 500)
        
        return (
            <DefaultPage>
                Working on it...
            </DefaultPage>
        )
    }

    let deleteArea = ""
    if (canEdit){
        if (clickedDelete){
            if (deleteLoadingState == 1){
                deleteArea = <Loading text="" />
            }
            else if (deleteLoadingState == 0 || deleteLoadingState == 3){
                if (assetManifestRow['template'] == 'folder'){
                    deleteArea= (
                        <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                            <SyntheticButton value={(
                                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px', 'fontSize': '.8rem'}}>
                                    <MyImage src={DeleteIcon} alt={"Delete"} width={15} height={15} />
                                    Contents
                                </div>
                            )} style={{'padding': '3px', 'paddingLeft': '10px', 'paddingRight': '10px'}} onClick={() => handleDeleteConfirmClick(true)} />
                            <SyntheticButton value={(
                                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px', 'fontSize': '.8rem'}}>
                                    <MyImage src={DeleteIcon} alt={"Delete"} width={15} height={15} />
                                    Folder
                                </div>
                            )} style={{'padding': '3px', 'paddingLeft': '10px', 'paddingRight': '10px'}} onClick={() => handleDeleteConfirmClick()} />                        
                        </div>
                    )
                }
                else {
                    deleteArea = (
                        <div>
                            <SyntheticButton value={"Confirm"} style={{'fontSize': '.8rem', 'fontFamily': 'var(--font-body)', 'padding': '2px', 'paddingLeft': '10px', 'paddingRight': '10px'}} onClick={() => handleDeleteConfirmClick()} />
                        </div>
                    )
                }
                
            }
            else if (deleteLoadingState == 2){
                deleteArea = "Deleted"
            }
        }
        else {
            deleteArea = (
                <MyImage title="Delete" className={"_clickable"} src={DeleteIcon} width={20} height={20} alt='Delete' onClick={() => setClickedDelete(true)} />
            )
        }
    }

    if (!assetManifestRow || assetManifestRowLoadState != 2){
        if (assetManifestRowLoadState == -1 && isSignedIn){  // if a token wasn't found server side, but the client thinks the user is signed in
            router.reload()
            return (
                <DefaultPage>
                    <div>
                        Reloading...
                    </div>
                </DefaultPage>
            )
        }
        return (
            <DefaultPage>
                <div>
                    Load failed. Do you have permission to view this?
                </div>
            </DefaultPage>
        )
    }

    const assetTemplate = getTemplateByCode(assetManifestRow['template'])

    let dpProps = {}
    if (assetTemplate.constructor.altBackgroundColor){
        dpProps['backgroundColor'] = assetTemplate.constructor.altBackgroundColor
    }
    if (assetTemplate.constructor.fixHeight){
        dpProps['mainDivStyle'] = {'height': 'calc(100vh - var(--nav-bar-height))'}
        dpProps['noFooter'] = true
    }
    if (assetTemplate.constructor.footerStyle){
        dpProps['footerStyle'] = assetTemplate.constructor.footerStyle
    }

    let parentStyle = {'flex': '1', 'minHeight': '0px'}  // The min height makes it so that it doesn't expand the entire flex box on overflow
    if (!assetTemplate.constructor.noMargins){
        parentStyle = {...parentStyle, 'marginLeft': 'var(--std-margin)', 'marginRight': 'var(--std-margin)'}
    }
    if (assetTemplate.constructor.fixHeight){
        parentStyle = {...parentStyle, 'position': 'relative'}
    }

    return (
        <DefaultPage mustSignIn={!assetTemplate.constructor.noSignIn} noMargin={true} {...dpProps}>
            <Head>
                <title>{assetManifestRow['title']}</title>
                <meta name="description" content={assetManifestRow['preview_desc']} />
            </Head>
            <div style={{'height': '100%', 'display': 'flex', 'flexDirection': 'column', ...(assetTemplate.constructor.noMargins ? {} : {'gap': 'var(--std-margin-top'})}}>
                <div style={{'backgroundColor': 'var(--light-primary)', 'borderBottom': '1px solid var(--light-border)', 'padding': '10px', 'paddingLeft': 'var(--std-margin)', 'paddingRight': 'var(--std-margin)', 'fontSize': '.9rem'}}>
                    <CollapsibleMenu openByDefault={true} noHeader={true} bodyContainerStyle={needNotHidden ? {'overflow': 'visible'} : {}}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', 'marginBottom': '10px', 'flexWrap': 'wrap'}}>
                            <div style={{ fontSize: '1rem', 'display': 'flex'}}>
                                {isEditing ? (
                                    <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                                        <ControlledInputText 
                                            placeholder={assetManifestRow['title']}
                                            value={editedTitle}
                                            onKeyPress={handleKeyPress}
                                            setValue={(x) => setEditedTitle(x)} 
                                            inputStyle={{
                                                border: 'none',
                                                borderBottom: '1px solid gray',
                                                padding: '0',
                                                background: 'none',
                                                outline: 'none',
                                                minWidth: '20vw',
                                                borderRadius: '0px'
                                            }}
                                            size={'15'}
                                        />
                                        <span style={{ color: 'var(--passive-text)' }}>by</span>
                                        <ControlledInputText 
                                            placeholder={assetManifestRow['author']}
                                            value={editedAuthor} 
                                            setValue={setEditedAuthor}
                                            onKeyPress={handleKeyPress}
                                            inputStyle={{
                                                border: 'none',
                                                borderBottom: '1px solid gray',
                                                padding: '0',
                                                background: 'none',
                                                outline: 'none',
                                                borderRadius: '0px'
                                            }}
                                            size={'10'}
                                        />
                                        <MyImage onClick={handleInlineEdit} src={CircleCheckIcon} height={20} width={20} alt={'Submit'} style={{'cursor': 'pointer'}} />
                                        <MyImage onClick={() => setIsEditing(false)} src={RemoveIcon} height={20} width={20} alt={'Cancel'} style={{'cursor': 'pointer'}} />
                                    </div>
                                ) : (
                                    <span onClick={handleTitleClick} style={canEdit ? {'cursor': 'pointer'} : {}}>
                                        {/* Not good practice here with the id, but simplifies drastically */}
                                        <span id="titleFromIndex">
                                            {assetManifestRow['title']}
                                        </span>
                                        {
                                            assetManifestRow['author'] ? (
                                                <span style={{ color: 'var(--passive-text)' }}>
                                                    {` by ${assetManifestRow['author']}`}
                                                </span>
                                            ) : ""
                                        }
                                    </span>
                                )}
                            </div>
                            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                                {canEdit && !isEditing ? (
                                    <MyImage title="Edit" className={"_clickable"} src={EditIcon} width={20} height={20} alt='Edit' onClick={() => setIsEditing(true)} />
                                ) : ""}
                                {deleteArea}
                                {isSignedIn ? <MyImage title="Put into folder" className={"_clickable"} src={MoveIcon} width={20} height={20} alt="Add to a Folder" onClick={() => setShowMove(!showMove)} /> : "" }
                            </div>
                            <div style={{'flex': '1', 'display': 'flex'}}>
                                <div title={assetManifestRow['preview_desc']} className={styles.seeDescription} onClick={() => {setShowDescription(!showDescription)}}>
                                    {showDescription ? `Hide Description` : `See Description`}
                                </div>
                            </div>
                            {assetTemplate.constructor.collab ? (<Collab collabUsers={collabUsers} />) : ""}
                            {canEdit ? (
                                <div className={`${styles.shareButton} _clickable`} id={"EditAssetPermissions"} onClick={() => setIsEditingPermissions(!isEditingPermissions)}>
                                    <MyImage title="Share" src={ShareIcon} height={15} width={15} alt={"Share"}/>
                                    Share
                                </div>
                            ) : ("")}
                            <div>
                                <UsedBy assetId={assetManifestRow['id']} label='Used By...' openCallback={() => {setNeedNotHidden(true)}} closeCallback={() => {setNeedNotHidden(false)}} />
                            </div>
                        </div>
                        {showMove || showDescription || (canEdit && isEditing) ? (
                            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                                {canEdit && isEditing ? (
                                    <ControlledInputText
                                        value={editedDesc}
                                        onKeyPress={handleKeyPress}
                                        setValue={(x) => setEditedDesc(x)}
                                        inputStyle={{'backgroundColor': 'var(--light-background)'}} />
                                ) : (showDescription ? (
                                    <div
                                        title={assetManifestRow['preview_desc']}
                                        className={`${styles.desc}`}
                                        >
                                        {assetManifestRow['preview_desc']}
                                    </div>
                                ) : "")}
                                {   /* Also title needs to be true in the case where the user can't view the asset. */
                                    showMove && assetManifestRow['title'] ? (
                                        <div>
                                            <MoveToFolder flexDirection='row' topText={`Put "${assetManifestRow['title']}" in a folder.`} resultLimit={15} assetId={assetManifestRow.id} closeCallback={() => {setShowMove(false)}} outsideClickCallback={() => {}} />
                                        </div>
                                    ) : ""
                                }
                            </div>
                        ) : ""}
                    </CollapsibleMenu>
                </div>
                <div style={parentStyle}>
                    {deleteLoadingState != 2 ? (
                        <assetTemplate.Element assetManifestRow={assetManifestRow} canEdit={canEdit} {...(collabSocket ? {'collabSocket': collabSocket} : {})} />
                    ) : (
                        assetTemplate.constructor.noMargins ? (
                            <div style={{'margin': 'var(--std-margin)'}}>
                                Deleted
                            </div>
                        ) : "Deleted"
                    )}
                </div>
            </div>
            {collabSocket && collabErrorState ? (
                <div style={{'position': 'fixed', 'right': 'var(--std-margin)', 'bottom': 'var(--std-margin-top)', 'zIndex': '10000', 'backgroundColor': 'var(--dark-primary)', 'padding': '5px 10px', 'borderRadius': 'var(--small-border-radius)', 'fontSize': '1.25rem', 'color': 'var(--light-text)', 'display': 'flex', 'gap': '10px'}}>
                    {`Connection Error`}
                    <Loading text="" color='var(--light-text)' />
                </div>
            ) : ""}
            {alertData && deleteLoadingState != 2 ? (
                <FadeOnLoad duration='1s'>
                    <SuggestionAlert
                        alertData={alertData}
                        alertType={'combine-into-notebook'}
                        manifestRow={assetManifestRow}
                        callback={() => setAlertData(undefined)}
                    />
                </FadeOnLoad>
            ) : ""}
            <Modal title={"Edit Permissions"} isOpen={isEditingPermissions} close={() => setIsEditingPermissions(false)} preventCloseLoading={changePermissionsLoadState==1}>
                <PermissionsEntry
                    optionsVar={permissionsOptions}
                    setOptionsVar={setPermissionsOptions} 
                    jointPermissions={jointPermissionsOptions}
                    userIdsToEmails={userIdsToEmails}
                    assetManifest={assetManifestRow}
                />
            </Modal>
            
        </DefaultPage>
    );
}


//export async function getServerSideProps(context) {
export const getServerSideProps = async (ctx) => {

    const { ssAuthGetToken } = await import('@/auth/ssAuth');
    const token = await ssAuthGetToken(ctx)
    
    const id = ctx.query.id;

    let assetManifest = {}
    let loadState = 1;

    let url = process.env.NEXT_SERVER_SIDE_BACKEND_URL + `/assets/manifest-row?id=${id}`
    try {
        const response = await fetch(url, {headers:{'x-access-token': token}});
        const myJson = await response.json(); //extract JSON from the http response
        if (myJson['response'] !== 'success'){
            throw new Error("Server returned failed - " + myJson['reason'])
        }
        assetManifest = myJson['result'];
        loadState = 2;
    }
    catch (e) {
        console.log(e);
        if (!token){
            return {
                props: {
                    assetManifestRow: {},
                    assetManifestRowLoadState: -1  // we use a special load state of -1
                }
            }
        }
        loadState = 3;
    }

    return {
        props: {
            assetManifestRow: assetManifest,
            assetManifestRowLoadState: loadState
        }
    };
}

function Collab({ collabUsers }) {
    return (
        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px', 'flexWrap': 'wrap'}}>
            {collabUsers.map((item, i) => {
                let initial = "A"
                if (item.first_name?.length){
                    initial = item.first_name.substring(0, 1).toUpperCase()
                }
                else if (item.last_name?.length){
                    initial = item.last_name.substring(0, 1).toUpperCase()
                }
                else if (item.email_address?.length){
                    initial = item.email_address.substring(0, 1).toLowerCase()
                }

                let name = "Anonymous"
                if (item.first_name && item.last_name){
                    name = `${item.first_name} ${item.last_name}`
                }
                else if (item.first_name){
                    name = `${item.first_name}`
                }
                else if (item.email_address) {
                    name = item.email_address
                }

                let gradientStartColor = 'var(--dark-primary)'
                const n = 3
                if (i % n == 1){
                    gradientStartColor = 'var(--logo-red)'
                }
                else if (i % n == 2){
                    gradientStartColor = 'var(--logo-blue)'
                }

                return (
                    <div key={`${item.sid}`} title={name} style={{'position': 'relative', 'width': 20, 'height': 20, 'overflow': 'hidden', 'borderRadius': '50%', 'cursor': 'default'}}>
                        <div style={{'width': '100%', 'height': '100%', 'position': 'absolute', 'left': '0px', 'top': '0px', 'background': `linear-gradient(45deg, ${gradientStartColor}, var(--dark-secondary))`}}></div>
                        <div style={{'height': '100%', 'width': '100%', 'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center', 'position': 'relative', 'fontSize': '16px', 'color': 'var(--light-text)'}}>
                            {initial}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}


function SuggestionAlert({ alertData, callback, manifestRow, alertType }) {

    const { getToken } = Auth.useAuth()
    const router = useRouter()
    const [respondLoadState, setRespondLoadState] = useState(0)

    async function respond(accepted){
        try {
            setRespondLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/user/alert-respond"
            const data = {
                'id': manifestRow.id,
                'accepted': accepted,
                'type': alertType,
                'data': alertData
            }
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'body': JSON.stringify(data),
                'method': 'POST'
            })
            const myJson = await response.json()
            if (myJson.id){
                await router.push(`/assets/${myJson.id}`)
                callback()
                setRespondLoadState(2)
            }
            else {
                callback()
                setRespondLoadState(2)
            }
        }
        catch(e) {
            setRespondLoadState(3)
            console.log(e)
        }
    }

    const assetsToCombine = alertData.results
    let text = `Add`
    let more = 0
    for (let i = 0; i < assetsToCombine.length; i++){
        const thisAsset = assetsToCombine[i]
        if (i < 2 || (i == 2 && assetsToCombine.length > 3)){
            text += ` "${shortenText(thisAsset.title, 3, 25, true)}",`
        }
        else if (i < 3 && assetsToCombine.length == 3) {
            text += ` and "${shortenText(thisAsset.title, 3, 25, true)}"`
        }
        else {
            more++
        }
    }
    // TODO: ... and x more
    if (more > 0){
        text += ` and ${more} more to a Workspace?`
    }
    else {
        text += " to a Workspace?"
    }

    return (
        <div className={styles.suggestionAlertContainer}>
            <div className={styles.suggestionAlert}>
                <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                    <div>
                        {text}
                    </div>
                    {respondLoadState == 1 ? (
                        <Loading text="" />
                    ) : (
                        <>
                            <MyImage onClick={() => respond(true)} className={"_clickable"} src={CircleCheckIcon} alt={"Check"} width={20} height={20} />
                            <MyImage onClick={() => respond(false)} className={"_clickable"} src={RemoveIcon} alt={"Check"} width={20} height={20} />
                        </>
                    )}
                </div>
            </div>
            <div className={styles.suggestRecommended}>
                Recommended
            </div>
        </div>
    )
}
