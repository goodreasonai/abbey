import { Auth } from "@/auth/auth"
import { useCallback, useEffect, useMemo, useState } from "react"
import AssetsTableWithQuizes from "../AssetsTableWithQuizes/AssetsTableWithQuizes"
import AddToFolder from "../Folder/AddToFolder"
import SyntheticButton from "../form/SyntheticButton"
import PanelSourceSelect from "../PanelSourceSelect/PanelSourceSelect"
import useSaveDataEffect from "@/utils/useSaveDataEffect"
import Loading from "../Loading/Loading"
import Link from "next/link"
import MyImage from "../MyImage/MyImage"
import QuizIcon from '../../../public/icons/QuizIcon.png'
import SelectAssetWrapper from "../SelectAssetWrapper/SelectAssetWrapper"
import Hr from "../Hr/Hr"
import { toPercentage } from "@/utils/text"
import RichTextViewer from "../RichText/Viewer"
import Editor from "../RichText/Editor"
import LoadingSkeleton from "../Loading/LoadingSkeleton"
import ToggleButtons from "../form/ToggleButtons"
import styles from './Section.module.css'
import GradientEffect from "../GradientEffect/GradientEffect"
import Button from "../form/Button"
import CreateWrapper from "../Quick/CreateWrapper"
import Modal from "../Modal/Modal"
import { saveResources } from "@/utils/requests"
import BackIcon from '../../../public/icons/BackIcon.png'


export function getDefaultSectionState(){
    return {
        'quizes': {},  // brutal misspelling but don't want to change for fear of messing up existing stuff in the db
        'sectionIntro': '',
        'sectionQuiz': undefined
    }
} 

export default function Section({ manifestRow, canEdit }) {
    const [sourcesLoadState, setSourcesLoadState] = useState(0)
    const [sourcesSaveState, setSourcesSaveState] = useState(0)
    const [sources, setSources] = useState([])
    const [sectionState, setSectionState] = useState(getDefaultSectionState())
    const [activity, setActivity] = useState([])
    const [sectionLoadingState, setSectionLoadingState] = useState(0)
    const [showEditing, setShowEditing] = useState(false)

    const [createSectionQuizLoading, setCreateSectionQuizLoading] = useState(false)
    const [newLessonLoading, setNewLessonLoading] = useState(false)
    const [showEditLessons, setShowEditLessons] = useState(false)

    // Only relevant for editing (which should be only for admin?)
    const [selectionsLoadState, setSelectionsLoadState] = useState(0)
    const [reorderedAssets, setReorderedAssets] = useState([])  // used instead of sources to prevent double saves with PanelSourceSelect
    const quizes = sectionState?.quizes
    const setQuizes = useCallback((x) => {
        setSectionState((prev) => {return {...prev, 'quizes': typeof x == 'function' ? x(prev.quizes) : x}})
    }, [setSectionState])
    const sectionQuiz = sectionState?.sectionQuiz
    const setSectionQuiz = useCallback((x) => {
        setSectionState((prev) => {return {...prev, 'sectionQuiz': typeof x == 'function' ? x(prev.sectionQuiz) : x}})
    }, [setSectionState])
    const sectionIntro = sectionState?.sectionIntro
    const setSectionIntro = useCallback((x) => {
        setSectionState((prev) => {return {...prev, 'sectionIntro': typeof x == 'function' ? x(prev.sectionIntro) : x}})
    }, [setSectionState])
    
    const { getToken, isSignedIn } = Auth.useAuth()

    async function getSection(){
        try {
            setSectionLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/section/get?id=${manifestRow['id']}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken()
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            if (myJson['result']){
                setSectionState(myJson['result'])
            }
            setActivity(myJson['activity'])
            setSectionLoadingState(2)
        }
        catch(e) {
            console.log(e)
            setSectionLoadingState(3)
        }
    }

    async function getSources(){
        try {
            setSourcesLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/sources-info?id=${manifestRow['id']}&ordered=1`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken()
                },
                'method': 'GET'
            })
            const myJson = await response.json()

            setSources(myJson['results'])
            setSourcesLoadState(2)
        }
        catch (e) {
            console.log(e)
            setSourcesLoadState(3)
        }
    }

    const saveReorderedAssets = useCallback(async (selections) => {
        try {
            setSourcesSaveState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/add-resources"
            const data = {
                'id': manifestRow['id'],
                'resource_ids': selections.map(x => x.id),
                'save_order': true
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

            if (myJson['response'] != 'success'){
                throw Error(`Response was not success: ${myJson['reason']}`)
            }
            setSourcesSaveState(2)
        }
        catch(e) {
            setSourcesSaveState(3)
            console.log(e)
        }
    }, [manifestRow])
    async function reorderCallback(assets){
        setReorderedAssets(assets)
    }
    useSaveDataEffect(reorderedAssets, reorderedAssets?.length == sources?.length && sourcesLoadState == 2 && canEdit, saveReorderedAssets, 500)

    // callback from panel source select
    // For groups: 
    async function regularSaveCallback(){
        if (!manifestRow.group_id){
            return
        }
        setSourcesSaveState(1)
        try{
            await refreshGroup()
            setSourcesSaveState(2)
        }
        catch(e){
            console.log(e)
            setSourcesSaveState(3)
        }
    }

    async function refreshGroup(){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/groups/refresh"
            const data = {
                'id': manifestRow.group_id,
            }
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'body': JSON.stringify(data),
                'method': 'POST'
            })
        }
        catch(e) {
            console.log(e)
        }
    }

    const saveState = useCallback(async (state) => {
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/section/save"
            const data = {
                'id': manifestRow['id'],
                'state': state,
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

            if (myJson['response'] != 'success'){
                throw Error(`Response was not success: ${myJson['reason']}`)
            }    
        }
        catch(e) {
            console.log(e)
        }
    }, [manifestRow])
    useSaveDataEffect(sectionState, canEdit && sectionLoadingState == 2, saveState, 500)


    useEffect(() => {
        if (manifestRow && isSignedIn !== undefined){
            getSources()
            getSection()
        }
    }, [manifestRow, isSignedIn])

    function assignQuizCallback(itemId, quizId){
        setQuizes({...quizes, [itemId]: quizId})
    }

    // Code also exists in TestStudy1 ... may want to refactor
    const quizGrades = useMemo(() => {
        let newQuizGrades = {}
        if (!activity){
            return {}
        }
        for (let act of activity){
            if (act.type == 'quiz_grade'){
                try {
                    newQuizGrades[act.asset_id] = JSON.parse(act.metadata)
                }
                catch(e) {
                    console.log(e)
                }
            }
        }
        return newQuizGrades
    }, [activity])

    const sectionQuizGrade = useMemo(() => {
        if (quizGrades){
            let sectionGrade = quizGrades[sectionQuiz]
            if (sectionGrade){
                return toPercentage(sectionGrade.total_points, sectionGrade.available_points)
            }
        }
        return undefined
    }, [activity, sectionState])

    function getTotalScoreStyle(score){
        let totalScoreStyle = {}
        if (score > 90){
            totalScoreStyle['backgroundColor'] = 'green'  // green instead of dark primary due to the brightness against the background in dark mode
            totalScoreStyle['color'] = 'white'
        }
        else if (score < 70){
            totalScoreStyle['backgroundColor'] = 'var(--logo-red)'  // green instead of dark primary due to the brightness against the background in dark mode
            totalScoreStyle['color'] = 'white'
        }
        else {
            totalScoreStyle['backgroundColor'] = 'orange'  // green instead of dark primary due to the brightness against the background in dark mode
            totalScoreStyle['color'] = 'white'
        }
        return totalScoreStyle
    }

    const dummyAhtmlFile = useMemo(() => {
        const blob = new Blob(["This is a sample document. To edit it, click the edit icon in the bottom left, or press the e key."], { type: "text/plain" });
        // Create a File object
        const file = new File([blob], "Untitled.ahtml", { type: "text/plain" });
        return file
    })
    
    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
            <div className={styles.headerContainer}>
                <GradientEffect style={{'opacity': '.65', 'filter': 'brightness(1.75)'}} />
                <div style={{'width': '100%', 'height': '100%', 'zIndex': '2', 'display': 'flex', 'flexDirection': 'column', 'gap': '10px'}}>
                    <div style={{'flex': '1', 'zIndex': '2', 'display': 'flex', 'justifyContent': 'flex-end', 'alignItems': 'flex-start'}}>
                        <div style={{'display': 'flex'}}>
                            {manifestRow.group_id ? (
                                <Link href={`/groups/${manifestRow.group_id}`}>
                                    <div style={{'backgroundColor': 'var(--dark-primary)', 'padding': '5px 10px', 'borderRadius': 'var(--small-border-radius)', 'fontSize': '.8rem', 'display': 'flex', 'gap': '5px', 'alignItems': 'center'}}>
                                        <MyImage src={BackIcon} width={15} height={15} alt={"Back"} />
                                        Collection
                                    </div>
                                </Link>
                            ) : ""}
                        </div>
                    </div>
                    <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center', 'width': '100%', 'zIndex': '2'}}>
                        <div style={{'flex': '1', 'display': 'flex'}}>
                            <div style={{'fontSize': '1.5rem', 'fontWeight': '500','padding': '5px 10px', 'backgroundColor': 'var(--dark-primary)', 'borderRadius': 'var(--small-border-radius)'}}>
                                {manifestRow.title}
                            </div>
                        </div>
                        {canEdit ? (
                            <ToggleButtons
                                options={[
                                    {'value': true, 'name': 'Edit'},
                                    {'value': false, 'name': 'View'}
                                ]}
                                value={showEditing}
                                setValue={setShowEditing}
                            />
                        ) : ""}
                    </div>
                </div>
            </div>
            {
                sectionLoadingState == 2 ? (
                    showEditing ? (
                        <Editor
                            minHeightOption="none"
                            assetId={manifestRow.id}
                            htmlContent={sectionIntro}
                            onChangeHTML={(x) => {setSectionIntro(x)}}
                        />
                    ) : (sectionIntro ? (
                        <div style={{'backgroundColor': 'var(--light-primary)', 'padding': '10px', 'borderRadius': 'var(--medium-border-radius)', 'border': '1px solid var(--light-border)'}}>
                            <RichTextViewer
                                viewerPaddingOption="none"
                                content={sectionIntro}
                            />
                        </div>
                    ) : "")
                ) : (
                    <LoadingSkeleton type="default" numResults={1} />
                )
            }
            <div>
                <AssetsTableWithQuizes
                    assets={sources}
                    assetsLoadState={sourcesLoadState}
                    setAssets={setSources}
                    number={true}
                    reorderCallback={reorderCallback}
                    quizes={quizes}
                    quizGrades={quizGrades}
                    assignQuizCallback={assignQuizCallback}
                    canEdit={showEditing}
                    emptyMessage="No lessons yet." />
            </div>
            {
                sectionQuiz || showEditing ? (
                    <div style={{'backgroundColor': 'var(--light-primary)', 'display': 'flex', 'alignItems': 'center', 'padding': 'var(--std-margin)', 'justifyContent': 'center', 'borderRadius': 'var(--medium-border-radius)', 'border': '1px solid var(--light-border)', 'flexDirection': 'column', 'gap': '1rem'}}>
                        {!showEditing && sectionQuiz && sectionQuizGrade ? (
                            <>
                                <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                                    {`Section Grade:`}
                                    <div style={{'padding': '5px 10px', 'borderRadius': 'var(--small-border-radius)', 'display': 'flex', 'justifyContent': 'center', ...getTotalScoreStyle(sectionQuizGrade)}}>
                                        {`${sectionQuizGrade}%`}
                                    </div>
                                </div>
                                <Link className="_touchableOpacity" href={`/assets/${sectionState.sectionQuiz}`}>
                                    Retake
                                </Link>
                            </>
                        ) : (!showEditing && sectionQuiz ? (
                            <Link href={`/assets/${sectionState.sectionQuiz}`}>
                                <SyntheticButton
                                    value={(
                                        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                            <div>
                                                Take Section Quiz
                                            </div>
                                            <MyImage src={QuizIcon} width={20} height={20} alt={"Quiz"} />
                                        </div>
                                    )}
                                    style={{'fontSize': '1.25rem'}}
                                    onClick={() => {}}
                                />
                            </Link>
                        ) : (showEditing && sectionQuiz ? (
                            <Link href={`/assets/${sectionState.sectionQuiz}`}>
                                <SyntheticButton
                                    value={(
                                        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                            <div>
                                                Edit Section Quiz
                                            </div>
                                            <MyImage src={QuizIcon} width={20} height={20} alt={"Quiz"} />
                                        </div>
                                    )}
                                    style={{'fontSize': '1.25rem'}}
                                    onClick={() => {}}
                                />
                            </Link>
                        ) : (showEditing && !sectionQuiz && sources?.length ? (
                            <div>
                                <CreateWrapper
                                    templateCode={"quiz"}
                                    newTab={true}
                                    noShow={true}
                                    data={{'title': `Section Quiz for ${manifestRow.title}`, 'preview_desc': `How well do you know ${manifestRow.title}?`, 'selections': `[${manifestRow.id}]`, 'group': manifestRow.group_id}}
                                    loadCallback={() => setCreateSectionQuizLoading(true)}
                                    callback={(x) => {setCreateSectionQuizLoading(false); x && setSectionQuiz(x.id)}}
                                >
                                    <SyntheticButton
                                        value={(
                                            <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                                <div>
                                                    Create Section Quiz
                                                </div>
                                                {createSectionQuizLoading ? (
                                                    <Loading text="" color="var(--light-text)" />
                                                ) : (
                                                    <MyImage src={QuizIcon} width={20} height={20} alt={"Quiz"} />
                                                )}
                                            </div>
                                        )}
                                        style={{'fontSize': '1.25rem'}}
                                        onClick={() => {}}
                                    />
                                </CreateWrapper>
                            </div>
                        ) : "")))}
                    </div>
                ) : ""
            }
            {showEditing ? (
                <>
                    <Hr />
                    <div style={{'display': 'flex', 'gap': '10px'}}>
                        <div>
                            <CreateWrapper
                                noShow={true}
                                newTab={true}
                                noRedirect={true}
                                templateCode={'document'}
                                data={{'files': dummyAhtmlFile, 'group': manifestRow.group_id}}
                                loadCallback={() => {setNewLessonLoading(true)}}
                                callback={async (x) => {setNewLessonLoading(false); x && setSources([...sources, x]); x && saveResources(manifestRow.id, [...sources, x], ()=>{}, await getToken())}}
                            >
                                {newLessonLoading ? (
                                    <Loading text="" />
                                ) : (
                                    <div className="_touchableOpacity">
                                        Add Lesson
                                    </div>
                                )}
                            </CreateWrapper>
                        </div>
                        <div className="_touchableOpacity" onClick={() => setShowEditLessons(true)}>
                            Edit/Remove Lessons
                        </div>
                        {sourcesSaveState == 1 ? (
                            <Loading size={15} text="Saving" />
                        ) : (sourcesSaveState == 3 ? ("Error Saving") : "")}
                    </div>
                    <Modal minWidth="75vw" isOpen={showEditLessons} close={() => setShowEditLessons(false)} title={"Edit Lessons"}>                        
                        <PanelSourceSelect saveCallback={regularSaveCallback} ordered={true} canEdit={canEdit} manifestRow={manifestRow} resultLimit={10} selectionsLoadState={selectionsLoadState} setSelectionsLoadState={setSelectionsLoadState} selections={sources} setSelections={setSources} />
                    </Modal>
                </>
            ) : ""}
        </div>
    )
}
