import ControlledInputText from "./ControlledInputText";
import MagnifyingGlassIcon from '../../../public/icons/MagnifyingGlassIcon.png';
import SyntheticButton from "./SyntheticButton";
import EraseIcon from '../../../public/icons/EraseIcon.png';
import MyImage from "../MyImage/MyImage";
import { useState, useEffect, useRef } from 'react'
import styles from './Form.module.css'


export default function SearchBar({ value, setValue, getSearchResults, handleSearch, placeholder="Search...", textFieldStyle={}, searchOnErase=true, textFieldStretch=false, autoFocus=false, textInputStyle={}, size="large", containerStretch=true, ...props }) {

    const [autoFillOptions, setAutoFillOptions] = useState([]);
    const searchDropdownRef = useRef(null);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState(-1);
    const [showDropdown, setShowDropdown] = useState(true)   

    useEffect(() => {

        async function makeAutoFill(){
            if (!value){
                return
            }
            try {
                const res = await getSearchResults(value)
                setAutoFillOptions(res)
            }
            catch(e) {
                console.log(e)
                setAutoFillOptions([])
            }
        }

        if (showDropdown && getSearchResults){
            makeAutoFill()
        } else {
            setShowDropdown(true)
        }
    }, [value])

    useEffect(() => {
        function handleClickOutside(event) {
            if ((searchDropdownRef.current && !searchDropdownRef.current.contains(event.target))) {
                setAutoFillOptions([])
                setShowDropdown(false);
            }
        }
        // Add the listener for mousedown
        document.addEventListener("mousedown", handleClickOutside);

        // Cleanup - remove the listener when the component unmounts
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [setShowDropdown]);

    const handleKeyDown = event => {
        const container = searchDropdownRef.current;
        let currentItem; 

        switch (event.keyCode) {
            case 38: //up
                if (container){
                    setSelectedOptionIndex(prevIndex => {
                        const nextInd = Math.max(prevIndex - 1, -1)
                        currentItem = container.children[nextInd];
                        if (currentItem && currentItem.offsetTop < container.scrollTop) {
                            container.scrollTop = currentItem.offsetTop;
                        }
        
                        return nextInd;
                    })
                };
                break;
            case 40: //down
                if (container) {
                    setSelectedOptionIndex(prevIndex => {
                        if (prevIndex >= container.children.length - 1){
                            return prevIndex
                        }
                        const nextInd = Math.min(prevIndex + 1, autoFillOptions.length - 1)
                        currentItem = container.children[nextInd];
                        if (currentItem) {
                            const bottomOfItem = currentItem.offsetTop + currentItem.offsetHeight;
                            if (bottomOfItem > container.scrollTop + container.clientHeight) {
                                container.scrollTop = bottomOfItem - container.clientHeight;
                            }
                        }
                        return nextInd
                    
                    })
                }
                break;
            case 13: //enter
                if (selectedOptionIndex !== -1) {
                    handleSearch(autoFillOptions[selectedOptionIndex].title)
                    setValue(autoFillOptions[selectedOptionIndex].title)
                }
                else {
                    //event.preventDefault() // I don't remember why we prevented default here
                    handleSearch(value)
                }
                setAutoFillOptions([])
                setShowDropdown(false)                
                setSelectedOptionIndex(-1)
                break;

        }
    }

    function erase(){
        setValue("")
        if (searchOnErase){
            handleSearch("")
        }
    }

    let iconSize = 20
    let iconPadding = {}
    if (size == 'small'){
        textInputStyle['fontSize'] = '.8rem'
        textInputStyle['padding'] = '5px'
        iconSize = 15
        iconPadding = {'padding': '5px 10px'}
    }

    let extraBorderRadiusStyle = value ? {'borderTopRightRadius': '0px', 'borderBottomRightRadius': '0px'} : {}  // for the magnifying glass while there's an erase icon

    return (
        <div style={{'display': 'flex', 'alignItems': 'stretch', ...(containerStretch ? {'flex': '1'} : {})}} {...props}>
            <div style={{'position': 'relative', 'flexGrow': '1', 'maxWidth': textFieldStretch ? 'unset' : '20em', 'display': 'flex', 'flexDirection': 'column'}}>
                <ControlledInputText
                    autoFocus={autoFocus}
                    value={value}
                    setValue={setValue}
                    placeholder={placeholder}
                    style={{'flex': '1', ...textFieldStyle}}
                    inputStyle={{'border': '1px solid var(--light-border)', 'borderRightWidth': '0px', 'borderTopRightRadius': '0px', 'borderBottomRightRadius': '0px', ...textInputStyle}}
                    onKeyDown={handleKeyDown} />

                {value && autoFillOptions && autoFillOptions.length && showDropdown ? (
                    <div className={`${styles.autoFillContainer}`} ref={searchDropdownRef}>
                        {autoFillOptions.map((option, index) => (
                            <div 
                                key={option.id} 
                                className={`${styles.autoFillOption} ${index === selectedOptionIndex ? styles.highlightedAutoFillOption : ''}`} 
                                onClick={() => {
                                    setValue(option.title)
                                    setShowDropdown(false)  
                                    handleSearch(option.title);
                                    setAutoFillOptions([]);
                            }}>
                                <div style={{'display': 'flex', 'gap': '5px'}} title={`${option.title} ${option.preview_desc}`}>
                                    <div className={`${styles.autoFillOptionTitle} _clamped1`}>
                                        {option.title}
                                    </div>
                                    <div className={`${styles.autoFillOptionDesc} _clamped1`}>
                                        {option.preview_desc}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : ("")}
            </div>

            <SyntheticButton style={{'display': 'flex', 'alignItems': 'center', ...extraBorderRadiusStyle, 'borderTopLeftRadius': '0px', 'borderBottomLeftRadius': '0px', ...iconPadding}} value={(
                <MyImage alt={"Search"} src={MagnifyingGlassIcon} width={iconSize} height={iconSize} />
            )} onClick={() => handleSearch(value)} />
            {value ? (
                <SyntheticButton style={{'display': 'flex', 'alignItems': 'center', 'borderTopLeftRadius': '0px', 'borderBottomLeftRadius': '0px', ...iconPadding}} value={(
                    <MyImage alt={"Erase"} src={EraseIcon} width={iconSize} height={iconSize} />
                )} onClick={erase} />
            ) : ("")}
        </div>
    )
}
