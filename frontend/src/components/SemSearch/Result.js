import styles from './SemSearch.module.css'
import RichTextViewer from '../RichText/Viewer'
import { useState } from 'react'
import { toWords } from '@/utils/text'
import Loading from '../Loading/Loading'
import { Auth } from "@/auth/auth";


// Item is chunk
export default function Result({ manifestRow, item, searchText, ...props }) {

    const searchedWords = toWords(searchText)
    const { getToken } = Auth.useAuth()

    const [befores, setBefores] = useState([])
    const [afters, setAfters] = useState([])
    const [beforesLoadingState, setBeforesLoadingState] = useState(0)
    const [aftersLoadingState, setAftersLoadingState] = useState(0) 

    async function requestAdjacent(before){

        // What's the desired chunk index?
        let ci = before ? item.index - befores.length - 1 : item.index + afters.length + 1

        try {
            before ? setBeforesLoadingState(1) : setAftersLoadingState(1);

            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/get-chunk?id=${manifestRow['id']}&chunk_index=${ci}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken()
                },
                'method': 'GET'
            })
            if (!response.ok){
                throw Error("Response was not ok")
            }
            const myJson = await response.json()
            if (myJson['chunk']){
                if (before){
                    setBefores([myJson['chunk'], ...befores])
                    setBeforesLoadingState(2)
                }
                else {
                    setAfters([...afters, myJson['chunk']])
                    setAftersLoadingState(2)
                }
            }
            else {
                throw Error("No chunk")
            }
        }
        catch(e) {
            console.log(e)
            before ? setBeforesLoadingState(3) : setAftersLoadingState(3);
        }
    }

    let beforeElement = item.index - befores.length == 0 ? ("") : (
        <div>
            {
                beforesLoadingState == 1 ? (
                    <Loading />
                ) : beforesLoadingState != 3 ? (
                    <div onClick={() => {requestAdjacent(true)}} style={{'display': 'flex'}}>
                        <div className={styles.seeContextText}>
                            ...see before
                        </div>
                    </div>
                ) : ""
            }
            <div>
                {
                    befores.map((item, i) => {
                        return (
                            <RichTextViewer viewerPaddingOption='none' content={item.txt} />
                        )
                    })
                }
            </div>
        </div>
    )
    let afterElement = (
        <div>
            <div>
                {
                    afters.map((item, i) => {
                        return (
                            <RichTextViewer viewerPadding='none' content={item.txt} />
                        )
                    })
                }
            </div>
            {
                aftersLoadingState == 1 ? (
                    <Loading />
                ) : aftersLoadingState != 3 ? (
                    <div onClick={() => {requestAdjacent(false)}} style={{'display': 'flex'}}>
                        <div className={styles.seeContextText}>
                            ...see more
                        </div>
                    </div>
                ) : ""
            }
        </div>
    )

    const chunkName = `Chunk ${item.index + 1}`

    return (
        <div className={styles.searchResult}>
            <div className={styles.searchResultHeader}>
                <div style={{'flex': '1'}}>
                    From {item.source_name}
                </div>
                <div>
                    ({chunkName})
                </div>
            </div>
            <div className={styles.searchResultText}>
                {beforeElement}
                <RichTextViewer viewerPadding='none' boldWords={searchedWords} content={item.txt} />
                {afterElement}
            </div>
        </div>
    )
}
