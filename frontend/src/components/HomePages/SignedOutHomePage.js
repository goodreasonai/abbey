import styles from './SignedOutHomePage.module.css'
import Head from "next/head"
import DefaultPage from "../DefaultPage"
import MyImage from "../MyImage/MyImage"
import { SITE_TITLE, HOME_PAGE_URL, NAME, ANIMATED_LOGO } from "@/config/config"
import Link from 'next/link'
import { Auth } from "@/auth/auth";
import WorkspaceIcon from '../../../public/icons/NotebookIcon.png'
import PopOnScroll from '../visuals/PopOnScroll';
import WordFlipper from './WordFlipper';
import ScrollWithFixedScene from '../visuals/ScrollWithFixedScene';
import InfQuizBasic from '../../../public/random/InfQuizQuestions/InfQuizBasic.png'
import InfQuizExplain from '../../../public/random/InfQuizQuestions/InfQuizExplain.png'
import InfQuizBasicDark from '../../../public/random/InfQuizQuestions/InfQuizBasicDark.png'
import InfQuizExplainDark from '../../../public/random/InfQuizQuestions/InfQuizExplainDark.png'
import InfQuizBasicMobile from '../../../public/random/InfQuizQuestions/InfQuizBasicMobile.png'
import InfQuizExplainMobile from '../../../public/random/InfQuizQuestions/InfQuizExplainMobile.png'
import InfQuizBasicDarkMobile from '../../../public/random/InfQuizQuestions/InfQuizBasicDarkMobile.png'
import InfQuizExplainDarkMobile from '../../../public/random/InfQuizQuestions/InfQuizExplainDarkMobile.png'
import SubmersionOfPharaoh from '../../../public/random/SubmersionOfPharaoh.jpeg'
import WorkspaceSS from '../../../public/random/WorkspaceSS.png'
import WorkspaceSSDark from '../../../public/random/WorkspaceSSDark.png'
import CourseSSDark from '../../../public/random/CourseSSDark.png'
import CourseSS from '../../../public/random/CourseSS.png'
import CircleCheck from '../../../public/icons/CircleCheckIcon.png'
import RhodesExpanded from '../../../public/random/RhodesExpanded.webp'
import Jerome from '../../../public/random/jerome.jpg'
import SyntheticButton from '../form/SyntheticButton';
import GearIcon from '../../../public/icons/GearIcon.png'
import CurriculumIcon from '../../../public/icons/CurriculumIcon.png'
import QuizIcon from '../../../public/icons/QuizIcon.png'
import MagnifyingGlassIcon from '../../../public/icons/MagnifyingGlassIcon.png'
import { TEMPLATES } from '@/templates/template'
import { useState, useEffect, useRef } from 'react'
import { getTemplateByCode } from '@/templates/template'
import GradientEffect from '../GradientEffect/GradientEffect'
import Tooltip from '../Tooltip/Tooltip'


export default function SignedOutHomePage({}) {
    const [promotedAssetGroups, setPromotedAssetGroups] = useState([])
    const { getToken } = Auth.useAuth()

    const [selectedTemplate, setSelectedTemplate] = useState(getTemplateByCode('document'))

    const flipperWords = ['anything.', 'a test.', 'a project.', 'a class.', 'a new role.', 'a meeting.']

    async function getPromoted() {
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/groups/promoted"
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            setPromotedAssetGroups(myJson['results'])
        }
        catch(e) {
            console.log(e)
        }
    }

    useEffect(() => {
        getPromoted()
    }, [])

    const promotedSection = promotedAssetGroups?.length ? (
        <div style={{'display': 'flex', 'flexWrap': 'wrap', 'alignItems': 'center', 'gap': '10px'}}>
            <div className={styles.shadowedText}>
                {promotedAssetGroups.length > 1 ? `Special Collections:` : `Special Collection:`}
            </div>
            {promotedAssetGroups.map((item) => {
                return (
                    <Link href={`/groups/${item.id}`} key={item.id}>
                        <div className={styles.promoButtonContainer}>
                            <div>
                                {item.title}
                            </div>
                            <MyImage src={item.image} canSwitch={false} width={30} height={30} alt={item.title} />
                        </div>
                    </Link>
                )
            })}
        </div>
    ) : ""

    return (
        <>
            <Head>
                <script type="application/ld+json">
                    {`{
                    "@context" : "https://schema.org",
                    "@type" : "WebSite",
                    "name" : "${SITE_TITLE}",
                    "url" : "${HOME_PAGE_URL}/"
                    }`}
                </script>
            </Head>
            <DefaultPage noBackground={true} mustSignIn={false} noMargin={true} footerStyle={{'margin': '0px'}} title={SITE_TITLE}>
                <div className={styles.signedOutContainer}>
                    <div className={styles.topPartContainerWithImage}>
                        <MyImage canSwitch={false} src={Jerome} className={styles.topPartImg} alt={"Staint Jerome at his study."} />
                        <div className={styles.topPartContainer}>
                            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1.5rem', 'alignItems': 'center'}}>
                                <div className={styles.docHeader}>
                                    <div className={styles.bookUpContainer}>
                                        <div>
                                            Book-up for
                                        </div>
                                        <div>
                                            <WordFlipper words={flipperWords} />
                                        </div>
                                    </div>
                                </div>
                                <div className={`${styles.topPartTagline}`}>
                                    {`Welcome to ${NAME}`}
                                    <div style={{'display': 'flex', 'alignItems': 'center', 'backgroundColor': 'inherit', 'position': 'relative', 'top': '-5px'}}>
                                        <object style={{'colorScheme': 'light'}} type="image/svg+xml" data={ANIMATED_LOGO} height="45" width="45" aria-label="Abbey Books Logo" />
                                    </div>
                                </div>
                                <div className={styles.docSignInLink}>
                                    <div>
                                        <Link href={`${Auth.getSignInURL('/')}`}><SyntheticButton value={(<span className={styles.buttonText}>Login</span>)} /></Link>
                                    </div>
                                    <div>
                                        <Link href={`${Auth.getSignUpURL('/')}`}><SyntheticButton value={(<span className={styles.buttonText}>Sign Up</span>)} /></Link>
                                    </div>
                                </div>
                            </div>
                            {promotedSection}
                            <div className={styles.infoButtonsContainer}>
                                <div className={styles.infoButtons}>
                                    <div className={`${styles.infoButton}`}>Get Summaries From Your Docs <MyImage src={GearIcon} width={20} height={20} alt={"Gears"} /> </div>
                                    <div className={`${styles.infoButton}`}>Generate Entire Courses <MyImage src={CurriculumIcon} width={20} height={20} alt={"Curriculum"} /> </div>
                                    <div className={`${styles.infoButton}`}>AI-Generate Quizzes <MyImage src={QuizIcon} width={20} height={20} alt={"Quiz"} /> </div>
                                    <div className={`${styles.infoButton} ${styles.eraseFirst}`}>Explore Articles and Textbooks From Our Content Library <MyImage src={MagnifyingGlassIcon} width={20} height={20} alt={"Magnifying Class"} /> </div>
                                </div>
                            </div>
                            <div className={`${styles.enterpriseContact} ${styles.shadowedText}`}>
                                Looking for enterprise sales? Contact <u>team@goodreason.ai</u>.
                            </div>
                        </div>
                    </div>
                    <div className={styles.lowerContainer}>
                        <div className={styles.lowerContainerTitle}>
                            <span>
                                {`Brainstorm freely and let AI organize in `}
                                <span>
                                    <div style={{'display': 'inline', 'position': 'relative'}}>
                                        {`Workspace`}
                                        <MyImage style={{'position': 'absolute', 'right': '-5px', 'top': '50%', 'transform': 'translateX(100%) translateY(-50%)'}} src={WorkspaceIcon} className={styles.titleIcon} alt={"Workspace icon"} />
                                    </div>
                                </span>
                            </span>
                        </div>
                        <div className={styles.twoPanelContainer}>
                            <div className={styles.twoPanelImageContainer}>
                                <MyImage
                                    className={styles.twoPanelImage}
                                    canSwitch={false} src={WorkspaceSS} inDark={WorkspaceSSDark} alt={"Workspace"}
                                />
                            </div>
                            <PopOnScroll>
                                <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '2rem'}}>
                                    {[
                                        "AI-generated Key Points and Outline",
                                        "Chat with all your documents at once",
                                        "AI auto-write notes based on your docs",
                                        "Search, rearrange, and organize all of your notes"
                                    ].map((item, i) => {
                                        return (
                                            <div key={i} style={{'display': 'flex', 'gap': '10px', 'fontSize': '1.25rem'}} className={styles.shadowedText}>
                                                <MyImage src={CircleCheck} width={20} height={20} alt={"Check"} />
                                                <div>
                                                    {item}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </PopOnScroll>
                        </div>
                    </div>
                    <div style={{'position': 'relative'}}>
                        <div className={styles.lowerContainer} style={{'backgroundImage': 'unset'}}>
                            <div className={`${styles.lowerContainerTitle}`}>
                                Creating a course for your business has never been easier.
                            </div>
                            <div className={styles.twoPanelContainer}>
                                <PopOnScroll>
                                    <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '2rem'}}>
                                        {[
                                            "Auto-generate quiz questions",
                                            "Create content automatically from your documents",
                                            "Custom branding",
                                            "Personalized support to help create the course"
                                        ].map((item, i) => {
                                            return (
                                                <div key={i} style={{'display': 'flex', 'gap': '10px', 'fontSize': '1.25rem'}} className={styles.shadowedText}>
                                                    <MyImage src={CircleCheck} width={20} height={20} alt={"Check"} />
                                                    <div>
                                                        {item}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </PopOnScroll>
                                <div className={styles.twoPanelImageContainer}>
                                    <MyImage
                                        className={styles.twoPanelImage}
                                        canSwitch={false} src={CourseSS} inDark={CourseSSDark} alt={"Course"}
                                    />
                                    <Link href={'https://abbey.us.ai/groups/27'}>
                                        <div style={{'position': 'absolute', 'right': '50%', 'bottom': '-10px', 'transform': 'translateX(50%)', 'overflow': 'hidden', 'borderRadius': 'var(--medium-border-radius)', 'border': '1px solid var(--light-border)'}}>
                                            <div style={{'color': 'var(--light-text', 'position': 'relative', 'padding': '5px 10px', 'zIndex': '1', 'fontSize': '.8rem'}}>
                                                See Our MCAT Course
                                            </div>
                                            <GradientEffect style={{'width': '200%', 'height': '200%', 'zIndex': '0'}} />
                                        </div>
                                    </Link>
                                </div>
                            </div>
                            <div style={{'textAlign': 'center', 'fontSize': '1.15rem'}} className={styles.shadowedText}>
                                Reach out to team@goodreason.ai to get started.
                            </div>
                        </div>
                        <MyImage canSwitch={false} src={RhodesExpanded} fill={true} className={styles.topPartImg} alt={"Colossus of Rhodes"} />
                    </div>
                    <div className={styles.lowerContainer}>
                        <div className={styles.lowerContainerTitle}>
                            {`AI templates to help parse documents, websites, videos, and more.`}
                        </div>
                        <div className={styles.twoPanelSelectTemplateContainer}>
                            <div style={{'width': 'calc(300px', 'height': '300px'}}>
                                <SpinningItems selectedTemplate={selectedTemplate} setSelectedTemplate={setSelectedTemplate} imageSize={30} circleSize={'300'} />
                            </div>
                            <div className={styles.selectedTemplateContainer}>
                                {selectedTemplate ? (
                                    <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '2rem', 'backgroundColor': 'var(--light-primary)', 'borderRadius': 'var(--large-border-radius)', 'padding': '2rem', 'border': '1px solid var(--light-border)'}}>
                                        <div style={{'fontSize': '1.5rem', 'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                                            {`${selectedTemplate.constructor.readableName}`}
                                            <MyImage src={selectedTemplate.constructor.icon} style={{'width': '2rem', 'height': '2rem'}} alt={selectedTemplate.constructor.readableName} />
                                        </div>
                                        <div>
                                            {`${selectedTemplate.constructor.description}`}
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        Select a template
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div>
                        <InfQuizScroll />
                    </div>
                    <div style={{'backgroundColor': 'var(--light-primary)', 'display': 'flex', 'flexDirection': 'column', 'gap': '2rem', 'justifyContent': 'center', 'textAlign': 'center', 'padding': 'var(--std-margin)'}}>
                        <div style={{'fontSize': '2rem'}}>
                            {`Ready to start using ${NAME}?`}
                        </div>
                        <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center', 'justifyContent': 'center'}}>
                            <Link href='login'>
                                <SyntheticButton value={"Login"} />
                            </Link>
                            <Link href={'sign-up'}>
                                <SyntheticButton value={"Sign Up"} />
                            </Link>
                        </div>
                    </div>
                </div>
            </DefaultPage>
        </>
    )
}

const SpinningItems = ({ selectedTemplate, setSelectedTemplate, circleSize=300, imageSize=50, style, ...props }) => {
    const [angle, setAngle] = useState(0);
    const [isHovering, setIsHovering] = useState(false);

    useEffect(() => {
        const intervalId = setInterval(() => {
            setAngle((prevAngle) => (prevAngle + 1) % 360);
        }, isHovering ? 10000 : 50); // Slow down when hovering
        return () => clearInterval(intervalId);
    }, [isHovering]);

    const tmps = TEMPLATES.filter((x) => x.constructor.uploadable)

    const radius = (circleSize - imageSize) / 2;
    const center = circleSize / 2;

    const handleMouseEnter = () => setIsHovering(true);
    const handleMouseLeave = () => setIsHovering(false);

    return (
        <div style={{'position': 'relative', ...style}}
        
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}>
            {tmps.map((tmp, index) => {
                const individualAngle = (angle + (index * 360) / tmps.length) % 360;
                const radians = (individualAngle * Math.PI) / 180;
                const x = center + radius * Math.cos(radians) - imageSize / 2;
                const y = center + radius * Math.sin(radians) - imageSize / 2;

                return (
                    <div
                        style={{
                            'transform': `translate(${x}px, ${y}px)`,
                            'position': 'absolute',
                            'transformOrigin': `${imageSize/2}px ${imageSize/2}0px`,
                            'padding': '8px',
                            'transition': 'transform .1s linear', ...(selectedTemplate?.constructor?.code == tmp.constructor.code ? {
                                'border': '5px dotted var(--dark-primary)',
                                'borderRadius': 'var(--large-border-radius)',
                                'padding': '3px'
                            } : {})
                        }}
                        key={index}
                        onClick={() => setSelectedTemplate(tmp)}
                    >
                        <Tooltip content={tmp.constructor.readableName}>
                            <MyImage
                                width={imageSize}
                                height={imageSize}
                                src={tmp.constructor.icon}
                                alt={tmp.constructor.readableName}
                            />
                        </Tooltip>
                    </div>
                );
            })}
        </div>
    );
};

function InfQuizScroll({}) {

    const slider = useRef()
    const displayOne = useRef()
    const displayTwo = useRef()

    function onAnimate(time){
        const viewportWidth = window.innerWidth
        const displayOneRect = displayOne.current.getBoundingClientRect()
        const displayTwoRect = displayTwo.current.getBoundingClientRect()
        const displayOneRectWidth = displayOneRect.width
        const displayTwoRectWidth = displayTwoRect.width

        const newDisplacement = (displayOneRectWidth - .5*(viewportWidth - displayTwoRectWidth)) * (time)
        slider.current.style.left = `-${newDisplacement}px`
    }

    const tmp = getTemplateByCode('quiz')

    return (
        <div>
            <ScrollWithFixedScene heightMultiplier={3} onAnimate={onAnimate}>
                <div style={{'height': '100vh', 'display': 'flex', 'flexDirection': 'column', 'overflow': 'hidden'}}>
                    <div className={styles.infQuizHeader}>
                        <div className={styles.shadowedText} style={{'textAlign': 'center'}}>
                            Content In, Questions Out
                        </div>
                        <MyImage className={"_hideOnMobile"} src={tmp.constructor.icon} width={35} height={35} alt={"Infinite Quiz Icon"} />
                    </div>
                    <div style={{'flex': '1'}}>
                        <div ref={slider} style={{'height': '100%', 'width': '200vw', 'display': 'flex', 'overflow': 'hidden', 'position': 'relative'}}>
                            <div ref={displayOne} style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem', 'height': '100%', 'width': '100vw', 'overflow': 'hidden', 'justifyContent': 'center', 'alignItems': 'center', 'paddingBottom': '4rem'}}>
                                <div style={{'fontSize': '1.5rem', 'textAlign': 'center'}} className={styles.shadowedText}>
                                    Generate questions from docs, videos, and more.
                                </div>
                                <div className={styles.infQuizImageContainer}>
                                    <MyImage inDark={InfQuizBasicDark} onMobile={InfQuizBasicMobile} onMobileInDark={InfQuizBasicDarkMobile} canSwitch={false} src={InfQuizBasic} style={{'objectFit': 'contain'}} fill={true} alt={"Infinite Quiz screenshot"} />
                                </div>
                            </div>
                            <div ref={displayTwo} style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem', 'height': '100%', 'maxWidth': '100vw', 'justifyContent': 'center', 'alignItems': 'center', 'paddingBottom': '4rem'}}>
                                <div style={{'fontSize': '1.5rem', 'textAlign': 'center', 'padding': '10px 0px'}} className={styles.shadowedText}>
                                    Get detailed explanations and exact sources.
                                </div>
                                <div className={styles.infQuizImageContainer}>
                                    <MyImage alt={"Infinite quiz screenshot"} inDark={InfQuizExplainDark} canSwitch={false} src={InfQuizExplain} style={{'objectFit': 'contain'}} onMobile={InfQuizExplainMobile} onMobileInDark={InfQuizExplainDarkMobile} fill={true} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <MyImage className={`${styles.topPartImg}`} src={SubmersionOfPharaoh} fill={true} canSwitch={false} alt={"Submersion of Pharoah"} />
                </div>
            </ScrollWithFixedScene>
        </div>
    )
}

