import { Auth } from "@/auth/auth"
import { useEffect, useState } from "react"
import Button from "../form/Button"
import styles from './ControlledTable.module.css'
import SearchBar from '@/components/form/SearchBar'
import Loading from "../Loading/Loading"
import Pagination from "../Pagination/Pagination"
import LoadMore from "../LoadMore/LoadMore"
import LoadingSkeleton from "../Loading/LoadingSkeleton"

// getUrl is a function taking one arg (page number) and returns url to make GET request to for row items
export default function ControlledTable({ items, setItems, loadingState, setLoadingState, makeRow, getUrl, searchBarStyle={}, searchBarContainerStyle={}, noResultsContainerStyle={}, paginationContainerStyle={}, loadingSkeleton=undefined, searchable=false, limit=10, resultsKey='results', flexDirection='column', flexWrap='wrap', totalKey='total', gap='20px', paginated=true, doublePaginated=false, loadMore=false, itemsCallback=()=>{}, forceRefresh=undefined, rightOfSearchBar="", tableHeader="", scroll=false, customDisplayWrapperStyle={}, customNoResults="", leftOfSearchBar="", ...props }){

    const [currPage, setCurrPage] = useState(1)
    const [numResults, setNumResults] = useState(0);
    const [loadMoreLoadState, setLoadMoreLoadState] = useState(0)

    const [searchText, setSearchText] = useState("")

    const { getToken, isSignedIn } = Auth.useAuth()

    async function makeRequest(page) {
        const url = getUrl(page, searchText)
        const response = await fetch(url, {
            headers: {
                'x-access-token': await getToken(),
                'Content-Type': 'application/json'
            },
            method: 'GET'
        })

        if (!response.ok){
            console.log(response)
            throw new Error('Response was not OK')
        }

        let myJson = await response.json();

        if(myJson['response'] != 'success'){
            console.log(myJson)
            throw new Error("Response was OK but not success")
        }

        return myJson
    }

    async function getItems(page){
        setLoadingState(1)
        const oldCurrPage = currPage
        try {
            setCurrPage(page)
            let myJson = await makeRequest(page)
            setItems(myJson[resultsKey])
            if (totalKey){
                setNumResults(myJson[totalKey])
            }
            setLoadingState(2)
        }
        catch (e) {
            setCurrPage(oldCurrPage)
            console.log(e)
            setLoadingState(3)
        }
    }

    async function doLoadMore(){
        setLoadMoreLoadState(1)
        try {
            let myJson = await makeRequest(currPage + 1)
            setItems([...items, ...myJson[resultsKey]])
            setCurrPage(currPage + 1)
            if (totalKey && myJson.totalKey){
                setNumResults(myJson[totalKey])
            }
            setLoadMoreLoadState(2)
        }
        catch (e) {
            console.log(e)
            setLoadMoreLoadState(3)
        }
    }

    useEffect(() => {
        if (getUrl && isSignedIn !== undefined){
            getItems(1);
        }
    }, [isSignedIn])

    useEffect(() => {
        itemsCallback(items)
    }, [items])

    async function getSearchResults(text){
        if (!text){
            text = ""
        }

        try {
            const token = await getToken();
            const url = getUrl(1, text)
            const response = await fetch(url, {headers: {"x-access-token": token}});
            const myJson = await response.json(); //extract JSON from the http response

            if (myJson['response'] !== 'success'){
                throw new Error("Server returned failed")
            }
            let res = myJson[resultsKey]
            let total = myJson[totalKey]
            return [res, total]
        }
        catch(e) {
            console.error(e)
        }
        return [[], 0]
    }

    let showTableHeader = true
    let display = ""
    if (!items || items.length == 0 || loadingState < 2){
        showTableHeader = false
        if (loadingState == 1 || loadingState == 0){
            if (loadingSkeleton){
                display = (
                    <LoadingSkeleton numResults={limit} type={loadingSkeleton} />
                )
            }
            else {
                display = (
                    <Loading />
                )
            }
        }
        else {
            if (customNoResults){
                display = customNoResults
            }
            else {
                display = (
                    <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem', ...noResultsContainerStyle}}>
                        <div>
                            No results.
                        </div>
                        <div>
                            <Button value="Refresh" onClick={() => getItems(1)} />
                        </div>
                    </div>
                )
            }
        }
    }
    else {
        display = (
            items.map(makeRow)
        )
    }

    return (
        <div style={{'display': 'flex', 'gap': '1rem', 'flexDirection': `column`, ...(scroll ? {'height': '100%'} : {})}} {...props}>
            {searchable ? (
                    <div style={searchBarContainerStyle}>
                        {leftOfSearchBar}
                        <SearchBar
                            textInputStyle={{...searchBarStyle}}
                            value={searchText}
                            setValue={setSearchText}
                            getSearchResults={async (x) => {let [items, _] = await getSearchResults(x); return items;}}
                            handleSearch={async (x) => {
                                setLoadingState(1)
                                let [items, total] = await getSearchResults(x);
                                if (total){
                                    setNumResults(total)
                                }
                                setItems(items)
                                setLoadingState(2)
                            }}
                            containerStretch={false}
                        />
                        {rightOfSearchBar}
                    </div>
            ) : ""}
            {paginated && doublePaginated && items && numResults > limit ? <Pagination getPage={getItems} currPage={currPage} numPages={Math.ceil(numResults / limit)} /> : ""}
            <div style={scroll ? {'flex': '1', 'display': 'flex', 'flexDirection': 'column', 'minHeight': '0px'} : {}}>
                {showTableHeader ? tableHeader : ""}
                <div style={{...(scroll ? {'height': '100%', 'minHeight': '0px'} : {}), ...customDisplayWrapperStyle}}>
                    <div className={scroll ? styles.customScroll : ''} style={{'display': 'flex', 'flexDirection': flexDirection, 'gap': gap, 'flexWrap': flexWrap, ...(scroll ? {'height': '100%', 'overflowY': 'scroll'} : {})}}>
                        {display}
                    </div>
                </div>
            </div>
            <div style={paginationContainerStyle}>
                {paginated && items && numResults > limit ? <Pagination getPage={getItems} currPage={currPage} numPages={Math.ceil(numResults / limit)} /> : ""}
                {loadMore && items && items.length >= limit * currPage ? (
                    loadMoreLoadState == 1 ? <Loading text="" /> : (
                        <div sytle={{'display': 'flex'}}>
                            <LoadMore onClick={doLoadMore} />
                        </div>
                    )
                ) : "" }
            </div>
        </div>
    )
}
