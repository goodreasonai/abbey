import CopyIcon from '../../../public/icons/CopyIcon.png'
import CopySelectedIcon from '../../../public/icons/CopySelectedIcon.png'
import ClipboardIcon from '../../../public/icons/ClipboardIcon.png'
import ClipboardCheckIcon from '../../../public/icons/ClipboardCheckIcon.png'

import Image from 'next/image'
import styles from './CopyButton.module.css'
import { useState } from 'react'
import MyImage from '../MyImage/MyImage'
import Tooltip from '../Tooltip/Tooltip'

// Note: noFlicker is a hacky way if the text keeps updating to keep the icon from flickering by disabling the auto detect color flip (and always setting it to inverted)
export default function CopyButton({ text="", textToCopy="", iconSize=20, grayed=true, noFlicker=false, stopPropgation=false, noTooltip=false, ...props }){

    const [copied, setCopied] = useState(false)

    function makeCopy(e){
        if (stopPropgation){
            e.stopPropagation()
        }
        navigator.clipboard.writeText(textToCopy)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px', ...(grayed ? {} : {'opacity': '1'})}} className={copied ? styles.imgSelected : styles.img} onClick={makeCopy}>
            {text ? (<div>
                {text}
            </div>) : ""}
            {!noTooltip ? (
                <Tooltip content={"Copy to clipboard"}>
                    <MyImage canSwitch={!noFlicker} style={noFlicker ? {'filter': 'invert(100%)'} : {}} src={copied ? ClipboardCheckIcon : ClipboardIcon} width={iconSize} height={iconSize} alt="Copy" />
                </Tooltip>
            ) : (
                <MyImage canSwitch={!noFlicker} style={noFlicker ? {'filter': 'invert(100%)'} : {}} src={copied ? ClipboardCheckIcon : ClipboardIcon} width={iconSize} height={iconSize} alt="Copy" />
            )}
            
        </div>
    )
}
