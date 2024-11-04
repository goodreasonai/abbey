import { useState, useEffect } from 'react'
import styles from './Curriculum.module.css'
import Table from '../Table/Table'
import MyImage from '../MyImage/MyImage'
import AddIcon from '../../../public/icons/AddIcon.png'
import RemoveIcon from '../../../public/icons/RemoveIcon.png'
import Link from 'next/link'
import LinkedSelectorItem from '../LinkedSelectorItem/LinkedSelectorItem'
import CollapsibleMenu from '../CollapsibleMenu/CollapsibleMenu'
import Quick from '../Quick/Quick'
import GearIcon from '../../../public/icons/GearIcon.png'
import Loading from '../Loading/Loading'
import { Auth } from "@/auth/auth";
import CreateWrapper from '../Quick/CreateWrapper'


export default function AddSources({ value, setValue, manifestRow, leaf, collections=[], selectedGroupTags={}, otherLinks=[] }) {

    // Collapsible handles this, but unfortunately the url for Table is getting pinged before it's open.
    const [open, setOpen] = useState(false)
    const [autoLoadState, setAutoLoadState] = useState(0)

    const { getToken } = Auth.useAuth()

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
            'include_group_ids': JSON.stringify(collections),
            'filter_tags_on_groups': JSON.stringify(selectedGroupTags)
        }
        for (let key in paramObj) {
            params.append(key, paramObj[key]);
        }
        url.search = params.toString()
        return url
    }

    function makeRow(item, i) {
        const existingLinkIds = value.map((item) => item.id)
        const included = existingLinkIds.includes(item.id)

        function doAdd(){
            if (!included){
                setValue([...value, item])
            }
            else {
                setValue(value.filter((x) => x.id != item.id))
            }
        }

        const iconImage = (
            <MyImage src={included ? RemoveIcon : AddIcon} width={16} height={16} alt={"Add"} onClick={doAdd} className={"_clickable"}  />
        )

        return (
            <LinkedSelectorItem item={item} iconImage={iconImage} showButton={true} key={i} />
        )
    }

    // Some duplicated code, should merge in the future.
    async function autofill() {
        if (autoLoadState == 1){
            return
        }
        const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/curriculum/link"
        try {
            setAutoLoadState(1)
            const data = {
                'id': manifestRow['id'],
                'collections': collections,
                'filter_tags_on_groups': selectedGroupTags,
                // To add: prompt
                'title': leaf.title,
                'exclude_ids': otherLinks
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

            setValue(myJson['results'])
            setAutoLoadState(2)
        }
        catch(e) {
            console.log(e)
            setAutoLoadState(3)
        }
    }


    function uploadFile(resp) {
        if (resp){
            setValue([...value, resp])
        }
    }

    return (
        <div style={{'display': 'flex', 'gap': '10px', 'flexWrap': 'wrap'}}>
            <CollapsibleMenu header={"Add Sources"} altHeader={true} altHeaderClassName={styles.collapsibleContainerAltHeader} setOpenCallback={setOpen}>
                <div style={{'minHeight': '200px'}}>
                    {open ? (
                        <Table
                            searchable={true}
                            makeRow={makeRow}
                            getUrl={getUrl}
                            limit={resultLimit}
                            flexDirection='row'
                            loadingSkeleton={'green-pills'}
                            flexWrap='wrap' />
                    ) : ""}
                </div>
            </CollapsibleMenu>
            {
                !open ? (
                    <div className={styles.collapsibleContainerAltHeader} onClick={autofill}>
                        <div>
                            Auto-Fill Sources
                        </div>
                        <div>
                            {
                                autoLoadState == 1 ? (
                                    <Loading size={15} text="" />
                                ) : (
                                    <MyImage src={GearIcon} width={15} height={15} alt={"Gears"} />
                                )
                            }
                        </div>
                    </div>
                ) : ""
            }
            
            {
                !open ? (
                    <CreateWrapper templateCode={"document"} noStretch={true} callback={uploadFile} noRedirect={true} >
                        <div className={styles.collapsibleContainerAltHeader}>
                            Upload Doc
                        </div>
                    </CreateWrapper>
                ) : ""
            }
        </div>
    )
}
