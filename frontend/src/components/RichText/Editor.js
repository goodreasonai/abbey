import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Bold from '@tiptap/extension-bold'
import Text from '@tiptap/extension-text'
import Heading from '@tiptap/extension-heading'
import BulletList from '@tiptap/extension-bullet-list'
import ListItem from '@tiptap/extension-list-item'
import Underline from '@tiptap/extension-underline'
import Italic from '@tiptap/extension-italic'
import Link from '@tiptap/extension-link'
import { generateJSON, generateHTML } from '@tiptap/html'
import { EditorProvider, useCurrentEditor } from '@tiptap/react'
import styles from './Editor.module.css'
import MenuBar from './MenuBar'
import ImageResize from 'tiptap-extension-resize-image';
import Image from '@tiptap/extension-image';
import History from '@tiptap/extension-history';
import Blockquote from '@tiptap/extension-blockquote';
import FontSize from 'tiptap-extension-font-size';
import TextStyle from '@tiptap/extension-text-style'
import HardBreak from '@tiptap/extension-hard-break'
import { useEffect, useMemo, useRef, useState } from 'react'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import TextAlign from '@tiptap/extension-text-align'
import { LineHeight } from './CustomExtensions/LineHeight'
import { Indent } from './CustomExtensions/Indent'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import Gapcursor from '@tiptap/extension-gapcursor'
import TableToolbar from './TableToolbar'
import OrderedList from '@tiptap/extension-ordered-list'
import CustomShortcuts from './CustomExtensions/CustomShortcuts'
import { MathExtension } from '@aarkue/tiptap-math-extension'
import Placeholder from '@tiptap/extension-placeholder'


export const extensions = [
    Document,
    Text,
    Heading,
    Bold,
    Underline,
    BulletList,
    OrderedList,
    ListItem,
    Paragraph,
    Italic,
    Link,
    ImageResize.configure({
        allowBase64: true,
        inline: true
    }),
    History,
    Blockquote.configure({
        HTMLAttributes: {
          class: styles.blockquote,
        }
    }),
    FontSize,
    TextStyle,
    HardBreak,
    HorizontalRule,
    TextAlign.configure({
        'types': ['heading', 'paragraph'],
        'defaultAlignment': 'left',
        'alignments': ['left', 'right', 'center']
    }),
    LineHeight.configure({
        types: ["heading", "paragraph"],
        heights: ["100%", "115%", "150%", "200%", "250%", "300%"]
    }),
    Indent,
    Gapcursor,
    Table.configure({
        resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
    MathExtension.configure({
        'delimiters': 'bracket'
    })
]

// onChange should be (myJson) => {} and onChangeHTML should be (html) => {}
export default function Editor({ htmlContent=undefined, editable=true, jsonContent=undefined, showMenu=true, showDelete=false, assetId=undefined, deleteCallback=()=>{}, onChange=undefined, onChangeHTML=undefined, minHeightOption='medium', customRightMenu=undefined, editorPaddingOption="medium", clearContentCounter=0, style={}, shortcuts=[], exclude=[], disablePromptSelector=false, placeholder='', ...props }) {

    const [contextMenu, setContextMenu] = useState(null);
    const editorContainerRef = useRef()

    const editorExtensions = [
        ...extensions,
        CustomShortcuts.configure({
            'shortcuts': shortcuts  // list of {'key': (see documentation), 'fn': ()=>{}}
        }),
        Placeholder.configure({
            'placeholder': placeholder,
            'emptyEditorClass': styles.placeholder,
        })
    ]

    function onUpdate({ editor }){
        if (onChange){
            let myJson = generateJSON(editor.getHTML(), extensions)
            onChange(myJson)
        }
        if (onChangeHTML){
            onChangeHTML(editor.getHTML(), extensions)
        }
    }

    let content = ""
    if (jsonContent && jsonContent.type == 'doc' ){
        content = generateHTML(jsonContent, extensions)
    }
    else if (htmlContent){
        content = htmlContent
    }
    else if (jsonContent){
        content = jsonContent
    }

    const handleContextMenu = (event) => {
        const target = event.target;
    
        if (target.closest('table')) {
            event.preventDefault();
            const containerRect = editorContainerRef.current.getBoundingClientRect();
            setContextMenu({
                position: { 
                    x: event.clientX - containerRect.left, 
                    y: event.clientY - containerRect.top 
                },
            })
        }
        else {
          setContextMenu(null);
        }
    };

    const minHeightClass = styles[`minHeight_${minHeightOption}`]
    const paddingClass = styles[`padding_${editorPaddingOption}`]

    return (
        <div
            translate='no'
            className={`${styles.editorContainer}`}
            style={{...style, 'position': 'relative'}}
            onContextMenu={handleContextMenu}
            ref={editorContainerRef}
            {...props}>
            <EditorProvider
                onUpdate={onUpdate}
                editable={editable}
                slotBefore={(showMenu ? <MenuBar disablePromptSelector={disablePromptSelector} exclude={exclude} clearContentCounter={clearContentCounter} showDelete={showDelete} assetId={assetId} deleteCallback={deleteCallback} customRightMenu={customRightMenu} /> : "")}
                extensions={editorExtensions}
                content={content}
                className={`${styles.editorProvider}`}
                editorProps={{
                    'attributes': {'class': `${styles.editorProvider} ${minHeightClass} ${paddingClass}`},
                }}
                parseOptions={{'preserveWhitespace': true}}
            >
                {contextMenu && (
                    <TableToolbar
                        onClose={() => setContextMenu(null)}
                        position={contextMenu.position}
                    />
                )}
            </EditorProvider>
        </div>
    )
}
