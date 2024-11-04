import { useEffect, useState } from "react";
import AssetsTable from "../assets-table/AssetsTable";


export default function SourceSelect({ initialSelections, setSelections, setSelectionRows, allowedTemplates=[], selfId=-1, ...props }){

    let realSelections = initialSelections
    if (!initialSelections){
        realSelections = []
    }

    const [selectionIds, setSelectionIds] = useState(realSelections.map(item => item.id));
    const [selectionObjects, setSelectionObjects] = useState(realSelections);

    useEffect(() => {
        if (initialSelections){
            setSelectionIds(initialSelections.map(item => item.id))
            setSelectionObjects(initialSelections)
        }
    }, [initialSelections])

    useEffect(() => {
        if (setSelections){
            setSelections(selectionIds)
        }
    }, [selectionIds])

    useEffect(() => {
        if (setSelectionRows){
            setSelectionRows(selectionObjects)
        }
    }, [selectionObjects])

    function onSelect(item){
        let id = item.id;

        function getNewSelections(prevSelections) {
            let newSelections = [...prevSelections]
            if (newSelections.includes(id)){
                const index = newSelections.indexOf(id);
                if (index > -1) { // only splice array when item is found
                    newSelections.splice(index, 1); // 2nd parameter means remove one item only
                }
            }
            else {
                newSelections.push(id)
            }
            return newSelections;
        }

        setSelectionIds((prevSelections) => {return getNewSelections(prevSelections)})

        setSelectionObjects((prevSelectionObjects) => {
            let newSelectionObjects = [...prevSelectionObjects]
            if (prevSelectionObjects.map((item) => item.id).includes(id)){
                const index = prevSelectionObjects.map((item) => item.id).indexOf(id);
                if (index > -1) { // only splice array when item is found
                    newSelectionObjects.splice(index, 1);
                }
            }
            else {
                newSelectionObjects.push(item)
            }
            return newSelectionObjects;
        })
    }

    return (
        <AssetsTable
            contentUrl={process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/manifest`}
            onlyTemplates={allowedTemplates && allowedTemplates.length ? JSON.stringify(allowedTemplates) : ""}
            selectable={true}
            selections={selectionIds}
            selectionObjects={selectionObjects}
            selectableCallback={onSelect}
            pageLen={10}
            selfId={selfId}
            loadingSkeleton={true}
            {...props} />
    );
}
