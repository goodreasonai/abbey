
export function isChrome() {
    try {
        const userAgent = navigator.userAgent;
        return userAgent.includes("Chrome") && !userAgent.includes("Edge") && !userAgent.includes("OPR");
    }
    catch(e) {
        return false
    }
}
