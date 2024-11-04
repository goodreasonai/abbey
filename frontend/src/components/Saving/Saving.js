import Loading from "../Loading/Loading"
import MyImage from "../MyImage/MyImage"
import CircleCheckIcon from '../../../public/icons/CircleCheckIcon.png'

export default function Saving({ saveValueLoading, ...props }) {

    if (saveValueLoading == 1){
        return (
            <div style={{'display': 'flex', 'alignItems': 'center', 'opacity': '.5'}} {...props}>
                <Loading text="Saving" noSpin={true} size={15} flipped={true} gap={'5px'} style={{'fontSize': '.9rem'}} />
            </div>
        )
    }
    else if (saveValueLoading == 2){
        return (
            <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px', 'fontSize': '.9rem', 'opacity': '.5'}} {...props}>
                <div>
                    Saved
                </div>
                <MyImage src={CircleCheckIcon} width={15} height={15} alt="Check" />
            </div>
        )
    }
    else if (saveValueLoading == 3) {
        return (
            <div style={{'fontSize': '.9rem'}} {...props}>
                Error Saving
            </div>
        )
    }
    else {
        return ""
    }
}
