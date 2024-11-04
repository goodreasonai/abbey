import { Auth } from "@/auth/auth";
import { useState } from "react";
import Loading from "../Loading/Loading";
import SearchBar from "../form/SearchBar";
import styles from './SemSearch.module.css'
import Result from "./Result";
import LoadingSkeleton from "../Loading/LoadingSkeleton";


export default function SemSearch({ manifestRow, autoFocus=false, onSearchEnd=()=>{}, ...props }) {
    const id = manifestRow['id']
    const [searchText, setSearchText] = useState("")
    const [searchLoadState, setSearchLoadState] = useState(0)
    const [searchResults, setSearchResults] = useState([])
    const { getToken } = Auth.useAuth()

    async function semSearch(){
        setSearchLoadState(1)
        let url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/retriever-search?id=${id}&txt=${searchText}`
        try {
            const response = await fetch(url, {
                headers: {
                    'x-access-token': await getToken()
                },
                'method': 'GET'
            });
            const myJson = await response.json(); //extract JSON from the http response
            if (myJson['response'] !== 'success'){
                throw new Error("Server returned failed")
            }
            setSearchResults(myJson['results']);
            setSearchLoadState(2);
            onSearchEnd(myJson['results'])
        }
        catch (error) {
            console.error(error);
            setSearchLoadState(3);
        }
    }

    let resultsPart = ""
    if (searchLoadState == 0){
        resultsPart = (
            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center', 'zIndex': 10}}>
                <div style={{'color': 'var(--passive-text)'}}>
                    Search over the text using semantic similarity 
                </div>
            </div>
        )
    }
    else if (searchLoadState == 2){
        resultsPart = (
            <div className={styles.searchResults}>
                {searchResults.map((item) => {
                    return (
                        <div key={item.chunk_index}>
                            <Result item={item} manifestRow={manifestRow} searchText={searchText} />
                        </div>
                    )
                })}
            </div>
        )
    }
    else if (searchLoadState == 1){
        resultsPart = (
            <LoadingSkeleton numResults={10} />
        )
    }
    else if (searchLoadState == 3){
        <div>
            Error occurred; try again.
        </div>
    }

    return (
        <div className={styles.searchContainer} {...props}>
            <div style={{'position': 'sticky', 'paddingBottom': '20px', 'display': 'flex', 'justifyContent': 'center', 'top': '0px', 'zIndex': 5, 'backgroundColor': 'var(--light-background)'}}>
                <SearchBar
                    autoFocus={autoFocus}
                    textFieldStretch={true}
                    value={searchText}
                    setValue={setSearchText}
                    handleSearch={() => semSearch()}
                    getSearchResults={() => {return []}}
                    searchOnErase={false} />
            </div>
            {resultsPart}
        </div>
    )
}
