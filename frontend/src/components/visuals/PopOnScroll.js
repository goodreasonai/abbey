import { useState, useRef, useEffect } from "react";
import styles from './PopOnScroll.module.css'

export default function PopOnScroll({ children }) {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef(null);
  
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        setIsVisible(true);
                    }, 200)  // delay so that the animation is noticed
                    observer.unobserve(entry.target);
                }
            },
            { threshold: 0.1 }
        );
  
        if (ref.current) {
            observer.observe(ref.current);
        }
  
        return () => {
            if (ref.current) {
                observer.unobserve(ref.current);
            }
        };
    }, []);
  
    return (
        <div ref={ref} className={`${styles.animateOnScroll} ${isVisible ? `${styles.animateVisible}` : ''}`}>
            {children}
        </div>
    );
};