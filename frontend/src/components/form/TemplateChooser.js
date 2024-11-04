import styles from './Form.module.css'
import { POPULAR_TEMPLATES, TEMPLATES } from '@/templates/template';
import React, { useState, useEffect } from 'react';
import Image from 'next/image'
import { useRef } from 'react';
import MyImage from '../MyImage/MyImage';
import Loading from '../Loading/Loading';
import Tooltip from '../Tooltip/Tooltip';
import StarIcon from '../../../public/icons/StarIcon.png';
import Info from '../Info/Info';
import InfinityIcon from '../../../public/icons/InfinityIcon.png'
import Link from 'next/link';
import { UPGRADE_SUBSCRIPTION_LINK } from '@/config/config';

export const tmpToBox = (tmp) => {
    return {
        name: tmp.constructor.readableName,
        value: tmp.constructor.code,
        description: tmp.constructor.description,
        icon: tmp.constructor.icon
    }
}


export default function TemplateChooser({value, setValue, allowedTemplates=[], hiddenTemplates=[], onChange, canChange=true, totalLimit, totalUserCount, assetCountsLoadState, ...props }) {

    const isLoaded = allowedTemplates && allowedTemplates.length

    let popularBoxes = []
    let disallowedBoxes = []
    let otherBoxes = []
    for (let tmp of TEMPLATES){
        if (tmp.constructor.uploadable){
            if (allowedTemplates.includes(tmp.constructor.code)){
                let accounted = false
                if (POPULAR_TEMPLATES.includes(tmp.constructor.code)){
                    popularBoxes.push(tmpToBox(tmp))
                    accounted = true
                }
                if (!accounted){
                    otherBoxes.push(tmpToBox(tmp))
                }
            }
            else {
                disallowedBoxes.push(tmpToBox(tmp))
            }
        }
    }

    const handleBoxClick = (templateValue) => {
        if (!canChange){
            return
        }
        setValue(templateValue);
        if (onChange) onChange(templateValue);
    }

    let popularDisplay = popularBoxes.map((template, i) => (
        <div 
            key={i} 
            className={`${styles.templateBox} ${value === template.value ? `${styles.selectedTemplate}` : ``}`}
            onClick={() => handleBoxClick(template.value)}
        >
            <div style={{'display': 'flex', 'alignItems': 'center'}}>
                <div style={{'flex': '1'}}>
                    {template.name}
                </div>
                {/* This canSwith false is bad, but unfortunately the switching background + transitions complicate MyImage.
                        See the CSS for the really bad part. */}
                <MyImage canSwitch={false} style={template.value == value ? {'filter': 'invert(100%)'} : {}} height={36} width={36} src={template.icon} alt={`${template.name} icon`} className={`${styles.templateIcon}`} />
            </div>
            <div style={{'flex':'1'}}></div>
            
            <p className={styles.templateDescription}>{template.description}</p>
        </div>
    ))

    let othersDisplay = otherBoxes.map((template, i) => (
        <Tooltip content={template.description} style={{'width': '200px', 'fontSize': '.8rem'}} key={i}>
            <div 
                className={`${styles.smallTemplateBox} ${value === template.value ? styles.selectedTemplate : ''}`}
                onClick={() => handleBoxClick(template.value)}
            >
                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                    <div style={{'flex': '1'}}>
                        {template.name}
                    </div>
                    {/* This canSwith false is bad, but unfortunately the switching background + transitions complicate MyImage.
                            See the CSS for the really bad part. */}
                    <MyImage
                        canSwitch={false}
                        style={template.value == value ? {'filter': 'invert(100%)', 'padding': '0px'} : {'padding': '0px'}}
                        height={20}
                        width={20}
                        src={template.icon}
                        alt={`${template.name} icon`}
                        className={`${styles.templateIcon}`} />
                </div>            
            </div>
        </Tooltip>
    ))
    
    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}} {...props}>
            <div style={{'fontSize': '1.5rem'}}>
                Choose a Template
            </div>
            <div className={styles.templateGroupingsContainer} style={{'flex': '1'}}>
                {!isLoaded ? (
                    <Loading />
                ) : (
                    <>
                        <div style={{'display': 'flex', 'flexWrap': 'wrap', 'gap': '2rem', 'flex': '1', 'minWidth': '50%'}}>
                            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '8px', 'fontSize': '1rem'}}>
                                    <div>
                                        Most Popular
                                    </div>
                                    <MyImage src={StarIcon} width={20} height={20} alt={"Star"} />
                                </div>
                                <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'stretch', 'flexWrap': 'wrap'}}>
                                    {popularDisplay}
                                </div>
                            </div>
                        </div>
                        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                            <div>
                                Others
                            </div>
                            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'stretch', 'flexWrap': 'wrap'}}>
                                {othersDisplay}
                            </div>
                        </div>
                    </>
                )}
            </div>
            <div style={{'position': 'absolute', 'right': '10px', 'top': '10px', 'backgroundColor': 'var(--light-background)', 'padding': '5px 10px', 'color': 'var(--dark-text)', 'borderRadius': 'var(--small-border-radius)', 'border': '1px solid var(--light-border)'}}>
                {assetCountsLoadState != 2 ? (
                    <Loading text="" />
                ) : (
                    <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                        {totalLimit == 'inf' ? (
                            <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}}>
                                <div>
                                    {`${totalUserCount} /`}
                                </div>
                                <MyImage src={InfinityIcon} width={20} height={20} alt={"Infinity"} />
                            </div>
                        ) : `${totalUserCount} / ${totalLimit}`}
                        <Info iconSize={15} text={totalLimit == 'inf' ? 'Thanks to your subscription, you have unlimited uploads.' : `You have used ${totalUserCount} of your allowed ${totalLimit} uploads. Upgrade in Settings for more.`} />
                    </div>
                )}
            </div>
            {assetCountsLoadState == 2 && totalLimit != 'inf' && totalUserCount >= totalLimit ? (
                <div style={{'position': 'absolute', 'top': '0px', 'right': '0px', 'left': '0px', 'bottom': '0px', 'backgroundColor': 'rgba(var(--light-primary-rgb), .7)', 'zIndex': '11', 'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center'}}>
                    <div style={{'backgroundColor': 'var(--light-primary)', 'padding': 'var(--std-margin)', 'borderRadius': 'var(--large-border-radius)', 'border': '1px solid var(--light-border)', 'fontSize': '1.25rem', 'textAlign': 'center', 'lineHeight': '2rem'}}>
                        You have used all of your available uploads! <br/> Upgrade your subscription <Link style={{'textDecoration': 'underline'}} href={UPGRADE_SUBSCRIPTION_LINK}>here</Link>.
                    </div>
                </div>
            ) : ""}
        </div>
    );

}