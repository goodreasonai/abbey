
export default function DefaultMargins({ children }) {
    return (
        <div style={{'margin': 'var(--std-margin)', 'marginTop': 'var(--std-margin-top)'}}>
            {children}
        </div>
    )
}
