import { useEffect, useRef, useState } from "react";

export default function SlidingPage({ main, right, showRight, style, keepRightRendered, ...props }) {
    
    const [rightInView, setRightInView] = useState(true)
    const rightRef = useRef()

    useEffect(() => {
        const handleTransitionEnd = (e) => {
            // We only care about the transition on "transform" (not, e.g., height or width)
            if (e.propertyName === 'transform' && !showRight) {
                setRightInView(false);
            }
        };
    
        const el = rightRef.current;
        if (el) {
            el.addEventListener('transitionend', handleTransitionEnd);
        }
    
        return () => {
            if (el) {
                el.removeEventListener('transitionend', handleTransitionEnd);
            }
        };
      }, [showRight, rightRef]);
    useEffect(() => {
        if (showRight) {
          setRightInView(true);
        }
    }, [showRight]);
    
    useEffect(() => {
        if (rightRef?.current){
            if (showRight){
                rightRef.current.style.transform = 'translateX(-100%)'
            }
            else {
                rightRef.current.style.transform = 'translateX(0%)'
            }
        }
    }, [rightRef?.current, showRight])

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                ...style,
            }}
            {...props}
        >
            {/* Main stays in the DOM at all times */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    transition: 'transform 0.5s ease',
                    transform: showRight ? 'translateX(-100%)' : 'translateX(0)',
                    padding: 'var(--std-margin-top) var(--std-margin)'
                }}
            >
                {main}
            </div>
    
            <div
                ref={rightRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: '100%', // Start off to the right
                    width: '100%',
                    height: '100%',
                    transition: 'transform 0.5s ease',
                    pointerEvents: showRight ? '' : 'none',
                    padding: 'var(--std-margin-top) var(--std-margin)'
                }}
            >
                {rightInView || keepRightRendered ? right : ""} 
            </div>
        </div>
    );
}
  