import { useCallback, useEffect, useMemo, useState } from "react"
import QuizIcon from '../../../public/icons/QuizIcon.png'
import Chat from '../Chat/Chat'
import AddSources from './AddSources'
import LinkedSelectorItem from '../LinkedSelectorItem/LinkedSelectorItem'
import ControlledInputText from '../form/ControlledInputText'
import ResponsiveTextarea from '../form/ResponsiveTextarea'
import AddNotes from './AddNotes'
import CollapsibleMenu from '../CollapsibleMenu/CollapsibleMenu'
import UpIcon from '../../../public/icons/UpIcon.png'
import DownIcon from '../../../public/icons/DownIcon.png'
import DeleteIcon from '../../../public/icons/DeleteIcon.png'
import AddIcon from '../../../public/icons/AddIcon.png'
import Dropdown from '../Dropdown/Dropdown'
import Loading from '../Loading/Loading'
import styles from './Curriculum.module.css'
import RemoveIcon from '../../../public/icons/RemoveIcon.png'
import { editLeaf } from './LinkStep'
import Link from 'next/link'
import FakeCheckbox from '../form/FakeCheckbox'
import MyImage from '../MyImage/MyImage'
import EditIcon from '../../../public/icons/EditIcon.png'
import CircleCheckIcon from '../../../public/icons/CircleCheckIcon.png'
import { Auth } from "@/auth/auth";
import SyntheticButton from '../form/SyntheticButton'
import { handleGeneralStreaming } from "@/utils/streaming"
import { deleteSection } from "./Structured"
import { insert, moveSection } from "./Structured"
import EyeballIcon from '../../../public/icons/EyeballIcon.png'
import { getContinuePath } from "./Curriculum"
import { continueCourse } from "./Curriculum"
import SmallSyntheticButton from "../form/SmallSyntheticButton"
import ChatIcon from '../../../public/icons/ChatIcon.png'
import Quick from "../Quick/Quick"
import RichTextViewer from "../RichText/Viewer"
import CreateWrapper from "../Quick/CreateWrapper"


export default function Section({fullState, setFullState, userValue, setUserValue, manifestRow, assetsInfo,
                                parent, nodeId, index, sectionTrail, isEditStep, highlightNext, premierPosition,
                                setPremierPosition, nextStepPath, makeSubsections, activityByAsset, setUserActivity, forceLoading=false, ...props}){

    const [amLoading, setAmLoading] = useState(false)
    const [quizLoading, setQuizLoading] = useState(false)
    const [quizDeleting, setQuizDeleting] = useState(false)
    const [editingSection, setEditingSection] = useState(false)
    const [errorOccurred, setErrorOccurred] = useState(false)
    const [makeLinkedChatLoading, setMakeLinkedChatLoading] = useState(0)
    const { getToken } = Auth.useAuth()

    const node = fullState.nodes[nodeId]  // gives title, description, links, children, etc.
    const openByDefault = isEditStep

    // Shortening some names and memoizing.
    const nodes = fullState.nodes
    const setNodes = useCallback((x) => {
        setFullState((prev) => {return {...prev, 'nodes': typeof x == 'function' ? x(prev.nodes) : x}})
    }, [setFullState])
    const roots = fullState.roots
    const setRoots = useCallback((x) => {
        setFullState((prev) => {return {...prev, 'roots': typeof x == 'function' ? x(prev.nodes) : x}})
    }, [setFullState])

    const selectedGroupTags= fullState.selectedGroupTags || {}
    const collections = useMemo(() => {
        let x = Object.keys(fullState.selectedGroups).filter((key) => fullState.selectedGroups[key])
        return x
    }, [fullState.selectedGroups])
    
    const brainstormResponse = fullState.brainstormResponse

    function isComplete(item) {
        if (userValue.checks && userValue.checks.includes(item.id)){
            return true
        }
        else if (userValue.checks && item.subsections && item.subsections.length > 0){
            for (const x of item.subsections){
                let y = isComplete(nodes[x])
                if (!y){
                    return false
                }
            }
            return true
        }
        else {
            return false
        }
    }

    async function genQuiz(prevQuiz){
        try {
            setQuizLoading(true)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/quiz/create"
            const data = {
                'ids': node.links.map((item) => item.id),
                'title': `Quiz for ${node.title}`,
                'parent': manifestRow['id'],
            }
            if (prevQuiz){
                data['replace'] = prevQuiz
            }
            const response = await fetch(url, {
                'method': "POST",
                'headers': {
                    'Content-Type': 'application/json',
                    'x-access-token': await getToken(),
                },
                'body': JSON.stringify(data)
            })

            const myJson = await response.json()
            editLeaf(node.id, {...node, 'quiz': myJson['asset_id']}, setNodes)
            setQuizLoading(false)
        }
        catch(e){
            console.log(e)
            setQuizLoading(false)
        }
    }

    async function deleteQuiz(prevQuiz) {
        try {
            setQuizDeleting(true)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/delete"
            const data = new FormData()
            data.append('id', prevQuiz)
            const response = await fetch(url, {
                'method': "POST",
                'headers': {
                    'x-access-token': await getToken(),
                },
                'body': data
            })

            const myJson = await response.json()

            if (myJson['response'] != 'success'){
                throw Error("Reponse was not success")
            }

            editLeaf(node.id, {...node, 'quiz': ''}, setNodes)
            setQuizDeleting(false)
        }
        catch(e){
            console.log(e)
            setQuizDeleting(false)
        }
    }

    function makeLink(item, linkItem, i) {

        // Given assetsInfo
        let updatedLinkItem = linkItem
        if (assetsInfo && assetsInfo[linkItem.id]){
            updatedLinkItem = assetsInfo[linkItem.id]
        }

        let hasViewed = false
        let hasChatted = false
        if (!isEditStep && activityByAsset && activityByAsset[linkItem.id]){
            hasViewed = activityByAsset[linkItem.id].filter((x) => x.type == 'view').length
            hasChatted = activityByAsset[linkItem.id].filter((x) => x.type == 'chat').length
        }

        function removeLink(){
            let newLinks = [...item.links]
            newLinks.splice(i, 1)
            editLeaf(item.id, {...item, 'links': newLinks}, setNodes)
        }

        const iconImage = (
            <MyImage src={RemoveIcon} width={15} height={15} className={"_clickable"} alt={"Remove Link"}
                        onClick={removeLink} />
        )

        // Manually adds a view to user activity so the user doesn't have to refresh.
        function addView(){
            setUserActivity((prev) => {return [...prev, {'asset_id': linkItem.id, 'type': 'view'}]})
        }

        return (
            <div key={linkItem.id} style={{'display': 'flex', 'flexDirection': 'column'}}
                onClick={addView}>
                <LinkedSelectorItem style={hasViewed || hasChatted ? {'borderBottomRightRadius': '0px', 'borderBottomLeftRadius': '0px'} : {}} item={updatedLinkItem} iconImage={iconImage} showButton={isEditStep} />
                {
                    hasViewed || hasChatted ? (
                        <div style={{'display': 'flex', 'gap': '10px', 'padding': '5px', 'backgroundColor': 'var(--light-primary)', 'border': '1px solid var(--light-border)', 'borderBottomLeftRadius': 'var(--small-border-radius)', 'borderBottomRightRadius': 'var(--small-border-radius)'}}>
                            {hasViewed ? (
                                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}} title={"Viewed"}>
                                    <div style={{'fontSize': '.75rem'}}>
                                        Viewed
                                    </div>
                                    <MyImage src={CircleCheckIcon} width={15} height={15} alt={"View"} />
                                </div>
                            ) : ""}
                            {hasChatted ? (
                                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}} title={"Viewed"}>
                                    <div style={{'fontSize': '.75rem'}}>
                                        Chatted
                                    </div>
                                    <MyImage src={CircleCheckIcon} width={15} height={15} alt={"View"} />
                                </div>
                            ) : ""}
                        </div>
                    ) : ""
                }
            </div>
        )
    }

    let fullSection = parent ? [...sectionTrail, index+1] : [index+1]

    const isLeaf = !(node.subsections && node.subsections.length)

    let fullIntroArea = ""
    if (isLeaf){
        // Uses either user value or existing intro based on whether it exists, and whether it's in edit mode.
        // Both the source text and the save functions change based on that.
        let sourceIsNode = node.desc || isEditStep
        let source = sourceIsNode ? node.desc : ( userValue.intros && userValue.intros[nodeId] ? userValue.intros[nodeId] : "") 
        let editSource = sourceIsNode ? (x) => {
            editLeaf(node.id, {...node, 'desc': x}, setNodes)
        } : (x) => {
            setUserValue((prev) => {return {...prev, 'intros': {...prev.intros, [nodeId]: x}}})
        }

        async function generateIntro(parent, node) {
            try {
                setAmLoading(true)
                const urlDesc = process.env.NEXT_PUBLIC_BACKEND_URL + "/curriculum/desc"
                const dataDesc = {
                    'id': manifestRow['id'],
                    'title': `${parent ? parent.title + ": " : ""}${node.title}`,
                    'outline': brainstormResponse.ai
                }
                const responseDesc = await fetch(urlDesc, {
                    'headers': {
                        'x-access-token': await getToken(),
                        'Content-Type': 'application/json'
                    },
                    'method': 'POST',
                    'body': JSON.stringify(dataDesc)
                })
    
                const reader = responseDesc.body.getReader();
                const decoder = new TextDecoder('utf-8');
                
                await handleGeneralStreaming({
                    reader: reader,
                    decoder: decoder,
                    onSnippet: (result)=>{
                        editSource(result)
                    }
                })
                setAmLoading(false)
            }
            catch (e) {
                console.log(e)
                setAmLoading(false)
            }
        }

        let introArea = ""
        let generateText = ""
        if (source){
            if (isEditStep){
                introArea = (
                    <ResponsiveTextarea value={source} className={styles.subsectionDescription}
                        onInput={(event) => editSource(event.target.value)} />
                )
            }
            else {
                introArea = (
                    <ResponsiveTextarea value={source} className={styles.subsectionDescription}
                        readOnly={true} />
                )
            }

            if (!amLoading && ((isEditStep && sourceIsNode) || (!isEditStep && !sourceIsNode))){
                generateText = "Re-Do Intro"
            }
        }
        else if (!amLoading) {
            generateText = "Generate Intro"
        }

        fullIntroArea = (
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '5px'}}>
                {introArea}
                {generateText ? (
                    <div style={{'display': 'flex'}}>
                    <div className={styles.makeIntroButton} onClick={() => generateIntro(parent, node)}>
                        <div>
                            {generateText}
                        </div>
                        <MyImage src={EditIcon} width={17} height={17} alt={"Write intro"} />
                    </div>
                </div>
                ) : ""}
            </div>
        )
    }

    const amLoadingOrForced = amLoading || forceLoading

    let errorElement = ""
    if (isLeaf){
        // Is it in error leaves?
        if (errorOccurred && !amLoadingOrForced){
            errorElement = "An error occurred"
        }
    }
    
    // Make header (left side)
    const sectionHeader = (
        <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center', 'flex': editingSection ? '1' : ''}}>
            {fullSection.join('.')}
            {editingSection && isEditStep ? (
                <div style={{'display': 'flex', 'flex': '1', 'gap': '10px', 'alignItems': 'center'}}>
                    <ControlledInputText
                        inputStyle={{'backgroundColor': 'var(--light-background)', 'flex': '1'}}
                        value={node.title}
                        setValue={(x) => {editLeaf(node.id, {...node, 'title': x}, setNodes)}}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                setEditingSection(false)
                            }
                        }}
                        outsideClickCallback={() => {setEditingSection(false)}} />
                    
                    <MyImage
                        src={CircleCheckIcon}
                        width={20}
                        height={20}
                        alt={"Confirm"}
                        className={"_clickable"}
                        onClick={() => {setEditingSection(false)}} />
                </div>
            ) : (
                isEditStep && !node.title ? (
                    <MyImage src={EditIcon} width={20} height={20} onClick={() => setEditingSection(true)} alt={"Edit title"} className={"_clickable"} />
                ) : (
                    <div onClick={() => {isEditStep && setEditingSection(true)}} className={'_clickable'}>
                        {node.title}
                    </div>
                )
            )}
            
            {
                !isEditStep ? (
                    <FakeCheckbox
                        value={isComplete(node)}
                        setValue={!isLeaf ? ()=>{} : (val) => {setUserValue((prev) => {
                            let checks = [...prev.checks] || []
                            if (checks.includes(node.id) && !val){
                                let index = checks.indexOf(node.id);
                                if (index !== -1) {
                                    checks.splice(index, 1);
                                }
                            }
                            else if (!checks.includes(node.id) && val){
                                checks.push(node.id)
                            }
                            return {...prev, 'stage': 1, 'checks': checks}
                        })}}
                        clickable={isLeaf}
                        showUnchecked={isLeaf}
                        iconSize={16}
                        onClick={(e) => {e.stopPropagation()}} />
                ) : ""
            }
            {amLoadingOrForced ? (
                <>
                    <div style={{'flex': '1'}}></div>
                    <Loading cute={true} />
                </>
            ) : ""}
            {errorElement}
        </div>
    )

    // Header buttons (right side)
    const rightButtons = !isEditStep ? "" : (
        <>
            <Dropdown
                value={(
                    <MyImage src={AddIcon} width={20} height={20} alt="Add" />
                )}
                initialButtonStyle={{'backgroundColor': 'unset', 'padding': '0px', 'box-shadow': 'unset'}}
                rightAlign={true}
                title={"Insert"}
                optionsStyle={{'width': '150px', 'fontSize': '.9rem'}}
                options={[
                    {'value': 'Insert Above', 'onClick': ()=>{insert('above', node, nodes, setNodes, roots, setRoots)}},
                    {'value': 'Insert Below', 'onClick': ()=>{insert('below', node, nodes, setNodes, roots, setRoots)}},
                    {'value': 'Add Subsection', 'onClick': ()=>{insert('subsection', node, nodes, setNodes, roots, setRoots)}}
                ]} />
            <div title={"Delete"} onClick={() => deleteSection(node, roots, setRoots, nodes, setNodes)} style={{'display': 'flex', 'alignItems': 'center'}} className='_clickable'>
                <MyImage src={DeleteIcon} width={20} height={20} alt="Delete" />
            </div>
            {
                index > 0 ? (
                    <div title={"Move up"} onClick={() => moveSection((parent ? parent.id : undefined), node.id, true, nodes, setNodes, roots, setRoots)} style={{'display': 'flex', 'alignItems': 'center'}} className='_clickable' >
                        <MyImage src={UpIcon} width={20} height={20} alt="Up"/>
                    </div>
                ) : ""
            }
            {
                ((parent && index < parent.subsections.length - 1) || (!parent && index < roots.length - 1)) ? (
                    <div title={"Move down"} onClick={() => moveSection((parent ? parent.id : undefined), node.id, false, nodes, setNodes, roots, setRoots)} style={{'display': 'flex', 'alignItems': 'center'}} className='_clickable'>
                        <MyImage src={DownIcon} width={20} height={20} alt="Down" />
                    </div>
                ) : ""
            }
        </>
    )

    // Make notes section
    let notesSection = ""
    if (isEditStep && isLeaf){
        notesSection = (
            <>
                <AddNotes
                    value={node.notes ? node.notes : ''}
                    setValue={(x) => {editLeaf(node.id, {...node, 'notes': x}, setNodes)}}
                    placeholder={'Add comments here...'} />
            </>
        )
    }
    else if (isLeaf && node.notes){
        let parsedNotes = node.notes
        if (parsedNotes){
            try {
                parsedNotes = JSON.parse(node.notes)
            }
            catch(e){}
        }
        else {
            parsedNotes = ""
        }
        
        notesSection = (
            <RichTextViewer content={parsedNotes} />
        )
    }

    
    let userNotesSection = ""
    if (!isEditStep && isLeaf){
        userNotesSection = (
            <>
                <AddNotes
                    value={userValue && userValue.notes && userValue.notes[node.id] ? userValue.notes[node.id] : ""}
                    setValue={(x) => {setUserValue((prev) => {let cpy = {...prev}; cpy.notes = {...cpy.notes, [node.id]: x}; return cpy})}}
                    placeholder={'Add notes just for you...'} />
            </>
        )
    }

    
    // Quiz area (display, take, delete, regenerate)
    let quizSection = ""
    if (isEditStep && isLeaf){
        if (quizLoading){
            quizSection = (
                <Loading text={"Generating quiz"} />
            )
        }
        else if (quizDeleting){
            quizSection = (
                <Loading text={"Deleting quiz"} />
            )
        }
        else if (!node.quiz && node.links && node.links.length){
            quizSection = (
                <div style={{'display': 'flex'}}>
                    <SyntheticButton onClick={() => genQuiz(false)} value={(
                        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                            Make Quiz
                            <div style={{'display': 'flex', 'alignItems': 'center'}}>
                                <MyImage src={QuizIcon} width={20} height={20} alt={"Quiz"} />
                            </div>
                        </div>
                    )} />
                </div>
            )
        }
    }
    let hasQuizGrade = activityByAsset && activityByAsset[node.quiz]
    let grades = []
    if (hasQuizGrade){
        grades = activityByAsset[node.quiz].filter((x) => x.type == 'quiz_grade')
        hasQuizGrade = grades.length
    }
    if (isLeaf && node.quiz){
        if (quizLoading){
            quizSection = (
                <Loading text={"Generating quiz"} />
            )
        }
        else if (quizDeleting){
            quizSection = (
                <Loading text={"Deleting quiz"} />
            )
        }
        else {
            if (hasQuizGrade){
                let quizGrade = JSON.parse(grades[0].metadata)
                let thisGrade = parseInt(quizGrade['total_points'])
                let available = parseInt(quizGrade['available_points'])
                let percentage = (100 * thisGrade / available).toFixed(1)
                quizSection = (
                    <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                        <Link href={`/assets/${node.quiz}`}>
                            <SyntheticButton value={(
                                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                    {`Re-take Quiz (${percentage}%)`}
                                    <div style={{'display': 'flex', 'alignItems': 'center'}}>
                                        <MyImage src={QuizIcon} width={20} height={20} alt={"Quiz"} />
                                    </div>
                                </div>
                            )} />
                        </Link>
                        {
                            isEditStep ? (
                                <>
                                    <div className={styles.makeIntroButton} onClick={() => genQuiz(node.quiz)}>
                                        <div>
                                            Re-make Quiz
                                        </div>
                                    </div>
                                    <div className={styles.makeIntroButton} onClick={() => deleteQuiz(node.quiz)}>
                                        <div>
                                            Delete Quiz
                                        </div>
                                    </div>
                                </>
                            ) : ""
                        }
                    </div>
                )
            }
            else {
                quizSection = (
                    <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                        <Link href={`/assets/${node.quiz}`}>
                            <SyntheticButton value={(
                                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                    Take Quiz
                                    <div style={{'display': 'flex', 'alignItems': 'center'}}>
                                        <MyImage src={QuizIcon} width={20} height={20} alt={"Quiz"} />
                                    </div>
                                </div>
                            )} />
                        </Link>
                        {
                            isEditStep ? (
                                <>
                                    <div className={styles.makeIntroButton} onClick={() => genQuiz(node.quiz)}>
                                        <div>
                                            Re-make Quiz
                                        </div>
                                    </div>
                                    <div className={styles.makeIntroButton} onClick={() => deleteQuiz(node.quiz)}>
                                        <div>
                                            Delete Quiz
                                        </div>
                                    </div>
                                </>
                            ) : ""
                        }
                    </div>
                )
            }
            
        }
    }

    // Dealing with highlights / auto-opening.
    let amNext = false
    let hasPremierPosition = false
    let setForceOpen = () => {}
    if (highlightNext){
        hasPremierPosition = premierPosition ? premierPosition.includes(node.id) : false
        if (hasPremierPosition){
            setForceOpen = () => {
                setPremierPosition(undefined)
            }
        }

        amNext = nextStepPath && nextStepPath.length && nextStepPath[nextStepPath.length - 1] == node.id    
    }

    function createChatCallback(assetRow){
        // Add into section
        if (assetRow){
            setUserValue((prev) => {return {...prev, 'chats': {...prev.chats, [nodeId]: assetRow.id}}})
        }
    }

    let createChatSection = !isEditStep && isLeaf ? (
        userValue.chats && userValue.chats[nodeId] ? (
            <div style={{'display': 'flex'}}>
                <div className={styles.makeIntroButton}>
                    <Link href={`/assets/${userValue.chats[nodeId]}`} target="_blank">
                        <div style={{'display': 'flex', 'gap': '7px', 'alignItems': 'center'}}>
                            <div>
                                Go to Chat
                            </div>
                            <MyImage src={ChatIcon} width={17} height={17} alt={"Chat"}  />
                        </div>
                    </Link>
                </div>
            </div>
        ) : (
            <div style={{'display': 'flex'}}>
                <CreateWrapper
                    callback={(x) => {setMakeLinkedChatLoading(false); createChatCallback(x)}}
                    noStretch={true}
                    templateCode={"detached_chat"}
                    noShow={true}
                    newTab={true}
                    loadCallback={() => {setMakeLinkedChatLoading(true)}}
                >
                    {makeLinkedChatLoading ? (
                        <Loading text="" />
                    ) : (
                        <div className={styles.makeIntroButton}>
                            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                                <div>
                                    Make No-Doc Chat
                                </div>
                                <MyImage src={ChatIcon} width={20} height={20} alt={"Chat"}  />
                            </div>
                        </div>
                    )}
                    
                </CreateWrapper>
            </div>
        )
    ) : ""

    // If all the readings have associated actuivity, and the quiz taken, add a complete button.
    const allReadNotComplete = isLeaf && !isComplete(node) && (!node.quiz || hasQuizGrade) && (!node.links || (activityByAsset && !(node.links.filter((x) => {return (!activityByAsset[x.id] || !activityByAsset[x.id].length)}).length)))
    let actionRow = (allReadNotComplete || quizSection) ? (
        <div style={{'display': 'flex', 'gap': '1rem', 'alignItems': 'center'}}>
            {quizSection}
            {
                !isEditStep && allReadNotComplete ? (
                    <SyntheticButton value={(
                        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                            <div>
                                Click to Complete
                            </div>
                            <MyImage src={CircleCheckIcon} width={20} height={20} alt={"Check"} />
                        </div>
                    )} onClick={() => {
                        setUserValue((prev) => {
                            let newVal = {...prev, 'stage': 1, 'checks': [...prev.checks, node.id]}
                            continueCourse(getContinuePath(newVal, nodes, roots), setPremierPosition)
                            return newVal
                        })
                    }} />
                ) : ""
            }
        </div>
    ) : ""
    
    return (
        <CollapsibleMenu headerId={`header_${node.id}`} key={node.id} header={sectionHeader} headerContainerAddClass={amNext ? `${styles.headerContainerSecondClass}` : ''} forceOpen={hasPremierPosition} setForceOpen={setForceOpen} headerNeedsFullSpace={editingSection} rightButtons={rightButtons} openByDefault={openByDefault || (!sectionTrail || sectionTrail.length < 1)} ignoreHeaderTextClick={isEditStep}>
            <div style={{'display': 'flex', 'gap': '10px', 'flexDirection': 'column'}}>
                {fullIntroArea}
                <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '10px'}}>
                    {node.links && node.links.length > 0 ? (
                        <div className={styles.sectionLinks}>
                            {node.links.map((x, i) => {return makeLink(node, x, i)})}
                        </div>
                    ) : ""}
                    {makeSubsections(node.subsections, node, fullSection)}
                    {isEditStep && isLeaf ? (
                        <AddSources
                            value={node.links ? node.links : []}
                            setValue={(x) => {editLeaf(node.id, {...node, 'links': x}, setNodes)}}
                            leaf={node}
                            manifestRow={manifestRow}
                            collections={collections}
                            selectedGroupTags={selectedGroupTags}
                            otherLinks={Object.values(nodes).map((item) => item.links && item.id != node.id ? item.links.map(x => x.id) : []).flat()} />
                    ) : ""}
                    {notesSection}
                    {actionRow}
                    {createChatSection}
                    {userNotesSection}
                </div>
            </div>
        </CollapsibleMenu>
    )
}

