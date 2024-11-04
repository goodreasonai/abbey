import styles from './AssetsTable.module.css'
import Link from 'next/link'
import Button from '../form/Button'
import InputText from '../form/InputText'
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image'
import RemoveIcon from '../../../public/icons/RemoveIcon.png'
import Loading from '../Loading/Loading'
import SyntheticButton from '../form/SyntheticButton'
import { useRouter } from "next/router";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Result from './Result'
import RecentActivity from './RecentActivity';
import Dropdown from '../Dropdown/Dropdown';
import { TEMPLATES, getTemplateByCode } from '@/templates/template';
import FolderIcon from '../../../public/icons/FolderIcon.png'
import MyImage from '../MyImage/MyImage';
import SearchBar from '../form/SearchBar';
import Pagination from '../Pagination/Pagination';
import LoadingSkeleton from '../Loading/LoadingSkeleton';
import LoadMore from '../LoadMore/LoadMore';
import SmallSyntheticButton from '../form/SmallSyntheticButton';
import PinIcon from '../../../public/icons/PinIcon.png'
import CreateWrapper from '../Quick/CreateWrapper';
import { Auth } from '@/auth/auth';

// contentUrl is a backend url for the request
export default function AssetsTable({contentUrl,
                                    recentActivity=false,
                                    recentActivityArea=false,
                                    subManifest=undefined,
                                    showSearch=true,
                                    useSearchUrl=false,
                                    onlyTemplates="",

                                    /* It turns out this is really expensive! */
                                    /* Making this do anything will require change on backend */
                                    showNumResults=false,

                                    paginated=true,
                                    pageLen=15,
                                    showEdit=false,
                                    showPin=false,
                                    showDelete=false,
                                    selectable=false,
                                    selectAllEnabled=false,
                                    selections=[],
                                    selectionObjects=[],
                                    selfId=-1,
                                    showTemplatesButton=false,
                                    showTemplatesOptions=TEMPLATES.map((item) => item.constructor.code),
                                    selectableCallback=(() => {}),
                                    foldersFirst=false,  // Gets user's or groups top-level folders, no search or other ability.
                                    showNewFolderButton=false,
                                    groupId=undefined,
                                    includeGroups=false,
                                    alphabetical=false,
                                    showCreateText=true,
                                    loadMore=false,
                                    loadingSkeleton=false,
                                    maxTitleChar=50,
                                    showRemove=false }){

    
    const [assets, setAssets] = useState([])
    const [assetsLoadState, setAssetsLoadState] = useState(0)
    const [extendLoadState, setExtendLoadState] = useState(0)
    const [folders, setFolders] = useState([])
    const [foldersLoadState, setFoldersLoadState] = useState(0)
    const [pins, setPins] = useState([])
    const [pinsLoadState, setPinsLoadState] = useState(0)
    const [numPages, setNumPages] = useState(1)

    const [numResults, setNumResults] = useState(0)

    const { getToken, isSignedIn } = Auth.useAuth()
    const { user } = Auth.useUser()

    const router = useRouter();
    const [searchBarText, setSearchBarText] = useState("")

    const [currPage, setCurrPage] = useState(1)

    const searchCounter = useRef(0)  // it's a way to basically abort fetches without aborting fetches!

    function getUrl(searchText, limit=pageLen, offset=0, templates=onlyTemplates){
        let url = new URL(contentUrl);
        let params = new URLSearchParams(url.search);
        
        let paramObj = {
            'search': searchText,
            'limit': limit,
            'offset': offset,
            'recent_activity': recentActivity ? 1 : 0,
            'isolated': 1,
            'get_total': paginated ? 1 : 0 
        }
        if (subManifest){
            paramObj['sub_manifest'] = subManifest
        }
        if (templates){
            paramObj['only_templates'] = templates
        }
        else if (onlyTemplates){
            paramObj['only_templates'] = onlyTemplates
        }
        if (alphabetical){
            paramObj['alphabetical'] = 1
        }
        if (groupId){
            paramObj['group_id'] = groupId
            paramObj['isolated'] = 0
        }
        else if (includeGroups){
            paramObj['include_groups'] = 1
            paramObj['isolated'] = 0
        }

        for (let key in paramObj) {
            params.append(key, paramObj[key]);
        }

        url.search = params.toString();

        return url
    }

    async function getSearchResults(searchText, limit=pageLen, offset=0, templates=onlyTemplates){
        const token = await getToken();
        
        const url = getUrl(searchText, limit, offset, templates)

        const response = await fetch(url, {headers: {"x-access-token": token}});
        const myJson = await response.json(); //extract JSON from the http response

        if (myJson['response'] !== 'success'){
            throw new Error("Server returned failed")
        }

        const res = myJson['results'].filter(item => item.id !== selfId)

        return [res, myJson['total']]
    }


    async function search(searchText, limit=pageLen, offset=0, templates=onlyTemplates, extendAssets){
        searchCounter.current += 1
        let counter = searchCounter.current

        if (extendAssets){
            setExtendLoadState(1)
        }
        else {
            setAssetsLoadState(1);
        }
        
        try {
            let [res, total] = await getSearchResults(searchText, limit, offset, templates)
            if (counter != searchCounter.current){  // this is a way to avoid stale queries
                return
            }
            if (extendAssets){
                setAssets([...assets, ...res]);
                setExtendLoadState(2)
            }
            else {
                setAssets(res);
                setAssetsLoadState(2);
            }

            setNumPages(Math.ceil(total / pageLen));
            setCurrPage(Math.ceil(1 + offset / limit));

            setNumResults(total);
        }
        catch (error) {
            console.error(error);
            setAssetsLoadState(3);
        }
    }

    function handleSearch(sbt){
        if (useSearchUrl){
            router.replace({
                pathname: router.pathname,
                query: { ...router.query, search: sbt, page: '1' }
            });
        }
        else {
            search(sbt)
        }
        
    }

    // When useSearchUrl is true, all actions are controlled through the router query
    useEffect(() => {
        if (isSignedIn === undefined){
            return
        }

        // NOTE: what if useSearchUrl is false but subManifest changes? Might need something else...
        if (!useSearchUrl) {
            search(searchBarText, pageLen, 0)
            return
        }

        // The isReady seems to fix double load problems
        // Sometimes you still get a double load, but the query values are unchanged, so it's OK from end-user perspective
        // I think that's just an in-development problem, shouldn't carry over to production hopefully
        if (!router.isReady) return

        const onlyTheseTemplates = router.query.only_templates === undefined ? onlyTemplates : router.query.only_templates

        const onPage = router.query.page === undefined ? 1 : parseInt(router.query.page)
        // Don't need to setCurrPage because the search will do it automatically after load

        const searchText = router.query.search === undefined ? '' : router.query.search
            
        setSearchBarText(searchText);
        search(searchText, pageLen, (onPage-1)*pageLen, onlyTheseTemplates)
    }, [router.query && router.query.page, router.query && router.query.search, router.query && router.query.only_templates, subManifest, useSearchUrl, onlyTemplates, pageLen, isSignedIn]);


    async function getPage(pageNum, extend) {
        if (useSearchUrl && !extend){
            router.replace({
                pathname: router.pathname,
                query: { ...router.query, page: pageNum }
            });
        }
        else {
            const onlyTheseTemplates = router.query.only_templates === undefined ? onlyTemplates : router.query.only_templates
            search(searchBarText, pageLen, (pageNum - 1)*pageLen, onlyTheseTemplates, extend);
        }
    }

    async function getPins(){
        try {
            setPinsLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/user/pins'
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken()
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            setPins(myJson['results'])
            setPinsLoadState(2)
        }
        catch(e) {
            console.log(e)
            setPinsLoadState(3)
        }
    }

    useEffect(() => {
        if (showPin && isSignedIn !== undefined){
            getPins()
        }
    }, [showPin, isSignedIn])

    function makeRow(item, i) {

        const pinned = pins.map((x) => x.id).includes(item.id)
        function togglePinCallback(){
            if (pinned){
                setPins((prev) => prev.filter((x) => x.id != item.id))
            }
            else {
                setPins([...pins, item])
            }
        }

        return (
            <Result item={item}
                selections={selections}
                onSelect={selectableCallback}
                showEdit={showEdit}
                showPin={showPin}
                pinned={pinned}
                togglePinCallback={togglePinCallback}
                selectable={selectable}
                showDelete={showDelete}
                setAssets={setAssets}
                setFolders={setFolders}
                key={item.id}
                maxTitleChar={maxTitleChar}
                subManifest={subManifest}
                showRemove={showRemove}
                    />
        )
    }


    let folderItems = folders.length ? folders.map(makeRow) : ""
    if (foldersLoadState == 1 || foldersFirst && foldersLoadState == 0){
        folderItems = (<Loading />)
    }

    const deduplicatedAssets = useMemo(() => {
        if (router.query.search || router.query.only_templates){
            return assets
        }
        return assets.filter((item) => !folders.map(item => item.id).includes(item.id))
    }, [assets, folders])

    let skeletonNumResults = !assets.length ? pageLen : Math.max(2, assets.length)
    let listItems = assetsLoadState == 2 ? deduplicatedAssets.map(makeRow) : (
        <div style={{'marginTop': '10px'}}>
            {
                assetsLoadState == 3 ? (
                    <div>
                        Error loading assets. Refresh?
                    </div>
                ) : (
                    loadingSkeleton ? <LoadingSkeleton numResults={skeletonNumResults} /> : <Loading />
                )
            }
        </div>
    );
    
    if (assetsLoadState == 2 && assets.length == 0){
        if ((recentActivity || !subManifest) && showCreateText){
            listItems = (
                <Link href="/create">
                    <div className={styles.obnoxiousCreate}>
                        <div>
                            {`Nothing yet,`}&nbsp;<u>click here</u>&nbsp;{`to create something.`}
                        </div>
                    </div>
                </Link>
            )
        }
        else {
            listItems = (
                <div>
                    <br/>
                    No results.
                </div>
            )
        }
        
    }

    const FOLDERS_LIMIT = 10
    useEffect(() => {
        async function getFolders(){
            try {
                setFoldersLoadState(1)
                const token = await getToken();                
                let url = process.env.NEXT_PUBLIC_BACKEND_URL + `/folder/top-level-manifest?limit=${FOLDERS_LIMIT}`
                if (groupId){
                    url = process.env.NEXT_PUBLIC_BACKEND_URL + `/folder/top-level-manifest-group?limit=${FOLDERS_LIMIT}&group_id=${groupId}`
                }

                const response = await fetch(url, {headers: {"x-access-token": token}});
                const myJson = await response.json(); //extract JSON from the http response

                if (myJson['response'] !== 'success'){
                    throw new Error("Server returned failed")
                }
                let res = myJson['results']
                setFolders(res)
                setFoldersLoadState(2)
            }
            catch(e) {
                console.error(e)
                setFoldersLoadState(3)
            }
        }
        if (foldersFirst && isSignedIn !== undefined){
            getFolders()
        }
    }, [foldersFirst, isSignedIn])

    function showOnlyTheseTemplates(tmp){
        if (!tmp){
            let newQuery = { ...router.query, 'page': '1' }
            delete newQuery['only_templates']
            router.replace({
                pathname: router.pathname,
                query: newQuery,
            });
        }
        else {
            router.replace({
                pathname: router.pathname,
                query: { ...router.query, only_templates: JSON.stringify([tmp]), 'page': 1 },
            });
        }
        
    }

    function getTemplateFromRouter(){
        const tmps = router.query.only_templates
        if (tmps){
            const code = JSON.parse(tmps)[0]
            return getTemplateByCode(code).constructor.readableName;
        }
        else {
            return undefined
        }
    }

    // In the future, it might be best to make another request and get the allowed templates
    // For now, we just have options for all the free ones.
    let showOnlyElement = ""
    if (showTemplatesButton){
        const templateOptions = showTemplatesOptions.map((item) => getTemplateByCode(item)).filter(x => x.constructor.uploadable).map((item) => {
            return {
                'value': (
                    <div style={{'display': 'flex', 'alignItems': 'center', 'justifyContent': 'space-between'}}>
                        <div>{item.constructor.readableName}</div>
                        <MyImage src={item.constructor.icon} width={20} height={20} alt={item.constructor.readableName} />
                    </div>
                    
                ),
                'onClick': ()=>{showOnlyTheseTemplates(item.constructor.code)},
                'dummy': item.constructor.readableName
            }
        })
        templateOptions.sort((a, b) => a.dummy.localeCompare(b.dummy))
        const fullTemplateOptions = [
            {'value': 'All Templates', 'onClick': ()=>{showOnlyTheseTemplates('')}},
            ...templateOptions
        ]
        showOnlyElement = (
            <div className={styles.showOnly}>
                <div>
                    <Dropdown value={getTemplateFromRouter() ? getTemplateFromRouter() : "All Templates"} options={fullTemplateOptions}
                    optionsStyle={{'minWidth': '150px'}}
                    rightAlign={true}
                    initialButtonStyle={{'height': '100%'}}
                    style={{'height': '100%'}} />
                </div>
            </div>
        )
    }

    let searchFields = ("")
    if (showSearch){
        searchFields = (
            <SearchBar
                value={searchBarText}
                setValue={setSearchBarText}
                handleSearch={(x) => handleSearch(x)}
                getSearchResults={async (x) => {let y = await getSearchResults(x); return y[0]}} />
        )
    }

    let resultsTotal = ("")
    if (showNumResults){
        resultsTotal = (
            <div>
                Total results: {numResults}
            </div>
        )
    }

    let selectionElement = !selectable || !selectionObjects || !selectionObjects.length ? "" : (
        <div style={{'display': 'flex', 'flexWrap': 'wrap', 'gap': '5px'}}>
            {selectionObjects.map((item, i) => {
                return (
                    <div key={item.id} className={`${styles.selectionRect}`}>
                        <div>
                            {item.title}
                        </div>
                        <MyImage onClick={() => selectableCallback(item)} src={RemoveIcon} alt="Remove" width={15} height={15} style={{'filter': 'invert(var(--inverted))', 'cursor': 'pointer'}} />
                    </div>
                )
            })}
        </div>
    )

    function selectAll(){
        assets.map((item) => selectableCallback(item))
    }
    let selectAllElement = !selectable || !selectAllEnabled ? "" : (
        <div style={{'display': 'flex'}}>
            <Button value="Toggle Page" onClick={selectAll} />
        </div>
    )

    let newFolderButtonElement = ""
    if (showNewFolderButton){

        function newFolderCallback(newAsset){
            if (!newAsset){
                return
            }
            setAssets((prev) => {return [{...newAsset, has_edit_permission: true}, ...prev]})
            setFolders((prev) => {return [{...newAsset, has_edit_permission: true}, ...prev]})
        }

        newFolderButtonElement = (
            <div>
                <CreateWrapper noShow={true} templateCode={"folder"} callback={newFolderCallback} noRedirect={true}>
                    <div>
                        <SyntheticButton value={(
                            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                                <div>
                                    New Folder
                                </div>
                                <MyImage src={FolderIcon} width={20} height={20} alt={"New Folder"} canSwitch={true} />
                            </div>
                        )}
                        />
                    </div>
                </CreateWrapper>
            </div>
        )
    } 

    return (
        <DndProvider backend={HTML5Backend}>
            {
                (assetsLoadState == 1 || assetsLoadState == 0) && assets.length == 0 && !showSearch ? (
                        loadingSkeleton ? (
                            <div style={{'paddingTop': '10px'}}>
                                <LoadingSkeleton numResults={pageLen} />
                            </div>
                        ) : (
                            <div style={{'padding': '1rem'}}>
                                <Loading />
                            </div>
                        )
                    ) : (
                    <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '10px'}}>
                        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '10px'}}>
                            <div className={styles.topBar}>
                                <div style={searchFields ? {'flex': '1'} : {'display': 'none'}}>
                                    {searchFields}
                                </div>
                                {showOnlyElement}
                                {newFolderButtonElement}
                            </div>
                            {resultsTotal}
                        </div>
                        {selectionElement}
                        {selectAllElement}
                        {(recentActivityArea && !router.query.search && !router.query.only_templates && currPage == 1) ? (
                                <RecentActivity
                                    selections={selections}
                                    onSelect={selectableCallback}
                                    showEdit={showEdit}
                                    selectable={selectable}
                                    showDelete={showDelete}
                                    setAssets={setAssets}
                                    loadingSkeleton={loadingSkeleton}
                                /> ): ""}
                        {pins?.length && showPin && !router.query.search && !router.query.only_templates && currPage == 1 ? (
                            <div className={styles.folders}>
                                <div className={styles.foldersHeader}>
                                    <div>
                                        Pins
                                    </div>
                                    <MyImage src={PinIcon} width={20} height={20} alt={"Pins"} />
                                </div>
                                <div className={styles.folderItemsContainer}>
                                    {pins.map(makeRow)}
                                </div>
                            </div>
                        ) : ""}
                        {assets.length && foldersFirst && folderItems.length && !router.query.search && !router.query.only_templates && currPage == 1 ? (
                            <div className={styles.folders}>
                                <div className={styles.foldersHeader}>
                                    <div>
                                        Folders
                                    </div>
                                    <MyImage src={FolderIcon} width={20} height={20} alt={"Folders"} />
                                </div>
                                <div className={styles.folderItemsContainer}>
                                    {folderItems}
                                </div>
                                {folderItems.length >= FOLDERS_LIMIT ? (
                                    <div>
                                        <SmallSyntheticButton
                                            value={(
                                                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px', 'fontSize': '.9rem'}}>
                                                    <div>
                                                        See All Folders
                                                    </div>
                                                    <MyImage src={FolderIcon} alt={"Folder"} width={15} height={15} />
                                                </div>
                                            )} onClick={() => {showOnlyTheseTemplates('folder')}} />
                                    </div>
                                ) : ""}
                                
                            </div>
                        ) : ""}
                        <div className={styles.main}>
                            {listItems}
                        </div>
                        {paginated ? (
                            <Pagination getPage={getPage} currPage={currPage} numPages={numPages} />
                        ) : (
                            loadMore && assets.length >= pageLen * currPage && assetsLoadState == 2 ? (
                                extendLoadState == 1 ? (
                                    <Loading />
                                ) : (
                                    <div style={{'display': 'flex'}}>
                                        <LoadMore onClick={() => {extendLoadState != 1 && getPage(currPage + 1, true)}} />
                                    </div>
                                )
                            ) : ""
                        )}
                    </div>
                )
            }
                
        </DndProvider>
    )
}
