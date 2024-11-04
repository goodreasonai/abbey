import Image from "next/image";
import InfoIcon from '../../../public/icons/InfoIcon.png'
import React, { useState, useRef } from 'react';
import MyImage from "../MyImage/MyImage";
import Tooltip from "../Tooltip/Tooltip";


export default function Info({ text, iconStyle={}, tooltipStyle={'width': '300px'}, iconSize=20, ...props }) {
    return (
        <Tooltip content={text} style={tooltipStyle} {...props}>
            <MyImage src={InfoIcon} alt={"Info"} height={iconSize} width={iconSize} style={iconStyle} />
        </Tooltip>
    );
}

