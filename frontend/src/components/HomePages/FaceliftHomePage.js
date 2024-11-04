import DefaultPage from '@/components/DefaultPage';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { HOME_PAGE_EXAMPLE_LINK, HOME_PAGE_HEADER, NAME  } from '@/config/config';
import { PREMIER_TEMPLATES, SECONDARY_TEMPLATES, getTemplateByCode } from '@/templates/template';
import MyImage from '../MyImage/MyImage';
import styles from './FaceliftHomePage.module.css'
import MarkdownViewer from '../Markdown/MarkdownViewer';
import CreateWrapper from '../Quick/CreateWrapper';
import Tooltip from '../Tooltip/Tooltip';
import CourseScreenshot from '../../../public/random/CourseScreenshot.webp'
import Egypt from '../../../public/random/Egypt.webp'
import BigLoading from '../Loading/BigLoading';
import Loading from '../Loading/Loading';
import { formatTimestampSmall } from '@/utils/time';
import GradientEffect from '../GradientEffect/GradientEffect';
import CurvedArrow from '../CurvedArrow/CurvedArrow';
import shortenText from '@/utils/text';
import FadeOnLoad from '../visuals/FadeOnLoad';
import { useIsMobile } from '@/utils/mobile';
import { Auth } from '@/auth/auth';

export default function FaceliftHomePage({}) {

    const { user } = Auth.useUser()
    const { getToken, isSignedIn } = Auth.useAuth()
    /*const user = {'firstName': 'Gordon', 'lastName': 'Kamer', 'emailAddress': 'g@us.ai'}
    const getToken = () => {return ""}*/

    const [recentsLoadingState, setRecentsLoadingState] = useState(0)
    const [recents, setRecents] = useState([])
    const [purchases, setPurchases] = useState([])
    const [chosenArt, setChosenArt] = useState({})
    const [attentionItems, setAttentionItems] = useState([])
    const [createLoading, setCreateLoading] = useState("")

    const { isMobile, isLarge } = useIsMobile()

    async function getRecents(){
        const LIMIT = 15
        try {
            setRecentsLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/manifest?recent_activity=1&limit=${LIMIT}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            setRecents(myJson['results'])
            setRecentsLoadingState(2)
        }
        catch(e) {
            setRecentsLoadingState(3)
        }
    }

    async function getNeedsAttention(){
        try {
            let url = process.env.NEXT_PUBLIC_BACKEND_URL + '/user/needs-attention'
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': await getToken()
                }
            });
            let myJson = await response.json()
            setAttentionItems(myJson['results'])
        }
        catch (e) {
            console.log(e)
        }
    }

    async function getPurchases(){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/groups/purchases"
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            setPurchases(myJson['results'])
        }
        catch(e) {
            console.log(e)
        }
    }

    async function getImage(){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/feed/art-history`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            setChosenArt(myJson['result'])
        }
        catch(e) {
            console.log(e)
        }
    }

    useEffect(() => {
        if (isSignedIn){
            getRecents()
            getNeedsAttention()
            getImage()
            getPurchases()
        }
    }, [isSignedIn])

    let secondaryTemplates = SECONDARY_TEMPLATES.slice(0, 2)
    let mainTemplates = PREMIER_TEMPLATES
    if (isLarge){
        secondaryTemplates = SECONDARY_TEMPLATES.slice(1, 4)
        mainTemplates = [...PREMIER_TEMPLATES, SECONDARY_TEMPLATES[0]]
    }
    else if (isMobile){
        mainTemplates = []
        secondaryTemplates = [...PREMIER_TEMPLATES, ...SECONDARY_TEMPLATES.slice(0, 2)]
    }

    const showNotifications = attentionItems?.length
    const showRecentActivity = recents?.length
    const showGettingStarted = recents?.length < 3 && recentsLoadingState > 1
    const showPurchases = purchases?.length

    return (
        <DefaultPage noMargin={true}>
            <div style={{'display': 'flex', 'width': '100%', 'justifyContent': 'center', 'overflow': 'hidden'}}>
                <FadeOnLoad className={styles.doubleContainer}>
                    <div style={{'height': '100%', 'flex': '1', 'display': 'flex', 'flexDirection': 'column', 'gap': '2rem', 'padding': 'var(--std-margin)'}}>
                        <div style={{'width': '100%', 'display': 'flex', 'justifyContent': 'center', 'fontSize': '1.75rem'}}>
                            {HOME_PAGE_HEADER(user?.firstName?.trim(), user?.lastName?.trim())}
                        </div>
                        <div style={{'width': '100%', 'position': 'relative'}}>
                            <div className={styles.createCommand} style={showGettingStarted ? {} : {'display': 'none'}}>
                                <div style={{'fontSize': '1.1rem'}}>
                                    Create
                                </div>
                                <div style={{'position': 'absolute', 'left': '-5px', 'top': '25px'}}>
                                    <CurvedArrow />
                                </div>
                            </div>
                            <div style={{'display': 'flex', 'gap': '10px'}}>
                                <div className='_hideOnMobile' style={{'display': 'flex', 'gap': '10px', 'width': '75%'}}>
                                    {mainTemplates.map((item) => {
                                        const tmp = getTemplateByCode(item)
                                        const noShow = tmp.constructor.noUploadOptions
                                        return (
                                            <CreateWrapper key={item} style={{'width': '50%'}} noShow={noShow} loadCallback={!noShow ? ()=>{} : () => setCreateLoading(item)} callback={() => setCreateLoading(false)} templateCode={item}>
                                                <Tooltip containerStyle={{'height': '100%', 'width': '100%'}} verticalAlign='bottom' content={`${tmp.constructor.actionPhrase} ${tmp.constructor.readableName}`}>
                                                    <div className={styles.bigCreateBlock}>
                                                        {createLoading == item ? (
                                                            <div style={{'width': '100%', 'height': '100%', 'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center'}}>
                                                                <BigLoading />
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div style={{'display': 'flex', 'alignItems': 'center', 'justifyContent': 'space-between'}}>
                                                                    <div>
                                                                        {tmp.constructor.readableName}
                                                                    </div>
                                                                    <div>
                                                                        <MyImage src={tmp.constructor.icon} width={20} height={20} alt={tmp.constructor.readableName} />
                                                                    </div>
                                                                </div>
                                                                <div style={{'color': 'var(--passive-text)', 'fontSize': '.9rem'}}>
                                                                    {tmp.constructor.description}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </Tooltip>
                                            </CreateWrapper>
                                        )
                                    })}
                                </div>
                                <div className={styles.secondaryTemplatesContainer}>
                                    {secondaryTemplates.map((item) => {
                                        const tmp = getTemplateByCode(item)
                                        const noShow = tmp.constructor.noUploadOptions
                                        return (
                                            <CreateWrapper templateCode={item} noShow={noShow} loadCallback={!noShow ? () => {} : ()=>{setCreateLoading(item)}} callback={() => setCreateLoading(false)} key={item}>
                                                <Tooltip containerStyle={{'width': '100%', 'height': '100%'}} content={`${tmp.constructor.actionPhrase} ${tmp.constructor.readableName}`}>
                                                    {createLoading == item ? (
                                                        <div className={styles.smallCreateRow} style={{'justifyContent': 'center'}}>
                                                            <Loading text="" />
                                                        </div>
                                                    ) : (
                                                        <div className={styles.smallCreateRow}>
                                                            <div>
                                                                {tmp.constructor.readableName}
                                                            </div>
                                                            <MyImage src={tmp.constructor.icon} width={20} height={20} alt={tmp.constructor.readableName} />
                                                        </div>
                                                    )}
                                                </Tooltip>
                                            </CreateWrapper>
                                        )
                                    })}
                                    <Link href={`/create`}>
                                        <div className={styles.smallCreateRow} style={{'justifyContent': 'center', 'color': 'var(--passive-text)'}}>
                                            More
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        </div>
                        {showPurchases ? (
                            <FadeOnLoad>
                                <div style={{'width': '100%', 'display': 'flex', 'gap': '10px', 'alignItems': 'stretch', 'flexWrap': 'wrap'}}>
                                    {purchases.map((item) => {
                                        return (
                                            <Link href={`/groups/${item.id}`} className={styles.purchaseItemLinkWrapper} key={item.id}>
                                                <div className={styles.purchaseItem}>
                                                    <div>
                                                        <MyImage canSwitch={false} src={item.image} height={50} width={50} alt={item.title} />
                                                    </div>
                                                    <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '.5rem'}}>
                                                        <div>
                                                            {item.title}
                                                        </div>
                                                        <div className='_clamped3' style={{'color': 'var(--passive-text)', 'fontSize': '.9rem'}}>
                                                            {item.preview_desc}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        )
                                    })}
                                </div>
                            </FadeOnLoad>
                        ) : ""}
                        {showNotifications ? (
                            <FadeOnLoad>
                                <div style={{'width': '100%', 'display': 'flex', 'flexDirection': 'column', 'gap': '.5rem', 'justifyContent': 'center'}}>
                                    <div style={{'color': 'var(--passive-text)', 'display': 'flex', 'justifyContent': 'center'}}>
                                        Notifications
                                    </div>
                                    <div style={{'width': '100%', 'display': 'flex', 'flexDirection': 'column', 'gap': '10px'}}>
                                        {attentionItems.map((item) => {
                                            let tmp = getTemplateByCode(item.template)
                                            return (
                                                <div className={styles.rowItem} key={JSON.stringify(item)}>
                                                    <tmp.AttentionComponent data={item} key={item.id} />
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </FadeOnLoad>
                        ) : ""}
                        {showRecentActivity ? (
                            <FadeOnLoad>
                                <div style={{'width': '100%', 'display': 'flex', 'flexDirection': 'column', 'gap': '.5rem', 'justifyContent': 'center'}}>
                                    <div style={{'color': 'var(--passive-text)', 'display': 'flex', 'justifyContent': 'center'}}>
                                        Recent Activity
                                    </div>
                                    <div style={{'width': '100%', 'display': 'flex', 'flexDirection': 'column', 'gap': '10px'}}>
                                        {recents.map((item) => {
                                            const tmp = getTemplateByCode(item.template)
                                            const icon = tmp.constructor.icon
                                            return (
                                                <Link href={`/assets/${item.id}`} key={item.id}>
                                                    <div className={`${styles.rowItem} _clickable`}>
                                                        <MyImage src={icon} width={20} height={20} title={tmp.constructor.readableName} alt={tmp.constructor.readableName} />
                                                        <div style={{'flex': '1'}}>
                                                            {shortenText(item.title, 6, 50, true)}
                                                        </div>
                                                        <div style={{'color': 'var(--passive-text)', 'fontFamily': 'var(--font-body)', 'fontSize': '.9rem'}}>
                                                            {formatTimestampSmall(item.timestamp)}
                                                        </div>
                                                    </div>
                                                </Link>
                                            )
                                        })}
                                    </div>
                                </div>
                            </FadeOnLoad>
                        ) : ""}
                        {showGettingStarted ? (
                            <FadeOnLoad>
                                <div style={{'width': '100%', 'display': 'flex', 'flexDirection': 'column', 'gap': '2rem', 'justifyContent': 'center'}}>
                                    <div style={{'color': 'var(--passive-text)', 'display': 'flex', 'justifyContent': 'center'}}>
                                        {`What can you do with ${NAME}?`}
                                    </div>
                                    <div style={{'width': '100%', 'display': 'flex', 'flexDirection': 'column', 'gap': '2rem'}}>
                                        <FadeOnLoad className={styles.canDoItemContainer}>
                                            <div className={styles.canDoTextContainer}>
                                                <div style={{'fontSize': '1.25rem'}}>
                                                    Building a Rocket
                                                </div>
                                                <div style={{'color': 'var(--passive-text)', 'fontSize': '.9rem'}}>
                                                    Make a course on anything - even learn the principles of aerospace engineering using content from Collections.
                                                </div>
                                                <div style={{'display': 'flex', 'gap': '15px', 'flexWrap': 'wrap'}}>
                                                    <Link href={`/create?template=curriculum`}>
                                                        <div className={`${styles.suggestedActionText} _touchableOpacity`}>
                                                            Make Course
                                                        </div>
                                                    </Link>
                                                    <Link href={`/groups`}>
                                                        <div className={`${styles.suggestedActionText} _touchableOpacity`}>
                                                            See Collections
                                                        </div>
                                                    </Link>
                                                </div>
                                            </div>
                                            <div className={styles.canDoImageContainer}>
                                                <MyImage style={{'objectFit': 'contain'}} canSwitch={false} alt={"Course"} src={CourseScreenshot} fill={true} />
                                                <Link href={HOME_PAGE_EXAMPLE_LINK}>
                                                    <div style={{'position': 'absolute', 'right': '50%', 'bottom': '10px', 'transform': 'translateX(50%)', 'overflow': 'hidden', 'borderRadius': 'var(--medium-border-radius)', 'border': '1px solid var(--light-border)'}}>
                                                        <div style={{'color': 'var(--light-text', 'position': 'relative', 'padding': '5px 10px', 'zIndex': '1', 'fontSize': '.8rem'}}>
                                                            See Example
                                                        </div>
                                                        <GradientEffect style={{'width': '200%', 'height': '200%', 'zIndex': '0'}} />
                                                    </div>
                                                </Link>
                                            </div>
                                        </FadeOnLoad>
                                        <FadeOnLoad className={styles.canDoItemContainer}>
                                            <div className={styles.canDoImageContainer}>
                                                <MyImage style={{'objectFit': 'cover'}} canSwitch={false} alt={"The Pyramids"} src={Egypt} fill={true} />
                                            </div>
                                            <div className={styles.canDoTextContainer}>
                                                <div style={{'fontSize': '1.25rem'}}>
                                                    Finding a Mummy
                                                </div>
                                                <div style={{'color': 'var(--passive-text)', 'fontSize': '.9rem'}}>
                                                    {`Got history reading? ${NAME} can help give you summaries, answer questions, or turn it into a podcast for you to listen to.`}
                                                </div>
                                                <div style={{'color': 'var(--passive-text)', 'fontSize': '.9rem'}}>
                                                    {`Whether the text is in English or ancient hieroglyphics, ${NAME} can help you understand it.`}
                                                </div>
                                                <div style={{'display': 'flex', 'gap': '10px', 'flexWrap': 'wrap'}}>
                                                    <Link href={`/create?template=document`}>
                                                        <div className={`${styles.suggestedActionText} _touchableOpacity`}>
                                                            Upload Document
                                                        </div>
                                                    </Link>
                                                </div>
                                            </div>
                                        </FadeOnLoad>
                                    </div>
                                </div>
                            </FadeOnLoad>
                        ) : ""}
                    </div>
                    <FadeOnLoad className={`${styles.artContainer} _hideOnMobile`}>
                        <div style={{'backgroundColor': 'var(--light-primary)', 'height': '80%', 'padding': '20px', 'width': '100%', 'border': '1px solid var(--light-border)', 'borderRadius': 'var(--medium-border-radius)', 'display': 'flex', 'flexDirection': 'column', 'gap': '10px'}}>
                            <div style={{'position': 'relative', 'overflow': 'hidden', 'flex': '1', 'width': '100%', 'backgroundColor': 'var(--light-primary)'}}>
                                {
                                    chosenArt?.image ? (
                                        <MyImage priority={true} style={{'objectFit': 'contain'}} canSwitch={false} fill={true} src={chosenArt.image} alt={"Art history"} />
                                    ) : (
                                        <div style={{'width': '100%', 'height': '100%'}}>
                                        </div>
                                    )
                                }
                            </div>
                            <div>
                                {chosenArt?.markdown ? (
                                    <MarkdownViewer className={styles.markdownCorrection}>
                                        {`${chosenArt.markdown}`}
                                    </MarkdownViewer>
                                ) : ""}
                            </div>
                        </div>
                    </FadeOnLoad>
                </FadeOnLoad>
            </div>
        </DefaultPage>
    )
}
