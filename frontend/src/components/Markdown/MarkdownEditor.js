import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import styles from './Markdown.module.css'
import React, { useState } from 'react'
import { MDXEditor } from '@mdxeditor/editor/MDXEditor'
import '@mdxeditor/editor/style.css'
import { useTheme } from 'next-themes'

import {
    diffSourcePlugin,
    markdownShortcutPlugin,
    AdmonitionDirectiveDescriptor,
    directivesPlugin,
    frontmatterPlugin,
    headingsPlugin,
    imagePlugin,
    linkDialogPlugin,
    linkPlugin,
    listsPlugin,
    quotePlugin,
    tablePlugin,
    thematicBreakPlugin,
    toolbarPlugin,
    codeBlockPlugin,
    codeMirrorPlugin,
    CodeMirrorEditor,

    // Toolbar stuff
    Separator,
    CreateLink,
    UndoRedo,
    BoldItalicUnderlineToggles,
    ListsToggle,
    InsertTable,
    BlockTypeSelect
} from '@mdxeditor/editor'


export default function MarkdownEditor({value, onChange}){

    const toolbarStuff = (
        <>
            <UndoRedo />

            <Separator />

            <BoldItalicUnderlineToggles/>

            <Separator />

            <CreateLink />

            <Separator />

            <ListsToggle />

            <Separator />

            <InsertTable />

            <Separator />

            <BlockTypeSelect />
        </>
    )

    const ALL_PLUGINS = [
        toolbarPlugin({ toolbarContents: () => toolbarStuff }),
        listsPlugin(),
        quotePlugin(),
        headingsPlugin({ allowedHeadingLevels: [1, 2, 3] }),
        linkPlugin(),
        linkDialogPlugin(),
        imagePlugin({ imageAutocompleteSuggestions: [''] }),
        tablePlugin(),
        thematicBreakPlugin(),
        frontmatterPlugin(),
        codeBlockPlugin({ defaultCodeBlockLanguage: 'txt', codeBlockEditorDescriptors: [
            {
              priority: 100,
              match: () => true,
              Editor: CodeMirrorEditor,
            },
        ], }),
        codeMirrorPlugin({ codeBlockLanguages: { js: 'JavaScript', css: 'CSS', txt: 'text', tsx: 'TypeScript' } }),
        directivesPlugin({ directiveDescriptors: [AdmonitionDirectiveDescriptor] }),
        diffSourcePlugin({ viewMode: 'rich-text', diffMarkdown: 'boo' }),
        markdownShortcutPlugin(),
    ]

    const { theme, setTheme } = useTheme()

    // While appearing controlled, should not actually be controlled due to internal MdEditor things
    const [internalValue, setInternalValue] = useState(value)

    function realOnChange(x){
        setInternalValue(x)
        if (onChange){
            onChange(x)
        }
    }
    const darkThemes = ['dark']
    let useDark = darkThemes.includes(theme)

    return ( useDark ?
        (<div style={{'borderBottom': '2px solid var(--light-primary)'}} className={styles.editorArticle}>
            <MDXEditor className="dark-theme"  markdown={internalValue} onChange={realOnChange} plugins={ALL_PLUGINS} />
        </div>)
        :
        (<div style={{'borderBottom': '2px solid var(--light-primary)'}} className={styles.editorArticle}>
            <MDXEditor markdown={internalValue} onChange={realOnChange} plugins={ALL_PLUGINS} />
        </div>)
    )
}
