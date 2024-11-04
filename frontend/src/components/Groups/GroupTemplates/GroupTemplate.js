export default class GroupTemplate {
    constructor(code, readableName, description, icon) {
        this.code = code;
    }

    Element({ manifestRow }) { 
        return (
            <div>
                {`Element not implemented for group template with code ${this.code}`}
            </div>
        )
    }
}