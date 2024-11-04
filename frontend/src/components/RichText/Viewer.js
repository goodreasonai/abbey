
import { EditorProvider, generateHTML } from '@tiptap/react'
import { extensions } from './Editor'
import styles from './Editor.module.css'


// case insensitive
export function boldWordsInHtml(html, boldWords, className) {
    // Create a DOMParser to parse the HTML string
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Function to wrap a word in a bold tag with optional class
    function wrapWord(word) {
        const bTag = document.createElement('b');
        if (className) {
            bTag.className = className;
        }
        bTag.textContent = word;
        return bTag;
    }

    const boldWordsLc = boldWords.map((x) => x.toLowerCase())

    // Function to recursively traverse and process text nodes
    function traverseNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const parent = node.parentNode;
            const words = node.textContent.split(/\b/); // Split by word boundaries
            const fragment = document.createDocumentFragment();
            words.forEach((word) => {
                if (boldWordsLc.includes(word.toLowerCase())) {
                    fragment.appendChild(wrapWord(word));
                } else {
                    fragment.appendChild(document.createTextNode(word));
                }
            });
            parent.replaceChild(fragment, node);
        } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
            Array.from(node.childNodes).forEach(traverseNodes);
        }
    }

    // Start traversing from the body of the parsed document
    traverseNodes(doc.body);

    // Return the modified HTML as a string
    return doc.body.innerHTML;
}


export default function RichTextViewer({ content, onLoad=undefined, minHeightOption='none', boldWords=[], viewerPaddingOption="small", ...props }){

    let realContent = ""
    if (content && typeof content === 'object' && content.type == 'doc'){
        realContent = generateHTML(content, extensions)
    }
    else if (content){
        realContent = content
    }

    if (boldWords.length){
        realContent = boldWordsInHtml(realContent, boldWords)
    }
    const minHeightClass = styles[`minHeight_${minHeightOption}`]
    const paddingClass = styles[`padding_${viewerPaddingOption}`]
    return (
        <div className={styles.editorProvider} {...props}>
            <EditorProvider
                onCreate={({ editor }) => {onLoad && onLoad(editor)}}
                editable={false}
                extensions={extensions}
                content={realContent}
                editorProps={{'attributes': {'class': `${styles.editorProvider} ${minHeightClass} ${paddingClass}`}}}
            >
            </EditorProvider>
        </div>
    )
}
