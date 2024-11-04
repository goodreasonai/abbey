import { Auth } from "@/auth/auth"
import { useState, useEffect } from "react"
import Tooltip from "../Tooltip/Tooltip"
import MyImage from "../MyImage/MyImage"
import Link from "next/link"
import QuizIcon from '../../../public/icons/QuizIcon.png'
import Loading from "../Loading/Loading"
import DownloadIcon from '../../../public/icons/DownloadIcon.png'
import MagnifyingGlassIcon from '../../../public/icons/MagnifyingGlassIcon.png'
import fileResponse from "@/utils/fileResponse"
import Modal from "../Modal/Modal"
import SemSearch from "../SemSearch/SemSearch"
import styles from './Website.module.css'


export default function Sidebar({ manifestRow }) {

    const [quizLoadingState, setQuizLoadingState] = useState(0)
    const [quizId, setQuizId] = useState()
    const [downloadFileState, setDownloadFileState] = useState(0)
    const [showSearch, setShowSearch] = useState(false)

    const { getToken, isSignedIn } = Auth.useAuth()
    
    async function makeQuiz(){
        try {
            setQuizLoadingState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/quiz/create"
            const data = {
                'ids': [manifestRow['id']],
                'title': `Quiz for ${manifestRow['title']}`
            }
            const response = await fetch(url, {
                'method': "POST",
                'headers': {
                    'Content-Type': 'application/json',
                    'x-access-token': await getToken(),
                },
                'body': JSON.stringify(data)
            })

            const myJson = await response.json()
            if (myJson['response'] != 'success'){
                throw Error("Response was not success")
            }

            setQuizId(myJson['asset_id'])
            setQuizLoadingState(2)
        }
        catch(e){
            console.log(e)
            setQuizLoadingState(3)
        }
    }

    async function loadQuiz() {
        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/quiz/find?id=${manifestRow['id']}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken()
                },
                'method': 'GET'
            })
            const myJson = await response.json()
            if (myJson['response'] != 'success'){
                throw Error("Couldn't load previous thing.")
            }
            if (myJson['result']){
                setQuizId(myJson['result'].id)
            }
        }
        catch(e) {
            console.log(e)
        }
    }

    const initiateDownload = async () => {
        try {
            setDownloadFileState(1)
            const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/files?id=${manifestRow['id']}`, {
                method: 'GET',
                headers: {
                    'x-access-token': await getToken(),
                },
            });
        
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
        
            fileResponse(response)
            setDownloadFileState(2)
        }
        catch (error) {
            setDownloadFileState(3)
            console.error('There was a problem fetching the file:', error);
        }
    };

    useEffect(() => {
        if (manifestRow['id'] && isSignedIn !== undefined){
            loadQuiz()
        }
    }, [manifestRow.id, isSignedIn])

    return (
        <div className={styles.sidebar}>
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '2rem'}}>
                <Tooltip content={"Search"}>
                    <MyImage src={MagnifyingGlassIcon} alt={"Search"} width={25} height={25} onClick={() => {setShowSearch(true)}} />
                </Tooltip>
                {!quizId ? (
                    quizLoadingState == 1 ? (
                        <Loading size={25} text="" />
                    ) : (
                        <Tooltip content={"Make Quiz"}>
                            <MyImage src={QuizIcon} alt={"Quiz"} width={25} height={25} onClick={() => {makeQuiz()}} />
                        </Tooltip>
                    )
                ) : (
                    <Tooltip content={"Take Quiz"} flash={true}>
                        <Link href={`/assets/${quizId}`} style={{'display': 'flex'}}>
                            <MyImage src={QuizIcon} alt={"Quiz"} width={25} height={25} />
                        </Link>
                    </Tooltip>
                )}
                {downloadFileState == 1 ? (
                    <Loading text={""} size={25} />
                ) : (
                    <Tooltip content={"Download Scrape"}>
                        <MyImage src={DownloadIcon} alt={"Download"} width={25} height={25} onClick={() => {initiateDownload()}} />
                    </Tooltip>
                )}
                
            </div>
            <Modal minWidth="80vw" minHeight="80vh" isOpen={showSearch} close={() => setShowSearch(false)} title={"AI Search"}>
                <SemSearch autoFocus={showSearch} manifestRow={manifestRow} />
            </Modal>
        </div>
    )
}

