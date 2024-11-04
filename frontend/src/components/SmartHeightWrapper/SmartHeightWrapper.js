import { useRef, useEffect, useCallback } from "react"
import observeRect from "@reach/observe-rect";


export default function SmartHeightWrapper({ children, ...props }) {

    const containerRef = useRef()

    useEffect(() => {
        if (containerRef.current){
            const adjustHeight = () => {
                const viewportHeight = window.innerHeight;
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                if (rect.top < 0) {
                    // If chatContainerRef's top is out of view, set its height to 100vh
                    containerRef.current.style.height = '100vh';
                }
                else {
                    // Otherwise, adjust the height to align with the bottom of the viewport
                    const height = viewportHeight - rect.top;
                    containerRef.current.style.height = `${height}px`;
                }
            }
            // Call adjustHeight on page load and whenever the window is resized or scrolled
            adjustHeight();
            window.addEventListener('resize', adjustHeight);

            let rectObserver = observeRect(containerRef.current, adjustHeight);
            rectObserver.observe();

            return () => {
                window.removeEventListener('resize', adjustHeight);
                rectObserver.unobserve();
            }
        }
    }, [containerRef.current])
    

    return (
        <div ref={containerRef} {...props}>
            {children}
        </div>
    )
}
