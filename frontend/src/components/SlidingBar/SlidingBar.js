import { useState, useEffect, useRef } from 'react'

export default function SlidingBar({ values, arrowContainerStyleLeft={}, arrowContainerStyleRight={}, buttonContainerStyle={}, buffer=10 }) {

    const [scrollPosition, setScrollPosition] = useState(0)
    const [amOverflowingRight, setAmOverflowingRight] = useState(false)

    const containerRef = useRef(null)
    const innerRef = useRef(null)
    const buttonsRef = useRef([])

    useEffect(() => {
        function checkButtons() {
            const { left, right } = getHiddenButtons();

            if (values?.length && (right?.length == values.length || left?.length == values.length)){
                setScrollPosition(0)
            }
            else {
                if (right?.length) {
                    setAmOverflowingRight(true);
                } else {
                    setAmOverflowingRight(false);
                }
            }
            
        }

        checkButtons();

        window.addEventListener('resize', checkButtons);
        const resizeObserver = new ResizeObserver(() => {
            checkButtons();
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            window.removeEventListener('resize', checkButtons);
            resizeObserver.disconnect();
        };
    }, [scrollPosition, values]);


    function getHiddenButtons() {
        if (!buttonsRef.current || !buttonsRef.current.length || !containerRef.current) return {'left': [], 'right': []};

        const containerRect = containerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width;

        const hiddenLeft = []
        const hiddenRight = []
        buttonsRef.current.forEach((button, index) => {
            if (!button){
                return
            }
            const buttonLeft = button.offsetLeft;
            const buttonRight = buttonLeft + button.offsetWidth;
            if (buttonLeft < -1 * scrollPosition) {
                hiddenLeft.push(button)
            }
            else if (buttonRight > containerWidth - scrollPosition) {
                hiddenRight.push(button)
            }
        });

        return {'left': hiddenLeft, 'right': hiddenRight}
    }

    function moveBarTo(moveToRight) {
        if (!containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const { left, right } = getHiddenButtons()
        // make the rightmost button fully visible
        if (moveToRight && right?.length){
            let minHiddenPos = Infinity
            for (let button of right){
                const buttonLeft = button.offsetLeft;
                minHiddenPos = Math.min(minHiddenPos, buttonLeft)
            }
            const newCoord = -1 * minHiddenPos + buffer
            if (newCoord == scrollPosition){
                setScrollPosition(scrollPosition - containerRect.width / 1.5 + 2 * buffer)
            }
            else {
                setScrollPosition(newCoord)
            }
        }
        else {
            // Moving to the left
            let maxHiddenPos = 0
            let offsetWidth = 0
            for (let button of left){
                const buttonLeft = button.offsetLeft;
                if (maxHiddenPos < buttonLeft){
                    maxHiddenPos = buttonLeft
                    offsetWidth = button.offsetWidth
                }
            }
            let bufferMultiple = right?.length == 0 ? 2 : 1  // Can't figure out why I need this, but I do!
            let newCoord = -1 * maxHiddenPos + containerRect.width - offsetWidth - bufferMultiple * buffer
            newCoord = Math.min(0, newCoord)
            if (newCoord == scrollPosition){
                setScrollPosition(scrollPosition + containerRect.width / 1.5 - 2 * buffer)
            }
            else {
                setScrollPosition(newCoord)
            }
        }
    }

    return (
        <div style={{'width': '100%', 'height': '100%', 'display': 'flex', 'minWidth': '0px', 'alignItems': 'center'}}>
            <div style={{'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center', 'height': '100%', ...(scrollPosition < 0 ? arrowContainerStyleLeft : {})}}>
                <MoveButton hide={!(scrollPosition < 0)} dir="right" callback={() => moveBarTo(false)} />
            </div>
            <div ref={containerRef} style={{'flex': '1', 'minWidth': '0px', 'overflow': 'hidden'}}>
                <div
                    ref={innerRef}
                    style={{
                        display: 'flex',
                        gap: `${buffer}px`,
                        padding: `0px ${buffer}px`,
                        position: 'relative',
                        transform: `translateX(${scrollPosition}px)`,
                        transition: 'transform 0.3s ease',
                    }}
                >
                    {values.map((x, i) => {
                        if (buttonsRef && buttonsRef.current && buttonsRef.current.length < i + 1){
                            buttonsRef.current.push(undefined)
                        }
                        return (
                            <div style={{'whiteSpace': 'nowrap', ...buttonContainerStyle}} ref={(el) => (buttonsRef.current[i] = el)}>
                                {x}
                            </div>
                        )
                    })}
                </div>
            </div>
            <div style={{'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center', 'height': '100%', ...(amOverflowingRight ? arrowContainerStyleRight : {})}}>
                <MoveButton hide={!amOverflowingRight} dir="left" callback={() => moveBarTo(true)} />
            </div>
        </div>
    )
}

function MoveButton({ callback, dir, hide }) {
    return (
        <div onClick={() => callback()} className='_clickable' style={{...(hide ? {'opacity': '0', 'pointerEvents': 'none'} : {}), 'transform': dir == 'left' ? 'rotate(180deg)' : '', 'backgroundColor': 'var(--light-background)', 'padding': '1px 3px', 'borderRadius': 'var(--small-border-radius)', 'border': '1px solid var(--light-border)', 'fontSize': '.8rem'}}>
            {`◀`}
        </div>
    )
}
