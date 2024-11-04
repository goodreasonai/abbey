import SyntheticButton from "./SyntheticButton";


export default function SmallSyntheticButton({style, ...props}) {

    let myStyle = {
        'padding': '5px 10px',
        'fontSize': '.9rem'
    }
    let realStyle = {...myStyle, ...style}

    return (
        <SyntheticButton style={realStyle} {...props} />
    )
}
