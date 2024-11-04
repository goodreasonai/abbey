import { useRef } from "react";
import { useEffect } from "react";
import styles from './Form.module.css'

export default function DateTimePicker({ value, setValue, outsideClickCallback, ...props }) {

    const myInputRef = useRef();

    useEffect(() => {

        const handleClickOutside = (event) => {
            if (myInputRef.current && !myInputRef.current.contains(event.target)) {
                outsideClickCallback()
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

    return (
        <input
            className={styles.dateTimePicker}
            ref={myInputRef}
            type="datetime-local"
            value={value}
            onChange={(e) => {setValue(e.target.value)}} {...props} />
    )
    
}
