import { useEffect, useRef } from 'react'
import styles from './ChocolateRain.module.css'
import { NAV_BAR_LOGO } from '@/config/config'
import QuizIcon from '../../../../public/icons/QuizIcon.png'

export default function ChocolateRain({ nDrops=100, avgSpeed=1 }) {

    const containerRef = useRef()
    const updateInterval = useRef()

    function getRandomStartY(height){
        const buckets = 100
        return Math.floor(Math.floor(Math.random() * buckets) / buckets * height)
    }
    function getRandomX(width){
        const buckets = 30
        return Math.floor(Math.floor(Math.random() * buckets) / buckets * width)
    }
    function getRandomSpeed(percent) {
        let x = (((percent - .5) / 2) + 1) * avgSpeed
        return x
    }
    function getRandomInnerHTML(percent){
        const randRem = `${percent + 1}rem`
        const randPx = `${(percent * 10) + 15}px`
        const options = [
            `<span style='font-size:${randRem}'>?</span>`,
            `<img src='${NAV_BAR_LOGO.src}' width=${randPx} height=${randPx} />`,
            `<img src='${QuizIcon.src}' width=${randPx} height=${randPx} />`
        ]
        let i = Math.floor(Math.random() * options.length);
        return options[i]
    }

    useEffect(() => {
        let drops = []
        for (let i = 0; i < nDrops; i++){
            const el = document.createElement('div')
            el.classList.add(styles.rainDrop)
            const width = containerRef.current.getBoundingClientRect().width
            const height = containerRef.current.getBoundingClientRect().height
            el.style.left = `${getRandomX(width)}px`
            const y = getRandomStartY(height)
            el.style.top = `${y}px`
            let percent = Math.random()
            el.innerHTML = getRandomInnerHTML(percent)
            containerRef.current.appendChild(el);
            drops.push({
                'y': y,
                'el': el,
                'speed': getRandomSpeed(percent)
            })
        }
        let counter = 0
        let buckets = 3
        let period = drops.length / buckets
        updateInterval.current = setInterval(() => {
            try {
                const height = containerRef.current.getBoundingClientRect().height
                const width = containerRef.current.getBoundingClientRect().width
                let offset = Math.floor(counter * period)
                let limit = counter == buckets - 1 ? drops.length : period + offset
                for (let i = offset; i < limit; i++){
                    drops[i].y += drops[i].speed
                    if (drops[i].y >= height + 50){
                        drops[i].y = 0
                        drops[i].el.style.left = `${getRandomX(width)}px`
                        let percent = Math.random()
                        drops[i].speed = getRandomSpeed(percent)
                        drops[i].el.innerHTML = getRandomInnerHTML(percent)
                    }
                    drops[i].el.style.top = `${Math.round(drops[i].y)}px`
                }
                counter += 1
                if (counter >= buckets){
                    counter = 0
                }
            } catch(e) {console.log(e)}
        }, 1)
        return () => {
            for (let i = 0; i < drops.length; i++){
                drops[i].el.remove()
            }
            clearInterval(updateInterval.current)
        }
    }, [nDrops])

    return (
        <div className={styles.container} ref={containerRef}>
        </div>
    )
}
