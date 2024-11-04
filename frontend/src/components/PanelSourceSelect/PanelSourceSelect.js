import LinkedSelectorItem from '../LinkedSelectorItem/LinkedSelectorItem'
import Table from "../Table/Table";
import styles from './PanelSourceSelect.module.css'
import RemoveIcon from '../../../public/icons/RemoveIcon.png'
import AddIcon from '../../../public/icons/AddIcon.png'
import MyImage from "../MyImage/MyImage";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Auth } from '@/auth/auth';
import useSaveDataEffect from '@/utils/useSaveDataEffect';
import Saving from '../Saving/Saving';
import MinimizeIcon from '../../../public/icons/MinimizeIcon.png'
import CreateWrapper from '../Quick/CreateWrapper';
import UpIcon from '../../../public/icons/UpIcon.png'
import { DATA_TEMPLATES, getTemplateByCode } from '@/templates/template';
import CollapsibleMenu from '../CollapsibleMenu/CollapsibleMenu';


/*

NOT BASED ON ASSETS TABLE
unlike other SourceSelect.

It's common that a parent needs the selections, so we ask the parent to have the state, though they will be populated by this component.

Theme is light or dark – use depending on the expected background (changes search bar background, inter alia.).

*/

export default function PanelSourceSelect({ manifestRow, canEdit, resultLimit=10, onlyTemplates=[], selections, setSelections, selectionsLoadState, setSelectionsLoadState, showMinimize=false, minimized=false, setMinimized=()=>{}, theme="dark", allowUpload=false, ordered=false, saveCallback=()=>{}, selectorStyle={}, ...props }) {

    const { getToken } = Auth.useAuth()
    const [selectionsSaveState, setSelectionsSaveState] = useState(0)
    const [uploadNewClicked, setUploadNewClicked] = useState(false)

    async function getSources() {
        try {
            setSelectionsLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/sources-info?id=${manifestRow['id']}&ordered=${ordered ? 1 : 0}`
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken()
                },
                'method': 'GET'
            })
            
            const myJson = await response.json()

            if (myJson['response'] != 'success'){
                throw Error(`Response was not success: ${myJson[['reason']]}`)
            }

            const results = myJson['results']

            setSelections(results)

            setSelectionsLoadState(2)
        }
        catch(e) {
            console.log(e)
            setSelectionsLoadState(3)
        }
    }

    useEffect(() => {
        if (manifestRow?.id){
            getSources()
        }
    }, [manifestRow])

    const saveSelections = useCallback(async (selections) => {
        try {
            setSelectionsSaveState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/add-resources"
            const data = {
                'id': manifestRow['id'],
                'resource_ids': selections.map(x => x.id),
                'save_order': ordered
            }
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'body': JSON.stringify(data),
                'method': 'POST'
            })

            const myJson = await response.json()

            if (myJson['response'] != 'success'){
                throw Error(`Response was not success: ${myJson['reason']}`)
            }
            setSelectionsSaveState(2)
            saveCallback()
        }
        catch(e) {
            console.log(e)
            setSelectionsSaveState(3)
        }
    }, [manifestRow])
    useSaveDataEffect(selections, selectionsLoadState == 2 && canEdit && manifestRow, saveSelections, 0, setSelectionsSaveState)

    function makeRow(item, i){

        let iconImageSrc = AddIcon
        let included = selections.filter((x) => x.id == item.id).length > 0
        if (included){
            iconImageSrc = RemoveIcon
        }

        let iconImage = (
            <MyImage
                src={iconImageSrc}
                width={20}
                height={20}
                alt={"Toggle"}
                className="_clickable"
                onClick={() => {
                    if (included){
                        setSelections(selections.filter(x => x.id != item.id))
                    }
                    else {
                        setSelections([...selections, item])
                    }
                }}
            />
        )

        return (
            <LinkedSelectorItem style={selectorStyle} item={item} key={i} showButton={true} iconImage={iconImage} />
        )
    }

    function getUrl(page, text){
        let url = new URL(process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/manifest")
        let params = new URLSearchParams(url.search);
        const offset = resultLimit * (page - 1)
        let paramObj = {
            'search': text,
            'limit': resultLimit,
            'folders_first': 0,
            'recent_activity': 0,
            'isolated': text ? 0 : 1,
            'include_groups': 1,
            'offset': offset,
        }
        if (manifestRow){
            paramObj['exclude_ids'] = JSON.stringify([manifestRow.id])
        }
        if (onlyTemplates && onlyTemplates.length){
            paramObj['only_templates'] = JSON.stringify(onlyTemplates)
        }
        for (let key in paramObj) {
            params.append(key, paramObj[key]);
        }
        url.search = params.toString()
        return url
    }

    function handleUpload(asset) {
        if (asset){
            setSelections([...selections, asset])
            setUploadNewClicked(false)
        }
    }

    const allowUploadTemplates = useMemo(() => {
        let allowUploadTemplates = !onlyTemplates?.length ? DATA_TEMPLATES : DATA_TEMPLATES.filter((x) => onlyTemplates.includes(x))
        allowUploadTemplates = allowUploadTemplates.filter((x) => {
            const tmp = getTemplateByCode(x)
            return tmp.constructor.uploadable
        })
        return allowUploadTemplates
    }, [onlyTemplates])
    
    
    const allowUploadArea = (
        <div style={{'display': 'flex', 'flexWrap': 'wrap', 'gap': '10px', 'alignItems': 'center'}}>
            <div style={{'display': 'flex', 'alignItems': 'flex-end', 'height': '100%', 'gap': '5px'}}>
                <div onClick={() => setUploadNewClicked(!uploadNewClicked)} style={{'backgroundColor': 'var(--light-primary)', 'fontSize': '.9rem', 'padding': '5px 10px', 'border': '1px solid var(--light-border)', 'borderRadius': 'var(--small-border-radius)'}} className='_clickable'>
                    <div style={{'display': 'flex', 'gap': '5px', 'alignItems': 'center'}}>
                        {uploadNewClicked ? (
                            <MyImage src={MinimizeIcon} width={15} height={15} alt={"Minimize"} />
                        ) : (
                            <>
                                <div>
                                    Upload New
                                </div>
                                <MyImage src={AddIcon} width={15} height={15} alt={"Add"} />
                            </>
                        )}                   
                        
                    </div>
                </div>
                {uploadNewClicked ? (
                    allowUploadTemplates.map((x) => {
                        const tmp = getTemplateByCode(x)
                        return (
                            <div key={x}>
                                <CreateWrapper noRedirect={true} callback={handleUpload} className={styles.uploadDoc} style={theme == 'light' ? {'backgroundColor': 'var(--light-background)'} : {}} templateCode={x}>
                                    <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}}>
                                        {tmp.constructor.readableName}
                                        <MyImage src={tmp.constructor.icon} width={15} height={15} alt={tmp.constructor.readableName} />
                                    </div>
                                </CreateWrapper>
                            </div>
                        )
                    })
                ) : ""}
            </div>
        </div>
    )

    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '.5rem', 'overflow': 'scroll'}}>
            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'flex-start'}}>
                <div style={{'flex': '1'}}>
                    {
                        selections && selections.length ? (
                            <div style={{'display': 'flex', 'gap': '1rem', 'flexWrap': 'wrap'}}>
                                {selections.map((item, i) => {
                                    return (
                                        <LinkedSelectorItem
                                            style={selectorStyle}
                                            item={item}
                                            key={i}
                                            showButton={true}
                                            iconImage={(
                                                <MyImage
                                                    src={RemoveIcon}
                                                    alt={"Remove"}
                                                    width={20}
                                                    height={20}
                                                    className={"_clickable"}
                                                    onClick={() => {
                                                        setSelections(selections.filter(x => x.id != item.id))
                                                    }}
                                                /> 
                                            )}
                                        />
                                    )
                                })}
                                {
                                    allowUpload ? (
                                        allowUploadArea
                                    ) : ""
                                }
                            </div>
                        ) : (
                            <div>
                                {
                                    allowUpload ? (
                                        allowUploadArea
                                    ) : "No selections yet"
                                }
                            </div>
                        )
                    }
                </div>
                {showMinimize ? (
                    <MyImage src={MinimizeIcon} height={20} width={20} alt={"Minimize"} className={"_clickable"} onClick={() => setMinimized(true)} />
                ) : ""}
            </div>
            <Saving saveValueLoading={selectionsSaveState} />
            <Table
                searchBarStyle={theme == 'light' ? {'backgroundColor': 'var(--light-background)'} : {}}
                searchable={true}
                limit={resultLimit}
                paginated={true}
                makeRow={makeRow} 
                getUrl={getUrl}
                flexDirection="row"
                flexWrap="wrap"  />
        </div>
    )
}
