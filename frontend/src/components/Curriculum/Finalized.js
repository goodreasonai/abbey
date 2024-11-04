import Structured from "./Structured";
import { useState } from 'react'

export default function Finalized({ manifestRow, fullState, setFullState, userValue, setUserValue, userActivity, setUserActivity, premierPosition, setPremierPosition, assetsInfo, setAssetsInfo, ...props }) {

    let element = ""
    if (fullState && fullState.nodes && Object.keys(fullState.nodes).length > 0){
        element = (
            <Structured
                fullState={fullState}
                setFullState={setFullState}
                manifestRow={manifestRow}
                userValue={userValue}
                setUserValue={setUserValue}
                userActivity={userActivity}
                setUserActivity={setUserActivity}
                premierPosition={premierPosition}
                setPremierPosition={setPremierPosition}
                highlightNext={true}
                assetsInfo={assetsInfo}
                setAssetsInfo={setAssetsInfo} />
        )
    }
    else {
        element = "Curriculum is empty."
    }

    return (
        <div {...props}>
            {element}
        </div>
    )
}
