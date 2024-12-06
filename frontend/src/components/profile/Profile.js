import { Auth } from "@/auth/auth"
import { useEffect, useState } from "react"
import Loading from "@/components/Loading/Loading"
import styles from './Profile.module.css'
import SubscriptionSelect from "@/components/profile/SubscriptionSelect"
import Button from "../form/Button"
import { useTheme } from 'next-themes'
import MyImage from "../MyImage/MyImage"
import TTSModels from "./TTSModels"
import LoadingSkeleton from "../Loading/LoadingSkeleton"
import EnterCode from "../EnterCode/EnterCode"
import ImageIcon from '../../../public/icons/ImageIcon.png'
import Tooltip from "../Tooltip/Tooltip"
import CircleCheckIcon from '../../../public/icons/CircleCheckIcon.png'
import { getImageByModelName } from "@/utils/models"
import { ALLOW_SUBSCRIPTION, HIDE_TTS } from "@/config/config"


export default function Profile(){

    const { getToken, isSignedIn } = Auth.useAuth()

    const [userModelOptions, setUserModelOptions] = useState([])
    const [userSelectedModel, setUserSelectedModel] = useState("")
    
    const { user } = Auth.useUser();

    const [productCode, setProductCode] = useState("");
    
    async function getUserModelOptions(){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/user/chat-models'
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            if (myJson['response'] != 'success'){
                console.log(myJson)
                throw Error("Response was not success")
            }
            const available = myJson['available'].map((item) => {return {...item, 'available': true}})
            const unavailable = myJson['unavailable'].map((item) => {return {...item, 'available': false}})
            setUserModelOptions([...available, ...unavailable])
        }
        catch (e) {
            console.log(e)
        }
    }

    async function getUserSelectedModel(){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/user/chat-model'
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            if (myJson['response'] != 'success'){
                console.log(myJson)
                throw Error("Response was not success")
            }
            setUserSelectedModel(myJson['model'])
        }
        catch (e) {
            console.log(e)
        }
    }

    async function setUserChatModel(model){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/user/select-chat-model'
            const data = {
                'model': model.code
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
                console.log(myJson)
                throw Error("Response was not success")
            }
            setUserSelectedModel(myJson['model'])
        }
        catch (e) {
            console.log(e)
        }
    }


    useEffect(() => {
        if (!userModelOptions.length && isSignedIn){
            getUserModelOptions()
        }
        if (!userSelectedModel && isSignedIn){
            getUserSelectedModel()
        }
    }, [isSignedIn])

    function makeModelOption(item, i){

        let cardClass = styles.modelCard
        let onClick = () => setUserChatModel(item)

        if (item.code == userSelectedModel.code){
            cardClass = styles.modelCardSelected
        }
        else if (!item.available){
            cardClass = styles.unavailableCard
            onClick = () => {}
        }


        let matchedLogo = ""
        const matchedLogoSource = getImageByModelName(item.name)
        if (matchedLogoSource?.src){
            matchedLogo = (
                <div style={{'display': 'flex', 'alignItems': 'center'}}>
                    <MyImage src={matchedLogoSource.src} height={20} alt={matchedLogoSource.alt} canSwitch={matchedLogoSource.canSwitch} />
                </div>
            )
        }        

        return (
            <div className={cardClass} key={i} onClick={onClick}>
                <div className={styles.modelCardHeader}>
                    {
                        matchedLogo
                    }
                    <div>
                        {item.name}
                    </div>
                    <div style={{'fontSize': '1rem'}}>
                        <span style={{'color': 'var(--passive-text)'}}>Best for:</span> <span>{item.traits}</span>
                    </div>
                    {item.accepts_images ? (
                        <>
                            <div style={{'flex': '1'}}></div>
                            <Tooltip content={"Accepts images"}>
                                <div style={{'position': 'relative'}}>
                                    <div style={{'position': 'absolute', 'bottom': '-5px', 'right': '-5px', 'backgroundColor': 'var(--dark-primary)', 'borderRadius': '50%', 'zIndex': '1', 'display': 'flex'}}>
                                        <MyImage src={CircleCheckIcon} alt={"Check"} width={15} height={15} />
                                    </div>
                                    <MyImage src={ImageIcon} alt={"Images"} width={15} height={15} />
                                </div>
                            </Tooltip>
                           
                        </>
                    ) : ""}
                </div>
                <div className={styles.modelCardDescription}>
                    {item.desc}
                </div>
            </div>
        )

    }

    async function verifySubscription(){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/pay/get-subscription"
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'method': 'POST'
            })
            const myJson = await response.json()
            if (myJson['response'] != 'success'){
                console.log(myJson)
                throw Error("Response was not success")
            }

            // Note: if it's possible to have multiple subscriptions active, then this will have to be changed.
            const subCode = myJson['subscription_code']
            setProductCode(subCode)
        }
        catch (e) {
            console.log(e)
        }
    }

    useEffect(() => {
        if (isSignedIn && ALLOW_SUBSCRIPTION){
            verifySubscription()
        }
    }, [isSignedIn])

    useEffect(() => {
        if (isSignedIn){
            getUserModelOptions()
        }
    }, [productCode, isSignedIn])

    return (
        <div>
            <div className={styles.header}>
                {user && user.firstName ? (
                    user.firstName + "'s Settings"
                ) : "Settings"}
            </div>
            <div className={styles.infoRows}>
                {ALLOW_SUBSCRIPTION ? (
                    <>
                        <div className={styles.infoRow}>
                            <div style={{'fontSize': '1.5rem', 'marginTop': '1rem'}}>
                                Subscription Options
                            </div>
                        </div>
                        <div className={styles.infoRow}>
                            <SubscriptionSelect selected={productCode} />
                        </div>
                    </>
                ) : ""}
                
                <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '.5rem'}}>
                    <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                        <div style={{'display': 'flex', 'gap': '5px', 'fontFamily': 'var(--font-body)', 'fontSize': '.9rem'}}>
                            <div style={{'color': "var(--passive-text)"}}>
                                Your current chat model backbone is
                            </div>
                            <div>
                                {
                                    userSelectedModel ? userSelectedModel['name'] : (<Loading text="" />)
                                }
                            </div>
                        </div>
                    </div>
                    <div style={{'display': 'flex', 'gap': '10px', 'flexWrap': 'wrap', 'alignItems': 'stretch'}}>
                        {userModelOptions.length ? userModelOptions.map(makeModelOption) : (<LoadingSkeleton numResults={4} type="grid" />)}
                    </div>
                </div>
                {HIDE_TTS ? "" : <TTSModels productCode={productCode} />}
                <ThemeChanger/>
                {ALLOW_SUBSCRIPTION ? <EnterCode showPreviouslyUsedCodes={true} /> : ""}
            </div>
            
        </div>
    )
}


const ThemeChanger = () => {
    const [mounted, setMounted] = useState(false)
    const { theme, setTheme } = useTheme()

    // useEffect only runs on the client, so now we can safely show the UI
    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return null
    }
  
    return (
      <div>
            <div style={{'fontSize': '1.5rem', 'margin': '1rem 0'}}>
                Theme
            </div>
            <div> 
                The current theme is: {theme == 'system' ? 'light' : theme}
            </div>
            <div style={{'display': 'flex', 'gap': '10px', 'marginTop': '1em'}}>
                <Button value={'Light'} onClick={() => setTheme('light')}/>
                <Button value={'Dark'} onClick={() => setTheme('dark')}/>
            </div>
      </div>
    )
}
