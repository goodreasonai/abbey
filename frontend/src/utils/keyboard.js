import { useEffect, useCallback } from 'react';

const useKeyboardShortcut = (keyCombos, callback, onBody) => {
    const handleKeyPress = useCallback((event) => {
        if (onBody && (event.target.tagName != "BODY" && event.target.tagName != "A" && !(event.target.tagName == 'TEXTAREA' && event.target.readOnly))) {
            return
        }
        for (const keys of keyCombos){
            const pressedKeys = new Set();        
            keys.forEach(key => {
                if (event[key === 'Control' ? 'ctrlKey' : key === 'Shift' ? 'shiftKey' : key === 'Alt' ? 'altKey' : key === 'Meta' ? 'metaKey' : 'key'] === true || event.key === key) {
                    pressedKeys.add(key);
                }
            });

            if (pressedKeys.size === keys.length) {
                event.preventDefault();
                callback();
                break
            }
        }
    }, [keyCombos, callback]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyPress);
        
        // Cleanup the event listener on component unmount
        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, [handleKeyPress]);
};

export default useKeyboardShortcut;

export function getModKey() {
    if (typeof window == 'undefined'){
        return "Ctrl"
    }
    const platform = window?.navigator?.userAgentData?.platform || ""
    const macosPlatforms = ['macOS', 'Macintosh', 'MacIntel', 'MacPPC', 'Mac68K']
    if (macosPlatforms.indexOf(platform) !== -1) {
        return "⌘"
    }
    return "Ctrl"
}
