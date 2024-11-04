import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import BrainstormStep from './BrainstormStep'
import styles from './Curriculum.module.css'
import StepContainer from './StepContainer'
import LinkStep, { extractNodes } from './LinkStep'
import AddGroups from './AddGroups'
import Finalized from './Finalized'
import Loading from '../Loading/Loading'
import { Auth } from "@/auth/auth";
import { getCanEdit } from '@/utils/requests'
import useSaveDataEffect from '@/utils/useSaveDataEffect'
import Saving from '../Saving/Saving'
import { USER_DATA } from '@/config/strConstants'


export const linksAreFull = (value) => {
    for (let key of Object.keys(value)) {
        if (!value[key].links || !value[key].links.length){
            return false;
        }
    }

    return true
}

// Returns array of size two, numerator and denominator
export const courseCompletion = (value, userValue) => {
    let num = 0
    let denom = 0
    for (let key of Object.keys(value)){
        if (!value[key].subsections || !value[key].subsections.length){
            num += 1
            if (userValue.checks.includes(key)){
                denom += 1  // leetcode failure
            }
        }
    }
    return [denom, num]
}


export const getDefaultFullState = () => {
    return {
        'currStep': 0,  // 0 = brainstorming, 1 = add groups, 2 = editing, 3 = taking
        'roots': [],  // Root sections by ID
        'nodes': {},  // Node id -> object
        'brainstormResponse': {'user': '', 'ai': ''}, // The first user text / the last ai response
        'brainstormChatRounds': [{'user': '', 'ai': ''}],
        'selectedGroups': {},
        'selectedGroupTags': {}
    }
}

export const getDefaultUserState = () => {
    return {
        'notes': {},  // nodeId -> user notes.
        'checks': [],  // list of node ids that have been completed.
        'stage': 0,  // 0 = not started, 1 = started, 2 = completed
        'intros': {}  // nodeId -> user intro (replacement for node.desc when unavailable)
    }
}

// Get the node that's next up
export const getContinuePath = (userState, nodes, roots) => {
    // Get the topologically first node without a check
    function rec(node, history) {
        let newHistory = [...history, node['id']]
        if (node.subsections && node.subsections.length){
            for (let child of node.subsections){
                let path = rec(nodes[child], newHistory)
                if (path){
                    return path
                }
            }
        }
        else if (!userState.checks.includes(node['id'])){
            return newHistory
        }
        return undefined
    }
    for (let root of roots){
        let path = rec(nodes[root], [])
        if (path){
            return path
        }
    }
    return undefined
}


export const continueCourse = (path, setPremierPosition) => {
    setPremierPosition(path)

    if (!path){
        return
    }

    // we love our DOM manipulations don't we folks
    let elementId = `header_${path[path.length-1]}`  // dependent on the id in Structured.
    const element = document.getElementById(elementId);
    if (element) {
        // This is also fucking terrible.
        // Based on how long it will take for the stuff to open.
        setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 500)
    }
}


export default function Curriculum({ manifestRow, canEdit }) {


    /* Contains:
    - 'currStep' (0 = brainstorm, 1 = select groups, 2 = linking, 3 = final)
    - 'nodes'
    - 'brainstormResponse'
    - 'selectedGroups'
    */
    const [fullState, setFullState] = useState(getDefaultFullState())
    const [fullStateLoadingState, setFullStateLoadingState] = useState(0)
    const [userValue, setUserValue] = useState(getDefaultUserState())
    const [savedUserValue, setSavedUserValue] = useState(getDefaultUserState())
    const [userActivity, setUserActivity] = useState([])
    const [assetsInfo, setAssetsInfo] = useState({})
    const [savedFullState, setSavedFullState] = useState(null)

    const [fullStateSavingState, setFullStateSavingState] = useState(0)
    const [userValueSavingState, setUserValueSavingState] = useState(0)
    
    // This is just a hacky way to get the "Continue" button to work
    const [premierPosition, setPremierPosition] = useState(undefined)  // a list defining the node path to the premier position

    const { getToken, isSignedIn } = Auth.useAuth()

    const stepsToReady = useMemo(() => {
        return {
            0: !(!fullState.brainstormResponse.ai),
            1: Object.keys(fullState.selectedGroups).filter((item) => fullState.selectedGroups[item]).length > 0,
            2: linksAreFull(fullState.nodes),
            3: false
        }
    }, [fullState])

    // Get the full state
    useEffect(() => {

        async function getFullState(){
            try {
                setFullStateLoadingState(1)
                const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/curriculum/get?id=${manifestRow['id']}`
                const response = await fetch(url, {
                    'headers': {
                        'x-access-token': await getToken()
                    },
                    'method': 'GET'
                })
                
                const myJson = await response.json()
    
                if (myJson['response'] != 'success'){
                    throw Error(`Response was not success: ${myJson[['reason']]}`)
                }
    
                const results = myJson['curriculum_state']
                if (!results){
                    setFullState(getDefaultFullState())
                }
                else {
                    let val = results
                    // This business has to do with changing from old/new versions (1/17/24)
                    // Now, it also serves the function of taking server generated state and converting it into normal state.
                    if (val.roots){
                        setFullState(val)
                        setSavedFullState(JSON.parse(JSON.stringify(val)))
                    }
                    else if (val.value) {
                        let [roots, nodes] = extractNodes(val.value)
                        const newState = {...val, 'roots': roots, 'nodes': nodes}
                        delete newState['value']
                        setFullState(newState)
                        setSavedFullState(JSON.parse(JSON.stringify(newState)))
                    }
                }

                if (myJson['assets_info']){
                    // Turn it into object with id => info
                    let mapping = myJson['assets_info'].reduce((acc, item) => {
                        acc[item.id] = item;
                        return acc;
                    }, {});
                    setAssetsInfo(mapping)
                }

                if (myJson['aggregated_activity']){
                    setUserActivity(myJson['aggregated_activity'])
                }

                setFullStateLoadingState(2)
            }
            catch(e) {
                console.log(e)
                setFullStateLoadingState(3)
            }
        }

        if (manifestRow.id && isSignedIn !== undefined){
            getFullState()
        }
    }, [manifestRow, isSignedIn])


    // Get the user data
    useEffect(() => {

        async function getUserState(){
            try {
                const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/metadata?id=${manifestRow['id']}&key=${USER_DATA}`
                const response = await fetch(url, {
                    'headers': {
                        'x-access-token': await getToken()
                    },
                    'method': 'GET'
                })
                
                const myJson = await response.json()
    
                if (myJson['response'] != 'success'){
                    throw Error(`Response was not success: ${myJson[['reason']]}`)
                }
    
                const results = myJson['results']
    
                if (results.length != 0){
                    let val = JSON.parse(results[0].value)
                    setSavedUserValue(val)
                    setUserValue(val)
                }
            }
            catch(e) {
                console.log(e)
            }
        }

        if (manifestRow.id && isSignedIn){
            getUserState()
        }
    }, [manifestRow, isSignedIn])


    const saveFullStateCallback = useCallback(async () => {
        try {
            setFullStateSavingState(1)  // technically unnecessary when using useSaveDataEffect
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/curriculum/save"
            const data = {
                'value': fullState,
                'old_value': savedFullState,
                'id': manifestRow['id']
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

            setSavedFullState(JSON.parse(JSON.stringify(myJson['result'])))

            if (myJson['response'] != 'success'){
                throw Error(`Response was not success: ${myJson['reason']}`)
            }
            setFullStateSavingState(2)
        }
        catch(e) {
            console.log(e)
            setFullStateSavingState(3)
        }
    }, [fullState, setSavedFullState, setFullStateSavingState])
    const shouldSave = useMemo(() => {
        return JSON.stringify(fullState) != JSON.stringify(getDefaultFullState()) && canEdit
    }, [savedFullState, fullState])
    useSaveDataEffect(fullState, shouldSave, saveFullStateCallback, 1000, setFullStateSavingState)


    const saveUserState = useCallback(async () => {
        try {
            setUserValueSavingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/curriculum/save-user"
            const data = {
                'user_state': userValue,  // because it's a string that's being saved.
                'prev_user_state': savedUserValue,
                'id': manifestRow['id']
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

            setSavedUserValue(myJson['result'])
            setUserValueSavingState(2)
        }
        catch(e) {
            console.log(e)
            setUserValueSavingState(3)
        }
    }, [userValue, savedUserValue, setSavedUserValue, setUserValueSavingState])
    const canSaveUser = useMemo(() => {
        return JSON.stringify(userValue) != JSON.stringify(savedUserValue) && JSON.stringify(userValue) != JSON.stringify(getDefaultUserState())
    }, [userValue, savedUserValue])
    useSaveDataEffect(userValue, canSaveUser, saveUserState, 1000, setUserValueSavingState)

    function advanceStep(){
        setFullState({...fullState, 'currStep': fullState.currStep + 1})
    }

    function decrementStep(){
        setFullState({...fullState, 'currStep': fullState.currStep - 1})
    }

    let completions = [0, 0]
    if (fullState.currStep == 3){
        completions = courseCompletion(fullState.nodes, userValue)
    }
    let completionsString = completions && completions.length > 1 && completions[1] ? `${completions[0]}/${completions[1]} complete` : ''
    let finalTitle = (
        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
            <div>
                {completionsString}
            </div>
            <div>
                <Saving saveValueLoading={userValueSavingState} />
            </div>
        </div>
    )
    const steps = [
        {'title': 'Brainstorm', 'element': (
            <BrainstormStep
                manifestRow={manifestRow}
                brainstormResponse={fullState.brainstormResponse}
                setBrainstormResponse={(x) => setFullState((prev) => {return {...prev, 'brainstormResponse': x}})}
                brainstormChatRounds={fullState.brainstormChatRounds}
                setBrainstormChatRounds={(x) => setFullState((prev) => {return {...prev, 'brainstormChatRounds': x}})}
                nextCallback={() => advanceStep()} />
        )},

        {'title': 'Find Resources', 'element': (
            <AddGroups
                manifestRow={manifestRow}
                selectedGroups={fullState.selectedGroups}
                setSelectedGroups={(x) => setFullState((prev) => {return {...prev, 'selectedGroups': x}})}
                selectedGroupTags={fullState.selectedGroupTags || {}}
                setSelectedGroupTags={(x) => setFullState((prev) => {return {...prev, 'selectedGroupTags': x}})}
                nextCallback={() => advanceStep()} />
        )},

        {'title': 'Link Resources & Edit', 'element': (
            <LinkStep
                manifestRow={manifestRow}
                fullState={fullState}
                setFullState={setFullState}
                nextCallback={() => advanceStep()}
                userActivity={userActivity}
                setUserActivity={setUserActivity}
                setAssetsInfo={setAssetsInfo}
                assetsInfo={assetsInfo}
                userValue={userValue}
                setUserValue={setUserValue}
                savingVar={fullStateSavingState}
                 />
        )},

        {'title': finalTitle,  'element': (
            <Finalized
                fullState={fullState}
                setFullState={setFullState}
                manifestRow={manifestRow}
                userValue={userValue}
                setUserValue={setUserValue}
                userActivity={userActivity}
                setUserActivity={setUserActivity}
                premierPosition={premierPosition}
                setPremierPosition={setPremierPosition}
                assetsInfo={assetsInfo}
                setAssetsInfo={setAssetsInfo}
                 />
        )},
    ]

    let fullElement = (
        <Loading />
    )
    const openStepIndex = canEdit ? fullState.currStep : steps.length - 1
    if (openStepIndex != -1 && fullStateLoadingState == 2){
        let innerElement = steps[openStepIndex].element
        fullElement = (
            <StepContainer
                canEdit={canEdit}
                manifestRow={manifestRow}
                finalStepIndex={steps.length - 1}
                step={openStepIndex}
                allTitles={steps.map((item) => item.title)}
                nextCallback={advanceStep}
                backCallback={decrementStep}
                stepsToReady={stepsToReady}
                userValue={userValue}
                setUserValue={setUserValue}
                continueCourse={() => continueCourse(getContinuePath(userValue, fullState.nodes, fullState.roots), setPremierPosition)} >
                {innerElement}
            </StepContainer>
        )
    }

    if (fullStateLoadingState == 3){
        fullElement = (
            "Error"
        )
    }

    return (
        <div className={styles.container}>
            <div className={styles.stepsContainer}>
                {fullElement}
            </div>
        </div>
    )
}
