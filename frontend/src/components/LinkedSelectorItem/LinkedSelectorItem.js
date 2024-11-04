import styles from './LinkedSelectorItem.module.css'
import Link from 'next/link'
import shortenText from '@/utils/text'
import { getTemplateByCode } from '@/templates/template'
import MyImage from '../MyImage/MyImage'


export default function LinkedSelectorItem({item, iconImage, showButton, showTemplateIcon=true, theme="dark", ...props}) {

    let tmp = getTemplateByCode(item.template)
    let templateImg = tmp.constructor.icon

    let containerClass = theme == 'light' ? styles.linkContainerLight : styles.linkContainer
    let linkClass = theme == 'light' ? styles.frLinkLight : styles.frLink

    return (
        <div className={containerClass} {...props}>
            <Link href={`/assets/${item.id}`} target={"_blank"} title={`${shortenText(item.preview_desc, 50, 750)}...`} className={linkClass}>
                <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '5px'}}>
                    <div className={styles.linkTitle}>
                        {shortenText(item.title, 5, 30, true)}
                    </div>
                    <div className={styles.linkAuthor}>
                        {item.author}
                    </div>
                </div>
                {
                    showTemplateIcon ? (
                        <div>
                            <MyImage src={templateImg} width={20} height={20} alt={"Template image"} />
                        </div>
                    ) : ""
                }
                
            </Link>
            {
                showButton ? (
                    <div className={styles.linkDeleteImageContainer}>
                        {iconImage}
                    </div>
                ) : ""
            }
            
        </div>
    )
}
