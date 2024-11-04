
import { useEffect, useState } from 'react'
import ControlledInputText from '../form/ControlledInputText'
import MyImage from '../MyImage/MyImage'
import CircleCheckIcon from '../../../public/icons/CircleCheckIcon.png'
import DeleteIcon from '../../../public/icons/DeleteIcon.png'
import { useCurrentEditor } from '@tiptap/react'
import styles from './Editor.module.css'
import LinkIcon from '../../../public/icons/LinkIcon.png'
import ImageIcon from '../../../public/icons/ImageIcon.png'
import BlockQuoteIcon from '../../../public/icons/BlockQuoteIcon.png'
import LeftAlignIcon from '../../../public/icons/LeftAlignIcon.png'
import CenterAlignIcon from '../../../public/icons/CenterAlignIcon.png'
import RightAlignIcon from '../../../public/icons/RightAlignIcon.png'
import LineSpaceIcon from '../../../public/icons/LineSpaceIcon.png'
import Number from '../form/Number'
import { Auth } from "@/auth/auth";
import { handleChoppedStreaming, handleGeneralStreaming } from '@/utils/streaming'
import MoreNotSquareIcon from '../../../public/icons/MoreNotSquareIcon.png'
import Tooltip from '../Tooltip/Tooltip'
import Loading from '../Loading/Loading'
import AIWriteIcon from '../../../public/icons/AIWriteIcon.png'
import Dropdown from '../Dropdown/Dropdown'
import TableIcon from '../../../public/icons/TableIcon.png'
import { convertToHTMLContent } from '@/utils/html'
import Modal from '../Modal/Modal'
import MenuPromptSelector from './MenuPromptSelector'
import { generateJSON } from '@tiptap/react'
import { extensions } from './Editor'


export default function MenuBar({ showDelete=false, assetId=undefined, deleteCallback=()=>{}, clearContentCounter=0, customRightMenu=undefined, exclude=[], disablePromptSelector=false }) {
    const { editor } = useCurrentEditor()

    const [showLinkOptions, setShowLinkOptions] = useState(false)
    const [linkUrl, setLinkUrl] = useState("")
    const [aiLoadState, setAiLoadState] = useState(0)
    const [showAiOptions, setShowAiOptions] = useState(false)
    const [selectedPrompt, setSelectedPrompt] = useState(undefined)
    const { getToken } = Auth.useAuth()

    function onLinkSet(){
        if (!linkUrl && editor.isActive('link')){
            editor.commands.unsetLink()
        }
        else {
            editor.commands.setLink({'href': linkUrl})
        }
        setShowLinkOptions(false)
    }

    function onLinkUnset(){
        editor.commands.unsetLink()
        setShowLinkOptions(false)
    }

    useEffect(() => {
        if (!editor.isActive('link')){
            setShowLinkOptions(false)
        }
        else {
            setLinkUrl(editor.getAttributes('link').href)
        }
    }, [editor.isActive('link') && editor.getAttributes('link').href])

    useEffect(() => {
        if (clearContentCounter > 0 && editor){
            editor.commands.clearContent()
        }
    }, [clearContentCounter])

    const handleImageUpload = (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
    
        reader.onload = (event) => {
            const base64Image = event.target.result;
            editor.chain().focus().setImage({ src: base64Image }).run()
        };
    
        reader.readAsDataURL(file);
    };

    async function aiWrite(){
        editor.setOptions({'editable': false})
        try {
            let context = ""
            let startPos = editor.state.selection.$from
            let path = []
            let i = 0;
            while(true) {
                let index = startPos.index(i)
                if (index === undefined){
                    break
                }
                path = [index, ...path]
                i++
            }
            context = startPos.nodeBefore && path.length && path[0] == 0 ? startPos.nodeBefore.textContent : ""  // stuff immediately before cursor in same node.
            function isAfter(thisPath, thatPath){
                for (let i = 0; i < thisPath.length; i++){
                    if (thisPath[i] > thatPath[i]){
                        return true
                    }
                }
                return false
            }
            function seek(node, currPath) {
                // cut off at 2000 characters
                if (context.length > 2000){
                    return
                }
                if (!node){
                    return
                }
                // Why wrap? Because it looks like there's some prose mirror bug that could throw an error on the calculation of node.children, oddly enough, for some corrupted node. Ignoring it seems to mitigate the issue.
                let hasChildren = false
                try{
                    hasChildren = node.children && node.children.length                        
                } catch(e){console.log(e)}
                
                if (hasChildren){
                    for (let i = node.children.length - 1; i >= 0; i--){
                        seek(node.children[i], [...currPath, i])
                    }
                }
                else {
                    // ignore stuff after
                    if (isAfter(currPath, path) || JSON.stringify(path) == JSON.stringify(currPath)){
                        return
                    }
                    // If there's no text content, good chance there is content but just in some other node, like math.
                    let newContent = ""
                    if (!node.textContent){
                        let contentArray = node.content?.content
                        for (let node of contentArray){
                            let math = node.attrs?.latex
                            if (math){
                                newContent += node.attrs.display ? "\\[" + math + "\\]" : "\\(" + math + "\\)"
                            }
                            if (node.type?.name == 'image'){
                                newContent += " (Image) "
                            }
                        }
                    }
                    else {
                        newContent = node.textContent
                    }

                    if (newContent){
                        context = newContent + "\n" + context
                    }
                }
            }
            seek(editor.$pos(0), [0])
            setAiLoadState(1)
            const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/text-editor/continue"
            const data = {
                'context': context,
                'id': assetId,
                'exclude': exclude
            }
            if (selectedPrompt){
                data['system_prompt'] = selectedPrompt  // Should be obj with keys preamble and conclusion
            }
            const response = await fetch(url, {
                'headers': {
                    'x-access-token': await getToken(),
                    'Content-Type': 'application/json'
                },
                'body': JSON.stringify(data),
                'method': 'POST'
            })
            if (!response.ok){
                throw Error("Response was not ok")
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            
            let buffer = ""
            let potentialHTMLDetected = false
            await handleChoppedStreaming({
                reader: reader,
                decoder: decoder,
                onSnippet: (result)=>{
                    if (result.includes('<')){
                        potentialHTMLDetected = true
                    }
                    if (result.includes('\\')){
                        potentialHTMLDetected = true
                    }
                    if (!potentialHTMLDetected){
                        for (let i = 0; i < result.length; i++){
                            if (result[i] == '\n'){
                                editor.commands.insertContent("<p>")
                            }
                            else {
                                editor.commands.insertContent(result[i])
                            }
                        }
                    }
                    else {
                        buffer += result
                    }
                },
            })
            if (buffer){
                function removeWhitespaceBetweenTags(input) {
                    return input.replace(/>\s+</g, '><');
                }
                function replaceLatexWithHTML(content) {
                    // Replace inline LaTeX delimiters $ ... $
                    content = content.replace(/\\\((.*?)\\\)/g, (match, latex) => {
                        return `<span data-type="inlineMath" data-display="no" data-latex="${latex.trim()}">${latex.trim()}</span>`;
                    });
                  
                    // Replace display LaTeX delimiters $$ ... $$
                    content = content.replace(/\\\[(.*?)\\\]/g, (match, latex) => {
                        return `<span data-type="inlineMath" data-display="yes" data-latex="${latex.trim()}">${latex.trim()}</span>`;
                    });
                    return content;
                }
                buffer = removeWhitespaceBetweenTags(buffer)
                buffer = replaceLatexWithHTML(buffer)
                buffer = convertToHTMLContent(buffer)
                let myJson = generateJSON(buffer, extensions)
                editor.commands.insertContent(myJson)
            }
            setAiLoadState(2)
        }
        catch(e) {
            console.log(e)
            setAiLoadState(3)
        }
        editor.setOptions({'editable': true})
    }

    const currFontSize = editor.getAttributes('textStyle').fontSize || (editor.isActive('heading', { level: 1 }) ? '18pt' : '12pt')

    const buttons = [
        {
            'onClick': () => editor.chain().focus().toggleBold().run(),
            'isActive': editor.isActive('bold'),
            'value': (
                <div style={{'fontWeight': 'bold'}}>B</div>
            ),
        },
        {
            'onClick': () => editor.chain().focus().toggleItalic().run(),
            'isActive': editor.isActive('italic'),
            'value': (<div style={{'fontStyle': 'italic'}}>I</div>)
        },
        {
            'onClick': () => editor.chain().focus().toggleUnderline().run(),
            'isActive': editor.isActive('underline'),
            'value': (<div style={{'textDecoration': 'underline'}}>U</div>)
        },
        {
            'onClick': () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
            'isActive': editor.isActive('heading', { level: 1 }),
            'value': (<div style={{'fontWeight': '700'}}>H1</div>)
        },
        {
            'onClick': () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            'isActive': editor.isActive('heading', { level: 2 }),
            'value': (<div style={{'fontWeight': '600'}}>H2</div>)
        },
        {
            'onClick': () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
            'isActive': editor.isActive('heading', { level: 3 }),
            'value': (<div style={{'fontWeight': '500'}}>H3</div>)
        },
        {
            'onClick': () => {},
            'isActive': editor.isActive('link'),
            'value': (
                <div style={{'display': 'flex', 'alignItems': 'center'}} onClick={() => {editor.isActive('link') && setLinkUrl(editor.getAttributes('link').href); !editor.isActive('link') && setLinkUrl(''); setShowLinkOptions(true)}}>
                    <MyImage src={LinkIcon} width={20} height={20} alt={"Link"} />
                </div>
            )
        },
        {
            'onClick': () => {
                document.getElementById('_imageInput').click()
            },
            'isActive': false,
            'value': (
                <>
                    <input
                        id="_imageInput"
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleImageUpload}
                        onClick={(event) => {event.target.value = null}}  /* weirdness - uploading the same image twice in a row doesnt trigger onChange, so this is here. */
                    />
                    <MyImage src={ImageIcon} width={17} height={17} alt={"Image"} />
                </>
            )
        },
        {
            'onClick': () => {editor.commands.toggleBlockquote()},
            'isActive': editor.isActive('blockquote'),
            'value': (
                <MyImage src={BlockQuoteIcon} width={18} height={18} alt={"Blockquote"} />
            )
        },
        {
            'onClick': () => editor.chain().focus().setHorizontalRule().run(),
            'isActive': false,
            'value': (
                <div style={{'fontWeight': 'bold', 'display': 'flex', 'flexDirection': 'column', 'fontSize': '.5rem'}}>
                    <div style={{'borderBottom': '1px solid black', 'width': '20px', 'textAlign': 'center'}}>H</div>
                    <div style={{'textAlign': 'center'}}>R</div>
                </div>
            )
        },
        {
            'onClick': () => editor.chain().focus().setTextAlign('left').run(),
            'isActive': editor.isActive({ textAlign: 'left' }),
            'value': (
                <MyImage src={LeftAlignIcon} width={20} height={20} alt={"Left align"} />
            )
        },
        {
            'onClick': () => editor.chain().focus().setTextAlign('center').run(),
            'isActive': editor.isActive({ textAlign: 'center' }),
            'value': (
                <MyImage src={CenterAlignIcon} width={20} height={20} alt={"Center align"} />
            )
        },
        {
            'onClick': () => editor.chain().focus().setTextAlign('right').run(),
            'isActive': editor.isActive({ textAlign: 'right' }),
            'value': (
                <MyImage src={RightAlignIcon} width={20} height={20} alt={"Right align"} />
            )
        },
        {
            'onClick': () => editor.commands.insertTable({ rows: 3, cols: 3 }),
            'isActive': false,
            'value': (
                <MyImage src={TableIcon} width={20} height={20} alt={"Table"} />
            )
        },
        {
            'onClick': () => {},
            'isActive': false,
            'value': (
                <Dropdown
                    initialButtonStyle={{'padding': '0px', 'backgroundColor': 'inherit'}}
                    optionsStyle={{'width': '50px', 'fontSize': '.8rem', 'backgroundColor': 'var(--light-primary)'}}
                    openCallback={() => {}}
                    closeCallback={() => {}}
                    closeOnSelect={false}
                    rightAlign={true}
                    value={(<MyImage src={LineSpaceIcon} width={20} height={20} alt={"Line Space"} />)}
                    options={[
                        {'value': '2.0', 'style': {'minWidth': 'unset', 'width': '50px', ...(editor.isActive({ lineHeight: '200%' }) ? {'backgroundColor': 'var(--dark-primary)', 'color': 'var(--light-text)'} : {'backgroundColor': 'var(--light-primary)', 'color': 'var(--dark-text)'})}, 'onClick': ()=>{editor.chain().focus().setLineHeight('200%').run()}},
                        {'value': '1.5', 'style': {'minWidth': 'unset','width': '50px', ...(editor.isActive({ lineHeight: '150%' }) ? {'backgroundColor': 'var(--dark-primary)', 'color': 'var(--light-text)'} : {'backgroundColor': 'var(--light-primary)', 'color': 'var(--dark-text)'})}, 'onClick': ()=>{editor.chain().focus().setLineHeight('150%').run()}},
                        {'value': '1.0', 'style': {'minWidth': 'unset', 'width': '50px', ...(editor.isActive({ lineHeight: '100%' }) ? {'backgroundColor': 'var(--dark-primary)', 'color': 'var(--light-text)'} : {'backgroundColor': 'var(--light-primary)', 'color': 'var(--dark-text)'})}, 'onClick': ()=>{editor.chain().focus().setLineHeight('100%').run()}},
                    ]}
                />
            )
        },
        {
            'onClick': () => {},
            'isActive': false,
            'noClass': true,
            'value': (
                <div style={{'display': 'flex', 'alignItems': 'center', 'height': '100%'}}>
                    <Number style={{'border': '1px solid var(--light-border)', 'padding': '2px', 'width': 'calc(2em + 5px)', 'marginLeft': '5px', 'marginRight': '5px'}} value={parseInt(currFontSize.replace(/\D/g, ''))} onChange={(e) => editor.commands.setFontSize(`${e.target.value}pt`)} width={2} />
                </div>
            )
        },
        {
            'onClick': () => {aiWrite()},
            'isActive': false,
            'disabled': assetId === undefined,
            'value': aiLoadState == 1 ? <Loading size={18} text="" /> : (
                <Tooltip content={"AI continue"}>
                    <div style={{'display': 'flex', 'gap': '3px', 'alignItems': 'center', 'fontFamily': 'var(--font-header)'}}>
                        <div>
                            AI
                        </div>
                        <MyImage src={AIWriteIcon} height={15} alt={"AI Write"} />
                        {!disablePromptSelector ? (
                            <div onClick={(e) => {e.preventDefault(); e.stopPropagation(); setShowAiOptions(true)}} style={{'display': 'flex', 'alignItems': 'center', 'borderRadius': '5px', 'border': '1px solid var(--light-border)', 'padding': '2px', 'backgroundColor': 'var(--light-primary)'}}>
                                <MyImage src={MoreNotSquareIcon} height={13} alt={"More"} />
                            </div>
                        ) : ""}
                    </div>
                </Tooltip>
            )
        }
    ]

    return (
        <>
            <div className={styles.menuBar}>
                {buttons.filter((item) => !item.disabled).map((item, i) => {
                    return (
                        <div key={i} onClick={item.onClick} className={`${item.noClass ? "" : styles.menuButton} ${(item.isActive && !item.noClass) ? styles.menuButtonActive : ''}`}>
                            {item.value}
                        </div>
                    )
                })}
                {customRightMenu ? (<><div style={{'flex': '1'}}></div><div style={{'padding': '5px 10px'}}>{customRightMenu}</div></>) : ""}
                {showDelete ? (
                    <>
                        <div style={{'flex': '1'}}></div>
                        <div className={styles.menuButton}>
                            <MyImage src={DeleteIcon} width={20} height={20} onClick={deleteCallback} alt={"Delete"} />
                        </div>
                    </>
                ) : ""}
            </div>
            <Modal minWidth='90vw' isOpen={showAiOptions} close={() => setShowAiOptions(false)} title={"AI Options"}>
                <MenuPromptSelector selectedPrompt={selectedPrompt} setSelectedPrompt={setSelectedPrompt} />
            </Modal>
            <Modal isOpen={showLinkOptions} close={() => setShowLinkOptions(false)} title={"Link"}>
                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '5px'}}>
                    <ControlledInputText
                        autoFocus={true}
                        style={{'fontSize': '.9rem', 'padding': '2px 5px'}}
                        value={linkUrl}
                        setValue={setLinkUrl}
                        placeholder="https://yourlink.com"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                onLinkSet();
                            }
                        }}
                            />
                    <MyImage src={CircleCheckIcon} width={20} height={20} alt={"Check"}
                        className={"_clickable"}
                        onClick={onLinkSet} />
                    {
                        editor.isActive('link') ? (
                            <MyImage src={DeleteIcon} width={20} height={20} alt={"Delete"}
                                className={"_clickable"}
                                onClick={onLinkUnset} />
                        ) : ""
                    }
                </div>
            </Modal>
        </>
    )
}