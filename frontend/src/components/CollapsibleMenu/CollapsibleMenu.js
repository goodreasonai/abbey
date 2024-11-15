import { useRef, useState, useEffect } from 'react';
import styles from './CollapsibleMenu.module.css'
import MyImage from '../MyImage/MyImage';
import MinimizeIcon from '../../../public/icons/MinimizeIcon.png'
import ExpandIcon from '../../../public/icons/ExpandIcon.png'


export default function CollapsibleMenu({ header="", rightButtons="", altHeader=false, altHeaderClassName='', headerContainerAddClass='', headerId="", noHeader=false, openByDefault=false, expand=false, setOpenCallback=()=>{}, ignoreHeaderTextClick=false, bodyContainerStyle={}, transitionSpeed=".25s", headerNeedsFullSpace=false, noMargining=false, forceOpen=false, setForceOpen=()=>{}, children }){

    const contentRef = useRef(null);
    const myRef = useRef(null);
    const [contentHeight, setContentHeight] = useState(openByDefault && !expand ? undefined : 0);
    const [open, setOpen] = useState(openByDefault)

    // Let's a parent specify that this should be open
    useEffect(() => {
        if (forceOpen && !open){
            setOpen(true)
            setForceOpen(false)
        }
    }, [forceOpen, open])

    useEffect(() => {
        let resizeObserver = new ResizeObserver(entries => {
            entries.forEach(entry => {
                let rect = entry.target.getBoundingClientRect()
                let myRect = myRef.current?.getBoundingClientRect()
                if (!myRect){
                    return
                }
                let offset = rect.y - myRect.y;
                if (entry.target.offsetHeight + offset > 0){
                    // a height of zero for the content usually means that it's off the screen anyway
                    setContentHeight(entry.target.offsetHeight + offset);
                }
            });
        });
    
        resizeObserver.observe(contentRef.current);
    
        return () => {
            resizeObserver.disconnect(contentRef.current);
            resizeObserver = null;
        };
    }, []);

    useEffect(() => {
        if (setOpenCallback){
            setOpenCallback(open)
        }
    }, [open])

    let headerElement = ""
    if (altHeader){
        headerElement = (
            <div style={{'display': 'flex'}}>
                <div id={headerId} className={`${altHeaderClassName ? altHeaderClassName : styles.collapsibleContainerAltHeader} _clickable`} onClick={() => {setOpen(!open)}} >
                    <div style={{'flex': '1', 'alignItems': 'center', 'display': 'flex'}}>
                        {header}
                    </div>
                    <div style={{'display': 'flex', 'alignItems': 'center'}}>
                        {
                            open ? (
                                <div title={"Close"} onClick={() => {setOpen(false)}} className={"_clickable"} style={{'display': 'flex', 'alignItems': 'center'}}>
                                    <MyImage src={MinimizeIcon} height={15} width={15} alt={"Close"} />
                                </div>
                            ) : (
                                <div title={"Open"} onClick={() => {setOpen(true)}} className={"_clickable"} style={{'display': 'flex', 'alignItems': 'center'}}>
                                    <MyImage src={ExpandIcon} height={15} width={15} alt={"Open"} />
                                </div>
                            )
                        }
                    </div>
                </div>
            </div>
        )
        
    }
    else {
        headerElement = (
            <div id={headerId} className={`${styles.collapsibleContainerHeader} ${headerContainerAddClass}`}>
                <div style={{'flex': '1', 'alignItems': 'center', 'display': 'flex'}} onClick={() => {!ignoreHeaderTextClick && setOpen(!open)}}>
                    {header}
                    {!headerNeedsFullSpace ? (
                        <div style={{'flex': '1', 'opacity': '0'}} className={'_clickable'} onClick={() => setOpen(!open)}>
                        א
                        </div>
                    ) : ""}
                </div>
                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                    {rightButtons}
                    {
                        open ? (
                            <div onClick={() => {setOpen(false)}} className={"_clickable"} style={{'display': 'flex', 'alignItems': 'center'}}>
                                <MyImage src={MinimizeIcon} height={20} width={20} alt={"Close"} />
                            </div>
                        ) : (
                            <div onClick={() => {setOpen(true)}} className={"_clickable"} style={{'display': 'flex', 'alignItems': 'center'}}>
                                <MyImage src={ExpandIcon} height={20} width={20} alt={"Open"} />
                            </div>
                        )
                    }
                </div>
            </div>
        )
    }

    let marginingStyle = {}
    if (!noHeader && !noMargining){
        marginingStyle = {}
        if (open){
            marginingStyle = {...marginingStyle, 'paddingTop': '1rem', 'marginTop': '0'}
        }
        else {
            marginingStyle = {...marginingStyle, 'height': '0', 'marginTop': '1rem'}
        }
    }

    return (
        <div>
            {!noHeader ? headerElement : ""}
            <div style={{
                'overflow': 'hidden',
                'height': `${open ? contentHeight : 0}px`,
                'transition': `height ${transitionSpeed} linear`,
                ...bodyContainerStyle
            }} ref={myRef}>
                <div ref={contentRef} style={marginingStyle}>
                    {children}
                </div>
            </div>
        </div>
    )

}
