import MyImage from "../MyImage/MyImage"
import BackIcon from '../../../public/icons/BackIcon.png'

export default function BackToCollection({ slideToLeft }){
    return (
        <div onClick={() => slideToLeft()} className="_touchableOpacity" style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
            <MyImage src={BackIcon} width={20} height={20} />
            <div>
                Back to Collection
            </div>
        </div>
    )
}
