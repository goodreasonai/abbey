import Editor from "../RichText/Editor"
import styles from './Curriculum.module.css'

export default function AddNotes({ value, setValue, placeholder="Enter some notes here...", ...props }){

    let jsonContent = value
    if (value){
        try {
            jsonContent = JSON.parse(value)
        }
        catch(e){}
    }
    else {
        jsonContent = ""
    }

    return (
        <div>
            {jsonContent ? (
                <Editor showDelete={true} deleteCallback={() => setValue('')} jsonContent={jsonContent} onChange={(x) => {setValue(JSON.stringify(x))}} style={{'overflow': 'scroll', 'height': '200px'}} />
            ) : (
                <div style={{'display': 'flex'}}>
                    <div className={styles.collapsibleContainerAltHeader} onClick={() => {setValue("Add notes...")}}>
                        Add Notes
                    </div>
                </div>
            )}
        </div>
    )
}
