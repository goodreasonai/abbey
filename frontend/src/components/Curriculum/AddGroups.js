import Link from "next/link";
import Table from "../Table/Table";
import styles from './AddGroups.module.css';
import Checkbox from "../form/Checkbox";
import { useState, useEffect } from 'react'
import { Auth } from "@/auth/auth";
import Loading from "../Loading/Loading";
import Button from "../form/Button";
import ShareArrowIcon from '../../../public/icons/ShareArrowIcon.png'
import MyImage from "../MyImage/MyImage";
import FakeCheckbox from "../form/FakeCheckbox";
import CollapsibleMenu from "../CollapsibleMenu/CollapsibleMenu";
import RemoveIcon from '../../../public/icons/RemoveIcon.png'
import loadingStyles from '../Loading/LoadingImage.module.css'

export default function AddGroups({ manifestRow, selectedGroups, setSelectedGroups, selectedGroupTags, setSelectedGroupTags, nextCallback, headerText="Check off the collections you want to source from.", headerTextStyle={}, ...props }){

    const resultLimit = 10
    const [selectedGroupsInfo, setSelectedGroupsInfo] = useState({})
    const { getToken } = Auth.useAuth()

    async function getGroupInfo() {
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/groups/manifest-rows`
            const data = {'ids': Object.keys(selectedGroups).filter((item) => selectedGroups[item])}
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
                throw Error("response was not success")
            }
            const results = myJson['results']
            const newSelected = {}
            for (let x of results){
                newSelected[x.id] = x
            }
            setSelectedGroupsInfo(newSelected)
        }
        catch (e) {
            console.log(e)
        }
    }

    useEffect(() => {
        if (selectedGroups){
            getGroupInfo()
        }
    }, [manifestRow, selectedGroups])

    function getUrl(page, text){
        const offset = resultLimit * (page - 1)
        let urlMeta = process.env.NEXT_PUBLIC_BACKEND_URL + 
                `/groups/manifest?limit=${resultLimit}&offset=${offset}&get_total=1&search=${text}`
        return urlMeta
    }

    function tagSelector(item, tagLengths, tag, tagi) {
        let checkValue = false;
        let prevSelectedValue = selectedGroupTags[item.id] || {}
        if (prevSelectedValue){
            if (prevSelectedValue[tag] === undefined || prevSelectedValue[tag]){
                checkValue = true
            }
        }
        let lenStr = tagLengths[tagi] ? ` : ${tagLengths[tagi]}` : ''
        return (
            <div style={{'backgroundColor': 'var(--dark-primary)', 'borderRadius': 'var(--small-border-radius)', 'padding': '5px', 'display': 'flex', 'gap': '10px', 'alignItems': 'center'}} key={tagi}>
                <div style={{'color': 'var(--light-text)', 'fontSize': '.8rem'}}>
                    {`${tag}${lenStr}`}
                </div>
                <div>
                    <FakeCheckbox iconSize={15} value={checkValue} setValue={(x) => setSelectedGroupTags({...selectedGroupTags, [item.id]: {...prevSelectedValue, [tag]: !checkValue}})} />
                </div>
            </div>
        )
    }

    function makeRow(item, i){
        let tagList = []
        let tagLengths = []

        let tagArea = ""
        if (selectedGroups && selectedGroups[item.id] && selectedGroupsInfo && selectedGroupsInfo[item.id] && selectedGroupsInfo[item.id].tags){
            let selectedItem = selectedGroupsInfo[item.id]
            let tagsWithColon = selectedItem.tags.split(',')
            tagLengths = [...tagsWithColon.map(item => item.split(":")[1]), '']
            tagList = [...tagsWithColon.map(item => item.split(":")[0]), 'Others']
            tagArea = (
                <div style={{'display': 'flex', 'flexWrap': 'wrap', 'gap': '10px', 'alignItems': 'center'}}>
                    {tagList.map((tag, tagi) => {return tagSelector(item, tagLengths, tag, tagi)})}
                </div>
            )
        }

        return (
            <div className={styles.groupResultContainer} key={item.id}>
                <div>
                    <FakeCheckbox setValue={(x) => {setSelectedGroups({...selectedGroups, [item.id]: x}); setSelectedGroupTags({...selectedGroupTags, [item.id]: {}})}} value={selectedGroups[item.id] === undefined ? false : selectedGroups[item.id]} />
                </div>
                <CollapsibleMenu openByDefault={true} noHeader={true}>
                    <div className={styles.groupResult}>
                        <div style={{'display': 'flex', 'alignItems': 'flex-start', 'gap': '10px'}}>
                            {
                                item.image ? (
                                    <img src={item.image} style={{'height': '50px', 'width': '50px'}} className={loadingStyles.imgSkeleton} />
                                ) : ""
                            }
                            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '.5rem'}}>
                                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                    <div className={`${styles.groupTitle} _clamped2`}>
                                        {item.title}
                                    </div>
                                    <div style={{'display': 'flex', 'alignItems': 'center'}}>
                                        <Link href={`/groups/${item.id}`} key={i} style={{'display': 'flex', 'alignItems': 'center'}} target="_blank">
                                            <MyImage src={ShareArrowIcon} width={15} height={15} alt={"Go to collection"} />
                                        </Link>
                                    </div>
                                </div>
                                <div className={`${styles.groupDesc} _clamped3`}>
                                    {item.preview_desc}
                                </div>
                            </div>
                        </div>
                        {tagArea}
                    </div>
                </CollapsibleMenu>
            </div>                
        )
    }

    let actualSelectedGroups = Object.keys(selectedGroups).filter((item) => selectedGroups[item])

    let selectedGroupsDisplay = ""
    if (actualSelectedGroups && Object.keys(actualSelectedGroups).length){
        selectedGroupsDisplay = (
            <div style={{'display': 'flex', 'flexDirection': 'row', 'gap': '.5rem', 'flexWrap': 'wrap'}}>
                {
                    actualSelectedGroups.filter((x) => selectedGroupsInfo[x]).map((groupi, i) => {
                        let item = selectedGroupsInfo[groupi]
                        let tagList = []
                        let tagLengths = []
                        if (item.tags && item.tags.length){
                            let tagsWithColon = item.tags.split(',')
                            tagLengths = [...tagsWithColon.map(item => item.split(":")[1]), '']
                            tagList = [...tagsWithColon.map(item => item.split(":")[0]), 'Others']
                        }
                        return (
                            <div key={item.id}>
                                <CollapsibleMenu header={<span className="_clickable">{item.title}</span>} noMargining={true}>
                                    <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem', 'backgroundColor': 'var(--light-primary)', 'padding': '10px', 'border': '1px solid var(--light-border)', 'borderTopWidth': '0px', 'borderRadius': 'var(--medium-border-radius)'}}>
                                        <div style={{'display': 'flex', 'gap': '10px', 'flexWrap': 'wrap'}}>
                                            {
                                                tagList.length ? (
                                                    tagList.map((tag, tagi) => {return tagSelector(item, tagLengths, tag, tagi)})
                                                ) : item.preview_desc
                                            }
                                        </div>
                                        <div style={{'display': 'flex'}}>
                                            <div className={`${styles.removeContainer} _clickable`} onClick={() => {setSelectedGroups({...selectedGroups, [item.id]: false}); setSelectedGroupTags({...selectedGroupTags, [item.id]: {}})}}>
                                                Remove 
                                                <MyImage src={RemoveIcon} width={15} height={15} alt={"Remove"} />
                                            </div>
                                        </div>
                                    </div>
                                </CollapsibleMenu>
                            </div>
                        )
                    })
                }
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <div style={{'fontSize': '1rem', ...headerTextStyle}}>
                {headerText}
            </div>
            {selectedGroupsDisplay}
            <Table loadingSkeleton={'default'} flexDirection="column" makeRow={makeRow} getUrl={getUrl} loadMore={true} paginated={false} limit={resultLimit} searchable={true} />
            {
                nextCallback && actualSelectedGroups.length > 0 ? (
                    <div>
                        <Button value={"Go to Next Step"} onClick={nextCallback} />
                    </div>
                ) : ""
            }
        </div>
    )
}

