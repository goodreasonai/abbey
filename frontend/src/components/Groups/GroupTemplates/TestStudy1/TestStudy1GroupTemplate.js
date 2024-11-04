import GroupTemplate from "../GroupTemplate"
import TestStudy1 from "./TestStudy1"

export default class TestStudy1GroupTemplate extends GroupTemplate {
    constructor(){
        super(
            'test-study-1'
        )
    }
    Element({ manifestRow }) {
        return (<TestStudy1 manifestRow={manifestRow} />)
    }
}
