import styles from './PassiveTextarea.module.css'

// First built for the sources display in Chat.js
export default function PassiveTextarea({ children, ...props }){
    return (
        <textarea className={styles.passiveTextarea} {...props} />
    )
}
