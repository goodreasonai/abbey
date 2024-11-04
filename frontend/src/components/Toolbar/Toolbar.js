import Loading from "../Loading/Loading"
import MyImage from "../MyImage/MyImage"
import Saving from "../Saving/Saving"
import styles from './Toolbar.module.css'

export default function Toolbar({ leftText="", options=[], savingVar=undefined, ...props }) { 
    return (
        <div className={styles.container} {...props}>
            <div className={styles.padded}>
                {leftText}
            </div>
            {options.map((item, i) => {
                return (
                    <div onClick={item.onClick} className={`${styles.option} ${styles.padded} _clickable`} key={i}>
                        {item.text}
                        {item.loading ? (
                            <Loading text="" />
                        ) : (
                            <MyImage src={item.icon} width={20} height={20} alt={item.alt} />
                        )}
                        
                    </div>
                )
            })}
            <div style={{'flex':'1'}}></div>
            {savingVar === undefined ? "" : (
                <Saving saveValueLoading={savingVar} className={styles.padded} />
            )}
        </div>
    )
}
