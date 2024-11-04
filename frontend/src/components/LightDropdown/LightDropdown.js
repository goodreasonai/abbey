import { useRef, useState, useEffect } from "react"
import ReactDOM from "react-dom";
import styles from './LightDropdown.module.css'

export default function LightDropdown({ value, options, direction, optionsStyle, rightAlign=false, closeOnClick=true, ...props }) {

    const [showDropdown, setShowDropdown] = useState(false)
    const [coords, setCoords] = useState({}); // takes current button coordinates
    const dropdownRef = useRef()
    const dropdownOptionsRef = useRef()

    function dropDropdown(){
        setShowDropdown(false)
        setCoords({})
    }

    function onClickDropdown(e){
        const rect = e.target.getBoundingClientRect();
        if (showDropdown){
            dropDropdown()
        }
        else {
            setCoords({
                x: rect.x,
                y: rect.y,
                height: rect.height
            });
            setShowDropdown(true)
        }
    }

    // Keeps track of position while the dropdown is open
    useEffect(() => {
        const updatePosition = () => {
            if (dropdownRef.current && showDropdown) {
                const rect = dropdownRef.current.getBoundingClientRect();
                setCoords({ y: rect.top, x: rect.left, height: rect.height });
            }
        };    
        updatePosition();    
        const observer = new MutationObserver(updatePosition);
        observer.observe(document.body, { childList: true, subtree: true });    
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition);
        return () => {
          observer.disconnect();
          window.removeEventListener('resize', updatePosition);
          window.removeEventListener('scroll', updatePosition);
        };
    }, [showDropdown, dropdownRef]);

    // This effect runs once on component mount and sets up the event listener for clicks
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownOptionsRef.current && !dropdownOptionsRef.current.contains(event.target) && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                dropDropdown()
            }
        }
        if (showDropdown){
            document.addEventListener("mousedown", handleClickOutside);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
        
    }, [dropdownOptionsRef, showDropdown, dropdownRef]);

    useEffect(() => {
        if (!rightAlign && showDropdown && dropdownOptionsRef.current) {
            const rect = dropdownOptionsRef.current.getBoundingClientRect();
            try {
                // TODO
            }
            catch(e) {
                console.log(e)
                // probably couldn't get window
            }
        }
    }, [showDropdown]);

    return (
        <div {...props} ref={dropdownRef}>
            <div className={!showDropdown ? "_touchableOpacity" : "_clickable"} onClick={onClickDropdown}>
                {value}
            </div>
            {showDropdown && ReactDOM.createPortal(
                <div
                    style={{
                        'position': 'fixed',
                        'top': direction === 'up' ? coords.y : coords.y + coords.height,
                        'left': coords.x,
                        'transform': `translateY(${direction === 'up' ? '-100%' : '0%'})`,
                        'backgroundColor': 'var(--light-primary)',
                        'border': '1px solid var(--light-border)',
                        'borderRadius': 'var(--medium-border-radius)',
                        'padding': '5px',
                        'zIndex': 1
                    }}
                    ref={dropdownOptionsRef}
                >
                    {options.map((item) => {
                        function onOptionClick(){
                            if (item.onClick && !item.unavailable){
                                item.onClick()
                                if (closeOnClick){
                                    dropDropdown()
                                }
                            }
                        }
                        return (
                            <div className={`${item.unavailable ? styles.unavailable : styles.option}`} style={{...optionsStyle}} key={item.value} onClick={onOptionClick}>
                                {item.value}
                            </div>
                        )
                    })}
                </div>,
                document.body
            )}
        </div>
    )
}
