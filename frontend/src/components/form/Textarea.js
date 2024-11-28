import styles from './Form.module.css'
import { useState, useEffect, useRef } from 'react';


export default function Textarea({ className, value, setValue, onChange, autoFocus, onClickOutside, allowResize='both', style, ...props }) {

    const myRef = useRef(null)
    useEffect(() => {
        if (autoFocus && myRef.current){
            myRef.current.focus({preventScroll: 'true'})
        }
    }, [autoFocus, myRef.current])

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
      }, [onClickOutside, myRef.current]);

    const handleChange = (e) => {
        setValue(e.target.value);
        if (onChange) onChange(e);
    }

    // This paste listener solves one problem:
    // On Chrome, if you copy paste into a textarea something that has a trailing line break, the cursor may stay where it is or go up, rather than going to the end of the pasted section.
    // This code manually moves and focuses the cursor on paste to fix this particular browser bug (behavior doesn't exist on Safari).
    useEffect(() => {
        if (myRef.current){
            function listener(e){
                // Get the current cursor position before paste
                const startPos = myRef.current.selectionStart;
                const pastedText = e.clipboardData.getData('text');
                
                setTimeout(() => {
                    // Calculate where cursor should end up after paste
                    const newPos = startPos + pastedText.length;
                    
                    // Move cursor to end of pasted text
                    myRef.current.setSelectionRange(newPos, newPos);
                    
                    // Make sure the cursor is visible
                    myRef.current.blur();
                    myRef.current.focus();
                }, 0);
            }
            myRef.current.addEventListener('paste', listener);
            return () => {
                myRef.current?.removeEventListener('paste', listener)
            }
        }
    }, [myRef.current])
    

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
