import BackToCollection from "./BackToCollection";


export default function Queue({ slideToLeft }) {

    return (
        <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
            <div style={{'display': 'flex'}}>
                <BackToCollection slideToLeft={slideToLeft} />
            </div>
            <div>
                See queue here
            </div>
        </div>
    )
}
