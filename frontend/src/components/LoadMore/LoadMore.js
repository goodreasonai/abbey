import SyntheticButton from "../form/SyntheticButton"

export default function LoadMore({ onClick, ...props }) {
    return (
        <SyntheticButton
            value = "Load More"
            onClick={onClick}
            {...props} />
    )
}
