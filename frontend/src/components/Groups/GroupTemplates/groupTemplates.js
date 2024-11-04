import TestStudy1GroupTemplate from "./TestStudy1/TestStudy1GroupTemplate"

export const GROUP_TEMPLATES = [
    new TestStudy1GroupTemplate(),
]

export const getGroupTemplateByCode = (code) => {
    let correct = GROUP_TEMPLATES.filter((x) => x.code == code)
    if (correct.length){
        return correct[0]
    }
    else {
        console.log(`Unrecognized group template '${code}'`)
        return GROUP_TEMPLATES[0]  // TODO: return unrecognized template type.
    }
}
