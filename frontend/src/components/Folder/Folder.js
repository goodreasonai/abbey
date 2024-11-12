import AssetsTable from "../assets-table/AssetsTable";
import Chat from "../Chat/Chat";
import Button from "../form/Button";
import Link from 'next/link'
import { Auth } from "@/auth/auth";
import fileResponse from "@/utils/fileResponse";
import { useState, useEffect, useMemo } from "react";
import Loading from "../Loading/Loading";
import { getTemplateByCode } from "@/templates/template";
import FolderIcon from "../../../public/icons/FolderIcon.png";
import CollapsibleMenu from "../CollapsibleMenu/CollapsibleMenu";
import AddToFolder from "./AddToFolder";
import SyntheticButton from "../form/SyntheticButton";
import MyImage from "../MyImage/MyImage";
import DownloadIcon from '../../../public/icons/DownloadIcon.png'
import AddIcon from '../../../public/icons/AddIcon.png'
import Quick from "../Quick/Quick";
import UpIcon from '../../../public/icons/UpIcon.png'
import CurriculumIcon from '../../../public/icons/CurriculumIcon.png'
import { handleGeneralStreaming } from "@/utils/streaming";
import { DIVIDER_TEXT } from "@/config/strConstants";
import Tooltip from "../Tooltip/Tooltip";
import WarningIcon from '../../../public/icons/WarningIcon.png'
import { useRouter } from "next/router";
import CreateWrapper from "../Quick/CreateWrapper";
import styles from './Folder.module.css'
import { DISABLE_OCR } from "@/config/config";
import SmartHeightWrapper from "../SmartHeightWrapper/SmartHeightWrapper";
import TwoPanel from "../TwoPanel/TwoPanel";


export default function Folder({ manifestRow, canEdit, ...props }){

    const { getToken, isSignedIn } = Auth.useAuth()

    const [sourcesLoadState, setSourcesLoadState] = useState(0)
    const [sources, setSources] = useState()
    const [addToFolderOpen, setAddToFolderOpen] = useState(false)
    const [forceRefresh, setForceRefresh] = useState(false)

    const [uploadFileMoveLoading, setUploadFileMoveLoading] = useState(0)
    
    const [buildCourseUpdateText, setBuildCourseUpdateText] = useState("Loading")
    const [buildCourseUpdateState, setBuildCourseUpdateState] = useState(0)
    const [buildCourseUpdateAssetId, setBuildCourseUpdateAssetId] = useState(undefined)
    const [newFolderLoading, setNewFolderLoading] = useState(false)

    const [downloadLoadState, setDownloadLoadState] = useState(0)

    useEffect(() => {
        async function getSources(){
            try {
                setSourcesLoadState(1)
                const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/sources-info?id=${manifestRow['id']}`
                const response = await fetch(url, {
                    'headers': {
                        'x-access-token': await getToken()
                    },
                    'method': 'GET'
                })
                const myJson = await response.json()
                setSources(myJson['results'].filter((item) => {
                    return getTemplateByCode(item.template).constructor.chattable
                }))
                setSourcesLoadState(2)
            }
            catch (e) {
                console.log(e)
                setSourcesLoadState(3)
            }
        }

        if (manifestRow['id'] && isSignedIn !== undefined){
            getSources()
            setDownloadLoadState(0)
            setBuildCourseUpdateAssetId(undefined)
            setBuildCourseUpdateText("")
            setBuildCourseUpdateState(0)
        }
    }, [manifestRow.id, isSignedIn])

    const initiateDownload = async () => {
        try {
            setDownloadLoadState(1)
            const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/files?id=${manifestRow['id']}`, {
                method: 'GET',
                headers: {
                    'x-access-token': await getToken(),
                },
            });
        
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            setDownloadLoadState(2)
            fileResponse(response)
        }
        catch (error) {
            setDownloadLoadState(3)
            console.error('There was a problem fetching the file:', error);
        }
    }; //e

    // Don't need to bother with the actual upload, just need to add it to the folder and display it.
    async function addToFolder(assetRow){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/add-resource"
            const data = {
                'id': manifestRow['id'],
                'resource_id': assetRow.id
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
            setForceRefresh(!forceRefresh)
        }
        catch(e){
            console.log(e)
        }
    }

    async function buildCourse(){
        try {
            setBuildCourseUpdateState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/curriculum/build-from-folder`
            const data = {
                'id': manifestRow['id']
            }
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

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            
            await handleGeneralStreaming({
                reader: reader,
                decoder: decoder,
                onSnippet: (result)=>{
                    let splitsville = result.split(DIVIDER_TEXT)
                    if (splitsville.length <= 0){
                        return
                    }
                    let last = splitsville.length - 1
                    while (last > 0){
                        try {
                            let parsed = JSON.parse(splitsville[last])
                            if (parsed['error']){
                                setBuildCourseUpdateState(3)
                                return
                            }
                            setBuildCourseUpdateText(parsed['text'])
                            if (parsed['asset_id']){
                                setBuildCourseUpdateAssetId(parsed['asset_id'])
                                setBuildCourseUpdateState(2)
                            }
                            return
                        }
                        catch(e) {
                            console.log(e)
                            last = last - 1
                        }
                    }
                }
            })
        }
        catch(e) {
            setBuildCourseUpdateState(3)
        }
    }

    let buildCourseText = "Build Course"
    let buildCourseImage = (
        <MyImage src={CurriculumIcon} alt={"Download"} width={20} height={20} />
    )
    if (buildCourseUpdateState == 1){
        buildCourseImage = <Loading color="var(--light-text)" text="" />
        buildCourseText = buildCourseUpdateText
    }
    else if (buildCourseUpdateState == 2){
        buildCourseText = "Go to Course"
    }
    else if (buildCourseUpdateState == 3){
        buildCourseText = "Error"
        buildCourseImage = ""
    }

    let buildCourseButton = (
        <SyntheticButton onClick={(buildCourseUpdateState == 0 ? () => buildCourse() : ()=>{})} value={(
            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                {buildCourseText}
                {buildCourseImage}
            </div>
        )} />
    )
    if (buildCourseUpdateAssetId){
        buildCourseButton = (
            <Link href={`/assets/${buildCourseUpdateAssetId}`}>
                {buildCourseButton}
            </Link>
        )
    }

    if (!isSignedIn){
        const router = useRouter()
        const currentUrl = `${router.asPath}`;
        buildCourseButton = (
            <Tooltip content={"Sign in to make course"} verticalAlign="bottom">
                <Link href={`${Auth.getSignInURL(currentUrl)}`}>
                    <div style={{'pointerEvents': 'none', 'opacity': '.5'}}>
                        {buildCourseButton}
                    </div>
                </Link>
            </Tooltip>
        )
    }

    let downloadIconDisplay = <MyImage src={DownloadIcon} alt={"Download"} width={20} height={20} />
    if (downloadLoadState == 1){
        downloadIconDisplay = <Loading color="var(--light-text)" text="" />
    }
    else if (downloadLoadState == 3){
        downloadIconDisplay = (
            <Tooltip content={"Error Downloading"}>
                <MyImage src={WarningIcon} alt={"Warning"} width={20} height={20} />
            </Tooltip>
        )
    }

    // It was getting retriggered a lot, which is bad, beacuse it's an expensive thing.
    let chatComponent = useMemo(() => {
        return (
            <Chat
                manifestRow={manifestRow}
                id={manifestRow['id']}
                splitSummary={true}
                splitSummarySources={sources}
                allowOCR={true && !DISABLE_OCR}
            />
        )
    }, [manifestRow.id, sources])

    return (
        <TwoPanel
            hideRightPanel={!sources?.length || manifestRow?.group_id}
            leftPanel={(
                <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem', 'width': '100%'}}>
                    <CollapsibleMenu openByDefault={true} noHeader={true} bodyContainerStyle={isSignedIn ? {} : {'overflow': 'visible'} /* NOTE: when signed out, no need for Add To Folder transition + need for tooltips */}>
                        <div style={{'display': 'flex', 'gap': '10px'}}>
                            <div style={{'flex': '1', 'display': 'flex', 'gap': '10px', 'flexWrap': 'wrap'}} >
                                {
                                    canEdit ? (
                                        <>
                                            <div>
                                                <SyntheticButton value={(
                                                    <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                                        Add to Folder
                                                        <MyImage src={AddIcon} alt={"Add"} width={20} height={20} />
                                                    </div>
                                                )} onClick={() => setAddToFolderOpen(!addToFolderOpen)} />
                                            </div>
                                            <div>
                                                <CreateWrapper
                                                    noRedirect={true}
                                                    templateCode={'document'}
                                                    loadCallback={() => setUploadFileMoveLoading(1)}
                                                    callback={(x) => {setUploadFileMoveLoading(2); x && addToFolder(x)}}
                                                >
                                                    <SyntheticButton
                                                        value={(
                                                            <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                                                Upload Doc
                                                                {uploadFileMoveLoading == 1 ? (
                                                                    <Loading text="" color="var(--light-text)" />
                                                                ) : (
                                                                    <MyImage src={UpIcon} alt={"Up"} width={20} height={20} />
                                                                )}
                                                            </div> 
                                                        )}
                                                    />
                                                </CreateWrapper>
                                            </div>
                                        </>
                                    ) : ""
                                }
                                {
                                    manifestRow['group_id'] ? (
                                        <div>
                                            {buildCourseButton}
                                        </div>
                                    ) : ""
                                }                        
                                <div className={canEdit ? styles.flex1OnBigScreen : ''}>
                                    <SyntheticButton onClick={initiateDownload} id='FolderDownload' value={(
                                        <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                                            Download
                                            {downloadIconDisplay}
                                        </div>
                                    )} />
                                </div>
                                {canEdit ? (
                                    <div>
                                        <CreateWrapper
                                            templateCode={"folder"}
                                            noRedirect={true}
                                            loadCallback={() => {setNewFolderLoading(true)}}
                                            callback={(x) => {setNewFolderLoading(false); x && addToFolder(x);}}
                                        >
                                            <SyntheticButton
                                                value={(
                                                    <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                                                        New Folder
                                                        {!newFolderLoading ? (
                                                            <MyImage src={FolderIcon} width={20} height={20} alt="Folder" />
                                                        ) : (
                                                            <Loading text="" color="var(--light-text)" />
                                                        )}
                                                    </div>
                                                )}
                                            />
                                        </CreateWrapper>
                                    </div>
                                ) : ""}
                            </div>
                        </div>
                        <div style={{'marginTop': '1rem'}}>
                            {addToFolderOpen ? (
                                <AddToFolder assetManifestRow={manifestRow} forceRefresh={forceRefresh} setForceRefresh={setForceRefresh} />
                            ) : ""}
                        </div>
                    </CollapsibleMenu>
                    <AssetsTable
                        key={forceRefresh}
                        contentUrl={process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/manifest`}
                        subManifest={manifestRow['id']}
                        showDelete={true}
                        showEdit={true}
                        useSearchUrl={true}
                        showCreateText={false}
                        showRemove={canEdit}
                        includeGroups={true}
                        loadingSkeleton={true}
                    />
                </div>
            )}
            rightPanel={(
                <SmartHeightWrapper style={{'width': '100%', 'paddingBottom': '20px', 'minHeight': '450px'}}>
                    {chatComponent}
                </SmartHeightWrapper>
            )}
        />
    )
}
