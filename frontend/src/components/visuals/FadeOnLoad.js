import styles from './FadeOnLoad.module.css'

/*
full = 0 to 1
fromHalf = .5 to 1
toHalf = 0 to .5
toQuarter = 0 to .25
*/
export default function FadeOnLoad({style, children, duration='.3s', fadeType='full', ...props}){
    
    const typeToClass = {
        'full': styles.fadeInFull,
        'fromHalf': styles.fadeInFromHalf,
        'toHalf': styles.fadeIntoHalf,
        'toQuarter': styles.fadeInToQuarter
    }
    if (!typeToClass[fadeType]){
        throw Error(`Fade type ${fadeType} not recognized.`)
    }

    const realStyle = {
        'animationName': typeToClass[fadeType],
        'animationDuration': duration, /* Duration of the animation */
        'animationFillMode': 'forwards', /* Keeps the element at the final state when the animation completes */
        ...style
    }

    return (
        <div style={realStyle} {...props}>
            {children}
        </div>
    )
}
