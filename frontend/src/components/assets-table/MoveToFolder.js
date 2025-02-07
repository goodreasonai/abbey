import LinkedSelectorItem from '../LinkedSelectorItem/LinkedSelectorItem';
import Table from '../Table/Table';
import SearchBar from '../form/SearchBar';
import styles from './MoveToFolder.module.css'
import { useRef, useEffect, useState } from 'react';
import MoveIcon from '../../../public/icons/MoveIcon.png'
import MyImage from '../MyImage/MyImage';
import CircleCheckIcon from '../../../public/icons/CircleCheckIcon.png'
import MinimizeIcon from '../../../public/icons/MinimizeIcon.png'
import Loading from '../Loading/Loading';
import { Auth } from '@/auth/auth';


export default function MoveToFolder({ topText="", assetId, resultLimit=5, flexDirection='column', outsideClickCallback=()=>{} }) {

    const myInputRef = useRef();
    const [flashingMessages, setFlashingMessages] = useState({})
    const [flashLoading, setFlashLoading] = useState({})
    const { getToken } = Auth.useAuth()

    // Callback when something is clicked outside
    useEffect(() => {

        const handleClickOutside = (event) => {
            if (myInputRef.current && !myInputRef.current.contains(event.target)) {
                outsideClickCallback()
            }
        };

        if (outsideClickCallback){
            // Attach the listeners on component mount.
            document.addEventListener('mouseup', handleClickOutside);
            // Detach the listeners on component unmount.
            return () => {
                document.removeEventListener('mouseup', handleClickOutside);
            };
        }

    }, []); // Empty array ensures that effect is only run on mount and unmount

    // Prevent propagation of click event beyond div
    useEffect(() => {
        function handleClick(event) {
            event.preventDefault();
        }

        const overlayDiv = myInputRef.current;
        overlayDiv.addEventListener('click', handleClick);

        // Cleanup function
        return () => {
            overlayDiv.removeEventListener('click', handleClick);
        };
    }, []); // Empty array ensures that effect is only run on mount and unmount

    async function doMoveTo(toItem){
        try {
            setFlashLoading({...flashLoading, [toItem.id]: true})
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/add-resource"
            const data = {
                'id': toItem.id,
                'resource_id': assetId
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
            setFlashLoading({...flashLoading, [toItem.id]: false})
            setFlashingMessages({...flashingMessages, [toItem.id]: true})
            setTimeout(() => {
                setFlashingMessages({...flashingMessages, [toItem.id]: false})
            }, 2000)
        }
        catch(e){
            console.log(e)
        }
    }

    function getUrl(page, text){
        if (!text){
            text = ""
        }
        let url = new URL(process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/manifest")
        let params = new URLSearchParams(url.search);
        const offset = resultLimit * (page - 1)
        let paramObj = {
            'search': text,
            'only_templates': JSON.stringify(['folder']),
            'limit': resultLimit,
            'folders_first': 0,
            'recent_activity': 0,
            'isolated': text ? 0 : 1,
            'offset': offset,
            'edit': 1,
            'get_total': 1,
            'exclude_ids': JSON.stringify([assetId])
        }
        for (let key in paramObj) {
            params.append(key, paramObj[key]);
        }
        url.search = params.toString()
        return url
    }

    function makeRow(item, i) {
        return (
            <div className={styles.itemContainer} onClick={() => doMoveTo(item)} key={i}>
                <div style={{'flex': '1'}}>
                    {item.title}
                </div>
                {
                    flashLoading[item.id] ? (
                        <Loading color='var(--light-text)' text="" />
                    ) : ""
                }
                {
                    flashingMessages[item.id] ? (
                        <MyImage src={CircleCheckIcon} width={20} height={20} alt={"Good"} />
                    ) : ""
                }
                <div style={{'display': 'flex', 'alignItems': 'center'}}>
                    <MyImage src={MoveIcon} width={20} height={20} alt={"Move"} />
                </div>
            </div>
        )
    }

    return (
        <div className={styles.container} ref={myInputRef}>
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                {topText}
                <Table
                    searchBarStyle={{'backgroundColor': 'var(--light-background)'}}
                    getUrl={getUrl}
                    makeRow={makeRow}
                    searchable={true}
                    paginated={true}
                    limit={resultLimit}
                    flexDirection={flexDirection}
                    gap='10px'
                />
            </div>
        </div>
    )
}
