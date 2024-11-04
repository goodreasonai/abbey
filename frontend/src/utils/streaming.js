import { DIVIDER_TEXT, CHAT_ERROR_TEXT } from "@/config/strConstants"


export const handleStreamingChat = async ({ reader, decoder, onSearchQuery=()=>{}, onInitial=()=>{}, onInitialEnd=(myJson, i)=>{}, onSnippetStart=()=>{}, onSnippet=(result, i)=>{} }) => {
    
    let chat_streams = {}  // Object of objects of form {'pre': {...}, 'text': ''}

    let first_read = false;

    let first_snippet_read = false;

    let buffer = ''  // For storing chars before their context is known

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break
        }
        if (!first_read){
            onInitial()
            first_read = true
        }

        buffer += decoder.decode(value);

        while (buffer.includes(DIVIDER_TEXT)){
            let ind = buffer.indexOf(DIVIDER_TEXT)
            
            let res = buffer.substring(0, ind)
            buffer = buffer.substring(ind+DIVIDER_TEXT.length)
            
            let myJson = JSON.parse(res)

            let index = myJson['index']

            if (myJson['search_query']){
                onSearchQuery(myJson['search_query'], index)
            }
            else if (chat_streams[index]) {
                chat_streams[index].text += myJson['result']
                if (!first_snippet_read){
                    first_snippet_read = true
                    onSnippetStart(chat_streams[index].text, index)
                }
                if (chat_streams[index].text.includes(CHAT_ERROR_TEXT)){
                    throw Error("Chat error")
                }
                onSnippet(chat_streams[index].text, index)
            }
            else {
                chat_streams[index] = {
                    'pre': myJson['result'],
                    'text': ''
                }
                onInitialEnd(chat_streams[index].pre, index)
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
