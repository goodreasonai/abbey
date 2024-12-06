import styles from './Form.module.css'

export default function Button({ value, type, className, onClick, disabled=false, noShadow=false, ...props}){

    // When making the button a submit button
    let realType = "button";
    if (type){
        realType = type;
    }

    let realClass = disabled ? `${styles.disabledButton} ${className}` : `${styles.button} ${className}`
    if (!noShadow){
        realClass += ` ${styles.hasShadow}`
    }

    function realOnClick(e){
        if (disabled){
            return;
        }
        try {
            onClick(e)
        }
        catch (e) {
            // Sometimes onClick doesn't take e, but that's fine.
        }
    }

    return (
        <input type={realType} value={value} className={realClass} onClick={realOnClick} {...props} />
    )
}
