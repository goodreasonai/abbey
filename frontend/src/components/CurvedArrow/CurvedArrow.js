
export default function CurvedArrow({ width=25, height=25, rotate='-20deg', scaleY='-1' }) {
    return (
        <svg style={{'transform': `scaleY(${scaleY}) rotate(${rotate})`}} fill="var(--alt-dark-secondary)" height={`${height}px`} width={`${width}px`} version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" 
            viewBox="0 0 200.013 200.013" xmlSpace="preserve">
            <path d="M197.007,48.479L139.348,0v28.623C63.505,32.538,3.006,95.472,3.006,172.271v27.741h40.099v-27.741
                c0-54.682,42.527-99.614,96.243-103.47v28.156L197.007,48.479z"/>
        </svg>
    )
}
