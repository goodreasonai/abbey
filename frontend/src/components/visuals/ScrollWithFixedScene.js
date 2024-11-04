import { useEffect, useRef } from "react";

export default function ScrollWithFixedScene({ onAnimate, heightMultiplier, style, children }){

    const containerRef = useRef()

    useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current){
                return
            }
            const rect = containerRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const elementTop = rect.top;
            const elementHeight = rect.height

            let time = 0
            if (elementTop > 0){
                // time is 0
            }
            else{
                // when elementTop = 0 is the start
                // when elementTop = viewportHeight - elementHeight is the end
                time = 1/(viewportHeight - elementHeight) * elementTop
                time = Math.min(time, 1)
            }
            onAnimate(time)
        };

        window.addEventListener('scroll', handleScroll);
        handleScroll(); // Initial check

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [containerRef]);

    return (
        <div ref={containerRef} style={{'height': `calc(100vh * ${heightMultiplier})`, 'width': '100%', ...style}}>
            <div style={{'position': 'sticky', 'top': '0px', 'height': '100vh'}}>
                {children}
            </div>
        </div>
    )
}
