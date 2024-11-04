

// Adds paragraphs for new lines
export function convertToHTMLContent(text) {
    return text.replace(/\n+/g, '<p>');
}


// starts inline due to styling in RestyleModal
export const abbeyHtmlStyle = `:root {
    --light-primary: #f0f0f0;
    --dark-text: #333;
    --light-green: #d5f5e3;
    --dark-primary: #516e5c;
    --light-blue: #3498db;
    --logo-blue: #1358a2;
    --logo-red: #E4433C;
    --yellow: #ffeaa7;
    --light-background: white;
    --dark-border: #666666;


    --dark-mode-light-primary: #434343;
    --dark-mode-light-green: #82B796;
    --dark-mode-red: #F37E7E;
    --dark-mode-yellow: #C0A85D;
    --dark-mode-light-background: #202020;
}
body {
    font-family: "Trebuchet MS", Arial, sans-serif;
    line-height: 1.6;
    color: var(--dark-text);
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    background-color: var(--light-primary);
}
h1, h2, h3 {
    color: var(--dark-primary);
}
h1 {
    border-bottom: 3px solid var(--light-blue);
    padding-bottom: 10px;
    font-size: 2.5em;
}
h2 {
    color: var(--logo-red);
    font-size: 2em;
}
h3 {
    color: var(--logo-red);
    font-size: 1.5em;
}
p, ul {
    margin-bottom: 15px;
    margin-left: 20px;
}
ul {
    padding-left: 20px;
}
li {
    margin-bottom: 10px;
    list-style-type: none;
    position: relative;
}
li:before {
    content: "•";
    color: var(--logo-blue);
    font-weight: bold;
    position: absolute;
    left: -15px;
}
strong {
    color: var(--logo-blue);
}
blockquote {
    background-color: var(--light-green);
    border-left: 5px solid var(--dark-primary);
    padding: 10px;
    margin: 20px 0;
    border-radius: 3px;
}
em {
    background-color: var(--yellow);
    padding: 2px 5px;
    border-radius: 3px; 
}
table {
    border-collapse: collapse;
    margin: 0;
    overflow: hidden;
    table-layout: fixed;
    width: 100%;
}

table td,
table th {
    border: 1px solid var(--dark-border);
    box-sizing: border-box;
    min-width: 1em;
    padding: 3px 5px;
    position: relative;
    vertical-align: top;
}

table td > *,
table th > * {
    margin-bottom: 0;
}

table th {
    background-color: var(--light-background);
    font-weight: 600;
    text-align: left;
}

table .selectedCell:after {
    background: var(--dark-highlight);
    opacity: .5;
    content: "";
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    pointer-events: none;
    position: absolute;
    z-index: 2;
}

table .column-resize-handle {
    background-color: var(--dark-highlight);
    bottom: -2px;
    position: absolute;
    right: -2px;
    pointer-events: none;
    top: 0;
    width: 4px;
}

table p {
    margin: 0;
}

  
.tableWrapper {
    padding: 1rem 0;
    overflow-x: auto;
}    

/* Images are always centered in ahtml */
img {
    margin: auto;
    display: block;
}
`
const abbeyHtmlStyleDark = `${abbeyHtmlStyle}
body {
    color: white;
    background-color: var(--dark-mode-light-primary);
}
h1 {
    color: var(--dark-mode-light-green);
}
h3, h2 {
    color: var(--dark-mode-red);
}
blockquote {
    background-color: var(--dark-mode-light-green)
}
strong {
    color: var(--light-blue);
}
em {
    background-color: var(--dark-mode-yellow);
}
table th {
    background-color: var(--dark-mode-light-background);
}`

// Includes styling for outline element (i.e., not included in user's html)
const extraAbbeyHtmlStyle = `
html {
    scroll-behavior: smooth;
}
.outline {
    position: fixed;
    top: 0px;
    right: 0px;
    padding: 3px 10px;
    font-size: .9rem;
    opacity: .5;
    background-color: var(--light-primary);
    border: 1px solid #dcdcdc;
    border-radius: 5px;
    margin: 5px;
    cursor: pointer;
    max-width: 400px;
    z-index: 2;
    transition: all .1s ease-in-out;
}
#headerLinksContainer {
    display: flex;
    flex-direction: column;
    gap: .5rem;
    padding-top: .5rem;
    overflow: scroll;
    max-height: 50vh;
}
.outline:hover {
    opacity: 1;
}
.headerButton {
    line-height: 1.25;
    opacity: .5;
    transition: all .1s ease-in-out;
}
.headerButton:hover {
    opacity: 1;
}

/* Scrollbar */
::-webkit-scrollbar {
    width: 8px;
}

/* This is like the background of the scroll bar */
::-webkit-scrollbar-track{
    background: var(--light-primary);
}

/* This, otherwise there's this annoying white box in the corner */
::-webkit-scrollbar-corner {
    background-color: var(--light-primary);
}

::-webkit-scrollbar-thumb:vertical {
    border: 1px solid var(--light-border);
    cursor: pointer;
    background-color: var(--dark-primary)
}
`
const extraAbbeyHtmlStyleDark = `${extraAbbeyHtmlStyle}
.outline {
    border-color: rgb(81, 81, 81);
    background-color: var(--dark-mode-light-primary);
}
::-webkit-scrollbar-track{
    background: var(--dark-mode-light-primary);
}
`


const abbeyHtmlOutlineElement = `
<div class="outline" id="topRightContainer">
    <div onClick="toggleOutline()">    
        Outline
    </div>
</div>
`

const abbeyHtmlJs = `

let outlineOpen = false;

function getHeaders(){
    // Not including h1
    // Can't use filter for reasons of insanity
    let headers = document.querySelectorAll('h2, h3, h4, h5, h6')
    let headers2 = []
    for (let h of headers){
        if (h.textContent){
            headers2.push(h)
        }
    }
    headers = headers2
    return headers
}

function toggleOutline() {
    let outlineEl = document.getElementById("topRightContainer");
    const headerLinksContainer = document.getElementById("headerLinksContainer");

    if (headerLinksContainer) {
        // If the outline exists, remove it
        headerLinksContainer.remove();
        outlineOpen = false;
        return;
    }

    const headers = getHeaders()

    const headerLinks = document.createElement('div');
    headerLinks.id = "headerLinksContainer";

    // Iterate through each header
    headers.forEach((header, index) => {
        const headerLinkItem = document.createElement('div');
        headerLinkItem.className = "headerButton";
        headerLinkItem.textContent = index+1 + ". " + header.textContent;
        headerLinkItem.setAttribute('data-header-index', index);
        headerLinks.appendChild(headerLinkItem);
    });

    // Use event delegation for click events
    headerLinks.addEventListener('click', function(e) {
        if (e.target.classList.contains('headerButton')) {
            const index = e.target.getAttribute('data-header-index');
            let container = document.getElementById("body");
            // Using scrollIntoView makes for very inconsistent and bad behvaior in the iFrame; so instead, this.
            window.scrollTo({
                top: headers[index].offsetTop
            })
        }
    });

    outlineEl.appendChild(headerLinks);
    outlineOpen = true;
}

// Add click event listener to the document
document.addEventListener('click', function(event) {
    const outlineEl = document.getElementById("topRightContainer");
    const headerLinksContainer = document.getElementById("headerLinksContainer");

    // Check if the outline is open and the click is outside the outline
    if (outlineOpen && headerLinksContainer && !outlineEl.contains(event.target)) {
        headerLinksContainer.remove();
        outlineOpen = false;
    }
});

function hideOutlineIfEmpty(){
    const headers = getHeaders();
    if (!headers.length){
        document.getElementById("topRightContainer").style.display = 'none';
    }
}

`

// the excessive backslashes are annoying, but recall that there are layers to this (you and I know)
const mathRenderTags = `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.4/dist/katex.min.css" crossorigin="anonymous">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.4/dist/katex.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.4/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
<script>
    document.addEventListener("DOMContentLoaded", function() {
        const inlineMathElements = document.querySelectorAll('[data-type="inlineMath"]');
        inlineMathElements.forEach(element => {
            renderMathInElement(element, {
                delimiters: [
                    {left: "$$", right: "$$", display: true},
                    {left: "$", right: "$", display: false},
                    {left: "\\\\(", right: "\\\\)", display: false},
                    {left: "\\\\[", right: "\\\\]", display: true},
                ],
                throwOnError : false
            });
        })
    });
</script>
`

export function convertAbbeyHtmlToHtml(ahtml, theme) {
    const style = theme == 'dark' ? abbeyHtmlStyleDark : abbeyHtmlStyle
    const extraStyle = theme == 'dark' ? extraAbbeyHtmlStyleDark : extraAbbeyHtmlStyle
    return `
    <!DOCTYPE html>
    <html>
        <head>
            <style>
                ${style}
                ${extraStyle}
            </style>
            <script type="text/javascript">${abbeyHtmlJs}</script>
            ${mathRenderTags}
        </head>
        <body id="body" onload="hideOutlineIfEmpty()">
            ${abbeyHtmlOutlineElement}
            ${ahtml}
        </body>
    </html>
    `
}


// This whole business is a bit slimy and should be cleaned up in the future.
const htmlDefaultStyle = `

/* Copy of styling in globals.css */
:root {
    --dark-primary: #516e5c;   /* Dark menus, buttons etc. */
    --dark-highlight: #61866f;  /* When you hover/select over a dark primary */
    --dark-secondary: #393b39;  /* Tooltip background (no dark mode change) */

    --light-primary: #f0f0f0;  /* Mostly for boxes on top of light background */
    --light-primary-rgb: 240, 240, 240;
    --light-highlight: #e7e7e7; /* Hover/select over a light primary */

    --light-background: rgb(250, 252, 250);  /* Lighter than light primary (used for insets) */

    --dark-text: black;
    --light-text: rgb(240, 240, 240);
    --passive-text: #707070;

    --logo-red: #BC413C;
    --logo-blue: #1358A2;
    --warning: orange;

    --light-shadow: #e0e0e0;
    --dark-shadow: #b8b8b8;

    --dark-border: #666666;  /* Doesn't change in dark mode */
    --light-border: #dcdcdc;
    --lightest-border: #e7e7e7;  /* They used to be different ok */

    --std-margin: 2rem;
    --std-margin-top: 1rem;
    
    --small-border-radius: 5px;
    --medium-border-radius: 5px;
    --large-border-radius: 15px;

    --correctiveFontMarginHeader: -3px;  /* Some fonts have some extra spacing at the top; this corrects. Use sparingly. */

}

body {
    font-family: Arial;  /* Non trivial to get fonts loaded in (TODO could try google font link, but make sure to reference in _app) */
}

ul,
ol {
    padding: 0 2rem;
}

h1, h1 > *  {
    line-height: 1.1;
    font-size: 20pt !important;
    font-weight: 700;
}

h2, h2 > * {
    line-height: 1.1;
    font-size: 18pt;
    font-weight: 600;
}

h3, h3 > *,
h4, h4 > *,
h5, h5 > *,
h6, h6 > * {
    line-height: 1.1;
    font-size: 16pt;
    font-weight: 500;
}

code {
    background-color: rgba(#616161, 0.1);
    color: #616161;
}

pre {
    background: #0D0D0D;
    color: #FFF;
    font-family: 'JetBrainsMono', monospace;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
}

img {
    max-width: 100%;
    height: auto;
}

blockquote {
    padding-left: 1rem;
    color: var(--passive-text);
    border-left: 2px solid var(--light-primary);
}

hr {
    border-color: var(--light-border);
    border-style: solid;
}

a {
    text-decoration: underline;
    cursor: pointer;
}

table {
    border-collapse: collapse;
    margin: 0;
    overflow: hidden;
    table-layout: fixed;
    width: 100%;
}

table td,
table th {
    border: 1px solid var(--dark-border);
    box-sizing: border-box;
    min-width: 1em;
    padding: 3px 5px;
    position: relative;
    vertical-align: top;
}

table td > *,
table th > * {
    margin-bottom: 0;
}

table th {
    background-color: var(--light-primary);
    font-weight: 600;
    text-align: left;
}

table .selectedCell:after {
    background: var(--dark-highlight);
    opacity: .5;
    content: "";
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    pointer-events: none;
    position: absolute;
    z-index: 2;
}

table .column-resize-handle {
    background-color: var(--dark-highlight);
    bottom: -2px;
    position: absolute;
    right: -2px;
    pointer-events: none;
    top: 0;
    width: 4px;
}

table p {
    margin: 0;
}

  
.tableWrapper {
    padding: 1rem 0;
    overflow-x: auto;
}

`

// Takes text editor value and adds styling info (DEFAULT styling rather than ahtml styling)
export function convertTextEditorHtml(html){
    return `
    <!DOCTYPE html>
    <html>
        <head>
            <style>
                ${htmlDefaultStyle}
            </style>
            ${mathRenderTags}
        </head>
        <body>
            ${html}
        </body>
    </html>
    `
}

export function removeHTMLTags(htmlText){
    // Create a new div element
    let tempDiv = document.createElement("div");
    // Set the HTML content with the provided text
    tempDiv.innerHTML = htmlText;
    // Retrieve the text property of the element (which strips out the HTML)
    return tempDiv.textContent || tempDiv.innerText || "";
}
