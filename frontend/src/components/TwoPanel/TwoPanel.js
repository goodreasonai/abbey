import { useRef, useEffect, useState } from 'react'
import styles from './TwoPanel.module.css'
import { useIsMobile } from '@/utils/mobile'

export default function TwoPanel({ leftPanel, rightPanel, hideLeftPanel=false, hideRightPanel=false, initialLeftWidth='66%', initialRightWidth='33%', stickyPanel="", className="", stackOnMobile=true, resizerStyle={}, ...props }) {
    const resizerRef = useRef()
    const leftPanelRef = useRef()
    const rightPanelRef = useRef()
    const startX = useRef(0)
    const startRightWidth = useRef(0)
    const startLeftWidth = useRef(0)
    const overlayRef = useRef(null);
    const { isMobile } = useIsMobile()

    const handleMouseDown = (e) => {
        startX.current = e.clientX
        startRightWidth.current = rightPanelRef.current.offsetWidth
        startLeftWidth.current = leftPanelRef.current.offsetWidth
        if (overlayRef.current) {
            overlayRef.current.style.display = 'block';
        }
        try {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }
        catch(e){}
    }

    const handleMouseMove = (e) => {
        const newRightWidth = startRightWidth.current - (e.clientX - startX.current)
        const newLeftWidth = startLeftWidth.current + (e.clientX - startX.current)

        if (newRightWidth > 0 && newLeftWidth > 0) {
            rightPanelRef.current.style.width = `${newRightWidth}px`
            leftPanelRef.current.style.width = `${newLeftWidth}px`
        }
    }

    const handleMouseUp = () => {
        try{
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            if (overlayRef.current) {
                overlayRef.current.style.display = 'none';
            }
        }
        catch(e){}
    }

    useEffect(() => {
        try {
            resizerRef.current.addEventListener('mousedown', handleMouseDown)
        }
        catch(e){}

        return () => {
            try {
                resizerRef.current.removeEventListener('mousedown', handleMouseDown)
            }
            catch(e){}
        }
    }, [hideLeftPanel, hideRightPanel])

    let leftPanelStyle = hideLeftPanel ? {} : (hideRightPanel ? {'width': '100%'} : {'flex': '1'})
    let rightPanelStyle = hideRightPanel ? {} : (hideLeftPanel ? {'width': '100%'} : {})

    if (isMobile && stackOnMobile){
        leftPanelStyle = {...leftPanelStyle, 'width': '100%'}
        rightPanelStyle = {...rightPanelStyle, 'width': '100%'}
    }

    return (
        <div className={`${styles.container} ${stackOnMobile ? styles.containerStackOnMobile : ''} ${className}`} {...props} >
            {!hideLeftPanel ? (
                <div className={`${stickyPanel == 'left' ? styles.stickyPanel : ''} ${styles.panel}`} style={{'height': '100%', 'width': initialLeftWidth, 'minWidth': '0px', ...leftPanelStyle}} ref={leftPanelRef}> 
                    {leftPanel}
                </div>
            ) : ""}
            
            {/* The purpose of the overlay is to make sure that hovering over left or right panel while dragging doesn't mess things up */}
            {
                !hideLeftPanel && !hideRightPanel ? (
                    <>
                        <div ref={overlayRef} style={{ display: 'none', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}></div>
                        <div ref={resizerRef} className={styles.resizer} style={{'height': '100%', ...resizerStyle}}></div>
                    </>
                ) : ""
            }
            {!hideRightPanel ? (
                <div className={`${stickyPanel == 'right' ? styles.stickyPanel : ''} ${styles.panel}`} style={{'height': '100%', 'width': initialRightWidth, 'minWidth': '0px', ...rightPanelStyle}} ref={rightPanelRef}>
                    {rightPanel}
                </div>
            ) : ""}
            
        </div>
    )
}
