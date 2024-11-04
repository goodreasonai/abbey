import styles from './Form.module.css'

export default function Number({className, width, ...props}){

    // Unfortunately dependent on the CSS
    let realWidth = {}
    if (width){
        realWidth = {'width': `calc(${width}em + 10px)`}
    }

    return (
        <input type='number' className={`${styles.number} ${className}`} style={realWidth} {...props} />
    )
}
