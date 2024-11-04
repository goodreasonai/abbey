import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import styles from './Classroom.module.css'
import { formatTimestampDefault, formatTimestampSmall } from "@/utils/time"
import { getTemplateByCode } from "@/templates/template"
import { getCanEdit } from "@/utils/requests"
import useSaveDataEffect from "@/utils/useSaveDataEffect"
import CollapsibleMenu from "../CollapsibleMenu/CollapsibleMenu"
import Table from "../Table/Table"
import LinkedSelectorItem from "../LinkedSelectorItem/LinkedSelectorItem"
import AddIcon from '../../../public/icons/AddIcon.png'
import RemoveIcon from '../../../public/icons/RemoveIcon.png'
import MyImage from "../MyImage/MyImage"
import Loading from "../Loading/Loading"
import MultiInputText from "../form/MultiInputText"
import EditIcon from '../../../public/icons/EditIcon.png'
import DateTimePicker from "../form/DateTimePicker"
import SyntheticButton from "../form/SyntheticButton"
import SendEmailIcon from '../../../public/icons/SendEmailIcon.png'
import Tooltip from "../Tooltip/Tooltip"
import Student from "./Student"
import Info from "../Info/Info"
import Saving from "../Saving/Saving"
import { Auth } from "@/auth/auth"


export const getDefaultValue = () => {
    return {
        'dueDates': {},  // asset id to string, which is formatted
        'assignments': []  // List of asset ids
    }
}


export default function Classroom({ manifestRow, canEdit }){
    
    const { getToken, isSignedIn } = Auth.useAuth();

    const thisTemplate = getTemplateByCode(manifestRow['template'])

    const [students, setStudents] = useState([])
    const [studentActivity, setStudentActivity] = useState([])
    const [studentsJson, setStudentsJson] = useState([])
    const savedStudents = useRef([])  // why ref? don't want to have to deal with double save complications. no other good reason.
    const [saveStudentsIsLoading, setSaveStudentsIsLoading] = useState(false)

    const [value, setValue] = useState(getDefaultValue())
    const [saveValueLoading, setSaveValueLoading] = useState(0)
    const [assignmentInfo, setAssignmentInfo] = useState({})  // to store asset id -> asset row for relevant assets
    const [fullStateLoadingState, setFullStateLoadingState] = useState(0)
    const [pendingStudents, setPendingStudents] = useState([])
    const [needsAttention, setNeedsAttention] = useState({})
    const [remindEmailLoadingState, setRemindEmailLoadingState] = useState(0)
    const [addAssignmentsOpen, setAddAssignmentsOpen] = useState(false)


    // turning student activity (which is a list) into an object that goes user id -> asset id -> list
    const processedStudentActivity = useMemo(() => {
        let processed = {}
        for (let entry of studentActivity){
            let uid = entry['user_id']
            let aid = entry['asset_id']
            if (processed[uid]){
                if (processed[uid][aid]){
                    processed[uid][aid].push(entry)
                }
                else {
                    processed[uid][aid] = [entry]
                }
            }
            else {
                processed[uid] = {[aid]: [entry]}
            }
        }
        return processed
    }, [studentActivity])

    useEffect(() => {
        async function getFullState() {
            try {
                setFullStateLoadingState(1)
                const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/classroom/get?id=${manifestRow['id']}`
                const response = await fetch(url, {
                    'headers': {
                        'x-access-token': await getToken(),
                    },
                    'method': 'GET'
                })
                const myJson = await response.json()
                if (myJson['response'] != 'success'){
                    console.log(myJson)
                    throw Error("Response was not success")
                }
                if (myJson['value']){
                    setValue(myJson['value'])
                }
                if (myJson['assignment_info']){
                    setAssignmentInfo(myJson['assignment_info'])
                }
                let students = []
                if (myJson['students']){
                    setStudents(myJson['students'])
                    students = [...myJson['students']]
                }
                let pendingStudents = []
                if (myJson['pending_students']){
                    setPendingStudents(myJson['pending_students'])
                    pendingStudents = myJson['pending_students']
                }
                
                setStudentsJson([...students.map((user) => {
                    return {'email': user.email_address}
                }), ...(pendingStudents.map((item) => {return {'email': item}}))])

                if (myJson['aggregated_activity']){
                    setStudentActivity(myJson['aggregated_activity'])
                }

                if (myJson['needs_attention']){
                    setNeedsAttention(myJson['needs_attention'])
                }

                setFullStateLoadingState(2)
            }
            catch(e) {
                console.log(e)
                setFullStateLoadingState(3)
            }
        }
        if (manifestRow['id'] && isSignedIn !== undefined){
            getFullState()
        }
    }, [manifestRow, isSignedIn])

    const stableRequest = useCallback(async () => {
        try {
            setSaveValueLoading(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/classroom/save'
            const data = {
                'id': manifestRow['id'],
                'value': value
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
                console.log(myJson)
                throw Error("Response was not success")
            }
            setSaveValueLoading(2)
        }
        catch (e) {
            setSaveValueLoading(3)
            console.log(e)
        }
    }, [value, manifestRow]);
    useSaveDataEffect(value, canEdit && fullStateLoadingState === 2, stableRequest, setSaveValueLoading)

    function makeStudentLabel(item, i) {
        return (
            <div style={{'padding': '5px 10px', 'backgroundColor': 'var(--dark-primary)', 'color': 'var(--light-text)', 'fontFamily': 'var(--font-body)', 'borderRadius': 'var(--small-border-radius)'}}>
                {item.first_name ? ( `${item.first_name} ${item.last_name}` ) : (item.email_address)}
            </div>
        )
    }

    function makeStudent(item, i){
        return (
            <Student
                key={item.id}
                item={item}
                processedStudentActivity={processedStudentActivity}
                assignmentInfo={assignmentInfo}
                dueDates={value && value.dueDates ? value.dueDates : {}} />
        )
    }

    // Get url for the add assignments table
    const resultLimit = 10
    function getUrl(page, text){
        if (!text){
            text = ""
        }
        let url = new URL(process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/manifest")
        let params = new URLSearchParams(url.search);
        const offset = resultLimit * (page - 1)
        let paramObj = {
            'search': text,
            'limit': resultLimit,
            'folders_first': 0,
            'recent_activity': 0,
            'isolated': text ? 0 : 1,
            'include_groups': 1,
            'offset': offset,
        }
        for (let key in paramObj) {
            params.append(key, paramObj[key]);
        }
        url.search = params.toString()
        return url
    }

    function addAssignment(item) {
        setAssignmentInfo({...assignmentInfo, [item.id]: item})
        setValue({...value, 'assignments': [...value.assignments, item.id]})
    }

    function removeAssignment(itemId) {
        // Don't actually need to change assignment info if you're careful elsewhere.
        setValue({...value, 'assignments': value.assignments.filter(x => x != itemId)})
    }

    function makeRow(item, i){
        const selected = value.assignments.includes(item.id)
        return (
            <div key={item.id}>
                <LinkedSelectorItem item={item} showButton={true} iconImage={!selected ? (
                    <MyImage src={AddIcon} alt={"Add"} width={20} height={20} className={"_clickable"} onClick={() => addAssignment(item)} />
                ) : <MyImage src={RemoveIcon} alt={"Remove"} width={20} height={20} className={"_clickable"} onClick={() => removeAssignment(item.id)} />
                } />
            </div>
        )
    }

    function AssignmentBlock({itemId}){

        const [editingDueDate, setEditingDueDate] = useState(false)

        let item = assignmentInfo[itemId]
        if (!item){
            return (<></>)
        }
        let dueDate = ""
        if (value.dueDates && value.dueDates[itemId]){
            // dueDate = formatTimestampDefault(value.dueDates[itemId])
            dueDate = value.dueDates[itemId]
        }
        const [editingDueDateText, setEditingDueDateText] = useState(dueDate.replace(' ', 'T'))

        function onDueDateClick(){
            if (canEdit){
                setEditingDueDate(true)
            }
        }

        function onEnter() {
            setValue({...value, 'dueDates': {...value.dueDates, [itemId]: editingDueDateText.replace('T', ' ')}})
            setEditingDueDate(false)
        }

        let dueDateDisplay = ""
        if (editingDueDate){
            dueDateDisplay = (
                <DateTimePicker
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onEnter();
                        }
                    }}
                    outsideClickCallback={onEnter}
                    value={editingDueDateText}
                    setValue={setEditingDueDateText} />
            )
        }
        else if (dueDate){
            dueDateDisplay = (
                <>
                    <div style={{'flex': '1'}}>
                        <span style={{'color': 'var(--passive-text)'}}>Due:</span> {formatTimestampDefault(dueDate, true)}
                    </div>
                    {
                        canEdit ? (
                            <div>
                                <MyImage src={EditIcon} width={20} height={20} alt={"Edit"} className={"_clickable"} />
                            </div>
                        ) : ""
                    }
                </>
            )
        }
        else if (canEdit){
            dueDateDisplay = (
                <>
                    <div style={{'flex': '1'}}>
                        Add Due Date
                    </div>
                    <div>
                        <MyImage src={AddIcon} width={15} height={15} alt={"Edit"} className={"_clickable"} />
                    </div>
                </>
            )
        }

        let iconImage = ""
        let showButton = false
        if (canEdit){
            iconImage = (
                <div style={{'display': 'flex'}}>
                    <MyImage src={RemoveIcon} alt={"Remove"} width={20} height={20} className={"_clickable"} onClick={() => removeAssignment(itemId)} />
                </div>
            )
            showButton = true
        }

        return (
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '0px'}}>
                <LinkedSelectorItem style={dueDateDisplay ? {'borderBottomRightRadius': '0px', 'borderBottomLeftRadius': '0px'} : {}} item={item} showButton={showButton} iconImage={iconImage} />
                {
                    dueDateDisplay ? (
                        <div className={`${styles.assignmentDueDate} ${canEdit ? styles.assignmentDueDateEditable : ''}`} onClick={onDueDateClick}>
                            {dueDateDisplay}
                        </div>
                    ) : ("")
                }
            </div>
        )
    }

    function makeAssignment(itemId, i) {
        return (
            <div key={itemId}>
                <AssignmentBlock itemId={itemId} />
            </div>
        )
    }

    const [dueSoon, upcomingAssignments, pastAssignments, undated] = useMemo(() => {
        const today = new Date();
        const oneWeekFromNow = new Date()
        oneWeekFromNow.setDate(today.getDate() + 7)

        const dueSoon = []
        const upcomingAssignments = []
        const pastAssignments = []
        const undated = []

        for (let assignmentId of value.assignments){
            if (value.dueDates && value.dueDates[assignmentId]){  // in form YYYY-MM-DD h:mm AM/PM
                const dueDate = new Date(value.dueDates[assignmentId]);
                if (dueDate < today){
                    pastAssignments.push(assignmentId)
                }
                else if (dueDate <= oneWeekFromNow) {
                    dueSoon.push(assignmentId);
                }
                else {
                    upcomingAssignments.push(assignmentId)
                }
            }
            else {
                undated.push(assignmentId)
            }
        }
        return [dueSoon, upcomingAssignments, pastAssignments, undated]
    }, [value.assignments, value.dueDates])


    // How many assignments do we show in one block without a 'See More'?
    const MAX_GROUPING_SIZE = 5
    function AssignmentGrouping({ item, title, sortingDirection='asc' }) {

        const [showingMore, setShowingMore] = useState(false)

        // Sort items by date.
        item = item.sort((a, b) => {
            if (!value.dueDates){
                return 0
            }
            const dateA = new Date(value.dueDates[a]) || new Date(0); // if no date, default to epoch
            const dateB = new Date(value.dueDates[b]) || new Date(0); // if no date, default to epoch
            if (sortingDirection == 'asc'){
                return dateA - dateB
            }
            else {
                return dateB - dateA
            }
        })

        let afters = []
        if (item.length > MAX_GROUPING_SIZE && !showingMore){
            afters  = item.slice(MAX_GROUPING_SIZE, item.length)
            item = item.slice(0, MAX_GROUPING_SIZE)
        }
        return (
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '.5rem'}}>
                <div>
                    {title}
                </div>
                <div style={{'display': 'flex', 'gap': '1rem', 'alignItems': 'center', 'flexWrap': 'wrap'}}>
                    {item.map(makeAssignment)}
                </div>
                {(afters && afters.length) || showingMore ? (
                    <div style={{'display': 'flex'}}>
                        <div style={{'color': 'var(--passive-text)'}} className="_clickable" onClick={() => setShowingMore(!showingMore)}>
                            {showingMore ? "See Less" : "See More"}
                        </div>
                    </div>
                ) : ""}
            </div>
        )
    }

    function makeGrouping(item, title, sortingDirection='desc') {
        return (
            <AssignmentGrouping item={item} title={title} sortingDirection={sortingDirection} />
        )
    }

    const assignmentGroupings = []
    if (undated.length){
        assignmentGroupings.push(makeGrouping(undated, 'Undated'))
    }
    if (dueSoon.length){
        assignmentGroupings.push(makeGrouping(dueSoon, 'Due Soon'))
    }
    if (upcomingAssignments.length){
        assignmentGroupings.push(makeGrouping(upcomingAssignments, 'Upcoming', 'asc'))
    }
    if (pastAssignments.length){
        assignmentGroupings.push(makeGrouping(pastAssignments, 'Past'))
    }
    let assignmentsBody = (
        assignmentGroupings.length ? (
            <div style={{'display': 'flex', 'gap': '1rem', 'flexWrap': 'wrap'}}>
                {assignmentGroupings.map((item, i) => {
                    return (
                        <div key={i}>
                            {item}
                        </div>
                    )
                })}
            </div>
        ) : "No assignments yet."
    )

    const saveStudents = useCallback(async () => {

        // note that it's ok to use stringify for equality since these are ordered arrays.
        if (JSON.stringify(studentsJson) == JSON.stringify(savedStudents.current)){
            return
        }
        try {
            setSaveStudentsIsLoading(true)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/classroom/save-students`
            const data = {
                'students': studentsJson,
                'id': manifestRow['id']
            }
            const response = await fetch (url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'body': JSON.stringify(data),
                'method': 'POST'
            })
            const myJson = await response.json()
            if (myJson['response'] != 'success'){
                console.log(myJson)
                throw Error("Response was not success")
            }
            savedStudents.current = JSON.parse(JSON.stringify(studentsJson))
        }
        catch(e) {
            console.log(e)
        }
        setStudentsJson(savedStudents.current)
        setSaveStudentsIsLoading(false)
    }, [studentsJson, setSaveStudentsIsLoading])

    useSaveDataEffect(studentsJson, canEdit && fullStateLoadingState == 2, saveStudents, 0)

    let pendingStudentsMap = useMemo(() => {
        let x = {}
        for (let email of pendingStudents){
            x[email] = (<span style={{'color': 'var(--light-text)'}}>{"(pending)"}</span>)
        }
        return x
    }, [pendingStudents])
    

    async function sendReminderEmail(){
        try {
            setRemindEmailLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/email/reminder`
            const data = {
                'id': manifestRow['id'],
                'data': {}
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
                console.log(myJson)
                throw Error("Response was not success")
            }
            setRemindEmailLoadingState(2)
        }
        catch (e) {
            setRemindEmailLoadingState(3)
            console.log(e)
        }
    }

    // EARLY RETURN :)
    if (fullStateLoadingState == 1 || fullStateLoadingState == 0){
        return (
            <Loading text={`Loading ${thisTemplate.constructor.readableName}`} />
        )
    }
    else if (fullStateLoadingState == 3) {
        return (
            <div>
                An error occurred.
            </div>
        )
    }

    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
            {
                needsAttention.id ? (
                    <div style={{'padding': '10px', 'backgroundColor': 'var(--light-primary)', 'display': 'flex', 'alignItems': 'center', 'border': '1px solid var(--light-border)', 'borderRadius': 'var(--small-border-radius)'}}>
                        <thisTemplate.AttentionComponent data={{...needsAttention, 'title': manifestRow['title'], 'template': 'classroom'}} />
                    </div>
                ) : ""
            }
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                    <div style={{'color': 'var(--passive-text)'}}>
                        Assignments
                    </div>
                    {
                        canEdit && students.length && assignmentGroupings.length ? (
                            remindEmailLoadingState == 0 ? (
                                <div style={{'display': 'flex', 'alignItems': 'center'}}>
                                    <Tooltip align="bottom" content={"Auto-send an email about due assignments"}>
                                        <SyntheticButton style={{'padding': '5px 10px', 'fontSize': '.9rem'}} value={(
                                            <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                                <div>
                                                    Remind
                                                </div>
                                                <MyImage src={SendEmailIcon} width={17} height={17} alt={"Email"} />
                                            </div>
                                        )} onClick={sendReminderEmail} />
                                    </Tooltip>
                                </div>
                            ) : (remindEmailLoadingState == 1 ? (
                                    <Loading text="Sending" />
                                ) : (remindEmailLoadingState == 2 ? (
                                    <div>
                                        Sent Reminder.
                                    </div>
                                ) : (remindEmailLoadingState == 3 ? (
                                    <div>
                                        Error
                                    </div>
                                ) : ""))
                            )
                            
                        ) : ""
                    }
                    <div style={{'flex': '1'}}></div>
                    <Saving saveValueLoading={saveValueLoading} />
                </div>
                {canEdit ? (
                    <div>
                        <CollapsibleMenu header={"Add Assignments"} setOpenCallback={setAddAssignmentsOpen}>
                            <div style={{'minHeight': '200px'}}>
                                {addAssignmentsOpen ? (
                                    <Table
                                        searchable={true}
                                        makeRow={makeRow}
                                        getUrl={getUrl}
                                        limit={resultLimit}
                                        loadingSkeleton={'green-pills'}
                                        flexDirection='row'
                                        flexWrap='wrap' />
                                ) : ""}
                            </div>
                        </CollapsibleMenu>
                    </div>
                ) : ""}
                {assignmentsBody}
            </div>
            <div>
                <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                    <div style={{'color': 'var(--passive-text)'}}>
                        Students
                    </div>
                    {
                        canEdit ? (
                            <div>
                                <CollapsibleMenu header={"Add Students"} setOpenCallback={setAddAssignmentsOpen}>
                                    <MultiInputText
                                        optionalExtraValueText={pendingStudentsMap}
                                        value={studentsJson.map((item) => item.email)}
                                        setValue={(x) => {
                                            setStudentsJson(x.map((item) => {return {'email': item}}))
                                            const justEmails = students.map((user) => {
                                                return user.email_address
                                            })
                                            const newGuys = []
                                            for (let guy of x){
                                                if (!justEmails.includes(guy)){
                                                    newGuys.push(guy)
                                                }
                                            }
                                            setPendingStudents([...pendingStudents, ...newGuys])
                                        }}
                                        showLoading={saveStudentsIsLoading}
                                        placeholder={"e.g., niels@bohr.com"}
                                        useLightPrimaryStyle={true} />
                                </CollapsibleMenu>
                            </div>
                        ) : ""
                    }
                    {
                        students.length ? (
                            canEdit ? (
                                students.map(makeStudent)
                            ) : (
                                <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center', 'flexWrap': 'wrap'}}>
                                    {students.map(makeStudentLabel)}
                                </div>
                            )
                        ) : (
                            <div>
                                {pendingStudents && pendingStudents.length ? (
                                    <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                        <div>
                                            Students pending
                                        </div>
                                        <Info text={"They need first to accept their invitations to join."} />
                                    </div>
                                ) : "No students yet"}
                            </div>
                        )
                    }
                </div>
                
            </div>
        </div>
    )
}
