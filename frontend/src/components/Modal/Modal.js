import MyImage from '../MyImage/MyImage'
import styles from './Modal.module.css'
import RemoveIcon from '../../../public/icons/RemoveIcon.png'
import { useCallback, useEffect, useRef, useState } from 'react';
import Loading from '../Loading/Loading';
import ReactDOM from 'react-dom'
import useKeyboardShortcut from '@/utils/keyboard';

export default function Modal({ isOpen, close, title, minWidth="500px", minHeight="unset", style, preventCloseLoading, children}) {

    const modalOverlayRef = useRef(null)
    const modalContainerRef = useRef(null)
    const containerContainerRef = useRef(null)

    const [contentWidth, setContentWidth] = useState(0)
    const [contentHeight, setContentHeight] = useState(0)

    // For smooth width transition
    useEffect(() => {
        let resizeObserver = new ResizeObserver(entries => {
            entries.forEach(entry => {
                let rect = entry.target.getBoundingClientRect()
                let myRect = containerContainerRef.current?.getBoundingClientRect()
                if (!myRect){
                    return
                }
                setContentWidth(entry.target.offsetWidth + rect.x - myRect.x);
                setContentHeight(entry.target.offsetHeight + rect.y - myRect.y)
            });
        });

        if (modalContainerRef.current){
            resizeObserver.observe(modalContainerRef.current);
    
            return () => {
                resizeObserver.disconnect(modalContainerRef.current);
                resizeObserver = null;
            };
        }
    }, [isOpen, modalContainerRef.current]);

    useEffect(() => {
    
        const handleScroll = () => {
            try {
                document.body.style.overflow = 'hidden';
            }catch(e){}
        };
    
        const handleResetScroll = () => {
            try {
                document.body.style.overflow = 'auto';
            }catch(e){}
        };

        const handleClickOutside = (event) => {
            if (event.target === modalOverlayRef.current) {
                close();
            }
        };
    
        try {
            if (isOpen) {
                window.addEventListener('scroll', handleScroll, { passive: true });
                window.addEventListener('mousedown', handleClickOutside, { capture: true });
                handleScroll();
            }
            else {
                window.removeEventListener('scroll', handleScroll, { passive: true });
                window.removeEventListener('mousedown', handleClickOutside, { capture: true });
                handleResetScroll();
            }
        } catch(e) {}
    
        return () => {
            try {
                window.removeEventListener('scroll', handleScroll, { passive: true });
                window.removeEventListener('click', handleClickOutside, { capture: true });
            } catch(e){}
            handleResetScroll();
        };
    }, [isOpen, close]);

    const keyboardCallback = useCallback(() => {
        close()
    }, [close])
    useKeyboardShortcut([['Escape']], keyboardCallback)


    if (!isOpen){
        return ""
    }
    return (
        ReactDOM.createPortal(
            <div className={styles.overlay} style={style} ref={modalOverlayRef}>
                <div className={styles.containerContainer} ref={containerContainerRef} style={{'overflow': 'hidden', 'transition': 'all .1s linear', 'width': `${contentWidth}px`, 'height': `${contentHeight}px`}}>
                    <div className={styles.container} style={{'minWidth': minWidth, 'maxWidth': '95%', 'minHeight': minHeight}} ref={modalContainerRef}>
                        <div className={styles.header}>
                            <div className={styles.title}>
                                {title}
                            </div>
                            {preventCloseLoading || false ? (
                                <Loading text="" size={17} />
                            ) : (
                                <MyImage src={RemoveIcon} className={"_clickable"} onClick={close} alt={"Close"} width={17} height={17} />
                            )}
                        </div>
                        <div className={styles.body}>
                            {children}
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        )
    )
}
