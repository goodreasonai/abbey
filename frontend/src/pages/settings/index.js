import Profile from "@/components/profile/Profile"
import Head from "next/head"
import DefaultPage from "@/components/DefaultPage"


export default function MyProfile(){
    return (
        <DefaultPage>
            <Head>
                <title>My Settings</title>
            </Head>
            <Profile />
        </DefaultPage>
    )
}
