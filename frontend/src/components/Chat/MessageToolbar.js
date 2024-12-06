import FakeCheckbox from "../form/FakeCheckbox"
import MyImage from "../MyImage/MyImage"
import Dropdown from "../Dropdown/Dropdown"
import styles from './Chat.module.css'
import ImageIcon from '../../../public/icons/ImageIcon.png'
import RangeSlider from "../form/RangeSlider"
import Loading from "../Loading/Loading"
import Tooltip from "../Tooltip/Tooltip"
import Info from "../Info/Info"
import { useRef } from "react"
import DiceIcon from '../../../public/icons/DiceIcon.png'
import RemoveIcon from '../../../public/icons/RemoveIcon.png'
import MenuIcon from '../../../public/icons/MenuIcon.png'
import LightDropdown from "../LightDropdown/LightDropdown"
import { getModKey } from "@/utils/keyboard"
import { DISABLE_WEB } from "@/config/config"


export default function MessageToolbar({ detached, selectedModel, selectedSearchEngine, item, canEdit, isLoading, isAnswering, toggleUseWeb, suggestQuestion, suggestLoadingState, removeChat, setImages, toggleDetached, userModelLoadingState, userModelOptions, setUserChatModel, userSearchEngineLoadingState, userSearchEngineOptions, setUserSearchEngine, dropdownGoesUp, showUseWebTooltip }) {

    const fileRef = useRef()

    let modelsDropdown = ""
    if (!selectedModel || !selectedModel.name){
        modelsDropdown = ""
    }
    else if (userModelLoadingState != 2){
        modelsDropdown = (
            <Loading text="" size={15} />
        )
    }
    if (userModelLoadingState == 2){
        modelsDropdown = (
            <LightDropdown
                style={{'fontSize': '.9rem'}}
                value={(selectedModel?.name)}
                optionsStyle={{'fontSize': '.9rem'}}
                options={userModelOptions.map((item) => {return {'value': item.name, 'onClick': ()=>{setUserChatModel(item)}, 'unavailable': !item.available}})}
                direction={dropdownGoesUp ? "up" : 'down'}
            />
        )
    }
    else if (userModelLoadingState == 3){
        modelsDropdown = ("Can't use chat")
    }

    let webSearchCheckbox = <FakeCheckbox value={item.useWeb ? true : false} checkedOpacity="1" iconSize={15} setValue={detached ? toggleUseWeb : ()=>{}} />
    let webSearchArea = ""
    if (!selectedSearchEngine || !selectedSearchEngine.name){
        webSearchArea = ""
    }
    else if (userSearchEngineLoadingState != 2 || !userSearchEngineOptions?.length){
        webSearchArea = (
            <Loading text="" size={15} />
        )
    }
    if (userSearchEngineLoadingState == 2 && userSearchEngineOptions?.length){
        webSearchArea = (
            <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}}>
                <div className={styles.detachButton}>
                    {userSearchEngineOptions?.length === 1 ? ("Use Web") : (
                        <LightDropdown
                            style={{'fontSize': '.9rem'}}
                            value={(selectedSearchEngine?.name)}
                            optionsStyle={{'fontSize': '.9rem'}}
                            options={userSearchEngineOptions.map((item) => {return {'value': item.name, 'onClick': ()=>{setUserSearchEngine(item)}, 'unavailable': !item.available}})}
                            direction={dropdownGoesUp ? "up" : 'down'}
                        />
                    )}
                </div>
                {showUseWebTooltip ? (
                    <Tooltip content={`${getModKey()} i`}>
                        {webSearchCheckbox}
                    </Tooltip>
                ) : (webSearchCheckbox)}
            </div>
        )
    }
    else if (userSearchEngineLoadingState == 3){
        webSearchArea = ("")
    }
    

    let greenDot = (
        <div style={{'position': 'absolute', 'width': 10, 'height': 10, 'backgroundColor': 'var(--dark-primary)', 'borderRadius': 5, 'bottom': -3, 'left': -3, 'borderColor': 'var(--light-primary)', 'borderWidth': '1px', 'borderStyle': 'solid'}}></div>
    )

    let attachImageArea = selectedModel && selectedModel.accepts_images ? (
        <div style={{'display': 'flex', 'alignItems': 'center', 'position': 'relative'}}>
            <MyImage className={"_touchableOpacity"} onClick={() => attachImageClick()} src={ImageIcon} width={15} height={15} alt={"image"} />
            {item.images?.length ? greenDot : ""}
            <input accept="image/png, image/jpeg, image/gif" type="file" style={{'display': 'none'}} ref={fileRef} onChange={handleFileChange} />
        </div>
    ) : ""

    let deleteArea = (canEdit && !isLoading && !isAnswering && removeChat) ? (
        <MyImage alt={"Remove"} src={RemoveIcon} width={15} height={15} onClick={removeChat} className={"_touchableOpacity"} />
    ) : ""

    function attachImageClick() {
        if (fileRef.current) {
            fileRef.current.click();
        }
    };

    async function handleFileChange(event) {
        const file = event.target.files[0];
        if (file) {
            const readFileAsBase64 = (file) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        resolve(reader.result);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            };

            let imageBase64 = await readFileAsBase64(file)
            setImages([imageBase64])
            fileRef.current.value = ""  // clears the file input so that if the component re mounts (i.e., quick create new chat) this function still gets called if the same image is uploaded.
        }
    };


    let suggestQuestionArea = (
        <div onClick={suggestQuestion}>
            {suggestLoadingState == 1 ? (
                <Loading size={17} text="" />
            ) : (
                <Tooltip align="right" tooltipStyle={{'width': '200px'}} content={"Suggest a question based on the source"} verticalAlign="bottom">
                    <div className={`${styles.suggestIcon}`} >
                        <MyImage src={DiceIcon} width={17} height={17} alt={"Dice"} />
                        <span className="_clamped1">Suggest Question</span>
                    </div>
                </Tooltip>
            )}
        </div>
    )
    let detachedArea = (
        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}}>
            <div className={styles.detachButton}>
                Detached
            </div>
            <FakeCheckbox value={item.detached ? true : false} checkedOpacity="1" iconSize={15} setValue={()=>{}} />
            <Info iconStyle={{'width': '15px', 'height': '15px'}} text="Temporarily force the AI to ignore your attached source document" />
        </div>
    )

    // In detached chat: show only web search
    // If not detached chat: Show suggest + dropdown
    return (
        <div>
            {detached ? (
                <div style={{'display': 'flex', 'flex': '1', 'alignItems': 'center', 'flexWrap': 'wrap', 'gap': '10px', 'color': 'var(--passive-text)'}}>
                    {!DISABLE_WEB ? webSearchArea : ""}
                    {modelsDropdown}
                    <div style={{'flex': '1'}}></div>
                    {attachImageArea}
                    {deleteArea}
                </div>
            ) : (
                <div style={{'display': 'flex', 'alignItems': 'center', 'flexWrap': 'wrap', 'gap': '10px'}}>
                    {modelsDropdown}
                    <div style={{'display': 'flex', 'flex': '1', 'alignItems': 'center'}}>
                        {suggestQuestionArea}
                    </div>
                    {attachImageArea}
                    <Dropdown
                        initialButtonStyle={{'all': 'unset', 'display': 'flex', 'alignItems': 'center'}}
                        value={
                            <div style={{'display': 'flex', 'alignItems': 'center', 'position': 'relative', 'cursor': 'pointer'}}>
                                <MyImage src={MenuIcon} width={17} height={17} alt={"Menu"} />
                                {item.useWeb || item.detached ? greenDot : ""}
                            </div>
                        }
                        rightAlign={true}
                        closeOnSelect={false}
                        options={[
                            ...(!DISABLE_WEB ? [{'value': webSearchArea, 'onClick': toggleUseWeb}] : []),
                            {'value': detachedArea, 'onClick': toggleDetached},
                        ]}
                        direction={dropdownGoesUp ? 'up' : 'down'}
                    />
                    {deleteArea}
                </div>
            )}
        </div>
    )
}
