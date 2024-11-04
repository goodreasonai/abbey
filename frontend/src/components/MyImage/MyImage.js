import Image from 'next/image';
import styles from './MyImage.module.css'
import { useRef, useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useIsMobile } from '@/utils/mobile';

export default function MyImage({ src, canSwitch=true, noGoodAwfulProp=false, className, inDark=undefined, forceDark=false, onMobile=undefined, onMobileInDark=undefined, ...props }){

    const imageRef = useRef(null)
    const { theme } = useTheme()
    const { isMobile } = useIsMobile()

    const checkBackgroundColor = () => {
        if (!window || !imageRef.current){
            return
        }
        let element = imageRef.current
        let bgColor = window.getComputedStyle(element).backgroundColor;
    
        // Traverse up the DOM tree until a non-transparent/non-white background color is found
        while (bgColor === 'rgba(0, 0, 0, 0)') {
            if (element.parentElement) {
                element = element.parentElement;
                bgColor = window.getComputedStyle(element).backgroundColor;
            }
            else {
                break;
            }
        }
        
        // Extract luminescence

        // Extract the RGB values

        let l = 1

        // If it's not still transparent...
        if (bgColor !== 'rgba(0, 0, 0, 0)'){
            let mat = bgColor.match(/\d+/g)
            let [r, g, b] = mat ? mat.map(Number) : [250, 250, 250];
            r /= 255;
            g /= 255;
            b /= 255;
            let max = Math.max(r, g, b), min = Math.min(r, g, b);
            l = (max + min) / 2;
        }

        if (l > .7 && !forceDark) { // if background color is light
            imageRef.current.style.filter = 'invert(0%)';
        }
        else {
            imageRef.current.style.filter = 'invert(100%)';
        }
    }
    
    useEffect(() => {

        if (!canSwitch || !imageRef.current || !window){
            return
        }

        // Run the check when the component mounts
        checkBackgroundColor();

        // Do a double take to handle transitions...
        // Not great but alternatives are nasty.
        setTimeout(() => {checkBackgroundColor()}, 100)

        // Set up a mutation observer to watch for changes to the data-theme attribute
        const observer = new MutationObserver(checkBackgroundColor);
        observer.observe(document.documentElement, { attributes: true });

        // Clean up the observer when the component unmounts
        return () => observer.disconnect();
    }, [canSwitch, theme, imageRef.current, noGoodAwfulProp]);

    let realSrc = inDark && theme == 'dark' ? inDark : src
    if (isMobile && onMobileInDark && theme == 'dark'){
        realSrc = onMobileInDark
    }
    else if (onMobile && isMobile) {
        realSrc = onMobile
    }

    return <Image {...props} src={realSrc} className={`${styles.myImage} ${className}`} ref={imageRef} />;
}