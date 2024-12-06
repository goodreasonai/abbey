import styles from './Form.module.css'

/*

The key difference here is that the value parameter can take JSX
The regular button is an <input> element, by contrast

*/

export default function SyntheticButton({value, noHighlight=false, className="", noShadow=false, ...props}){
    return (
        <div role="buton" tabIndex={0} {...props} className={`${className} ${styles.syntheticButton} ${noShadow ? '' : styles.hasShadow} ${!noHighlight ? styles.syntheticButtonHighlight : ''}`}>
            {value}
        </div>
    )

}