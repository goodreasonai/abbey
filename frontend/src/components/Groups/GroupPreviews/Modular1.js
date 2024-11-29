import PurchaseButton from "./PurchaseButton"
import { useEffect, useState } from "react";
import styles from './Modular1.module.css'
import Image from "next/image";
import MyImage from "../..//MyImage/MyImage";
import CircleCheckIcon from '../../../../public/icons/CircleCheckIcon.png'
import { getVideoIdFromUrl } from "../../Video/VideoEmbed";
import ScrollingCardsWithTemplates from "@/components/visuals/ScrollingCardsWithTemplates";
import PopOnScroll from "@/components/visuals/PopOnScroll";
import { Auth } from "@/auth/auth";

export default function Modular1({ groupManifest }) {

    const [modules, setModules] = useState([])
    const { getToken } = Auth.useAuth()

    async function getModules(){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/groups/preview-file?id=${groupManifest.id}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken()
                }
            })
            const myJson = await response.json()
            if (!response.ok){
                throw Error("Response was not ok")
            }
            setModules(myJson['modules'])
        }
        catch(e) {
            console.log(e)
        }
    }

    useEffect(() => {
        getModules()
    }, [groupManifest])

    function makeVideo(item) {
        const videoId = getVideoIdFromUrl(item.ytSrc)
        return (
            <div>
                <iframe
                    className={styles.video}
                    frameBorder="0"
                    src={`https://www.youtube.com/embed/${videoId}`}
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Embedded YouTube Video"
                />
            </div>
        )
    }


    function makeTwoPanelChecks(item, isDark) {
        return (
            <div className={item.checksOnLeft ? styles.twoPanelContainerLeft : styles.twoPanelContainerRight}>
                <PopOnScroll>
                    <div className={styles.twoPanelChecks}>
                        {item.checks.map((check, k) => {
                            return (
                                <div key={k} style={{'display': 'flex', 'gap': '10px', 'fontSize': '1.25rem'}}>
                                    <MyImage src={CircleCheckIcon} width={25} height={25} forceDark={isDark} alt={"Check"} />
                                    <div>
                                        {check}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </PopOnScroll>
                <div className={`${styles.twoPanelImageContainer} ${item.imgNeedsBackground ? styles.imageContainerNeedsBackground : ""}`}>
                    <Image style={{'objectFit': 'contain'}} fill={true} src={item.imgSrc} alt={"Main Image"} />
                </div>
            </div>
        )
    }

    function makeCheckGrid(item, isDark) {
        /*
        type: two-col-checks
        imgSrc: link
        checks: [] .. list of the check items
        */
        return (
            <div className={styles.checkGridContainer}>
                <div style={{'width': '80%', 'height': '100%', 'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center'}}>
                    <PopOnScroll>
                        <div style={{'display': 'flex', 'gap': '2em', 'flexWrap': 'wrap'}}>
                            {item.checks.map((check, k) => {
                                return (
                                    <div key={k} style={{'display': 'flex', 'gap': '10px', 'width': 'calc(50% - 1rem)', 'fontSize': '1.25rem'}}>
                                        <MyImage src={CircleCheckIcon} width={25} height={25} alt="Check" forceDark={isDark} />
                                        <div>
                                            {check}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </PopOnScroll>
                </div>
                <div className={`${styles.gridImageContainer} ${item.imgNeedsBackground ? styles.imageContainerNeedsBackground : ""}`}>
                    <Image src={item.imgSrc} style={{'objectFit': 'contain'}} fill={true} alt={"Main Image"} />
                </div>
            </div>
        )
    }
    
    function makeImageList(item){
        return (
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': 'var(--std-margin)', 'width': '100%'}}>
                <div style={{'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center', 'fontSize': '1.5rem'}}>
                    {item.text}
                </div>
                <div className={styles.imageListContainer}>
                    {item.imgs?.map((imgSrc, k) => {
                        return (
                            <div className={styles.imageListImageContainer} key={k}>
                                <Image src={imgSrc} style={{'objectFit': 'contain'}} fill={true} alt={"Main Image"} />
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    function makeTemplateCards(item, isDark){
        // templates is optional
        let props = {}
        if (item.templates){
            props['templates'] = item.templates
        }
        return (
            <ScrollingCardsWithTemplates paragraph={item.paragraph} title={item.title} isDark={isDark} {...props} />
        )
    }

    function makeModule(item, i){

        const isDark = i % 2 == 0
        const moduleContainerClass = !isDark ? styles.moduleContainerOdd : styles.moduleContainerEven

        let noPadding = false
        let content = "Module type not recognized"
        if (item.type == 'two-panel-checks'){
            content = makeTwoPanelChecks(item)
        }
        else if (item.type == "video"){
            content = makeVideo(item)
        }
        else if (item.type == "two-col-checks"){
            content = makeCheckGrid(item, isDark)
        }
        else if (item.type == "image-list"){
            content = makeImageList(item, isDark)
        }
        else if (item.type == 'template-cards'){
            content = makeTemplateCards(item, isDark)
            noPadding = true
        }

        return (
            <div className={moduleContainerClass} style={noPadding ? {'padding': '0px'} : {}} key={i}>
                {content}
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <div className={styles.headerContainer}>
                <div className={styles.groupTitleContainer}>
                    <div className={styles.groupTitle}>
                        {groupManifest.title}
                    </div>
                    <div className={styles.groupImage}>
                        <Image alt={groupManifest.title} sizes="(max-width: 800px) 50px, 75px" src={`${groupManifest.image}`} style={{'objectFit': 'cover', 'borderRadius': 'var(--small-border-radius)', 'border': '1px solid var(--light-border)'}} fill={true} />
                    </div>
                </div>
                <div className={styles.groupDesc}>
                    {groupManifest.preview_desc}
                </div>
                <PurchaseButton groupManifest={groupManifest} />
            </div>
            {modules.map(makeModule)}
            <div className={styles.headerContainer}>
                <PurchaseButton groupManifest={groupManifest} />
            </div>
        </div>
    )
}
