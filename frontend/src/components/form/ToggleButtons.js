import Button from "./Button"
import SyntheticButton from "./SyntheticButton"
import styles from './Form.module.css'
import Image from "next/image"
import MyImage from "../MyImage/MyImage"

// theme is default (light primary + dark primary) or light (light primary + light highlight)
export default function ToggleButtons({ options, value, setValue, theme='default', ...props }) {

    function makeOption(item, i) {

        let realClass = ``
        if (value != item.value){
            realClass = theme == 'default' ? styles.toggleButtonDeactivated : styles.toggleButtonLightDeactivated
        }
        else {
            realClass = theme == 'default' ? styles.toggleButtonActivated : styles.toggleButtonLightActivated
        }

        let style = {}
        style['border'] = '1px solid var(--light-border)'
        if (i == 0 && options.length > 1){
            style['borderTopRightRadius'] = '0px'
            style['borderBottomRightRadius'] = '0px'
            style['borderRightWidth'] = '0px'
        }
        else if (i == options.length - 1){
            style['borderTopLeftRadius'] = '0px'
            style['borderBottomLeftRadius'] = '0px'
        }
        else{
            style['borderRadius'] = '0px'
            style['borderRightWidth'] = '0px'
        }

        return (
            <SyntheticButton
                key={i}
                style={style}
                value={(
                    <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                        {item.name}
                        {item.imageSrc ? (
                            <MyImage src={item.imageSrc} alt={item.name} width={20} height={20}
                                noGoodAwfulProp={value} />
                        ) : ""}
                    </div>
                )}
                onClick={() => setValue(item.value)}
                className={realClass} />
        )
    }

    return (
        <div style={{'display': 'flex', 'alignItems': 'stretch'}} {...props}>
            {options.map(makeOption)}
        </div>
    )
}
