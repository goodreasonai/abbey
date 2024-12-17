import MyImage from "@/components/MyImage/MyImage"
import RestartIcon from '../../../../public/icons/RestartIcon.png'
import styles from './RightPanel.module.css'
import Loading from "@/components/Loading/Loading"

export default function Outline({ outline, refresh, outlineLoadingState, highlightNote, canEdit }) {

    /*
    
    Outline data looks like:

    {
        'outline': [
            {'heading': '...', 'first': "noteId"},
            {...},
            ...
        ],
        'timestamp': '...' (UTC),
        'numBlocks': int (# of blocks when points was generated)
    }
    
    */

    if (!outline?.outline?.length && outlineLoadingState === 1){
        return (
            <div style={{'height': '80%', 'width': '100%', 'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center'}}>
                <div style={{'width': '70%', 'textAlign': 'center', 'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center', 'gap': '10px'}}>
                    <div>
                        Creating outline
                    </div>
                    <Loading text="" />
                </div>
            </div>
        )
    }

    if (!outline?.outline?.length){
        return (
            <div style={{'height': '80%', 'width': '100%', 'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center'}}>
                <div style={{'width': '70%', 'textAlign': 'center'}}>
                    Add more notes to see an AI-generated outline.
                </div>
            </div>
        )
    }

    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '5px'}}>
            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                <div style={{'flex': '1', 'color': 'var(--passive-text)', 'fontSize': '1.1rem'}}>
                    Outline
                </div>
                {
                    canEdit ? (
                        outlineLoadingState == 1 ? (
                            <Loading size={15} text="" />
                        ) : (
                            <MyImage onClick={() => refresh()} className={"_touchableOpacity"} src={RestartIcon} alt={"Refresh"} width={15} height={15} />
                        )
                    ) : ""
                }
            </div>
            <hr style={{'borderStyle': 'solid', 'borderColor': 'var(--light-border)', 'marginBottom': '1rem'}} />
            <div style={{'flex': '1', 'display': 'flex', 'alignItems': 'center'}} className={styles.panelFade}>
                <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '10px', 'lineHeight': '1.5rem'}}>
                    {outline?.outline.map((item, i) => {
                        return (
                            <div key={i} style={{'display': 'flex', 'gap': '5px'}}>
                                <div style={{'minWidth': '15px', 'opacity': .5}}>
                                    {`${i+1}.`}
                                </div>
                                <div>
                                    <span className="_touchableOpacity" onClick={() => {highlightNote(item.top)}}>{item.heading}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
