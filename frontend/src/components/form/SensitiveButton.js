import { useState } from "react";
import Button from "./Button";
import Image from "next/image";
import RemoveIcon from '../../../public/icons/RemoveIcon.png'
import SyntheticButton from "./SyntheticButton";
import MyImage from "../MyImage/MyImage";

export default function SensitiveButton({ value, type, onClick, sensitiveText='Permanently delete?', ...props}){

    const [clicked, setClicked] = useState(false)
    const [submitted, setSubmitted] = useState(false);

    function doClick(){
        setSubmitted(true)
        onClick();
    }


    if (submitted){
        return (
            <div>
                Submitted
            </div>
        )
    }
    else if (clicked){
        return (
            <div style={{'display': 'flex', 'gap': '5px'}}>
                <Button value={sensitiveText} style={{'backgroundColor': 'var(--logo-red)'}} onClick={doClick} id='SensitivePermaDelete'/>
                <SyntheticButton value={(
                    <MyImage style={{'filter': 'invert(var(--inverted))'}} src={RemoveIcon} width={20} height={20} alt="Remove" />
                )} style={{'display': 'flex', 'alignItems': 'center'}} onClick={()=>setClicked(false)} id='SensitiveCancel'/>
            </div>
        )
    }
    else {
        return (
            <Button value={value} onClick={() => setClicked(true)} id='AssetEditDelete'/>
        )
    }
    
}
