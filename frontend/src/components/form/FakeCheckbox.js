import CheckedIcon from '../../../public/icons/CheckedIcon.png'
import UncheckedIcon from '../../../public/icons/UncheckedIcon.png'
import MyImage from '../MyImage/MyImage'

export default function FakeCheckbox({ value, setValue, clickable=true, iconSize=20, showUnchecked=true, checkedOpacity='50%', style={}, ...props }){

    return (
        <div style={{'display': 'flex', 'alignItems': 'center', 'opacity': checkedOpacity, ...style}} className={clickable ? '_clickable' : ''} {...props} >
            {value ? (
                <MyImage src={CheckedIcon} alt="Remove" width={iconSize} height={iconSize} onClick={() => setValue(false)} />
            ) : (
                <MyImage src={UncheckedIcon} style={showUnchecked ? {} : {'opacity': '0'}} alt="Select" width={iconSize} height={iconSize} onClick={() => setValue(true)} />
            )}
        </div>
    )
}
