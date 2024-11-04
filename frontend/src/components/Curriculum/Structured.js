import styles from './Curriculum.module.css'
import MyImage from '../MyImage/MyImage'
import CircleCheckIcon from '../../../public/icons/CircleCheckIcon.png'
import { getRandomId } from '@/utils/rand'
import { getContinuePath } from './Curriculum'
import SyntheticButton from '../form/SyntheticButton'
import { useCallback, useMemo } from 'react'
import RestartIcon from '../../../public/icons/RestartIcon.png'
import Section from './Section'


export const getDefaultSection = () => {
    return {
        'links': [],
        'desc': '',
        'nodes': '',
        'id': getRandomId(10),
        'title': 'New Section',
        'subsections': [],
        'quiz': undefined
    }
}

export const moveSection = (parentId, leafId, moveUp, nodes, setNodes, roots, setRoots) => {
    if (parentId){
        const parentNode = nodes[parentId]
        const parentSubsections = [...parentNode.subsections]
        for (let i = 0; i < parentSubsections.length; i++){
            if (parentSubsections[i] == leafId){
                let newI = moveUp ? i - 1 : i + 1
                // Now swap
                let tmp = parentSubsections[newI]
                parentSubsections[newI] = parentSubsections[i]
                parentSubsections[i] = tmp
                break
            }
        }
        setNodes({...nodes, [parentId]: {...parentNode, 'subsections': parentSubsections}})
    }
    else {
        // At root level
        const newRoots = [...roots]
        for (let i = 0; i < newRoots.length; i++){
            if (newRoots[i] == leafId){
                let newI = moveUp ? i - 1 : i + 1
                // Now swap
                let tmp = newRoots[newI]
                newRoots[newI] = newRoots[i]
                newRoots[i] = tmp
                break
            }
        }
        setRoots(newRoots)
    }    
}


export const getParentId = (leafId, nodes) => {
    for (let nodeId of Object.keys(nodes)){
        const node = nodes[nodeId]
        if (node.subsections){
            const nodeI = node.subsections.indexOf(leafId)
            if (nodeI != -1){
                return nodeId
            }
        }
    }
}


export const deleteSection = (leafObj, roots, setRoots, nodes, setNodes) => {
    const newRoots = [...roots]
    const newNodes = {...nodes}

    // Remove self and children from nodes.
    function recDelete(leafId) {
        const node = newNodes[leafId]
        if (node.subsections){
            for (let subId of node.subsections){
                recDelete(subId)
            }
        }
        delete newNodes[leafId]
    }
    recDelete(leafObj.id)

    // Remove node from parent
    const parentId = getParentId(leafObj.id, nodes)
    if (parentId){
        const node = newNodes[parentId]
        if (node.subsections){
            node.subsections = node.subsections.filter((item) => item != leafObj.id)
        }
    }
    else {
        const rootLoc = roots.indexOf(leafObj.id)
        if (rootLoc != -1){
            newRoots.splice(rootLoc, 1)
            setRoots(newRoots)
        }
    }
    setNodes(newNodes)
}


export const insert = (location, leafObj, nodes, setNodes, roots, setRoots) => {
    let newNode = getDefaultSection()
    const newNodes = {...nodes}
    newNodes[newNode.id] = newNode
    setNodes(newNodes)

    if (location == 'subsection'){
        let sisters = leafObj.subsections
        if (sisters){
            sisters = [newNode.id, ...sisters]
        }
        else {
            sisters = [newNode.id]
        }
        setNodes({...newNodes, [leafObj.id]: {...leafObj, 'subsections': sisters}})
        return
    }

    const parentId = getParentId(leafObj.id, nodes)
    const parentNode = nodes[parentId]
    if (parentId){
        let sisters = parentNode.subsections
        let currLoc = sisters.indexOf(leafObj.id)
        let newLoc = location == 'below' ? currLoc + 1 : currLoc
        sisters.splice(newLoc, 0, newNode.id)
        setNodes({...newNodes, [parentNode.id]: {...parentNode, 'subsections': sisters}})
    }
    else {
        // It's a root
        const newRoots = [...roots]
        const i = newRoots.indexOf(leafObj.id)
        let newI = location == 'below' ? i + 1 : i
        newRoots.splice(newI, 0, newNode.id)
        setRoots(newRoots)
    }
}


export default function Structured({ manifestRow, fullState, setFullState,
                                    editMode, canEdit, userValue, setUserValue,
                                    userActivity, setUserActivity, premierPosition, setPremierPosition,
                                    assetsInfo, setAssetsInfo, highlightNext=false,
                                    forceLoadingNodes={}, ...props }){
    

    // Shortening names and memoizing

    // This differs from premierPosition in that it's never unset.
    // On the other hand, premier position is more as a way to trigger openings / scroll
    const nodes = fullState.nodes
    const roots = fullState.roots
    const nextStepPath = useMemo(() => {
        if (userValue && nodes && roots){
            return getContinuePath(userValue, nodes, roots)
        }
        else {
            return undefined
        }
    }, [userValue])
    const activityByAsset = useMemo(() => {
        let obj = {}
        if (!userActivity){
            return null
        }
        for (let activity of userActivity){
            if (obj[activity.asset_id]){
                obj[activity.asset_id].push(activity)
            }
            else {
                obj[activity.asset_id] = [activity]
            }
        }
        return obj
    }, [userActivity])

    function makeTopSection(item, i){

        function makeSubsections(subs, parent, sectionTrail){
            if (!subs || subs.length == 0){
                return ""
            }

            return (
                <div className={styles.structuredSubsectionsContainer}>
                    {subs.map((sub, subI) => {
                        return makeSection(parent, sub, subI, sectionTrail)
                    })}
                </div>
            )
        }

        function makeSection(parent, nodeId, index, sectionTrail){
            return (
                <Section
                    fullState={fullState}
                    setFullState={setFullState}
                    userValue={userValue}
                    setUserValue={setUserValue}
                    manifestRow={manifestRow}
                    makeSubsections={makeSubsections}
                    highlightNext={highlightNext}
                    premierPosition={premierPosition}
                    setPremierPosition={setPremierPosition}
                    parent={parent}
                    nodeId={nodeId}
                    index={index}
                    sectionTrail={sectionTrail}
                    key={nodeId}
                    assetsInfo={assetsInfo}
                    nextStepPath={nextStepPath}
                    isEditStep={editMode}
                    activityByAsset={activityByAsset}
                    setUserActivity={setUserActivity}
                    forceLoading={forceLoadingNodes[nodeId]} />
            )
        }

        return (
            <div className={styles.structuredSectionContainer} key={i}>
                {makeSection(undefined, item, i)}
            </div>
        )
    }

    return (
        <div className={styles.structuredContainer} {...props}>
            {roots.map(makeTopSection)}
            {
                !nextStepPath && userValue.stage == 1 ? (
                    <SyntheticButton
                        value={(
                            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center', 'justifyContent': 'center'}}>
                                <div>
                                    Press to Complete
                                </div>
                                <MyImage src={CircleCheckIcon} width={20} height={20} alt={"Check"} />
                            </div>
                        )}
                        onClick={() => {setUserValue({...userValue, 'stage': 2}); alert("Congratulations from the development team! We hope you enjoyed your course.")}} />
                ) : ""
            }
        </div>
    )
}
