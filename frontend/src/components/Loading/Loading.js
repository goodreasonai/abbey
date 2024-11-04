import LoadingIcon from '../../../public/icons/LoadingIcon.png'
import MyImage from '../MyImage/MyImage'
import { useEffect, useRef, useState } from 'react'
import styles from './Loading.module.css'


// No spin changes the look completely (to arrows) - needed for when an animation is distracting (i.e., saving text editor)
export default function Loading({text='Loading', noSpin=false, color='var(--dark-primary)', size=20, cute=false, flipped=false, gap='10px', flexExpand=false, style, ...props}){

    const [cuteText, setCuteText] = useState("Loading for you")  // only used when cute is true.
    const isMounted = useRef(false)

    useEffect(() => {
        isMounted.current = true
        async function cycleLoadingText(){
            const options = [
                'Working for esteemed user',
                'Loading for honored guest',
                'Computing for elite human',
                'Generating for honored user',
                'Working on it for you',
                'Multiplying numbers'
            ]

            while (isMounted.current){
                const randomIndex = Math.floor(Math.random() * options.length);
                setCuteText(options[randomIndex])
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        if (cute){
            cycleLoadingText()
        }

        return () => {
            isMounted.current = false
        }

    }, [cute, setCuteText])

    let textDisplay = (
        text || cute ? (
            <span style={flexExpand ? {'flex': '1'} : {}}>
                {cute ? cuteText : text}
            </span>
        ) : ""
    )

    let realStyle = {'display': 'flex', 'alignItems': 'center', 'gap': gap, ...style}
    
    const scaledThickness = size / 5.7.toFixed(2)

    const spinnerStyle = {
        width: size,
        height: size,
        borderTop: `${scaledThickness}px solid ${color}`,
        borderLeft: `${scaledThickness}px solid ${color}`,
    };

    return (
        <div style={realStyle} {...props}>
            {flipped ? textDisplay : ""} 
            {noSpin ? (
                <MyImage src={LoadingIcon} alt={"Loading"} height={size} width={size} />
            ) : (
                <div>
                    <div className={styles.loadingDiv} style={spinnerStyle}></div>
                </div>
            )}
            {!flipped ? textDisplay : ""}
        </div>
    )
}
