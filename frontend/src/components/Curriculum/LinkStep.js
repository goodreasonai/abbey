import { useState, useEffect, useCallback, useMemo } from 'react'
import Button from '../form/Button'
import styles from './Curriculum.module.css'
import Loading from '../Loading/Loading'
import { Auth } from "@/auth/auth";
import Structured from './Structured'
import { linksAreFull } from './Curriculum'
import { handleGeneralStreaming } from '@/utils/streaming'
import SyntheticButton from '../form/SyntheticButton'
import GearIcon from '../../../public/icons/GearIcon.png'
import CircleCheckIcon from '../../../public/icons/CircleCheckIcon.png'
import MyImage from '@/components/MyImage/MyImage'
import AddGroups from './AddGroups'
import Toolbar from '../Toolbar/Toolbar'
import EditIcon from '../../../public/icons/EditIcon.png'
import { useRef } from 'react'


export const editLeaf = (leafId, newLeaf, setValue) => {
    setValue((prev) => {return {...prev, [leafId]: newLeaf}})
}

// Takes old (pre 2024 / server) version of value and separates it into nodes (content) and value (structure)
export const extractNodes = (value) => {
    let nodes = {}
    let roots = []
    function rec(val) {
        const node = {...val}
        if (val.subsections && val.subsections.length){
            for (let sub of val.subsections){
                rec(sub)
            }
            node.subsections = node.subsections.map((item) => item.id)
        }
        nodes[val.id] = node
    }
    for (let x of value){
        roots.push(x.id)
        rec(x)
    }
    return [roots, nodes]
}


export default function LinkStep({ manifestRow, fullState, setFullState, nextCallback, userActivity, setUserActivity, assetsInfo, setAssetsInfo, userValue, setUserValue, savingVar, ...props }) {
    
    const { getToken } = Auth.useAuth()

    const [structuredLoadingState, setStructuredLoadingState] = useState(0)
    const [linkLoadingState, setLinkLoadingState] = useState(0)
    const stopLinkingRef = useRef(false)

    const [forceLoadingNodes, setForceLoadingNodes] = useState({})  // used to pass down loading to those leaves for which LinkStep is managing auto-fill.
    
    const nodes = fullState.nodes
    const setNodes = useCallback((x) => {
        setFullState((prev) => {return {...prev, 'nodes': typeof x == 'function' ? x(prev.nodes) : x}})
    }, [setFullState])
    const roots = fullState.roots
    const setRoots = useCallback((x) => {
        setFullState((prev) => {return {...prev, 'roots': typeof x == 'function' ? x(prev.nodes) : x}})
    }, [setFullState])

    const selectedGroups=fullState.selectedGroups
    const setSelectedGroups=(x) => setFullState((prev) => {return {...prev, 'selectedGroups': x}})
    const selectedGroupTags= fullState.selectedGroupTags || {}
    const setSelectedGroupTags=(x) => setFullState((prev) => {return {...prev, 'selectedGroupTags': x}})
    const collections = useMemo(() => {
        let x = Object.keys(selectedGroups).filter((x) => selectedGroups[x])
        return x
    }, [selectedGroups])

    const brainstormResponse = fullState.brainstormResponse

    const autoLinked = useRef([])  // for making sure no duplicates in auto fill

    useEffect(() => {
        async function onLoad(){
            let foundPrev = nodes && Object.keys(nodes).length > 0
            if (!foundPrev){
                getStructured()
            }
        }

        if (manifestRow.id && structuredLoadingState == 0){
            onLoad()
        }
    }, [nodes])


    async function getStructured(){
        try {
            setStructuredLoadingState(1)

            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/curriculum/to-structured"
            
            const data = {
                'id': manifestRow['id'],
                'text': brainstormResponse.ai,
                'prompt': brainstormResponse.user
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
                throw Error(`Response was not success: ${myJson[['reason']]}`)
            }

            const result = myJson['result']

            // traverse value and separate into nodes and value (structure vs. content)
            let [roots, nodes] = extractNodes(result)
            setNodes(nodes)
            setRoots(roots)
            setStructuredLoadingState(2)
        }
        catch(e) {
            console.log(e)
            setStructuredLoadingState(3)
        }
    }

    function getLeaves(){
        let leaves = []
        function rec(nodeId){
            let x = nodes[nodeId]
            if (x.subsections && x.subsections.length) {
                for (let child of x.subsections){
                    rec(child)
                }
            }
            else {
                leaves.push(x)
            }
        }
        for (let root of roots){
            rec(root)
        }
        return leaves
    }

    async function retryLeaf(leaf, skipDesc) {
        try {
            setForceLoadingNodes({...forceLoadingNodes, [leaf.id]: true})
            // Generate description
            if (!skipDesc){
                const urlDesc = process.env.NEXT_PUBLIC_BACKEND_URL + "/curriculum/desc"
                const dataDesc = {
                    'id': manifestRow['id'],
                    'title': leaf.title,
                    'prompt': brainstormResult
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
                        editLeaf(leaf.id, {...leaf, 'desc': result}, setNodes)
                        leaf = {...leaf, 'desc': result}
                    }
                })
            }

            // Make links
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/curriculum/link"
            const data = {
                'id': manifestRow['id'],
                'collections': collections,
                // To add: prompt
                'filter_tags_on_groups': selectedGroupTags,
                'title': leaf.title,
                'exclude_ids': autoLinked.current
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
                throw Error(`Response was not success: ${myJson['reason']}`)
            }

            editLeaf(leaf.id, {...leaf, 'links': myJson['results']}, setNodes)
            setForceLoadingNodes({...forceLoadingNodes, [leaf.id]: false})

            return myJson['results']
        }
        catch (e) {
            setForceLoadingNodes({...forceLoadingNodes, [leaf.id]: false})
            console.log(e)
            return []
        }
    }

    async function doLinking(currLeafIndex, skipFull, skipDesc) {
        if (stopLinkingRef.current){  // This means it's stopped.
            if (currLeafIndex == 0){
                stopLinkingRef.current = false
            }
            else {
                setLinkLoadingState(0)
                return
            }
        }

        const leaves = getLeaves()  // redoing this each time is not expensive compared to the request
        
        if (currLeafIndex == 0){
            setLinkLoadingState(1)
            autoLinked.current = leaves.map((item) => item.links ? item.links.map(x => x.id) : []).flat() // resets it to be accurate when we first run it
        }
        if (currLeafIndex >= leaves.length){
            setLinkLoadingState(2)
            return
        }
        const leaf = leaves[currLeafIndex]
        if (!(skipFull && leaf.links && leaf.links.length > 0)){
            let newLinks = await retryLeaf(leaf, skipDesc)  // edits the node inside the function
            autoLinked.current.push(...newLinks.map(x => x.id))
        }
        doLinking(currLeafIndex + 1, skipFull, skipDesc)
    }

    function stopLinking() {
        stopLinkingRef.current = true
    }
    
    let content = ("")

    if (structuredLoadingState == 1){
        content = (
            <Loading cute={true} />
        )
    }
    else if (nodes && Object.keys(nodes).length > 0){
        content = (
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                <Toolbar
                    leftText={(
                        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                            Editing
                            <MyImage src={EditIcon} width={20} height={20} alt={"Editing"} />
                        </div>
                    )}
                    options={[
                        {'text':  "Auto-Fill Resources", 'loading': linkLoadingState == 1, 'icon': GearIcon, 'alt': 'Gears', 'onClick': () => {linkLoadingState == 1 ? stopLinking() : doLinking(0, true, true)}},
                        {'text': 'Done Editing', 'icon': CircleCheckIcon, 'alt': 'Good & Ready', 'onClick': () => {nextCallback()}}
                    ]}
                    style={{'position': 'sticky', 'top': '0px', 'zIndex': '10'}}
                    savingVar={savingVar}
                />
                <div className={styles.linkStepStructuredContainer}>
                    <div style={{'flex': '1'}}>
                        <Structured
                            fullState={fullState}
                            setFullState={setFullState}
                            manifestRow={manifestRow}
                            userValue={userValue}
                            setUserValue={setUserValue}
                            userActivity={userActivity}
                            setUserActivity={setUserActivity}
                            highlightNext={false}
                            assetsInfo={assetsInfo}
                            setAssetsInfo={setAssetsInfo}
                            editMode={true}
                            forceLoadingNodes={forceLoadingNodes} />
                    </div>
                    <div className={styles.linkStepAddGroupsContainer}>
                        <AddGroups
                            manifestRow={manifestRow}
                            selectedGroups={selectedGroups}
                            setSelectedGroups={setSelectedGroups}
                            selectedGroupTags={selectedGroupTags || {}}
                            setSelectedGroupTags={setSelectedGroupTags}
                            headerText="Collections you're sourcing from."
                            headerTextStyle={{'all': 'unset', 'fontSize': '1rem', 'color': 'var(--passive-text)'}}
                            nextCallback={undefined} />
                    </div>
                </div>
                <div>
                    {
                        linkLoadingState == 2 ? (
                            <Button onClick={() => nextCallback()} value={"Proceed"} />
                        ) : (
                            ""
                        )}
                </div>
            </div>
        )
    }

    return (
        <div>
            {content}
        </div>
    )
}
