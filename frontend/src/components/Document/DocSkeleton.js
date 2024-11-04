import styles from './DocSkeleton.module.css'

export default function DocSkeleton({...props}){
    return (
        <div className={styles.container} {...props}>
            <div className={styles.paragraph} style={{'display': 'flex', 'height': '4rem'}}></div>
            <div style={{'display': 'flex', 'gap': '20px'}}>
                <div className={styles.paragraph} style={{'height': '4rem'}}></div>
                <div className={styles.paragraph} style={{'height': '4rem'}}></div>
                <div className={styles.paragraph} style={{'height': '4rem'}}></div>
            </div>
            <div className={styles.paragraph}></div>
            <div className={styles.paragraph}></div>
            <div style={{'display': 'flex', 'gap': '20px'}}>
                <div className={styles.paragraph}></div>
                <div className={styles.paragraph}></div>
            </div>
            <div style={{'display': 'flex', 'gap': '20px'}}>
                <div className={styles.paragraph}></div>
                <div className={styles.paragraph}></div>
            </div>
            <div style={{'display': 'flex', 'gap': '20px'}}>
                <div className={styles.paragraph}></div>
                <div className={styles.paragraph}></div>
            </div>
            <br/><br/>
            <div className={styles.paragraph}></div>
        </div>
    )
}
