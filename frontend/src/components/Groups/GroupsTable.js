import Link from "next/link";
import Table from "../Table/Table";
import styles from './Groups.module.css';
import MyImage from "../MyImage/MyImage";
import loadingStyle from '../Loading/LoadingImage.module.css'
import Image from "next/image";


export default function GroupsTable({}){

    // export default function Table({makeRow, getUrl, limit=10, resultsKey='results', flexDirection='column', totalKey='total', paginated=true, itemsCallback=()=>{}, forceRefresh=undefined, ...props}){

    const resultLimit = 12

    function getUrl(page, search){
        const offset = resultLimit * (page - 1)
        const prependProductsLimit = page > 1 ? 0 : 3
        let urlMeta = process.env.NEXT_PUBLIC_BACKEND_URL + 
                `/groups/manifest?limit=${resultLimit}&offset=${offset}&search=${search}&prepend_products_limit=${prependProductsLimit}`
        return urlMeta
    }

    function makeRow(item, i){
        return (
            <Link href={`/groups/${item.id}`} key={i} className={styles.groupLinkContainer}>
                <div style={{'display': 'flex', 'flexDirection': 'column', 'height': '100%'}}>
                    {
                        item.product_id && item.needs_purchase ? (
                            <div className={styles.productHeader}>
                                For Sale
                            </div>
                        ) : (item.product_id ? (
                            <div className={styles.productHeader}>
                                Purchased
                            </div>
                        ) : "")
                    }
                    <div className={styles.groupResult}>
                        {
                            item.image ? (
                                <div className={styles.groupImage}>
                                    <Image alt={item.title} sizes="(max-width: 800px) 50px, 75px" src={`${item.image}`} style={{'objectFit': 'cover', 'borderRadius': 'var(--small-border-radius)', 'border': '1px solid var(--light-border)'}} fill={true} />
                                </div>
                            ) : ""
                        }
                        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                            <div className={`${styles.groupTitle} _clamped2`}>
                                {item.title}
                            </div>
                            <div className={`${styles.groupDesc} _clamped3`}>
                                {item.preview_desc}
                            </div>
                        </div>
                    </div>
                </div>
            </Link>
        )
    }

    return (
        <Table makeRow={makeRow} getUrl={getUrl} gap='15px' flexDirection="row" paginated={false} loadMore={true} limit={resultLimit} searchable={true} loadingSkeleton={'grid'} />
    )
}
