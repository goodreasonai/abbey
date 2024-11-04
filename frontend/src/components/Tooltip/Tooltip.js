import React, { useState, useRef, useEffect } from 'react';
import styles from './Tooltip.module.css';  // Assuming you use CSS Modules
import ReactDOM from 'react-dom'

export default function Tooltip({ children, content, verticalAlign, containerStyle, style, tooltipStyle, align='', followCursor, flash, ...props }) {
    const [showTooltip, setShowTooltip] = useState(false);
    const [childrenInfo, setChildrenInfo] = useState({ top: 0, left: 0 });
    const childrenRef = useRef();
    const tooltipRef = useRef()
    const [va, setVa] = useState(verticalAlign)  // vertical align, top or bottom
    const [ha, setHa] = useState('')  // horizontal align, left or right (or center, which is '')
    const [mousePosition, setMousePosition] = useState({})
    const alreadyFlashed = useRef(false)  // extra protection against double flashing in case a prop gets changed

    async function showFlash(){
        if (!alreadyFlashed.current && !showTooltip){
            setShowTooltip(true)
        }
        setTimeout(() => {
            setShowTooltip(false)
            alreadyFlashed.current = true
        }, 1500)
    }

    useEffect(() => {
        if (flash && !alreadyFlashed.current){
            updateTooltipPosition()
            showFlash()
        }
    }, [alreadyFlashed.current])

    function handleMouseEnter() {
        updateTooltipPosition();
        setShowTooltip(true);
    }

    function handleMouseLeave() {
        setShowTooltip(false);
    }

    function updateTooltipPosition() {
        if (childrenRef.current) {
            const rect = childrenRef.current.getBoundingClientRect();
            setChildrenInfo({
                top: rect.top + window.scrollY,
                left: rect.left + window.scrollX,
                height: rect.height,
                width: rect.width
            });
        }
    }

    useEffect(() => {
        window.addEventListener('resize', updateTooltipPosition);
        window.addEventListener('scroll', updateTooltipPosition);
        return () => {
            window.removeEventListener('resize', updateTooltipPosition);
            window.removeEventListener('scroll', updateTooltipPosition);
        };
    }, []);

    // for followCursor
    function handleMouseMove(event) {
        if (followCursor) {
            const x = event.clientX;
            const y = event.clientY;
            setMousePosition({ x, y });
        }
    };

    // automatically adjust location based on overflow
    function adjustBounds(){
        if (tooltipRef.current){
            const rect = tooltipRef.current.getBoundingClientRect();
            if (!align){
                if (!ha && rect.width + rect.left > window.innerWidth){
                    setHa('left')
                }
                if (!ha && rect.left < 0){
                    setHa('right')
                }
            }
            else {
                setHa(align)
            }
            if (!verticalAlign){
                if (!va && rect.top < 0){
                    setVa('bottom')
                }
                if (!va && rect.top + rect.height > window.innerHeight){
                    setHa('top')
                }
            }
            else {
                setVa(verticalAlign)
            }
        }
    }
    useEffect(() => {
        adjustBounds()
        window.addEventListener('resize', adjustBounds);
        window.addEventListener('scroll', adjustBounds);
        return () => {
            window.removeEventListener('resize', adjustBounds);
            window.removeEventListener('scroll', adjustBounds);
        };

    }, [tooltipRef?.current, childrenInfo])

    const buffer = 5

    let tooltipTop = childrenInfo?.top - buffer
    let tooltipLeft = childrenInfo?.left + childrenInfo?.width / 2
    let tooltipTransY = '-100%'
    let tooltipTransX = '-50%'
    if (!followCursor) {
        if (va == 'top' || !va){
            // it already is by default.
        }
        else if (va == 'bottom'){
            tooltipTop = childrenInfo?.top + childrenInfo?.height + buffer
            tooltipTransY = '0%'
        }
        if (ha == ''){
            // it already is centered
        }
        else if (ha == 'left'){
            tooltipLeft = childrenInfo?.left + childrenInfo?.width
            tooltipTransX = '-100%'
        }
        else if (ha == 'right'){
            tooltipLeft = childrenInfo?.left
            tooltipTransX = '0%'
        }
    }
    else {
        tooltipLeft = mousePosition?.x
        tooltipTop = mousePosition?.y - buffer
        tooltipTransY = '-100%'
        tooltipTransX = '-50%'
    }
    

    return (
        <>
            <div
                ref={childrenRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onMouseMove={handleMouseMove}
                style={{'cursor': 'pointer', 'display': 'flex', 'alignItems': 'center', ...containerStyle}}
            >
                {children}
            </div>
            {showTooltip ? ReactDOM.createPortal(
                <div
                    style={{
                        position: 'absolute',
                        top: `${tooltipTop}px`,
                        left: `${tooltipLeft}px`,
                        transform: `translateX(${tooltipTransX}) translateY(${tooltipTransY})`,
                        ...tooltipStyle,
                        ...style
                    }}
                    className={styles.popup}
                    ref={tooltipRef}
                    {...props}
                >
                    {content}
                </div>,
                document.body
            ) : null}
        </>
    );
}
