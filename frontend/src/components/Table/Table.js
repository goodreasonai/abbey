import { useState } from "react"
import ControlledTable from "../ControlledTable/ControlledTable"

// getUrl is a function taking one arg (page number) and returns url to make GET request to for row items
export default function Table({makeRow, getUrl, searchBarStyle={}, searchBarContainerStyle={}, noResultsContainerStyle={}, paginationContainerStyle={}, loadingSkeleton=undefined, searchable=false, limit=10, resultsKey='results', flexDirection='column', flexWrap='wrap', totalKey='total', gap='20px', paginated=true, doublePaginated=false, loadMore=false, itemsCallback=()=>{}, forceRefresh=undefined, ...props}){
    const [items, setItems] = useState([])
    const [loadingState, setLoadingState] = useState(0)
    return (
        <ControlledTable
            items = {items}
            setItems= {setItems}
            loadingState={loadingState}
            setLoadingState={setLoadingState}
            makeRow={makeRow}
            getUrl={getUrl}
            searchBarStyle={searchBarStyle}
            searchBarContainerStyle={searchBarContainerStyle}
            noResultsContainerStyle={noResultsContainerStyle}
            paginationContainerStyle={paginationContainerStyle}
            loadingSkeleton={loadingSkeleton}
            searchable={searchable}
            limit={limit}
            resultsKey={resultsKey}
            flexDirection={flexDirection}
            flexWrap={flexWrap}
            totalKey={totalKey}
            gap={gap}
            paginated={paginated}
            doublePaginated={doublePaginated}
            loadMore={loadMore}
            itemsCallback={itemsCallback}
            forceRefresh={forceRefresh}
            {...props}
        />
    )
}
