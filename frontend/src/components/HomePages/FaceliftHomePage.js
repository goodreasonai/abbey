import DefaultPage from '@/components/DefaultPage';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { HOME_PAGE_HEADER, NAME  } from '@/config/config';
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
import WorkspaceIcon from '../../../public/icons/NotebookIcon.png'
import ChatIcon from '../../../public/icons/ChatIcon.png'
import QuizIcon from '../../../public/icons/QuizIcon.png'
import InfinityIcon from '../../../public/icons/InfinityIcon.png'
import DocumentIcon from '../../../public/icons/DocumentIcon.png'
import VideoIcon from '../../../public/icons/VideoIcon.png'


export default function FaceliftHomePage({}) {

    const { user } = Auth.useUser()
    const { getToken, isSignedIn } = Auth.useAuth()

    const [recentsLoadingState, setRecentsLoadingState] = useState(0)
    const [recents, setRecents] = useState([])
    const [purchases, setPurchases] = useState([])
    const [chosenArt, setChosenArt] = useState({})
    const [attentionItems, setAttentionItems] = useState([])
    const [createLoading, setCreateLoading] = useState("")

    // For hardcoded "What can you do with" tutorial
    const [notebookIsLoading, setNotebookIsLoading] = useState(false)
    const [chatIsLoading, setChatIsLoading] = useState(false)

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
                                    <div style={{'width': '100%', 'display': 'flex', 'flexDirection': 'column', 'gap': '2.5rem'}}>
                                        <div className={styles.tutorialContainer}>
                                            <div style={{'fontSize': '1.25rem'}}>
                                                📓 Take reading notes for a project.
                                            </div>
                                            <div style={{'color': 'var(--passive-text)'}}>
                                                {`Suppose you're doing research: collecting PDFs, websites, relevant videos, and other sources. ${NAME} can help you keep them together, automatically summarize them, answer questions, write notes with you, collaborate with others, and more.`}
                                            </div>
                                            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                                                <div>
                                                    <CreateWrapper loadCallback={() => setNotebookIsLoading(true)} callback={() => setNotebookIsLoading(false)} noShow={true} templateCode={'notebook'}>
                                                        <div className={styles.tutorialButton}>
                                                            {`Start Using a Workspace`}
                                                            {notebookIsLoading ? (
                                                                <Loading text="" />
                                                            ) : (
                                                                <MyImage style={{}} width={20} height={20} src={WorkspaceIcon} alt={"Workspace icon"} />
                                                            )}
                                                        </div>
                                                    </CreateWrapper>
                                                </div>
                                                <div>
                                                    <CreateWrapper templateCode={'document'}>
                                                        <div className={styles.tutorialButton}>
                                                            {`Upload a Document`}
                                                            <MyImage style={{}} width={20} height={20} src={DocumentIcon} alt={"Workspace icon"} />
                                                        </div>
                                                    </CreateWrapper>
                                                </div>
                                            </div>

                                        </div>
                                        <div className={styles.tutorialContainer}>
                                            <div style={{'fontSize': '1.25rem'}}>
                                                🌐 Forget pop-ups: let AI search the web for you.
                                            </div>
                                            <div style={{'color': 'var(--passive-text)'}}>
                                                {`What's the latest injury news in fantasy? Are there any riots in Paris today I can join? In a chat on ${NAME}, just tick "Use Web," and ${NAME} will write a search query and scan the results for an answer.`}
                                            </div>
                                            <div style={{'display': 'flex'}}>
                                                <div>
                                                    <CreateWrapper loadCallback={() => setChatIsLoading(true)} callback={() => setChatIsLoading(false)} noShow={true} templateCode={'detached_chat'}>
                                                        <div className={styles.tutorialButton}>
                                                            {`Start chatting`}
                                                            {chatIsLoading ? (
                                                                <Loading text="" />
                                                            ) : (
                                                                <MyImage style={{}} width={20} height={20} src={ChatIcon} alt={"Chat icon"} />
                                                            )}
                                                        </div>
                                                    </CreateWrapper>
                                                </div>
                                            </div>

                                        </div>
                                        <div className={styles.tutorialContainer}>
                                            <div style={{'fontSize': '1.25rem'}}>
                                                📚 Study for a test with practice questions.
                                            </div>
                                            <div style={{'color': 'var(--passive-text)'}}>
                                                {`You read something: do you remember what you've just read? Click the 'Make Quiz' button at the top of any document to quiz yourself. Or, you can bundle readings together and get an infinite stream of questions in Infinite Quiz.`}
                                            </div>
                                            <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                                <div>
                                                    <CreateWrapper templateCode={'quiz'}>
                                                        <div className={styles.tutorialButton}>
                                                            {`Make a Quiz`}
                                                            <MyImage style={{}} width={20} height={20} src={QuizIcon} alt={"Quiz icon"} />
                                                        </div>
                                                    </CreateWrapper>
                                                </div>
                                                <div>
                                                    <CreateWrapper templateCode={'inf_quiz'}>
                                                        <div className={styles.tutorialButton}>
                                                            {`Infinite Quiz`}
                                                            <MyImage style={{}} width={20} height={20} src={InfinityIcon} alt={"Infinite quiz icon"} />
                                                        </div>
                                                    </CreateWrapper>
                                                </div>
                                            </div>

                                        </div>
                                        <div className={styles.tutorialContainer}>
                                            <div style={{'fontSize': '1.25rem'}}>
                                                📹 Summarize and chat with a YouTube Video.
                                            </div>
                                            <div style={{'color': 'var(--passive-text)'}}>
                                                {`You've been "recommended" a 2hr lecture on Indo-Aryan migrations: copy the link into ${NAME} and get a summary with key points.`}
                                            </div>
                                            <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                                                <div>
                                                    <CreateWrapper templateCode={'video'}>
                                                        <div className={styles.tutorialButton}>
                                                            {`Chat With a YouTube Video`}
                                                            <MyImage style={{}} width={20} height={20} src={VideoIcon} alt={"Video icon"} />
                                                        </div>
                                                    </CreateWrapper>
                                                </div>
                                            </div>
                                        </div>
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
