
import styles from './Form.module.css'
import { useState, useEffect } from 'react';
import ControlledInputText from './ControlledInputText';
import AddIcon from '../../../public/icons/AddIcon.png'
import RemoveIcon from '../../../public/icons/RemoveIcon.png'
import UncheckedIcon from '../../../public/icons/UncheckedIcon.png'
import CheckedIcon from '../../../public/icons/CheckedIcon.png'
import Tooltip from '../Tooltip/Tooltip';
import MyImage from '../MyImage/MyImage';
import Loading from '../Loading/Loading';



// Controlled
// Value is meant to be a list
// "optionalExtraValueText" => dict from text to value, put next to text (good for "pending" or "saving")
export default function MultiInputText({ className, value, setValue, noSelectionText="None selected.", 
                                         placeholder="example.com", optionalExtraValueText={}, optionalValueProps={}, optionalValueText="",
                                         useLightPrimaryStyle=false, showLoading=false, ...props }) {

    if (!value){
        value = []
    }

    // Separate state because the user of this form isn't interested in this value (contents of the text input)
    const [inputValue, setInputValue] = useState("");

    const [toShow, setToShow] = useState(new Set(value))

    function addText(){
        setValue([...value, inputValue])
        setInputValue("");
    }

    function removeText(txt){
        if (optionalValueProps && Object.keys(optionalValueProps).length){
            optionalValueProps.setValue(optionalValueProps.value.filter((item) => item != txt))
        }
        setValue(value.filter((item) => item != txt))
    }

    function addTextOptional(txt){
        optionalValueProps.setValue([...optionalValueProps.value, txt])
    }

    function removeTextOptional(txt){
        optionalValueProps.setValue(optionalValueProps.value.filter((item) => item!=txt))
    }

    // could potentially be abstracted as a general additional button depending on the props passed
    const optionalStyling = (item) => {
        let hasEditPerms = optionalValueProps.value.includes(item)
        return (
            <div>
                {!hasEditPerms ? (
                    <Tooltip content={optionalValueText}>
                        <MyImage src={UncheckedIcon} id="MultiInputGiveEdit" width={15} height={15} alt={optionalValueText} onClick={() => addTextOptional(item)}/>
                    </Tooltip>
                ) : (
                    <Tooltip content={optionalValueText}>
                        <MyImage src={CheckedIcon} id="MultiInputRemoveEdit" width={15} height={15} alt={optionalValueText} onClick={() => removeTextOptional(item)}/>
                    </Tooltip>
                )}
            </div>
        )
}

    function makeSelected(item, i){
        return (
            <div key={i} style={{
                'display': 'flex', 'alignItems': 'center', 'color': 'var(--light-text)', 'gap': '10px', 'backgroundColor': 'var(--dark-primary)', 'borderRadius': 'var(--small-border-radius)',
            }}>
                <div style={{'padding': '7px', 'fontSize': '0.85em', 'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                    {item}
                    {optionalExtraValueText[item] || ""}
                </div>
                {Object.keys(optionalValueProps).length ? optionalStyling(item) : ("")}
                <Tooltip content='Remove'>
                    <MyImage src={RemoveIcon} style={{'marginRight': '10px'}} onClick={() => removeText(item)} width={15} height={15} id='MultiInputRemove' alt={"Remove"} />
                </Tooltip>
            </div>
        )
    }

    useEffect(() => {
        setToShow(new Set(value))
    }, [value])

    let relevantBackground = useLightPrimaryStyle ? 'var(--light-primary)' : 'var(--light-background)'

    return (
        <div className={`${styles.multiInputText} ${className}`} {...props}>
            <div style={{'display': 'flex', 'alignItems': 'stretch', 'maxWidth': '350px'}}>
                <ControlledInputText value={inputValue} setValue={setInputValue} placeholder={placeholder}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault(); // Prevents adding a new line in the textarea
                                addText()
                            }
                        }}
                        inputStyle={{'backgroundColor': relevantBackground, 'borderTopRightRadius': '0px', 'borderBottomRightRadius': '0px'}} />
                <div style={{'display': 'flex', 'padding': '0 10px', 'border': '1px solid var(--light-border)', 'borderTopRightRadius': 'var(--small-border-radius)', 'borderBottomRightRadius': 'var(--small-border-radius)', 'overflow': 'hidden', 'borderLeftWidth': '0px', 'alignItems': 'center', 'justifyContent': 'center', 'backgroundColor': relevantBackground}}
                    className={"_clickable"} onClick={addText} id='AddButtonMultiInput'>

                    {showLoading ? (
                        <Loading style={{'opacity': '.5'}} text="" />
                    ) : (
                        <MyImage style={{'opacity': '.5'}} src={AddIcon} width={20} height={20} alt={"Add"} />
                    )}
                </div>
                
            </div>
            {
                value && value.length > 0 ? (
                    <div style={{'display': 'flex', 'alignItems': 'center', 'flexWrap': 'wrap', 'gap': '10px'}}>
                        {[...toShow].map(makeSelected)}
                    </div>
                ) : (
                    noSelectionText ? noSelectionText : ""
                )
            }
            
        </div>
    );
  }