import DefaultMargins from "@/components/DefaultMargins";
import styles from './TestStudy1.module.css'
import MyImage from "@/components/MyImage/MyImage";
import QuizIcon from '../../../../../public/icons/QuizIcon.png'
import { useCallback, useEffect, useMemo, useState } from "react";
import { Auth } from "@/auth/auth";
import AssetsTableWithQuizes from "@/components/AssetsTableWithQuizes/AssetsTableWithQuizes";
import Link from "next/link";
import Loading from "@/components/Loading/Loading";
import LoadingSkeleton from "@/components/Loading/LoadingSkeleton";
import { toPercentage } from "@/utils/text";
import { getTemplateByCode } from "@/templates/template";
import Tooltip from "@/components/Tooltip/Tooltip";
import ImageIcon from '../../../../../public/icons/ImageIcon.png'
import Modal from "@/components/Modal/Modal";
import ControlledInputText from "@/components/form/ControlledInputText";
import Button from "@/components/form/Button";
import Saving from "@/components/Saving/Saving";
import useSaveDataEffect from "@/utils/useSaveDataEffect";
import EditIcon from '../../../../../public/icons/EditIcon.png'
import SelectAssetWrapper from "@/components/SelectAssetWrapper/SelectAssetWrapper";
import CreateWrapper from "@/components/Quick/CreateWrapper";
import SourceSelect from "@/components/form/SourceSelect";


export default function TestStudy1({ manifestRow }) {

    const [sectionsLoadingState, setSectionsLoadingState] = useState(0)
    const [saveSectionsLoadState, setSaveSectionsLoadState] = useState(0)
    const [sections, setSections] = useState([])
    const [infQuiz, setInfQuiz] = useState(undefined)
    const [activity, setActivity] = useState([])
    const [activityAssets, setActivityAssets] = useState({})
    const [progress, setProgress] = useState({})

    const [sectionQuizzes, setSectionQuizzes] = useState({})
    const [sectionQuizActivity, setSectionQuizActivity] = useState([])

    const { getToken, isSignedIn } = Auth.useAuth()

    const canEdit = manifestRow.can_edit
    const [showEditHeaderModal, setShowEditHeaderModal] = useState(false)
    const [showEditSections, setShowEditSections] = useState(false)
    const [editHeaderSaveState, setEditHeaderSaveState] = useState(0)
    const [newHeaderImage, setNewHeaderImage] = useState("")  // text value for edit input
    const [newSectionLoading, setNewSectionLoading] = useState(false)

    async function getData(){
        try {
            setSectionsLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/groups/test-study-1/get?id=${manifestRow['id']}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken()
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            setSections(myJson['sections'])  // can use metadata except still need titles, descs, etc.
            setInfQuiz(myJson['inf_quiz'])  // technically can just use metadata
            setActivity(myJson['activity'].filter((item) => ['view', 'quiz_grade'].includes(item.type)))
            setActivityAssets(myJson['activity_assets'])
            setProgress(myJson['progress'])
            setSectionsLoadingState(2)
        }
        catch(e) {
            console.log(e)
            setSectionsLoadingState(3)
        }
    }

    async function getSectionQuizzes(){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/groups/test-study-1/get-section-quizzes?id=${manifestRow['id']}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken()
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            setSectionQuizzes(myJson['section_quizzes'])
            setSectionQuizActivity(myJson['section_quiz_activity'])
        }
        catch(e) {
            console.log(e)
        }
    }

    useEffect(() => {
        if (manifestRow && isSignedIn !== undefined){
            getData()
            getSectionQuizzes()
        }
    }, [manifestRow, isSignedIn])

    function makeActivity(item, i){
        const relAsset = activityAssets[item.asset_id]
        if (!relAsset){
            return <div key={item.id}></div>
        }
        let quizGrade = undefined
        if (item.type == 'quiz_grade'){
            let meta = JSON.parse(item.metadata)
            quizGrade = toPercentage(meta.total_points, meta.available_points)
        }

        const tmp = getTemplateByCode(relAsset.template)
        const iconSrc = tmp.constructor.icon

        return (
            <Link key={item.id} href={`/assets/${relAsset.id}`}>
                <div className="_touchableOpacity" style={{'display': 'flex', 'padding': '10px', 'gap': '10px'}}>
                    <div style={{'display': 'flex', 'alignItems': 'center'}}>
                        <MyImage src={iconSrc} width={20} height={20} alt={tmp.constructor.readableName} />
                    </div>
                    <div style={{'flex': '1'}}>
                        {`${quizGrade ? "Graded:": ""} ${relAsset.title}`}
                    </div>
                    {
                        quizGrade ? (
                            <div>
                                {`${quizGrade}%`}
                            </div>
                        ) : ""
                    }
                </div>
            </Link>
            
        )
    }

    const progressPercent = progress?.total_quizzes && progress?.total_quiz_grades ? Math.round((progress.total_quiz_grades / progress.total_quizzes) * 100) : 0

    const headerImage = useMemo(() => {
        let x = JSON.parse(manifestRow.metadata)?.header_image
        return x
    }, [manifestRow])

    useEffect(() => {
        setNewHeaderImage(headerImage)
    }, [headerImage])

    useEffect(() => {
        if (newHeaderImage != headerImage){
            setEditHeaderSaveState(0)
        }
    }, [newHeaderImage, headerImage])

    async function submitNewHeaderImage(){
        try {
            setEditHeaderSaveState(1)

            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/groups/test-study-1/edit-header-image"
            const data = {
                'id': manifestRow.id,
                'image': newHeaderImage
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
            if (myJson['response'] == 'success'){
                setEditHeaderSaveState(2)
            }
            else {
                setEditHeaderSaveState(3)
            }

        }
        catch (e) {
            setEditHeaderSaveState(3)
            console.log(e)
        }
    }

    
    const saveSections = useCallback(async (selections) => {
        try {
            setSaveSectionsLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/groups/test-study-1/save-sections"
            const data = {
                'id': manifestRow['id'],
                'section_ids': selections.map(x => x.id),
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
            await refreshGroup()
            setSaveSectionsLoadState(2)
        }
        catch(e) {
            setSaveSectionsLoadState(3)
            console.log(e)
        }
    }, [manifestRow])
    useSaveDataEffect(sections, sections && sectionsLoadingState == 2 && canEdit, saveSections, 50)


    async function addInfiniteQuiz(quizId){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/groups/test-study-1/set-inf-quiz"
            const data = {
                'id': manifestRow['id'],
                'inf_quiz_id': quizId,
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
    }

    function selectInfQuizCallback(x){
        if (x.length){
            addInfiniteQuiz(x[0].id)
        }
    }

    async function addSections(sectionRows){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/groups/test-study-1/add-sections"
            const data = {
                'id': manifestRow['id'],
                'section_ids': sectionRows.map((x) => x.id)
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
            else {
                setSections([...sections, ...sectionRows])
            }
        }
        catch(e) {
            console.log(e)
        }
    }

    function addSectionCallback(x){
        addSections([x])
    }

    // Called after edit/remove to straighten out all the assets.
    async function refreshGroup(){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/groups/test-study-1/refresh"
            const data = {
                'id': manifestRow.id
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

    const quizGrades = useMemo(() => {
        let newQuizGrades = {}
        if (sectionQuizActivity){
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
        }
        return newQuizGrades
    }, [sectionQuizActivity, activity])    

    const nextSection = useMemo(() => {
        let undoneSection = {}
        if (sections?.length){
            const undone = sections.filter((x) => !quizGrades[sectionQuizzes[x.id]])
            if (undone.length){
                undoneSection = undone[0]
            }
        }
        return undoneSection
    }, [sectionQuizzes, sections, sectionQuizActivity, quizGrades])

    return (
        <DefaultMargins>
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                <div className={styles.contentContainer}>
                    <div className={styles.leftContentContainer}>
                        <div className={styles.studyHubHeader}>
                            {headerImage ? (
                                <MyImage canSwitch={false} fill={true} priority={true} src={headerImage} style={{'objectFit': 'cover', 'opacity': '.8', 'filter': 'brightness(80%)'}} alt={"Section image"} />
                            ) : ""}
                            <div className={styles.studyHubHeaderText}>
                                <div style={{'padding': '3px 10px', 'backgroundColor': 'var(--dark-primary)', 'borderRadius': 'var(--medium-border-radius)', 'border': '1px solid var(--dark-border)'}}>
                                    {`${manifestRow.title} - Study Hub`}
                                </div>
                                {canEdit ? (
                                    <div onClick={() => setShowEditHeaderModal(true)} className="_clickable" style={{'display': 'flex', 'alignItems': 'center', 'backgroundColor': 'var(--dark-primary)', 'padding': '5px', 'borderRadius': 'var(--small-border-radius)'}}>
                                        <MyImage src={ImageIcon} width={20} height={20} alt={"Image"} />
                                    </div>
                                ) : ""}
                            </div>
                            
                        </div>
                        {
                            infQuiz ? (
                                <Link href={`/assets/${infQuiz}`}>
                                    <div className={styles.infiniteQuizButton}>
                                        <div>
                                            Infinite Practice
                                        </div>
                                        <MyImage src={QuizIcon} width={25} height={25} alt={"Quiz"} />
                                    </div>
                                </Link>
                            ) : (sectionsLoadingState < 2 ? (
                                <div className={styles.infiniteQuizButton}>
                                    <div>
                                        Take Infinite Quiz
                                    </div>
                                    <Loading size={25} text="" />
                                </div>
                            ) : (canEdit ? (
                                <div>
                                    <SelectAssetWrapper verb="Select" preposition="for" noun="Quiz" selectCallback={selectInfQuizCallback} style={{'display': 'flex', 'justifyContent': 'stretch'}}>
                                        <div className={styles.infiniteQuizButton}>
                                            <div>
                                                Select Infinite Quiz
                                            </div>
                                            <MyImage src={EditIcon} alt={"Edit"} width={20} height={20} />
                                        </div>
                                    </SelectAssetWrapper>
                                </div>
                                
                            ) : ""))
                        }
                        
                        <div className={styles.blockContaner}>
                            <div className={styles.blockHeader}>
                                Sections
                            </div>
                            <div>
                                <AssetsTableWithQuizes
                                    quizGrades={quizGrades}
                                    quizes={sectionQuizzes}
                                    noTopStyle={true}
                                    assets={sections}
                                    assetsLoadState={sectionsLoadingState}
                                    placeholderN={10}
                                    canEdit={canEdit}
                                    canEditQuizzes={false}
                                    setAssets={setSections}
                                    number={true}
                                />
                            </div>
                            {canEdit ? (
                                <div style={{'paddingTop': '10px', 'display': 'flex', 'gap': '15px', 'fontSize': '.9rem'}}>
                                    <div>
                                        <CreateWrapper
                                            callback={(x) => {setNewSectionLoading(false); addSectionCallback(x)}}
                                            noRedirect={true}
                                            templateCode={'section'}
                                            noShow={true}
                                            data={{'group': manifestRow.id}}
                                            loadCallback={() => setNewSectionLoading(true)}
                                        >
                                            {newSectionLoading ? (
                                                <Loading text="" />
                                            ) : (
                                                <div className="_touchableOpacity">
                                                    New Section
                                                </div>
                                            )}
                                            
                                        </CreateWrapper>
                                    </div>
                                    <div className="_touchableOpacity" onClick={() => setShowEditSections(true)}>
                                        Edit/Remove Sections
                                    </div>
                                    {saveSectionsLoadState == 1 ? (
                                        <Loading size={15} text="Saving" />
                                    ) : (saveSectionsLoadState == 3 ? ("Error Saving") : "")}
                                </div>
                            ) : ""}
                        </div>
                    </div>
                    <div className={styles.rightContentContainer}>
                        <div className={styles.blockContainer}>
                            <div className={styles.blockHeader}>
                                <div style={{'display': 'flex', 'alignItems': 'center'}}>
                                    <div style={{'flex': '1'}}>
                                        Progress
                                    </div>
                                    <div style={{'fontSize':  '.9rem'}}>
                                        {`${progressPercent}%`}
                                    </div>
                                </div>
                            </div>
                            <div className={styles.blockBody}>
                                <div style={{'width': '100%', 'padding': '10px', 'display': 'flex', 'flexDirection': 'column', 'gap': '.5rem'}}>
                                    {nextSection?.id ? (
                                        <div style={{'display': 'flex'}}>
                                            <Link href={`/assets/${nextSection.id}`}>
                                                <div className="_touchableOpacity">
                                                    {`Next: ${nextSection.title}`}
                                                </div>
                                            </Link>
                                        </div>
                                    ) : ""}
                                    <Tooltip content={`${progressPercent > 0 ? `${progress.total_quiz_grades} graded / ${progress.total_quizzes} total quizzes` : "No progress yet"}`}>
                                        <div style={{'width': '100%', 'height': '10px', 'backgroundColor': 'var(--light-highlight)'}}>
                                            <div style={{'width': `${progressPercent}%`, 'height': '10px', 'backgroundColor': 'var(--dark-highlight)'}}>
                                            </div>
                                        </div>
                                    </Tooltip>
                                </div>
                            </div>
                        </div>
                        <div className={styles.blockContaner}>
                            <div className={styles.blockHeader}>
                                Recent Activity
                            </div>
                            <div className={styles.blockBody}>
                            {
                                sectionsLoadingState != 2 ? (
                                    <div style={{'padding': '10px'}}>
                                        <LoadingSkeleton numResults={5} />
                                    </div>
                                ) : (activity?.length ? (
                                        activity.map(makeActivity)
                                ) : (
                                    <div style={{'padding': '10px'}}>
                                        No activity yet
                                    </div>
                                ))
                            }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {canEdit ? (
                <>
                    <Modal isOpen={showEditHeaderModal} close={() => setShowEditHeaderModal(false)} title={"Edit Header Image"}>
                        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                            <ControlledInputText value={newHeaderImage} setValue={setNewHeaderImage} />
                            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                                <Button value={"Submit"} onClick={() => submitNewHeaderImage()} />
                                <Saving saveValueLoading={editHeaderSaveState} />
                            </div>
                            {editHeaderSaveState == 2 ? (
                                <div>
                                    Refresh for effect
                                </div>
                            ) : ""}
                        </div>
                    </Modal>
                    <Modal isOpen={showEditSections} close={() => setShowEditSections(false)} title={"Edit Sections"}>                        
                        <SourceSelect allowedTemplates={['section']} initialSelections={sections} setSelectionRows={setSections} />
                    </Modal>
                </>
            ) : ""}
        </DefaultMargins>
    )
}
