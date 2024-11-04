
import { useState, useEffect } from 'react';

export const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(undefined);
    const [isLarge, setIsLarge] = useState(undefined);
    useEffect(() => {
        // Function to check if screen width is below 800px
        const checkScreenSize = () => {
            setIsMobile(window.innerWidth < 800);
            setIsLarge(window.innerWidth > 1600);
        };
        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => {
            window.removeEventListener('resize', checkScreenSize);
        };
    }, []);

    return { isMobile, isLarge };
};

