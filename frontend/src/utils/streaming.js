import { DIVIDER_TEXT, CHAT_ERROR_TEXT } from "@/config/strConstants"


export const handleStreamingChat = async ({ reader, decoder, onSearchQuery=()=>{}, onInitial=()=>{}, onInitialEnd=(myJson)=>{}, onReasoning=()=>{}, onSnippetStart=()=>{}, onSnippet=(result)=>{}, signal }) => {
    
    let first_read = false;
    let first_snippet_read = false;

    let buffer = ''  // For storing chars before their context is known
    let txt = ''
    let reasoning =  ''

    while (true) {

        if (signal && signal.aborted){
            break
        }

        const { value, done } = await reader.read();
        if (done) {
            break
        }
        if (!first_read){
            onInitial()
            first_read = true
        }

        buffer += decoder.decode(value);

        // DIVIDER TEXT comes at the end of each streaming object
        while (buffer.includes(DIVIDER_TEXT)){
            let ind = buffer.indexOf(DIVIDER_TEXT)
            
            let res = buffer.substring(0, ind)
            buffer = buffer.substring(ind+DIVIDER_TEXT.length)
            
            let myJson = JSON.parse(res)

            if (myJson['type'] == 'search_query'){
                onSearchQuery(myJson['text'])
            }
            else if (myJson['type'] == 'meta'){
                onInitialEnd(myJson['meta'])
            }
            else if (myJson['type'] == 'text'){
                if (!first_snippet_read){
                    first_snippet_read = true
                    onSnippetStart()
                }
                if (myJson['reasoning']){
                    reasoning += myJson['reasoning']
                    onReasoning(reasoning)
                }
                if (myJson['text']){
                    txt += myJson['text']
                    onSnippet(txt)
                }
            }
        }
    }
}

export const handleGeneralStreaming = async ({ reader, decoder, onSnippet=(result)=>{} }) => {
    let result = '';
    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break
        }
        else {
            let newPart = decoder.decode(value)
            result += newPart;
            onSnippet(result)
        }
    }
}

// Assumes pattern of TEXT-DIVIDER-TEXT-DIVIDER ... -DIVIDER
// onSnippet is called with chunks, not total result.
export const handleChoppedStreaming = async ({ reader, decoder, onSnippet=(result, i)=>{} }) => {
    
    let buffer = ''  // For storing chars before their context is known

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break
        }
        buffer += decoder.decode(value);
        while (buffer.includes(DIVIDER_TEXT)){
            let ind = buffer.indexOf(DIVIDER_TEXT)
            let res = buffer.substring(0, ind)  // everything up to the first divider text
            buffer = buffer.substring(ind+DIVIDER_TEXT.length)  // new buffer is everything after the current divider
            onSnippet(res)
        }

    }
}
