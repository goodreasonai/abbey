import { useEffect, useRef, useState } from "react";
import styles from './Form.module.css'


const ResponsiveTextarea = ({ value, id, className, onKeyDown, ...props}) => {
    const textareaRef = useRef(null);
  
    const resizeTextArea = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }

    const handleKeyDown = (e) => {
        if(e.key === 'Tab') {
            e.preventDefault();
            const start = e.target.selectionStart;
            const end = e.target.selectionEnd;
            const value = e.target.value;

            e.target.value = `${value.substring(0, start)}\t${value.substring(end)}`;
            e.target.selectionStart = e.target.selectionEnd = start + 1;
        }
        if (onKeyDown) {
            onKeyDown(e)
        }
    }

    useEffect(() => {
        resizeTextArea();
    
        window.addEventListener('resize', resizeTextArea);
        return () => window.removeEventListener('resize', resizeTextArea);
    }, []);
    
    useEffect(() => {
        resizeTextArea()
    }, [value])

    return (
      <textarea
        ref={textareaRef}
        value={value}
        className={`${styles.responsiveTextarea} ${className ? className : ''}`}
        id={id}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
};
  
export default ResponsiveTextarea;
    
