import styles from './Form.module.css'

export default function FileUploadSmall({ className, ...props }) {
    
    let realClassName = `${styles.fileUploadSmall}`
    if (className){
        realClassName += " " + className;
    }

    return (
        <input type="file" className={`${realClassName}`} {...props} />
    )
}