import styles from './Form.module.css';
import { useState, useEffect, useRef } from 'react';

/*
The original InputText was dumb and stupid
This lets you pass state through to the input text field rather than deal with the onChange yourself
*/
export default function ControlledInputText({ className, value, setValue, outsideClickCallback, placeholder="", maxChar=undefined, autoFocus=false, inputStyle={}, allCaps=false, ...props }) {

    const myInputRef = useRef();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (myInputRef.current && !myInputRef.current.contains(event.target)) {
                outsideClickCallback();
            }
        };

        if (outsideClickCallback){
            // Attach the listeners on component mount.
            document.addEventListener('mousedown', handleClickOutside);
            // Detach the listeners on component unmount.
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [value]);

    useEffect(() => {
        if (autoFocus){
            myInputRef.current.focus({preventScroll: 'true'});
        }
    }, [autoFocus]);

    const handleChange = (e) => {
        if (allCaps && e.target.value){
            setValue(e.target.value.toUpperCase())
        }
        setValue(e.target.value);
    }

    const realInputStyle = {...inputStyle}
    const charCountStyle = {}
    if (maxChar){
        realInputStyle['borderRightWidth'] = '0px'
        realInputStyle['borderTopRightRadius'] = '0px'
        realInputStyle['borderBottomRightRadius'] = '0px'
        if (realInputStyle['backgroundColor']){
            charCountStyle['backgroundColor'] = realInputStyle['backgroundColor']
        }
    }
    
    if (allCaps){
        realInputStyle["textTransform"] = "uppercase"
    }

    return (
      <div className={`${styles.inputTextContainer} ${className}`} {...props}>
            <input 
                type="text"
                className={`${styles.inputText}`}
                onChange={handleChange} 
                value={value} 
                ref={myInputRef}
                style={realInputStyle}
                placeholder={placeholder}
                {...(maxChar ? {maxLength: maxChar} : {})}
            />
            {maxChar && (
                <div className={styles.charCount} style={charCountStyle}>
                    {value.length}/{maxChar}
                </div>
            )}
      </div>
    );
}
