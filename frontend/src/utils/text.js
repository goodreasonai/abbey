
// Whichever is triggered first, either maxWords or maxCharacters
// Some good defaults: 50, 750
export default function shortenText(text, maxWords, maxCharacters, includeElipses){
    if (!text){
        return ""
    }
    const words = text.split(' ');
    let shortened = words.slice(0, maxWords).join(' ');
    
    if (shortened.length > maxCharacters) {
        shortened = text.substr(0, maxCharacters);
    }
    
    if (includeElipses && (words.length > maxWords || text.length > maxCharacters)){
        shortened += '...'
    }

    return shortened
}


// Turns https://abc.com/news INTO "abc"
export function extractSiteName(url) {
    let siteName = url.replace(/^https?:\/\//, '');
  
    // Remove "www." if present
    siteName = siteName.replace(/^www\./, '');
    
    // Remove any path, query parameters, or fragments after the domain
    siteName = siteName.replace(/[/\?#].*$/, '');
    
    // Remove the top-level domain (.com, .org, etc.)
    siteName = siteName.replace(/\.[^.]+$/, '');
    
    return siteName;
}

// Turns https://abc.com/news INTO "https://abc.com"
// OR: https://www.mobile.abbey.org?page=5 INTO "https://www.mobile.abbey.org"
export function extractRootUrl(url) {
    try {  // for malformatted or blank urls
        const parsedUrl = new URL(url);
        return `${parsedUrl.protocol}//${parsedUrl.hostname}`;
    }
    catch(e) {
        return ""
    }
}

// https://www.mysite.com/path --> mysite.com/path
export function extractSiteWithPath(fullUrl) {
    try {
        const url = new URL(fullUrl);
        let host = url.hostname;
        let path = url.pathname;
    
        // Remove "www." if it exists
        if (host.startsWith('www.')) {
            host = host.slice(4);
        }
        
        return host + path;
    
    } catch (error) {
        console.error("Invalid URL:", fullUrl);
        return fullUrl; // Return the original URL if parsing fails
    }
}

export function toWords(sentence) {
    // Remove punctuation from the sentence
    const cleanedSentence = sentence.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
  
    // Split the sentence into an array of words
    const words = cleanedSentence.split(' ');
  
    // Remove any empty strings from the array
    const nonEmptyWords = words.filter(word => word !== '');
  
    return nonEmptyWords;
}

export function toPercentage(numerator, denominator) {
    if (denominator === 0) {
        return 0  // Real math
    }
    const percentage = Math.floor((numerator / denominator) * 100);
    return percentage
}


export function removeCitations(text) {
    // Regular expression to match \cit{...}{...}
    const citationRegex = /\\cit\{[^}]+\}\{[^}]+\}/g;
    // Replace all matches with an empty string
    return text.replace(citationRegex, '');
}

// objs are form [{'text': '', 'citations': [...]}, ...]
export function addCitations(objs) {
    // To the end of each text, add text of the form \cit{citation text}{i} where i goes from 1, 2, 3, ... for each citation - except if a citation matches an earlier one, in which case the same number is used.
    
    let citationMap = new Map(); // Map to store unique citations and their numbers
    let citationCounter = 1; // Counter for assigning numbers to new citations

    return objs.map(obj => {
        let citationText = '';
        
        obj.citations.forEach(citation => {
            if (!citationMap.has(citation)) {
                // If it's a new citation, add it to the map with a new number
                citationMap.set(citation, citationCounter);
                citationCounter++;
            }
            
            // Add the citation to the text
            citationText += `\\cit{${citation}}{${citationMap.get(citation)}} `;
        });

        // Trim any trailing space and add the citations to the original text
        return {
            ...obj,
            text: obj.text + citationText.trim()
        };
    });
}

// https://boy.com/mypath --> "/mypath"
export function extractPath(url) {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.pathname;
    } catch (error) {
        console.error("Invalid URL:", error);
        return null;
    }
}
