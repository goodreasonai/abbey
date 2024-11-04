import styles from './Form.module.css'
import { useState, useEffect, useRef } from 'react';


export default function Textarea({ className, value, setValue, onChange, autoFocus, onClickOutside, allowResize='both', style, ...props }) {

    const myRef = useRef(null)
    useEffect(() => {
        if (autoFocus){
            myRef.current.focus({preventScroll: 'true'})
        }
    }, [autoFocus])

    useEffect(() => {
        function handleClickOutside(event) {
            if (myRef.current && !myRef.current.contains(event.target)) {
                if (onClickOutside){
                    onClickOutside();
                }
            }
        }    
        document.addEventListener('mousedown', handleClickOutside);    
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
      }, [onClickOutside]);

    const handleChange = (e) => {
        setValue(e.target.value);
        if (onChange) onChange(e);
    }

    return (
      <textarea 
          className={`${styles.textArea} ${className}`}
          style={{...style, 'resize': allowResize}}
          onChange={handleChange} 
          value={value} 
          ref={myRef}
          {...props}
      />
    );
  }
