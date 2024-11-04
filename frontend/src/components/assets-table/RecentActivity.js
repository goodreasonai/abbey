import { useState, useEffect } from "react";
import Loading from "../Loading/Loading";
import styles from './RecentActivity.module.css'
import { getTemplateByCode } from "@/templates/template";
import Image from "next/image";
import Link from "next/link";
import Taskbar from "./Taskbar";
import RecentIcon from '../../../public/icons/RecentIcon.png'
import MyImage from "../MyImage/MyImage";
import LoadingSkeleton from "../Loading/LoadingSkeleton";
import shortenText from "@/utils/text";
import { Auth } from "@/auth/auth";

export default function RecentActivity({loadingSkeleton}){

    const [ras, setRas] = useState([])
    const [assetsLoadState, setAssetsLoadState] = useState(0)

    const { getToken, isSignedIn } = Auth.useAuth()

    async function search(searchText, limit=3, offset=0){
        setAssetsLoadState(1);
        let url = new URL(process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/manifest`);
        let params = new URLSearchParams(url.search);
        
        let paramObj = {
            'search': searchText,
            'limit': limit,
            'offset': offset,
            'folders_first': 0,
            'recent_activity': 1,
        }
        for (let key in paramObj) {
            params.append(key, paramObj[key]);
        }

        url.search = params.toString();
        try {
            const response = await fetch(url, {headers: {"x-access-token": await getToken()}});
            const myJson = await response.json(); //extract JSON from the http response

            if (myJson['response'] !== 'success'){
                throw new Error("Server returned failed")
            }

            const res = myJson['results']

            setRas(res)
            setAssetsLoadState(2);

        }
        catch (error) {
            console.error(error);
            setAssetsLoadState(3);
        }
    }

    useEffect(() => {
        // This is actually OK even if component remounts with existing state.
        if (assetsLoadState != 2 && isSignedIn !== undefined){
            search("")
        }
    }, [isSignedIn])

    function makeResult(item, i) {

        let author = shortenText(item.author, 75, 30, true);
        let title = shortenText(item.title, 75, 60, true);

        let type = getTemplateByCode(item.template).constructor.readableName;
        let typeImage = getTemplateByCode(item.template).constructor.icon

        let desc = item.preview_desc;
        let id = item.id;

        let titleContent = (
            <span className={`${styles.resultTitle}`}>
                {title}
            </span>
        )

        function shortenString(str, maxLength) {
            if (str.length <= maxLength) {
                return str;
            }
            
            let trimmedStr = str.substr(0, maxLength);
            trimmedStr = trimmedStr.substr(0, Math.min(trimmedStr.length, trimmedStr.lastIndexOf(" ")));
        
            return trimmedStr + "...";
        }
    
        let shortenedDesc = shortenString(desc, 100)

        let resultContent = (
            <Link href={"/assets/" + `${id}`} className={styles.resultLink}>
                <div className={styles.result}>
                    <div className={`${styles.resultHeader}`}>
                        <div className={styles.resultType}>
                            <MyImage src={typeImage} width={20} height={20} alt={type} style={{'opacity': '50%'}} />
                            <div>
                                {type}
                            </div>
                        </div>
                    </div>
                    <div className={styles.resultMiddle}>
                        <div style={{'display': 'flex', 'flexDirection': 'column'}}>
                            <div style={{'flex': 1}}>
                                {titleContent}
                            </div>
                            <div className={`${styles.resultAuthor} _clamped1`}>
                                {author}
                            </div>
                        </div>
                    </div>
                    <div className={`${styles.resultDesc} _clamped2`}>
                        {shortenedDesc}
                    </div>
                    
                </div>
            </Link>        
        )
        
        return (
            <div className={styles.resultWrapper} key={i}>
                {resultContent}
            </div>
        )
    }

    let inside = "Error loading recent activity"
    if (assetsLoadState == 0 || assetsLoadState == 1){
        inside = (loadingSkeleton ? <LoadingSkeleton type={'horizontal'} numResults={3} /> : <Loading />)
    }
    else if (assetsLoadState == 2){
        inside = ras.map(makeResult)
    }

    return assetsLoadState == 2 && ras.length == 0 ? (
            <></>
        ) : (
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem', 'paddingTop': 'calc(1rem - 10px)'}}>
                <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                    <div>
                        Recently Viewed
                    </div>
                    <div style={{'display': 'flex', 'alignItems': 'center'}}>
                        <MyImage src={RecentIcon} alt={"Recently Viewed"} width={20} height={20} />
                    </div>
                </div>
                <div className={styles.raContainer}>
                    {inside}
                </div>
            </div>
        )
}
