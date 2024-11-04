import { useRef, useEffect } from 'react';


// setLoading(1) is called whenever the useEffect is triggered.
export default function useSaveDataEffect(data, canSave, request, delay, setLoading) {
    const timeoutRef = useRef(null);
    if (delay === undefined){
        delay = 1000
    }

    useEffect(() => {

        if (!canSave){
            return   
        }

        // Clear any existing timeout
        if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
        }

        if (setLoading){
            setLoading(1)
        }

        // Schedule a new timeout
        timeoutRef.current = setTimeout(() => {
            request(data);
            // Clear the timeout ref so we know the code has run
            timeoutRef.current = null;
        }, delay);

        // Clear the timeout when the component is unmounted or the data changes
        return () => {
            if (timeoutRef.current !== null) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [data, request, canSave, setLoading]);
}
