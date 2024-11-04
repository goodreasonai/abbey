import styles from './Form.module.css'
import { useState, useEffect } from 'react';


export default function InputText({ className, onChange, onFocus, onBlur, initialValue="", ...props }) {

    const [value, setValue] = useState(initialValue);


    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    let realClassName = `${styles.inputText}`
    if (className){
        realClassName += " " + className;
    }

    const handleChange = (e) => {
        setValue(e.target.value);
        if (onChange) onChange(e);
    }

    return (
      <input 
          type="text"
          className={`${realClassName}`}
          onChange={handleChange} 
          onFocus={onFocus} 
          onBlur={onBlur}
          value={value} 
          {...props}
      />
    );
  }
