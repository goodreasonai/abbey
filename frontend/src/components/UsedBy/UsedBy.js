import { Auth } from "@/auth/auth";
import Link from "next/link";
import { useState, useEffect } from "react";
import Button from "../form/Button";
import styles from './UsedBy.module.css'
import LinkedSelectorItem from "../LinkedSelectorItem/LinkedSelectorItem";
import shortenText from "@/utils/text";
import Dropdown from "../Dropdown/Dropdown";


export default function UsedBy({ assetId, label="", ...props }) {
    
    const [sourceOf, setSourceOf] = useState([])

    const { getToken, isSignedIn } = Auth.useAuth()

    useEffect(() => {
        async function getSourceOf(){
            let url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/source-of?id=${assetId}`
            try{
                const token = await getToken();
                const response = await fetch(url, {headers: {'x-access-token': token}});
                const myJson = await response.json();
                if (myJson['response'] !== 'success'){
                    throw new Error("Server returned failed")
                }
                
                setSourceOf(myJson.results)

            }
            catch (error) {
                console.error(error)
            }
        
        }
        if (assetId && isSignedIn !== undefined){
            setSourceOf([])
            getSourceOf()
        }
    }, [assetId, setSourceOf, isSignedIn])

    if (!sourceOf.length){
        return <div></div>
    }

    let options = sourceOf.map((source, i) => {
        return {'onClick': ()=>{}, 'value': (
            <Link key={source.id} href={`/assets/${source.id}`} style={{'flex': '1'}}>
                <div style={{'flex': '1', 'fontSize': '.8rem'}}>
                    {shortenText(source.title, 5, 25, true)}
                </div>
            </Link>
        )}
    })

    return (
        <Dropdown 
            value={label}
            options={options}
            initialButtonStyle={{'fontSize': '.8rem', 'paddingTop': '3px', 'paddingBottom': '3px'}}
            optionsStyle={{'minWidth': '200px'}}
            {...props} />
    )

}
