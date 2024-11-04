import DefaultPage from "@/components/DefaultPage";
import Groups from "@/components/Groups/Groups";
import Head from "next/head";


export default function Collections({}) {

    return (
        <DefaultPage mustSignIn={false}>
            <Head>
                <title>Collections</title>
            </Head>
            <Groups />
        </DefaultPage>
    )

}
