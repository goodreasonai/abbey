import { useEffect, useMemo, useState } from "react";
import BackToCollection from "./BackToCollection";
import { TableHeader, TableRow } from "./Crawler";
import ControlledTable from "../ControlledTable/ControlledTable";
import useKeyboardShortcut from "@/utils/keyboard";
import styles from './Crawler.module.css'
import FakeCheckbox from "../form/FakeCheckbox";
import SyntheticButton from "../form/SyntheticButton";
import { Auth } from "@/auth/auth";
import Loading from "../Loading/Loading";


export default function SearchEngine({ assetId, slideToLeft, addCallback }) {

    const { getToken } = Auth.useAuth()
    const [websites, setWebsites] = useState([])
    const [websitesLoadState, setWebsitesLoadState] = useState(0)
    const resultLimit = 20
    const [addBulkLoading, setAddBulkLoading] = useState(0)
    const [bulkAddedNumber, setBulkAddedNumber] = useState(0)
    const [selected, setSelected] = useState({})  // URL -> item or undefined

    function getUrl(page, text){
        if (!text){
            text = ""
        }
        let url = new URL(process.env.NEXT_PUBLIC_BACKEND_URL + "/crawler/web")
        let params = new URLSearchParams(url.search);
        const offset = resultLimit * (page - 1)
        let paramObj = {
            'query': text,
            'limit': resultLimit,
            'offset': offset,
            'id': assetId
        }
        for (let key in paramObj) {
            params.append(key, paramObj[key]);
        }
        url.search = params.toString()
        return url
    }

    const nSelected = useMemo(() => {
        return Object.keys(selected).filter((x) => selected[x]).length
    }) 

    async function addBulk(){
        try {
            setAddBulkLoading(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/crawler/add-bulk`
            const urlsToAdd = Object.keys(selected).filter((x) => selected[x])
            const data = {
                'id': assetId,
                'items': urlsToAdd.map((x) => selected[x])
            }
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'body': JSON.stringify(data),
                'method': 'POST'
            })
            if (!response.ok){
                throw Error("Response was not OK")
            }
            const myJson = await response.json()
            const results = myJson['results']
            setSelected({})
            setBulkAddedNumber(nSelected)
            setAddBulkLoading(2)
            setWebsites(websites.map((x) => urlsToAdd.includes(x.url) ? {...x, 'added': true} : x))
            addCallback(results)
        }
        catch(e) {
            console.log(e)
            setAddBulkLoading(3)
        }
    }

    const tableCols = useMemo(() => {
        return [
            {'title': '', 'key': 'selected', 'flex': 1, 'hook': ({ item }) => {
                if (item['added']){
                    return ""
                }
                const isSelected = selected[item['url']]
                return (
                    <FakeCheckbox value={isSelected} setValue={(x) => {setBulkAddedNumber(0); setSelected({...selected, [item['url']]: x ? item : undefined})}} />
                )
            }, 'headerHook': ({}) => {
                const allAdded = websites.filter((x) => x.added).length == websites.length
                const allSelected = websites.filter((x) => selected[x.url] || x.added).length == websites.length
                return (
                    <FakeCheckbox value={allSelected && !allAdded} setValue={(x) => {
                        const newSelected = {...selected}
                        for (const site of websites){
                            if (!site.added){
                                newSelected[site.url] = x ? site : undefined
                            }
                        }
                        setBulkAddedNumber(0)
                        setSelected(newSelected)
                    }} />
                )
            }},
            {'title': 'Name', 'key': 'name', 'flex': 10},
            {'title': 'URL', 'key': 'url', 'flex': 10, 'hook': ({ item }) => {
                return (
                    <a href={item['url']} target="_blank" className={styles.urlLink}>{item['url']}</a>
                )
            }},
            {'title': 'Snippet', 'key': 'snippet', 'flex': 10}
        ]
    }, [selected, websites])

    useKeyboardShortcut([['ArrowLeft']], slideToLeft, false)

    function makeRow(item, i) {
        return <TableRow key={i} setItem={() => {}} item={item} i={i} isFirst={ i == 0} isLast={i == websites?.length - 1} tableCols={tableCols} />
    }

    const rightOfSearchBar = useMemo(() => {
        if (nSelected == 0 && bulkAddedNumber){
            return (
                <div style={{'display': 'flex', 'alignItems': 'stretch', 'flex': '1', 'gap': '10px'}}>
                    <SyntheticButton
                        value={(
                            <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                <div>
                                    {`Added ${bulkAddedNumber}`}
                                </div>
                            </div>
                        )}
                        noHighlight={true}
                        style={{'display': 'flex'}}
                    />
                </div>
            )
        }
        else if (!nSelected){
            return ""
        }

        return addBulkLoading == 1 ? (
            <div style={{'display': 'flex', 'alignItems': 'stretch', 'flex': '1', 'gap': '10px'}}>
                <SyntheticButton
                    value={(
                        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                            <div>
                                Add to Collection
                            </div>
                            <Loading text="" color={"var(--light-text)"} />
                        </div>
                    )}
                    noHighlight={true}
                    style={{'display': 'flex'}}
                />
            </div>
        ) : (
            <div style={{'display': 'flex', 'alignItems': 'stretch', 'flex': '1', 'gap': '10px'}}>
                <SyntheticButton
                    value={(
                        <div style={{'display': 'flex', 'alignItems': 'center'}}>
                            Add to Collection ({`${nSelected}`})
                        </div>
                    )}
                    style={{'display': 'flex'}}
                    onClick={() => addBulk()}
                />
            </div>
        )
    }, [selected, addBulkLoading, nSelected, bulkAddedNumber])

    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'height': '100%', 'gap': '1rem'}}>
            <div style={{'display': 'flex'}}>
                <BackToCollection slideToLeft={slideToLeft} />
            </div>
            <div style={{'height': '100%', 'minHeight': '0px'}}>
                <ControlledTable
                    items={websites}
                    setItems={setWebsites}
                    loadingState={websitesLoadState}
                    setLoadingState={setWebsitesLoadState}
                    makeRow={makeRow}
                    limit={resultLimit}
                    getUrl={getUrl}
                    loadingSkeleton={'default-small'}
                    searchable={true}
                    tableHeader={(<TableHeader cols={tableCols} />)}
                    gap={'0px'}
                    flexWrap="noWrap"
                    scroll={true}
                    customNoResults={(
                        <div style={{'height': '100%', 'width': '100%', 'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center', 'fontSize': '1.15rem'}}>
                            Nothing yet.
                        </div>
                    )}
                    autoFocus={true}
                    searchBarStyle={{'width': '300px'}}
                    searchBarContainerStyle={{'display': 'flex', 'gap': '10px'}}
                    rightOfSearchBar={rightOfSearchBar}
                    searchAutoComplete={false}
                    customDisplayWrapperStyle={{'borderRadius': 'var(--medium-border-radius)', 'overflow': 'hidden', 'border': '1px solid var(--light-border)', 'backgroundColor': 'var(--light-primary)'}}
                />
            </div>
        </div>
    )
}
