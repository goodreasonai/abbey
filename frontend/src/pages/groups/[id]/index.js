import DefaultPage from "@/components/DefaultPage";
import Group from "@/components/Groups/Group";
import Loading from "@/components/Loading/Loading";
import LoadingSkeleton from "@/components/Loading/LoadingSkeleton";
import Button from "@/components/form/Button";
import { Auth } from "@/auth/auth";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";


export default function Collection({}){

    const router = useRouter()
    const { id } = router.query;

    const { getToken, isSignedIn } = Auth.useAuth()

    const [groupManifest, setGroupManifest] = useState({})
    const [groupManifestLoadingState, setGroupManifestLoadingState] = useState(0)

    async function getGroupManifest(){
        setGroupManifestLoadingState(1)

        try {
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/groups/manifest-row?id=${id}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                },
                'method': 'GET'
            })
            const myJson = await response.json()

            if (myJson['response'] != 'success'){
                throw Error(`Response was not success: ${myJson['reason']}`)
            }

            setGroupManifest(myJson['result'])

            setGroupManifestLoadingState(2)
        }
        catch(e) {
            console.log(e)
            setGroupManifestLoadingState(3)
        }

    }

    useEffect(() => {
        if (id && isSignedIn !== undefined){
            getGroupManifest()
        }
    }, [id, isSignedIn])

    let toShow = <LoadingSkeleton numResults={10} type="default" />
    if (groupManifestLoadingState == 2){
        toShow = (
            <Group groupManifest={groupManifest} />
        )
    }
    else if (groupManifestLoadingState == 3){
        toShow = (
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                <div>
                    Error loading collection. Do you have permission to view this collection?
                </div>
                <div>
                    <Link href={`${Auth.getSignInURL('/')}`}>
                        <Button value={"Sign In"} onClick={()=>{}} />
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <DefaultPage noMargin={groupManifestLoadingState == 2} backgroundColor={groupManifest.needs_purchase && groupManifest.product_id ? "var(--light-primary)" : ""} mustSignIn={false}>
            <Head>
                {
                    groupManifest.title ? (
                        <>
                            <title>{groupManifest.title}</title>
                            <meta name="description" content={groupManifest.preview_desc} />
                        </>
                    ) : ""
                }
            </Head>
            <div>
                {toShow}
            </div>
        </DefaultPage>
    )
}
