import MyImage from "@/components/MyImage/MyImage"
import RestartIcon from '../../../../public/icons/RestartIcon.png'
import styles from './RightPanel.module.css'
import Loading from "@/components/Loading/Loading"

export default function KeyPoints({ keyPoints, refresh, keyPointsLoadingState, highlightNote, canEdit }) {

    /*
    
    Key points data looks like:

    {
        'bullets': [
            {'text': '...', 'citations': [...block id strings]},
            {...},
            ...
        ],
        'timestamp': '...' (UTC),
        'numBlocks': int (# of blocks when points was generated)
    }
    
    */

    if (!keyPoints?.bullets?.length){
        return (
            <div style={{'height': '80%', 'width': '100%', 'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center'}}>
                <div style={{'width': '70%', 'textAlign': 'center'}}>
                    Add more notes to see AI-generated Key Points.
                </div>
            </div>
        )
    }

    const cits = []
    if (keyPoints?.bullets?.length){
        for (let i = 0; i < keyPoints.bullets.length; i++){
            let bullet = keyPoints.bullets[i]
            for (let k = 0; k < bullet.citations?.length; k++){
                let citation = bullet.citations[k]
                if (!cits.includes(citation)){
                    cits.push(citation)
                }
            }
        }
    }
    
    function inToCn(bulletIndex, citationIndex){  // "index to citation number"
        let cit = keyPoints.bullets[bulletIndex].citations[citationIndex]
        return cits.findIndex(x => x == cit) + 1
    }

    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '5px'}}>
            <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}}>
                <div style={{'flex': '1', 'color': 'var(--passive-text)', 'fontSize': '1.1rem'}}>
                    Key Points
                </div>
                {
                    canEdit ? (
                        keyPointsLoadingState == 1 ? (
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
                    {keyPoints.bullets.map((item, i) => {
                        return (
                            <div key={i} style={{'display': 'flex', 'gap': '5px', 'color': 'var(--passive-text)'}}>
                                <div style={{'minWidth': '15px'}}>
                                    {`${i+1}.`}
                                </div>
                                <div>
                                    <span>{item.text}</span>
                                    {item.citations?.length ? (
                                        <>
                                            <span>{` (`}</span>
                                            {item.citations.map((cit, k) => {
                                                return (
                                                    <span key={k}>{k == 0 ? "" : ", "}<span onClick={() => highlightNote(cit)} className={styles.citation}>{inToCn(i, k)}</span></span>
                                                )
                                            })}
                                            <span>{`)`}</span>
                                        </>
                                    ) : ""}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
