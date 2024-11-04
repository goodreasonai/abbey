import { useEffect, useRef, useState } from "react";
import ScrollWithFixedScene from "./ScrollWithFixedScene";
import MarkdownViewer from "../Markdown/MarkdownViewer";
import styles from './ScrollingCards.module.css'
import { useIsMobile } from "@/utils/mobile";

export default function ScrollingCards({ cards, title, paragraph, forceLightText=false, ...props }) {
    
    const { isMobile } = useIsMobile()

    const containerRef = useRef(null);
    const textBlockContainer = useRef(null)
    const cardsContainer = useRef(null)

    function onAnimate(time) {
        const textBlockWidth = textBlockContainer.current.getBoundingClientRect().width
        const cardsContainerWidth = cardsContainer.current.getBoundingClientRect().width

        const viewportWidth = window.innerWidth
        let slope = 0
        if (cardsContainerWidth > viewportWidth){
            slope = (textBlockWidth + cardsContainerWidth - viewportWidth) // if cards is bigger than vw, then the ending displacement is cards width - viewportWidth
        }
        else {
            slope = (textBlockWidth - .5 * (viewportWidth - cardsContainerWidth))
        }
        const newDisplacement = slope * time
        containerRef.current.style.left = `-${newDisplacement}px`
        textBlockContainer.current.style.opacity = `${1 - time}`
    }

    const textBlockWidth = isMobile ? "100vw" : "60vw"
    const cardWidth = `400px`
    const cardHeight = '70vh'
    const fullWidth = `calc(${textBlockWidth} + (${cardWidth} + 2 * var(--std-margin)) * ${cards.length})`

    return (
        <ScrollWithFixedScene heightMultiplier={2} onAnimate={onAnimate}>
            <div style={{'height': '100vh', 'overflow': 'hidden'}}>
                <div ref={containerRef} style={{'display': 'flex', 'height': '100%', 'position': 'relative', 'width': fullWidth}}>
                    <div ref={textBlockContainer} style={{'width': textBlockWidth, 'padding': 'var(--std-margin)', 'display': 'flex', 'alignItems': 'center', 'justifyContent': 'center'}}>
                        <div style={{'width': '80%', 'display': 'flex', 'flexDirection': 'column', ...(isMobile ? {'gap': '2rem'} : {'gap': '3rem'})}}>
                            <div style={isMobile ? {'fontSize': '2rem'} : {'fontSize': '3rem'}}>
                                {title}
                            </div>
                            <div>
                                <MarkdownViewer style={isMobile ? {'fontSize': '1.1rem'} : {'fontSize': '1.25rem'}} className={`${styles.cardsMarkdownContainer} ${forceLightText ? styles.cardsMarkdownContainerLightText : ''}`}>
                                    {paragraph}
                                </MarkdownViewer>
                            </div>
                        </div>
                    </div>
                    <div style={{'display': 'flex', 'alignItems': 'center'}} ref={cardsContainer} >
                        {cards.map((x, i) => {
                            return (
                                <div key={i} style={{'width': cardWidth, 'height': cardHeight, 'padding': '10px', 'margin': 'var(--std-margin)'}}>
                                    {x.content}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </ScrollWithFixedScene>
    )
}