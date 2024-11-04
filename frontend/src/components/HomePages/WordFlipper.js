
import { useState, useEffect, useRef } from "react";

export default function WordFlipper({ words, anchorWidth=200, style={} }) {
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [flipping, setFlipping] = useState(false);
    const [containerWidth, setContainerWidth] = useState(undefined);
    const wordRef = useRef(null);

    useEffect(() => {
        const interval = setInterval(() => {
            setFlipping(true);
            setTimeout(() => {
                setFlipping(false);
                setCurrentWordIndex((prevIndex) => (prevIndex + 1) % words.length);
            }, 500); // Adjust timing for flip effect
        }, 2500); // Change word every 3 seconds

        return () => clearInterval(interval);

    }, [words])

    const containerStyle = {
        position: 'relative',
        overflow: 'visible',
        ...(containerWidth !== undefined ? {'width': `${containerWidth}px`} : {}),
        transition: 'all .5s ease',
        position: 'relative',
        textAlign: 'center',
        ...style
    };

    useEffect(() => {
        if (wordRef.current) {
            let offset = wordRef.current.offsetWidth;
            let anchored = (3 * anchorWidth + offset) / 4;
            setContainerWidth(anchored);
        }
    }, [currentWordIndex]);
    
    const wordStyle = {
        display: 'inline-block',
        transition: 'all 0.6s ease',
        transform: flipping ? 'rotateX(30deg) translateY(-20px) translateX(10px)' : 'translateY(0) translateX(0)',
        opacity: flipping ? 0 : 1,
        whiteSpace: 'nowrap', // Prevents text from wrapping onto a new line
    };

    return (
        <div style={containerStyle}>
            <span style={wordStyle} ref={wordRef}>
                {`${words[currentWordIndex]}`}
            </span>
            <div style={{'position': 'absolute', 'bottom': '-5px', 'left': '0px'}}>
                <div style={{'display': 'flex', 'justifyContent': 'center'}}>
                    <svg style={{'width': '100%'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1213 73" fill="var(--dark-primary)"><path d="M1212.41 5.51c3.05 12.87-22.36 11.93-30.26 15.68-94.32 20.51-269.09 32.42-365.48 37.51-77.91 3.82-155.66 9.93-233.67 11.67-57.49 2.56-115.05-.19-172.57 1.58-121.28.91-243.17 1.88-363.69-13.33-12.51-2.64-25.8-2.92-37.77-7.45-30.66-21.42 26.02-21.53 38.52-19.26 359.95 29.05 364.68 27.36 638.24 17.85 121-3.78 241.22-19.21 426.76-41.46 4.72-.65 9.18 3.56 8.45 8.36a941.74 941.74 0 0 0 54.29-9.21c9.33-2.33 18.7-4.56 27.95-7.19a7.59 7.59 0 0 1 9.23 5.24Z"></path></svg>
                </div>
            </div>
        </div>
    )
}
