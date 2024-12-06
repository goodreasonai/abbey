import { useState, useEffect, useRef } from 'react';
import styles from './Dropdown.module.css';
import ReactDOM from "react-dom";


// options = of the form [{'value': (...), 'onClick': (...)}, ...]
export default function Dropdown({className, options, value, optionsStyle={}, rightAlign=false, initialButtonStyle={}, openCallback=() => {}, closeCallback=() => {}, closeOnSelect=true, direction="down", forceClose, setForceClose, noShadow=false, ...props}) {
    const [selected, setSelected] = useState(false);
    const dropdownRef = useRef(null); // Added this line to create a reference to the dropdown
    const dropdownOptionsContainerRef = useRef(null)
    const initialButtonRef = useRef(null)

    const [coords, setCoords] = useState({}); // takes current button coordinates

    const realClassName = className ? `${styles.dropdown} ${className}` : `${styles.dropdown}`;

    function dropDropdown(){
        setSelected(false)
        setCoords({})
    }

    useEffect(() => {
        if (selected){
            openCallback()
        }
        else {
            closeCallback()
        }
    }, [selected])

    // Keeps track of position while the dropdown is open
    useEffect(() => {
        const updatePosition = () => {
            if (dropdownRef.current && selected) {
                const rect = dropdownRef.current.getBoundingClientRect();
                setCoords({ y: rect.top, x: rect.left, height: rect.height, width: rect.width });
            }
        };
        const observer = new MutationObserver(updatePosition);
        observer.observe(document.body, { childList: true, subtree: true });    
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition);
        return () => {
          observer.disconnect();
          window.removeEventListener('resize', updatePosition);
          window.removeEventListener('scroll', updatePosition);
        };
    }, [selected, dropdownRef]);

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
            if (dropdownOptionsContainerRef.current && !dropdownOptionsContainerRef.current.contains(event.target) && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                dropDropdown()
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
        
    }, [dropdownRef, selected, dropdownOptionsContainerRef]);

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
            dropDropdown()
        }
    }, [forceClose, setSelected])

    function onClickDropdown(){
        const rect = initialButtonRef.current.getBoundingClientRect();
        if (selected){
            dropDropdown()
        }
        else {
            setCoords({
                x: rect.x,
                y: rect.y,
                height: rect.height,
                width: rect.width
            });
            setSelected(true)
        }
    }

    return (
        <div ref={dropdownRef} className={realClassName} {...props}>
            <div ref={initialButtonRef} onClick={onClickDropdown} className={`${styles.initialButton} ${!noShadow ? styles.hasShadow : ''}`} style={{'cursor': 'pointer', ...initialButtonStyle}}>
                {value}
            </div>
            {
                selected && ReactDOM.createPortal(
                    <div
                        ref={dropdownOptionsContainerRef}
                        style={{
                            'position': 'fixed',
                            'top': direction === 'up' ? coords.y : coords.y + coords.height,
                            'left': rightAlign ? coords.x + coords.width : coords.x,
                            'transform': `translateY(${direction === 'up' ? '-100%' : '0%'}) translateX(${rightAlign ? '-100%' : '0px'})`,
                            'borderRadius': 'var(--medium-border-radius)',
                            'cursor': 'pointer',
                            ...optionsStyle
                        }}
                        className={`${styles.dropdownOptionsContainer}`}>
                        {selectables}
                    </div>
                , document.body)
            }
        </div>
    );
}
