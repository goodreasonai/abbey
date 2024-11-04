import styles from './Groups.module.css'
import GroupsTable from './GroupsTable'


export default function Groups({}){
    return (
        <div className={styles.container}>
            <div>
                <GroupsTable />
            </div>
        </div>
    )
}
