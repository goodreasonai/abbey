import styles from './Create.module.css'
import { NAME } from "@/config/config";
import MyImage from "@/components/MyImage/MyImage";
import DefaultPage from "@/components/DefaultPage";
import Head from "next/head";
import { CREATE_BACKGROUND } from '@/config/config';
import Upload from "@/components/Upload/Upload";


// You set assetId to not null if it's an edit page
export default function Create({ assetId=null }){

    return (
        <DefaultPage noMargin={true} footerStyle={{'margin': '0px'}} noBackground={true}>
            <Head>
                <title>{`${NAME} - Create`}</title>
            </Head>
            <MyImage canSwitch={false} src={CREATE_BACKGROUND} className={styles.bgImg} alt={"Collossus of Rhodes"} />
            <Upload assetId={assetId} />
        </DefaultPage>
    )
}
