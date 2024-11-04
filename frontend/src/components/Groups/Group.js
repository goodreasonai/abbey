import AssetsTable from "../assets-table/AssetsTable";
import Button from "../form/Button";
import loadingStyles from '../Loading/LoadingImage.module.css'
import { GROUP_TEMPLATE_OPTIONS } from "@/templates/template";
import GroupPreview from "./GroupPreviews/GroupPreview";
import DefaultMargins from "../DefaultMargins";
import { getGroupTemplateByCode } from "./GroupTemplates/groupTemplates";
import MyImage from "../MyImage/MyImage";

export default function Group({ groupManifest }){

    if (groupManifest.needs_purchase){
        return <GroupPreview groupManifest={groupManifest} />
    }

    if (groupManifest.template){
        const tmp = getGroupTemplateByCode(groupManifest.template)
        return <tmp.Element manifestRow={groupManifest} />
    }

    // Default view
    return (
        <DefaultMargins>
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                <div style={{'display': 'flex', 'alignItems': 'flex-start', 'gap': '1rem'}}>
                    {groupManifest.image ? (
                        <MyImage src={groupManifest.image} width={75} height={75} style={{'borderRadius': 'var(--small-border-radius)', 'border': '1px solid var(--light-border)'}} className={loadingStyles.imgSkeleton} />
                    ) : ""}
                    <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                        <div style={{'fontSize': '1.5rem', 'color': 'var(--passive-text)'}}>
                            {groupManifest.title}
                        </div>
                        <div style={{'color': 'var(--passive-text)'}}>
                            {groupManifest.preview_desc}
                        </div>
                    </div>
                </div>
                <div>
                    <AssetsTable contentUrl={`${process.env.NEXT_PUBLIC_BACKEND_URL}/assets/manifest`}
                        paginated={false}
                        loadMore={true}
                        showSearch={true}
                        groupId={groupManifest.id}
                        useSearchUrl={true}
                        alphabetical={true}
                        showCreateText={false}
                        foldersFirst={true}
                        loadingSkeleton={true}
                        showTemplatesButton={true}
                        showTemplatesOptions={GROUP_TEMPLATE_OPTIONS}
                />
                </div>
            </div>
        </DefaultMargins>
    )
}
