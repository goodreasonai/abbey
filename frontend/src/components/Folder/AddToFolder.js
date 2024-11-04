import CollapsibleMenu from "../CollapsibleMenu/CollapsibleMenu"
import Table from "../Table/Table"
import MyImage from "../MyImage/MyImage"
import CircleCheckIcon from '../../../public/icons/CircleCheckIcon.png'
import MoveIcon from '../../../public/icons/MoveIcon.png'
import styles from './AddToFolder.module.css'
import { useState } from "react"
import AddIcon from '../../../public/icons/AddIcon.png'
import LinkedSelectorItem from "../LinkedSelectorItem/LinkedSelectorItem"
import { Auth } from "@/auth/auth"
import Loading from "../Loading/Loading"


export default function AddToFolder({ assetManifestRow, forceRefresh, setForceRefresh }) {

    const [loading, setLoading] = useState({})
    const [added, setAdded] = useState({})
    const { getToken } = Auth.useAuth()

    async function doMoveTo(toItem){
        try {
            setLoading({...loading, [toItem.id]: true})
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/add-resource"
            const data = {
                'id': assetManifestRow['id'],
                'resource_id': toItem.id
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
    
            if(myJson['response'] != 'success'){
                throw Error(`Response was not success: ${myJson['reason']}`)
            }
            setLoading({...loading, [toItem.id]: false})
            setAdded({...added, [toItem.id]: true})
            if (setForceRefresh){
                setForceRefresh(!forceRefresh)
            }
        }
        catch(e){
            console.log(e)
        }
    }

    const resultLimit = 15;
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
            'isolated': 1,
            'offset': offset,
            'get_total': 1
        }
        for (let key in paramObj) {
            params.append(key, paramObj[key]);
        }
        url.search = params.toString()
        return url
    }

    function makeRow(item, i) {

        let iconImage = ""
        if (loading[item.id]){
            iconImage = (
                <div style={{'display': 'flex', 'flexDirection': 'column'}}>
                    <Loading text="" color="var(--light-text)" />
                    <div style={{'flex': '1'}}></div>
                </div>
            )
        }
        else if (added[item.id]){
            iconImage = (
                <MyImage src={CircleCheckIcon} width={20} height={20} alt="Added" />
            )
        }
        else {
            iconImage = (
                <div className="_clickable">
                    <MyImage width={20} height={20} src={AddIcon} alt={"Add"} onClick={() => doMoveTo(item)} />
                </div>
            )
        }

        return (
            <div style={{'display': 'flex', 'maxWidth': '300px'}} key={i}>
                <LinkedSelectorItem
                    key={i}
                    item={item}
                    showButton={true}
                    iconImage={iconImage} />
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <Table
                searchBarStyle={{'backgroundColor': 'var(--light-background)'}}
                getUrl={getUrl}
                makeRow={makeRow}
                searchable={true}
                limit={resultLimit}
                paginated={true}
                loadingSkeleton={'green-pills'}
                gap='10px'
                flexDirection="row"
            />
        </div>
    )
}