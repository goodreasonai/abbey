import FileUpload from "@/components/form/FileUpload.js"
import SourceSelect from "@/components/form/SourceSelect"
import StudentSelector from "@/components/form/StudentSelector"
import Classroom from "@/components/Classroom/Classroom"
import ControlledInputText from "@/components/form/ControlledInputText"
import Document from "@/components/Document/Document"
import CheckIcon from '../../public/icons/CircleCheckIcon.png'
import RemoveIcon from '../../public/icons/RemoveIcon.png'
import { useEffect, useRef, useState } from "react"
import Loading from "@/components/Loading/Loading"
import Folder from '@/components/Folder/Folder'
import ClassroomIcon from '../../public/icons/ClassroomIcon.png'
import DocumentIcon from '../../public/icons/DocumentIcon.png'
import ChatIcon from '../../public/icons/ChatIcon.png'
import FolderIcon from '../../public/icons/FolderIcon.png'
import CrawlerIcon from '../../public/icons/CrawlerIcon.png'
import NotebookIcon from '../../public/icons/NotebookIcon.png'
import { CHROME_EXT_PROMO_LINK, MAX_PDF_PAGES, NAME } from "@/config/config"
import Number from "@/components/form/Number"
import DetachedChat from "@/components/DetachedChat/DetachedChat"
import WebsiteIcon from '../../public/icons/WebsiteIcon.png'
import Curriculum from "@/components/Curriculum/Curriculum"
import CurriculumIcon from '../../public/icons/CurriculumIcon.png'
import QuizIcon from '../../public/icons/QuizIcon.png'
import MyImage from "@/components/MyImage/MyImage"
import Quiz from "@/components/Quiz/Quiz"
import { Auth } from "@/auth/auth"
import Link from "next/link"
import ShareArrowIcon from '../../public/icons/ShareArrowIcon.png'
import DocSkeleton from "@/components/Document/DocSkeleton"
import DeleteIcon from '../../public/icons/DeleteIcon.png'
import TextEditor from "@/components/TextEditor/TextEditor"
import TextIcon from '../../public/icons/TextIcon.png'
import VideoIcon from '../../public/icons/VideoIcon.png'
import Video from "@/components/Video/Video"
import InfinityIcon from '../../public/icons/InfinityIcon.png'
import InfiniteQuiz from "@/components/InfiniteQuiz/InfiniteQuiz"
import Section from "@/components/Section/Section"
import Notebook from "@/components/Notebook/Notebook"
import { isChrome } from "@/utils/browser"
import GradientEffect from "@/components/GradientEffect/GradientEffect"
import PanelSourceSelect from "@/components/PanelSourceSelect/PanelSourceSelect"
import MarkdownViewer from "@/components/Markdown/MarkdownViewer"
import Website from "@/components/Website/Website"
import { getMimetypeFromResponse } from "@/utils/fileResponse"
import Crawler from "@/components/Crawler/Crawler"


class Template {
    static code;
    static uploadable;
    static readableName;
    static description;
    static icon;
    static summarizable;  // Should split summary allow a summary? (note: new interface makes this ~worthless)
    static chattable;  // Should a chat option be shown for this template in Folder?
    static hideGeneralFields;  // in the upload interface, are title/desc/etc shown?
    static hideShareField;
    static hideUploadProgress;
    static noMargins;  // asset template has no margins
    static altBackgroundColor;
    static actionPhrase;  // i.e., "Upload" or "Create"
    static noSignIn;  // can template be viewed without sign in?
    static fixHeight;  // Make template element's height extend exactly to screen height bottom
    static noExtraOptions;  // Are there template specific upload options?
    static collab;  // provide element with collab socket connection and show other users?
    static footerStyle;  // Style passed to the footer (default none)
    constructor() {
        if (new.target === Template) {
            throw new Error("Cannot instantiate an abstract class");
        }
    }

    // For [id].js in /assets
    // "editing" is a bool
    Element({ assetManifestRow, canEdit }) {
        throw new Error(`Element component is not implemented for ${assetManifestRow.template} template.`)
    }

    // otherData is meant to be an object with keys specific for the template
    async getUploadData(document, otherData, editing) {
        return {}
    }

    AttentionComponent({data, ...props}){
        throw new Error("Attention component not implemented for template")
    }

    ExtraUploadFields({ otherData, setOtherData }) {
        return ""
    }

}


class ClassroomTemplate extends Template {
    static code = "classroom";
    static readableName = "Classroom"
    static description = `Organize and monitor your students' activities.`
    static icon = ClassroomIcon
    static uploadable = true
    static primaryColor = '#6a370a'
    static summarizable = false
    static chattable = false
    static hideShareField = true
    static actionPhrase = 'Create'
    constructor(){
        super()
    }

    getUploadData(document, otherData, editing){
        return {
            'students': {
                name: "students",
                value: otherData.students ? JSON.stringify(otherData.students) : "",
            }
        }
    }

    Element({assetManifestRow, canEdit}) {
        return (
            <Classroom manifestRow={assetManifestRow} canEdit={canEdit} />
        )
    }


    ExtraUploadFields({ otherData, setOtherData }){
        return (
            <StudentSelector students={otherData.students} setStudents={(x) => setOtherData({'students': x})} />
        )
    }

    AttentionComponent({data, ...props}){

        if (data['key'] != 'permissions_request'){
            return <></>
        }

        const { getToken } = Auth.useAuth()
        const [loadingState, setLoadingState] = useState(0)
        const [afterText, setAfterText] = useState("")

        async function notifyServer(txt){
            try{
                setLoadingState(1)
                let url = process.env.NEXT_PUBLIC_BACKEND_URL + '/user/needs-attention-respond'
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': await getToken()
                    },
                    body: JSON.stringify({'data': {'response': txt}, 'asset_metadata_row': data, 'template': data['template']})
                });
                const myJson = await response.json()
                if (myJson['response'] == 'success'){
                    if (txt == 'accept'){
                        setAfterText("Joined " + data['title'])
                    }
                    else if (txt == 'reject'){
                        setAfterText("Rejected joining " + data['title'])
                    }
                }
                else {
                    throw new Error("Server responded, but it wasn't a success");
                }
                setLoadingState(2)
            }
            catch (e){
                console.log(e)
                setLoadingState(3)
            }
        }

        async function sendAccept(){
            notifyServer("accept")
        }

        function sendReject(){
            notifyServer("reject")
        }

        if (loadingState == 0){
            return (
                <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}} {...props}>
                    <div>
                        You've been asked to join {data['title']}. Accept?
                    </div>
                    <div style={{'display': 'flex', 'gap': '5px', 'alignItems': 'center'}}>
                        <MyImage src={CheckIcon} alt={"Accept"} width={20} height={20}
                                onClick={sendAccept}
                                style={{'cursor': 'pointer'}} />
                        <MyImage src={RemoveIcon} alt={"Reject"} width={20} height={20}
                                onClick={sendReject}
                                style={{'cursor': 'pointer'}} />
                    </div>
                </div>
            )
        }
        else if (loadingState == 1){
            return (
                <Loading />
            )
        }
        else if (loadingState == 2){
            return (
                <div>
                    {afterText}
                </div>
            )
        }
        else {
            return (
                <div>
                    Error
                </div>
            )
        }
        
    }
}


class DocumentTemplate extends Template {
    static code = "document";
    static readableName = "Document"
    static description = "Upload single documents to view and chat with, or to use as sources for other templates."
    static icon = DocumentIcon
    static uploadable = true;
    static primaryColor = '#1358a2'
    static summarizable = true
    static chattable = true
    static noSignIn = true
    static noMargins = true
    static actionPhrase = "Upload"
    static footerStyle = {'marginTop': '1rem'}

    constructor(){
        super()
    }

    Element({ assetManifestRow, canEdit }) {
        const [mimeLoadState, setMimeLoadState] = useState(0)
        const [mimetype, setMimetype] = useState()
        const { getToken, isSignedIn } = Auth.useAuth()
        const objectSrc = process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/files?id=" + assetManifestRow['id'];
        useEffect(() => {
            async function getMimeType(){
                setMimeLoadState(1)
                try {
                    const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/files?id=${assetManifestRow['id']}&only_headers=true`, {
                        method: 'GET',
                        headers: {
                            'x-access-token': await getToken(),
                        },
                    });
                    const _ = await response.blob();
                    const mimetype = getMimetypeFromResponse(response)
                    setMimetype(mimetype)
                    setMimeLoadState(2)
                }
                catch (error) {
                    setMimeLoadState(3)
                    console.error('There was a problem fetching the file:', error);
                }
            }
            if (isSignedIn !== undefined){
                getMimeType()
            }
        }, [setMimetype, setMimeLoadState, assetManifestRow.id, isSignedIn])
        if (mimeLoadState == 1 || mimeLoadState == 0){
            return (
                <div style={{'paddingRight': 'var(--std-margin)', 'paddingLeft': 'var(--std-margin)'}}>
                    <DocSkeleton />
                </div>
            )
        }
        if (mimeLoadState == 3){
            return (
                <div>
                    Error getting mimetype from file
                </div>
            )
        }
        return (
            <Document manifestRow={assetManifestRow} objectSrc={objectSrc} mimetype={mimetype} canEdit={canEdit} />
        )
    }


    getUploadData(document, otherData, editing){
        return {
            'files': {
                name: "files",
                value: otherData.files && otherData.files.length ? otherData.files[0] : undefined,
                mandatory: true
            }
        }
    }

    ExtraUploadFields({ otherData, setOtherData }) {
        function setFiles(files){
            setOtherData({'files': files})
        }
        const files = otherData?.files ? otherData.files : []

        return (
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                <FileUpload files={files} setFiles={setFiles} templateCode={"document"} />
            </div>
        )
    }
}


class CurriculumTemplate extends Template {
    static code = "curriculum";
    static readableName = "Curriculum"
    static description = "Learn anything by generating a structured course for you to follow. Links with your docs and/or Collections."
    static icon = CurriculumIcon
    static uploadable = !(process.env.NEXT_PUBLIC_HIDE_COLLECTIONS === '1');  // annoying can't import HIDE_COLLECTIONS for some reason
    static primaryColor = '#1358a2'
    static summarizable = false
    static chattable = false
    static actionPhrase = "Create";

    constructor(){
        super()
    }

    Element({ assetManifestRow, canEdit }) {
        return (
            <Curriculum manifestRow={assetManifestRow} canEdit={canEdit} />
        )
    }

    AttentionComponent({data, ...props}){

        if (data['key'] != 'curr_stage'){
            return <></>
        }

        return (
            <Link href={`/assets/${data['asset_id']}`} {...props}>
                <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center'}} {...props}>
                    <div>
                        {`Continue "${data['title']}"`}
                    </div>
                    <div style={{'display': 'flex', 'gap': '5px', 'alignItems': 'center'}}>
                        <MyImage src={ShareArrowIcon} alt={"Go"} width={20} height={20} />
                    </div>
                </div>
            </Link>
        )
    }
}


class QuizTemplate extends Template {
    static code = "quiz";
    static readableName = "Quiz"
    static description = "Create and share a quiz, generated and graded in collaboration with AI."
    static icon = QuizIcon
    static uploadable = true;
    static primaryColor = '#1358a2'
    static summarizable = false
    static chattable = false
    static actionPhrase = "Create"

    constructor(){
        super()
    }

    getUploadData(document, otherData, editing){
        return {
            'selections': {
                name: "source selections",
                mandatory: false,
                value: JSON.stringify(otherData.selections ? otherData.selections : [])
            }
        }
    }

    ExtraUploadFields({ otherData, setOtherData }) {
        const [selections, setSelections] = useState([])

        function setSelectionsWrap(x){
            setSelections(x)
            setOtherData({'selections': x.map((x) => x.id)})
        }

        return (
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                <div>
                    What source(s) is your quiz based on? (optional)
                </div>
                <PanelSourceSelect
                    selectorStyle={{'flex': '1', 'minWidth': '200px', 'maxWidth': '400px'}}
                    allowUpload={true}
                    onlyTemplates={DATA_TEMPLATES}
                    selections={selections}
                    setSelections={setSelectionsWrap}
                />
            </div>
        )
    }

    Element({ assetManifestRow, canEdit }) {
        return (
            <Quiz manifestRow={assetManifestRow} canEdit={canEdit} />
        )
    }

}



class DetachedChatTemplate extends Template {
    static code = "detached_chat";
    static readableName = "No-Doc Chat"
    static description = "Just chat with AI, no documents attached."
    static actionPhrase = "Start"
    static icon = ChatIcon
    static uploadable = true;
    static primaryColor = '#f0f0f0'
    static summarizable = true
    static noSignIn = true
    static chattable = true
    static hideGeneralFields = true
    static hideUploadProgress = true
    static noUploadOptions = true
    static noMargins = true

    constructor(){
        super()
    }

    Element({ assetManifestRow, canEdit }) {
        return (
            <DetachedChat manifestRow={assetManifestRow} canEdit={canEdit} />
        )
    }

    getUploadData(document, otherData, editing){
        // Doesn't need anything
        return {}
    }

    ExtraCreateElement({}) {
        return (
            <div style={{'backgroundColor': 'var(--light-primary)', 'width': '100%', 'padding': '20px', 'display': 'flex', 'justifyContent': 'center', 'alignItems': 'center', 'borderRadius': 'var(--medium-border-radius)', 'border': '1px solid var(--light-border)'}}>
                <div style={{'maxWidth': '650px', 'display': 'flex', 'justifyContent': 'center', 'alignItems': 'center', 'flexDirection': 'column'}}>
                    <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                        <div style={{'fontSize': '1.5rem'}}>
                            {DetachedChatTemplate.readableName}
                        </div>
                        <MyImage src={DetachedChatTemplate.icon} alt={"Template"} width={30} height={30} />
                    </div>
                    <div>
                        <MarkdownViewer>
                            {`${DetachedChatTemplate.description} Click \`Use Web\` to let AI browse the web. Helpful for coding, writing, and general questions. Suggest new features [here](/bug).`}
                        </MarkdownViewer>
                    </div>
                </div>
            </div>
        )
    }

}


class WebsiteTemplate extends Template {
    static code = "website";
    static readableName = "Webpage";
    static description = "Scrapes a publicly available webpage given a URL";
    static icon = WebsiteIcon;
    static uploadable = true;
    static primaryColor = '#186dc9'
    static summarizable = true;
    static chattable = true
    static noSignIn = true;
    static noMargins = true;
    static customUploadProcessingText = "Scraping";
    static actionPhrase = "Scrape"

    constructor(){
        super()
    }

    getUploadData(document, otherData, editing){
        return {
            'url': {
                name: "url",
                mandatory: true,
                value: otherData.url
            }
        }
    }

    Element({ assetManifestRow, canEdit }) {
        return (
            <Website manifestRow={assetManifestRow} canEdit={canEdit} />
        )
    }

    ExtraUploadFields({ otherData, setOtherData }) {
        return (
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                <ControlledInputText placeholder="URL to exact page"
                    value={otherData.url}
                    setValue={(url) => {setOtherData({'url': url})}}
                />
                {isChrome() && CHROME_EXT_PROMO_LINK ? (
                    <Link href={CHROME_EXT_PROMO_LINK}>
                        <div style={{'backgroundColor': 'var(--light-primary)', 'position': 'relative', 'overflow': 'hidden', 'borderRadius': 'var(--medium-border-radius)', 'padding': '10px', 'border': '1px solid var(--light-border)'}}>
                            <GradientEffect style={{'zIndex': '1'}} />
                            <div style={{'zIndex': '2', 'color': 'var(--light-text)', 'textDecoration': 'underline', 'position': 'relative'}}>
                                For a better experience, try our Chrome extension 
                            </div>
                        </div>
                    </Link>
                ) : ""}
            </div>
        )
    }
}



class VideoTemplate extends Template {
    static code = "video";
    static readableName = "YouTube";
    static description = "Chat with and summarize a video from YouTube";
    static icon = VideoIcon;
    static uploadable = true;
    static summarizable = true;
    static chattable = true;
    static noSignIn = true;
    static noMargins = true;
    static customUploadProcessingText = "Transcribing";
    static actionPhrase = "Upload"

    constructor(){
        super()
    }

    getUploadData(document, otherData, editing){
        return {
            'url': {
                name: "url",
                mandatory: true,
                value: otherData.url
            }
        }
    }

    Element({ assetManifestRow, canEdit }) {
        return (<Video manifestRow={assetManifestRow} canEdit={canEdit} />)
    }

    ExtraUploadFields({ otherData, setOtherData }) {
        return (
            <div>
                <ControlledInputText placeholder="URL of video"
                    value={otherData.url}
                    setValue={(url) => {setOtherData({'url': url})}} />
            </div>
        )
    }
}


class FolderTemplate extends Template {
    static code = "folder";
    static readableName = "Folder"
    static description = "Upload many documents at once and organize your items into folders."
    static icon = FolderIcon
    static uploadable = true
    static chattable = true
    static primaryColor = '#61866f'
    static summarizable = false
    static noSignIn = true
    static actionPhrase = "Create"

    constructor(){
        super()
    }

    Element({ assetManifestRow, canEdit }) {
        return (
            <Folder manifestRow={assetManifestRow} canEdit={canEdit} />
        )
    }

    ExtraUploadFields({ otherData, setOtherData }) {

        function setFiles(files){
            setOtherData({...otherData, 'files': files})
        }
        const files = otherData?.files ? otherData.files : []

        return (
            <div>
                <FileUpload files={files} setFiles={setFiles} oneFile={false} templateCode="folder"/>
            </div>
        )
    }

    getUploadData(document, otherData, editing){
        return {
            'selections': {
                name: "source selections",
                mandatory: false,
                value: otherData.selections ? JSON.stringify(otherData.selections) : JSON.stringify([])
            },
            'files': {
                name: "files",
                value: otherData.files && otherData.files.length ? otherData.files : undefined,
                mandatory: false,
                split: true  // Arcane chicanery
            }
        }
    }

}


class SectionTemplate extends FolderTemplate {
    static code = "section";
    static readableName = "Section"
    static description = "Organize items into sections."
    static icon = FolderIcon
    static uploadable = false
    static chattable = true
    static summarizable = true
    static noSignIn = true
    static actionPhrase = "Create"

    constructor(){
        super()
    }

    Element({ assetManifestRow, canEdit }) {
        return (
            <Section manifestRow={assetManifestRow} canEdit={canEdit} />
        )
    }

}


class NotebookTemplate extends Template {
    static code = "notebook";
    static readableName = "Workspace"
    static description = "Organize your reading notes and ask questions of many sources at once."
    static icon = NotebookIcon
    static uploadable = true
    static summarizable = true
    static chattable = true
    static noSignIn = true
    static actionPhrase = "Create"
    static noMargins = true
    static altBackgroundColor = 'var(--light-primary)'
    static fixHeight = true
    static noUploadOptions = true
    static collab = true
    static prefersShrunk = false

    constructor(){
        super()
    }

    Element({ assetManifestRow, canEdit, ...props }) {
        return (
            <Notebook manifestRow={assetManifestRow} canEdit={canEdit} {...props} />
        )
    }
}


class DeprecatedTemplate extends Template {
    static code = "deprecated";
    static readableName = "Deprecated"
    static description = "This template type is deprecated."
    static icon = DeleteIcon
    static uploadable = false;
    static chattable = false;
    static primaryColor = '#61866f'
    static summarizable = false
    static actionPhrase = "Do not create"

    constructor(){
        super()
    }

    Element({ assetManifestRow, canEdit }) {
        return (
            <div>
                Sorry, but this template type has been deprecated. You can email us to complain: team@us.ai.
            </div>
        )
    }
}

class TextEditorTemplate extends Template {
    static code = "text_editor";
    static readableName = "Text Editor"
    static actionPhrase = "Use"
    static description = "Create a new text document with AI auto-continue based on your docs."
    static icon = TextIcon
    static uploadable = true;
    static summarizable = true;
    static chattable = true
    static altBackgroundColor = "var(--light-primary)";
    constructor(){
        super()
    }

    Element({ assetManifestRow, canEdit }) {
        return (
            <TextEditor assetManifestRow={assetManifestRow} canEdit={canEdit} />
        )
    }

    getUploadData(document, otherData, editing){
        return {
            'selections': {
                name: "source selections",
                mandatory: false,
                value: JSON.stringify(otherData.selections ? otherData.selections : [])
            }
        }
    }

    ExtraUploadFields({ otherData, setOtherData }) {
        const [selections, setSelections] = useState([])

        function setSelectionsWrap(x){
            setSelections(x)
            setOtherData({'selections': x.map((x) => x.id)})
        }

        return (
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                <div>
                    What source(s) is your text based on? (optional)
                </div>
                <PanelSourceSelect
                    selectorStyle={{'flex': '1', 'minWidth': '200px', 'maxWidth': '400px'}}
                    allowUpload={true}
                    onlyTemplates={DATA_TEMPLATES}
                    selections={selections}
                    setSelections={setSelectionsWrap}
                />
            </div>
        )
    }
}


class InfiniteQuizTemplate extends Template {
    static code = "inf_quiz"
    static readableName = "Infinite Quiz"
    static description = "Quiz yourself with an infinite stream of questions from any source material"
    static icon = InfinityIcon
    static uploadable = true
    static actionPhrase = "Create"
    static summarizable = false
    static chattable = false
    static fixHeight = true
    static noMargins = true

    constructor(){
        super()
    }
    getUploadData(document, otherData, editing){
        return {
            'selections': {
                name: "source selections",
                mandatory: false,
                value: JSON.stringify(otherData.selections ? otherData.selections : [])
            }
        }
    }

    ExtraUploadFields({ otherData, setOtherData }) {
        const [selections, setSelections] = useState([])

        function setSelectionsWrap(x){
            setSelections(x)
            setOtherData({'selections': x.map((x) => x.id)})
        }

        return (
            <div style={{'display': 'flex', 'flexDirection': 'column', 'gap': '1rem'}}>
                <div>
                    What source(s) is your quiz based on? (optional)
                </div>
                <PanelSourceSelect
                    selectorStyle={{'flex': '1', 'minWidth': '200px', 'maxWidth': '400px'}}
                    allowUpload={true}
                    onlyTemplates={DATA_TEMPLATES}
                    selections={selections}
                    setSelections={setSelectionsWrap}
                />
            </div>
        )
    }

    Element({ assetManifestRow, canEdit }) {
        return (
            <InfiniteQuiz manifestRow={assetManifestRow} canEdit={canEdit} />
        )
    }
}

class CrawlerTemplate extends Template {
    static code = "crawler";
    static readableName = "Web Crawler"
    static description = "Scrape websites en masse"
    static icon = CrawlerIcon
    static uploadable = process.env.NEXT_PUBLIC_EXPERIMENTAL_TEMPLATES === '1'
    static chattable = false
    static primaryColor = '#61866f'
    static summarizable = false
    static noSignIn = false
    static noMargins = true
    static actionPhrase = "Create"
    static prefersShrunk = false

    constructor(){
        super()
    }

    Element({ assetManifestRow, canEdit }) {
        return (
            <Crawler manifestRow={assetManifestRow} canEdit={canEdit} />
        )
    }
}

export const TEMPLATES = [
    new DocumentTemplate(),
    new FolderTemplate(),
    new DetachedChatTemplate(),
    new CurriculumTemplate(),
    new WebsiteTemplate(),
    new ClassroomTemplate(),
    new QuizTemplate(),
    new NotebookTemplate(),
    new TextEditorTemplate(),
    new VideoTemplate(),
    new InfiniteQuizTemplate(),
    new SectionTemplate(),
    new CrawlerTemplate(),
];


// These templates may be included as sources to other templates
export const DATA_TEMPLATES = ['folder', 'document', 'website', 'text_editor', 'video', 'section', 'notebook']

// These templates might suggest that the user create a Workspace
export const ADD_TO_WORKSPACE_TEMPLATES = ['document', 'website', 'video']

// Gives option when deleting to delete all of the associated resources
export const ALLOW_DELETE_CONTENTS = ['folder']

export const POPULAR_TEMPLATES = ['document', 'detached_chat', 'folder', 'notebook']
export const GROUP_TEMPLATE_OPTIONS = ['folder', 'document', 'website']

export const PREMIER_TEMPLATES = ['document', 'notebook']  // The two main templates show in the FaceliftHomePage
export const SECONDARY_TEMPLATES = ['detached_chat', 'inf_quiz', 'video', 'website']

export const getTemplateByCode = (code) => {
    try {
        let x = TEMPLATES.filter(TemplateClass => TemplateClass.constructor.code == code)[0]
        if (x == undefined){
            return new DeprecatedTemplate()
        }
        return x
    }
    catch(e){
        console.log("Couldn't find template with code: " + code)
        console.log(e)
        return new DeprecatedTemplate();
    }
}

