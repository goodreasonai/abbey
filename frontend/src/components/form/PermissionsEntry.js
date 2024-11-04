import styles from './Form.module.css'
import MultiInputText from './MultiInputText';
import { ALLOW_PUBLIC_UPLOAD, ILLEGAL_SHARE_DOMAINS } from '@/config/config';
import MinimizeIcon from "../../../public/icons/MinimizeIcon.png"
import MyImage from '../MyImage/MyImage';
import CopyButton from '../CopyButton/CopyButton';
import FakeCheckbox from './FakeCheckbox';
import Info from '../Info/Info';

/*
optionsVar and setOptionsVar are state keeping track of the permissions entry
Object with keys "public" and "emailDomain"
*/
export default function PermissionsEntry({ className, optionsVar, setOptionsVar, handleMinimize, assetManifest, jointPermissions={'emailDomains': [], 'editDomains': [], 'users': []}, userIdsToEmails={}, containTooltips=false, ...props }) {
    
    let realClassName = `${styles.permissionsEntry}`
    if (className){
        realClassName += " " + className;
    }

    function onCheckChange(newVal){
        const newObj = { ...optionsVar, public: newVal };
        setOptionsVar(newObj);
    }

    // Remove the beginning @ sign if the person is entering a domain.
    function sanitize(x) {
        let realEmail = ''
        if (x[0] == '@'){
            realEmail = x.substring(1)
        }
        else {
            realEmail = x
        }
        if (ILLEGAL_SHARE_DOMAINS.includes(realEmail)){
            alert(`You can't set such broad permissions! Everyone with a ${realEmail} email could view this.`)
            return ""
        }
        return realEmail
    }

    if(!optionsVar){
        optionsVar = {public: 0, emailDomains: [], editDomains: []}
        setOptionsVar(optionsVar)
    }

    let emailDomainDisplay = (
        <div>                
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '10px'}}>
                <div>
                    Allow users with these emails or email domains:
                </div>
                <MultiInputText
                    value={optionsVar['emailDomains']}
                    setValue={(x) => {
                        const newEmailDomains = x.map(sanitize).filter((x) => x)
                        const newEditDomains = optionsVar.editDomains?.filter((x) => newEmailDomains.includes(x))
                        setOptionsVar({...optionsVar, editDomains: newEditDomains, emailDomains: x.map(sanitize).filter((x) => x)})
                    }}
                    optionalValueProps={{'value': optionsVar['editDomains'], 'setValue': (x) => {
                        setOptionsVar({...optionsVar, editDomains: x})  
                    }}}
                    optionalValueText='Make Editor'
                    noSelectionText={""}
                    placeholder={"e.g., 'team@us.ai' or just 'us.ai'"} />
            </div>
        </div>
    )

    let jointDisplay = ""
    const jointEmails = [...new Set([...(jointPermissions['emailDomains'] || []), ...(jointPermissions['editDomains'] || []), ...(jointPermissions['users'] || []).map((x) => userIdsToEmails[x])])].filter(x => x)
    if (jointEmails.length || jointPermissions.public){
        jointDisplay = (
            <div style={{'display': 'flex', 'flexWrap': 'wrap', 'gap': '10px', 'color': 'var(--passive-text)', 'fontSize': '.8rem'}}>
                {
                    jointEmails.length ? (
                        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}}>
                            <div>
                                Via parents:
                            </div>
                            <div style={{'display': 'flex', 'alignItems': 'center', 'flexWrap': 'wrap', 'gap': '5px'}}>
                                {jointEmails.map((item, i) => {
                                    return (
                                        <div key={item}>
                                            {item}
                                        </div>
                                    )
                                })}
                            </div>
                            <Info iconSize={15} iconStyle={{'opacity': '.5'}} text={"For example, if this asset is in a folder or a workspace that is shared with these people."} />
                        </div>
                    ) : ""
                }
                {
                    jointPermissions.public ? (
                        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                            This asset is public via a parent.
                            <Info iconSize={15} iconStyle={{'opacity': '.5'}} text={"For example, if this asset is in a folder or a workspace that is public."} />
                        </div>
                    ) : ""
                }
            </div>
        )
    }

    let fullUrl = ""
    if (assetManifest && assetManifest['id']) {
        fullUrl = process.env.NEXT_PUBLIC_ROOT_URL + `/assets/${assetManifest['id']}`
    }

    return (
        <div className={`${realClassName}`}>
            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'start'}}>
                {handleMinimize ? (
                    <div>
                        <MyImage src={MinimizeIcon} height={18} onClick={() => handleMinimize()} className="_clickable" alt='Close'/>
                    </div>
                ) : ""}
                <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '10px', 'fontSize': '.9rem'}}>
                    <div style={{'display': 'flex', 'gap': '1rem', 'alignItems': 'center', 'flexWrap': 'wrap'}}>
                        {
                            fullUrl ? (
                                <div style={{ 'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                                    <div>
                                        <CopyButton text={fullUrl} textToCopy={fullUrl} />
                                    </div>
                                </div>
                            ) : ""
                        }
                        {
                            (optionsVar.public || ALLOW_PUBLIC_UPLOAD) ? (
                                <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                                    Make Public: <FakeCheckbox setValue={onCheckChange} value={optionsVar.public} />
                                </div>
                            ) : ""
                        }
                    </div>
                    {emailDomainDisplay}
                    {jointDisplay}
                </div>
            </div>
        </div>
    );
  }
