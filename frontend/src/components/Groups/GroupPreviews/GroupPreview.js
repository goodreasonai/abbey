import Modular1 from "./Modular1";

export default function GroupPreview({ groupManifest }) {

    // Route to correct preview template
    if (groupManifest.preview_template == 'modular-1'){
        return <Modular1 groupManifest={groupManifest} />
    }

    return `Asset group preview template (${groupManifest.preview_template}) not recognized`
    
}
