import { formatTimestampSmall } from '@/utils/time';
import Link from 'next/link';
import { useState } from 'react';
import styles from './ChatSearch.module.css';
import MenuIcon from '../../../public/icons/MenuIcon.png';
import MyImage from '../MyImage/MyImage';
import Table from '../Table/Table';


export default function ChatSearch({id, itemsPerPage=10, ...props}) {

    const [openedOtherChats, setOpenedOtherChats] = useState(false)

    function makeOtherChat(item, i){
        return (
            <Link href={`/assets/${item.id}`} key={i}>
                <div className={styles.otherChat}>
                    <div style={{'flex': '1'}}>
                        {item.title}
                    </div>
                    <div>
                        {formatTimestampSmall(item.time_uploaded)}
                    </div>
                </div>
            </Link>
        )
    }

    function openOtherChats() {
        setOpenedOtherChats(!openedOtherChats)
    }

    const resultLimit = 10;

    function getUrl(page, search){
        const onlyTemplates = JSON.stringify(['detached_chat'])
        const offset = resultLimit * (page - 1)
        const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/manifest?limit=${resultLimit}&offset=${offset}&search=${search}&only_templates=${onlyTemplates}&isolated=1&exclude_ids=${JSON.stringify([id])}`
        return url
    }

    return (
        <div className={styles.container} {...props}>
            <div className={styles.header}>
                <div style={{'flex': '1'}}>
                    Other Chats
                </div>
                <div className={styles.menuIcon}>
                    <MyImage style={{'cursor': 'pointer'}} onClick={openOtherChats} src={MenuIcon} width={20} height={20} alt="Open other chats" />
                </div>
            </div>
            <div className={styles.mainBodyContainer} style={openedOtherChats ? {'display': 'block'} : {}}>
                <Table
                    key={id}
                    searchBarStyle={{'backgroundColor': 'var(--light-background)'}}
                    searchBarContainerStyle={{'margin': '10px', 'marginBottom': '0px', 'marginTop': '0px'}}
                    paginationContainerStyle={{'margin': '1rem', 'marginTop': '0px'}}
                    noResultsContainerStyle={{'margin': '1rem', 'marginTop': '0px'}}
                    makeRow={makeOtherChat}
                    getUrl={getUrl}
                    loadMore={true}
                    searchable={true}
                    loadingSkeleton={'default'}
                    gap={"0px"}  />
            </div>
        </div>
    )
}
