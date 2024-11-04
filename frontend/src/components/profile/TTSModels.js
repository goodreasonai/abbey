import { Auth } from "@/auth/auth"
import { useState, useEffect } from "react"
import styles from './Profile.module.css'
import Loading from "../Loading/Loading"
import OpenaiLogomarkBlack from '../../../public/random/OpenaiLogomarkBlack.png'
import MyImage from "../MyImage/MyImage"
import ElevenLabs from '../../../public/random/ElevenLabs.png'
import LoadingSkeleton from "../Loading/LoadingSkeleton"


export default function TTSModels({ productCode, ...props}){

    const [userModelOptions, setUserModelOptions] = useState([])
    const [userSelectedModel, setUserSelectedModel] = useState("")
    const { getToken } = Auth.useAuth()

    async function getUserModelOptions(){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/user/tts-models'
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
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/user/tts-model'
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

    async function setUserTTSModel(model){
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + '/user/select-tts-model'
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
        getUserModelOptions()
        getUserSelectedModel()
    }, [productCode])

    function makeTTS(item, i){

        let cardClass = styles.modelCard
        let onClick = () => setUserTTSModel(item)

        if (item.code == userSelectedModel.code){
            cardClass = styles.modelCardSelected
        }
        else if (!item.available){
            cardClass = styles.unavailableCard
            onClick = () => {}
        }

        let logo = ""
        if (item.code.includes("openai")){
            logo = (
                <MyImage src={OpenaiLogomarkBlack} alt={"OpenAI"} width={20} height={20} />
            )
        }
        else if (item.code.includes('eleven')){
            logo = (
                <MyImage src={ElevenLabs} alt={"Eleven Labs"} width={20} height={20} />
            )
        }

        return (
            <div key={i} className={cardClass} onClick={onClick}>
                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                    <div style={{'flex': '1', 'display': 'flex', 'gap': '5px', 'alignItems': 'center'}}>
                        <div>
                            {item.name}
                        </div>
                        {logo}
                    </div>
                    <div style={{'color': 'var(--passive-text)'}}>
                        {item.traits}
                    </div>                    
                </div>
                <div>
                    <audio controls style={{'height': '2rem'}}>
                        <source src={item.sample_url} />
                        Your browser does not support the audio element.
                    </audio>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.ttsContainer} {...props}>
            <div style={{'display': 'flex', 'gap': '5px', 'fontFamily': 'var(--font-body)', 'fontSize': '.9rem'}}>
                <div style={{'color': "var(--passive-text)"}}>
                    Your current text-to-speech voice is
                </div>
                <div>
                    {
                        userSelectedModel ? userSelectedModel['name'] : (<Loading text="" />)
                    }
                </div>
            </div>
            {
                userModelOptions.length ? (
                    <div style={{'display': 'flex', 'flexWrap': 'wrap', 'gap': '10px', 'alignItems': 'stretch'}}>
                        {userModelOptions.map(makeTTS)}
                    </div>
                ) : (<LoadingSkeleton type="grid" numResults={4} />)
            }
            
        </div>
    )
}
