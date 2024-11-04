

export default function Hr({ style={}, ...props}){
    return (
        <hr style={{'borderStyle': 'solid', 'borderColor': 'var(--light-border)', ...style}} />
    )
}
