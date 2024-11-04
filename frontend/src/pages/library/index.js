import AssetsTable from "@/components/assets-table/AssetsTable";
import DefaultPage from '@/components/DefaultPage';
import { NAME } from '@/config/config';
import Head from 'next/head'

export default function Library(){

    // Get recently uploaded assets + permissioned assetsW
    return (
        <DefaultPage>
            <Head>
                <title>{`${NAME} - My Library`}</title>
            </Head>
            <div>
                <AssetsTable
                    contentUrl={process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/manifest`}
                    pageLen={15}
                    showSearch={true}
                    useSearchUrl={true}
                    paginated={false}
                    showEdit={true}
                    showPin={true}
                    showDelete={true}
                    foldersFirst={true}
                    recentActivityArea={true}
                    showTemplatesButton={true}
                    showNewFolderButton={true}
                    loadMore={true}
                    loadingSkeleton={true}
                />
            </div>
        </DefaultPage>
    )
}
