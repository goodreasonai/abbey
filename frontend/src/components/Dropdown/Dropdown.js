import { useState, useEffect, useRef } from 'react';
import styles from './Dropdown.module.css';


// options = of the form [{'value': (...), 'onClick': (...)}, ...]
export default function Dropdown({className, options, value, optionsStyle={}, rightAlign=false, initialButtonStyle={}, openCallback=() => {}, closeCallback=() => {}, closeOnSelect=true, direction="down", forceClose, setForceClose, ...props}) {
    const [selected, setSelected] = useState(false);
    const dropdownRef = useRef(null); // Added this line to create a reference to the dropdown
    const dropdownOptionsContainerRef = useRef(null)

    const realClassName = className ? `${styles.dropdown} ${className}` : `${styles.dropdown}`;

    useEffect(() => {
        if (selected){
            openCallback()
        }
        else {
            closeCallback()
        }
    }, [selected])

    function makeOptions(item, i){

        if (!item.unavailable){
            function myOnClick(){
                if (item.onClick){
                    item.onClick()
                    if (closeOnSelect){
                        setSelected(false)
                    }
                }
            }
    
            return (
                <div key={i} className={`${styles.dropdownOption}`} style={item.style || {}} onClick={myOnClick}>
                    {item.value}
                </div>
            );
        }
        else {
            return (
                <div key={i} className={`${styles.dropdownOptionUnavailable}`}>
                    {item.value}
                </div>
            );
        }
    }

    const selectables = options.map(makeOptions);

    // This effect runs once on component mount and sets up the event listener for clicks
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setSelected(false);
            }
        }
        if (selected){
            // Add the listener for mousedown
            document.addEventListener("mousedown", handleClickOutside);

            // Cleanup - remove the listener when the component unmounts
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
        
    }, [dropdownRef, selected]);

    useEffect(() => {
        if (!setForceClose){
            return
        }
        if (!selected){
            setForceClose(false)
        }
    }, [selected, setForceClose])

    useEffect(() => {
        if (!setForceClose){
            return
        }
        if (forceClose){
            setSelected(false)
        }
    }, [forceClose, setSelected])

    useEffect(() => {
        if (!rightAlign && selected && dropdownOptionsContainerRef.current) {
            const rect = dropdownOptionsContainerRef.current.getBoundingClientRect();
            try {
                if (rect.right > window.innerWidth) {
                    dropdownOptionsContainerRef.current.style.right = '0px';
                } else {
                    dropdownOptionsContainerRef.current.style.right = '';
                }
            }
            catch(e) {
                // probably couldn't get window
            }
        }
    }, [selected]);

    return (
        <div ref={dropdownRef} className={realClassName} {...props}>
            <div onClick={() => setSelected(!selected)} className={styles.initialButton} style={initialButtonStyle}>
                {value}
            </div>
            {
                selected ? (
                    <div
                        ref={dropdownOptionsContainerRef}
                        style={{
                        'position': 'absolute',
                            ...(rightAlign ? {'right': '0'} : {}),
                            ...(direction == 'up' ? {'transform': 'translateY(-100%)', 'top': '0px'} : {}),
                            ...optionsStyle}}
                        className={`${styles.dropdownOptionsContainer}`}>
                        {selectables}
                    </div>
                ) : ""
            }
        </div>
    );
}
