import { useEffect, useRef, useState } from 'react'
import styles from './Form.module.css'
import JSZip from 'jszip'
import shortenText from '@/utils/text'
import MyImage from '../MyImage/MyImage'
import RemoveIcon from '../../../public/icons/RemoveIcon.png'
import CircleCheckIcon from '../../../public/icons/CircleCheckIcon.png'
import EditIcon from '../../../public/icons/EditIcon.png'
import ControlledInputText from './ControlledInputText'
import { MAX_PDF_PAGES } from '@/config/config'
import Tooltip from '../Tooltip/Tooltip'
import Loading from '../Loading/Loading'
import { PDFDocument } from 'pdf-lib';
import { getRandomId } from '@/utils/rand'
import Info from '../Info/Info'
import AttachIcon from '../../../public/icons/AttachIcon.png'


export default function FileUpload({ files, setFiles, templateCode, oneFile=true, className, accept=".docx, .pdf, .txt, .xlsx, .md", ...props }) {

    const [badFiles, setBadFiles] = useState([])  // We only setFiles for files that are 100% clean - so need to store the bad eggs here.
    // Possible problems are in fileProblems; handleFileChange references these
    
    const [dragging, setDragging] = useState(false)
    const [handlingFileChange, setHandlingFileChange] = useState(false)

    const fileInputRef = useRef()

    const containerRef = useRef()
    const [containerElement, setContainerElement] = useState()

    // basically when switching between folder/doc
    useEffect(() => {
        if (oneFile && files?.length > 1){
            setFiles([files[0]])
        }
    }, [oneFile, files])

    useEffect(() => {
        setContainerElement(containerRef.current)
    }, [containerRef.current])

    // Triggered after a user selects a file or files
    // Unzips relevant zipped files and calls onChange
    // Called by onDrop so that new drops don't replace the file if oneFile is false.
    async function handleFileChange(event){
        setHandlingFileChange(true)
        const selectedFiles = Array.from(event.target.files);
        // if the user didn't select a file, don't modify anything.
        if (!selectedFiles?.length){
            setHandlingFileChange(false)
            return;
        }

        // Go through the selected file and unzip as needed
        // Remove folders
        // Make sure PDFs are OK
        let newFiles = []
        let newBadFiles = []
        for (let i=0; i < selectedFiles.length; i++) {
            let fileInfo = selectedFiles[i]
            if (!fileInfo.id){
                fileInfo['id'] = getRandomId(10)  // we do a dirty thing: we add a unique ID for adding the file so that we can keep track of it.
            }

            // First, unzip if the file is a zip
            if (isFileZip(fileInfo)){
                // Need to unzip and do a bunch of files.
                try {
                    const extractedFiles = await unZip(fileInfo)
                    selectedFiles.push(...extractedFiles)  // add to end of selectedFiles and keep going (need for nested zips)
                }
                catch(e) {
                    console.log(e)
                    newBadFiles.push({ fileInfo, 'problem': 'failed-to-open-zip' })
                }
                continue
            }

            // Now going through either the only file or the many files released in the zip,
            // remove any folder files and handle encrypted / oversized PDFs
            if (isFileHidden(fileInfo)) {
                // we don't care for .DS_Store
            }
            else if (isFilePdf(fileInfo)){
                // Check to make sure the PDF is not encrypted, can be opened, and isn't oversized.
                const { pdfDoc, status } = await getPdfDoc(fileInfo)
                if (status == 'encrypted'){
                    newBadFiles.push({ fileInfo, 'problem': 'encrypted' })
                }
                else if (status == 'failed-to-open'){
                    newBadFiles.push({ fileInfo, 'problem': 'failed-to-open-pdf' })
                }
                else {
                    const count = await countPdfPages(pdfDoc)
                    if (count > MAX_PDF_PAGES){
                        newBadFiles.push({ fileInfo, 'problem': 'oversized-pdf' })
                    }
                    else {
                        newFiles.push(fileInfo)  // we think it's OK
                    }
                }
            }
            else if (isBannedExt(fileInfo)){
                newBadFiles.push({ fileInfo, 'problem': 'extension' })
            }
            else {
                // File's probably OK
                newFiles.push(fileInfo)
            }
        }

        // Finally, set the files (and only do 1 if oneFile = true)
        if (oneFile && newFiles.length){
            newFiles = [newFiles[0]]
        }
        setFiles(newFiles)
        setBadFiles(newBadFiles)
        setHandlingFileChange(false)
        fileInputRef.current.value = null;  // allows for removing/reuploading same thing (onChange wouldn't trigger otherwise); since we're keeping track of files with useState, don't need let the form input also keep track
    }

    // The point of having this is to make sure that dropping stuff is additive.
    async function onDrop (event) {
        event.preventDefault();  // otherwise the file will open up in the tab.
        setDragging(false)
        // For some reason: when you have a directory and call readEntries on it (in scanFiles), this destroys the ability to reference items inside event.dataTransfer.items.
        // However, you can pre-collect all the webkit entries and use those.
        const precollected = []
        for (let item of event.dataTransfer.items){
            precollected.push(item.webkitGetAsEntry())
        }
        let droppedFiles = []
        for (let item of precollected){
            let entries = await scanFiles(item)  // scanFiles retrieves all the files inside if it's a directory.
            let newFiles = []
            for (let entry of entries){
                let newFile = await getFileFromEntry(entry)
                newFiles.push(newFile)
            }
            droppedFiles.push(...newFiles)
        }

        if (!oneFile){
            // Dragging and dropping is additive for a folder.
            droppedFiles = [...files, ...droppedFiles]
        }
        const syntheticEvent = { target: { files: droppedFiles } };
        handleFileChange(syntheticEvent);
    };

    function onDragOver(event) {
        event.preventDefault();  // prevents file from opening in tab
        setDragging(true)
    }

    function onDragLeave(){
        setDragging(false)
    }

    function removeFile(index){
        setFiles(files.filter((x, i) => i != index))
    }

    function editPagesCallback(oldFileInfo, newFile){
        // remove the new file by name
        // whether in files or badFiles
        let newFiles = files.filter((x) => x.id != oldFileInfo.id)
        let newBadFiles = badFiles.filter((x) => x.fileInfo.id != oldFileInfo.id)
        newFile['id'] = getRandomId(10)  // a nasty thing
        if (newFiles.length != files.length){
            setFiles([...newFiles, newFile])
        }
        else if (newBadFiles.length != badFiles.length){
            setFiles([...files, newFile])
            setBadFiles([...newBadFiles])
        }
    }

    // returns form { text, showEditPages }
    function getBadFileMessage(code, fileInfo){
        return fileProblems[code].getBadFileMessage(fileInfo, containerElement)
    }

    // "Drag or click here" message
    const showMessage = !files?.length && !badFiles?.lengt && !handlingFileChange

    return (
        <div
            className={`${styles.dragArea} ${dragging ? styles.dragAreaDragging : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current.click()}
            style={{'display': 'flex', 'flexDirection': 'column', 'flex': '2', 'gap': '10px'}}
            ref={containerRef}
            {...props}
        >
            {badFiles?.length ? (
                badFiles.map(({ fileInfo, problem }) => {
                    const { text, showEditPages } = getBadFileMessage(problem, fileInfo)
                    return (
                        <div key={fileInfo.id} style={{'display': 'flex', 'flexWrap': 'wrap', 'gap': '10px', 'alignItems': 'center', 'justifyContent': 'center'}}>
                            <div style={{'color': 'var(--logo-red)'}}>
                                {text}
                            </div>
                            {showEditPages ? (
                                <EditPages startOpen={true} file={fileInfo} editPagesCallback={editPagesCallback} />
                            ) : ""}
                        </div>
                    )
                })
            ) : ""}
            {files?.length ? (
                files.map((file, i) => {
                    return (
                        <div key={file.id}  style={{'display': 'flex', 'gap': '10px', 'maxWidth': '100%'}}>
                            <div style={{'display': 'flex', 'alignItems': 'center'}} className='_clamped1'>
                                {file.name}
                            </div>
                            <div style={{'display': 'flex', 'alignItems': 'center', 'zIndex': '1'}}>
                                <MyImage src={RemoveIcon} alt={"Remove"} width={20} height={20} onClick={(e) => {removeFile(i); e.stopPropagation()}} />
                            </div>
                            {isFilePdf(file) ? (
                                <EditPages file={file} editPagesCallback={editPagesCallback} />
                            ) : ""}
                        </div>
                    )
                })
            ) : ""}
            {showMessage ? (
                <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
                    <div style={{'color': 'var(--passive-text)', 'fontSize': '1.25rem'}}>
                        {`Drag your file${!oneFile ? 's' : ''} here or `}<span style={{'textDecoration': 'underline'}}>click to browse</span>
                    </div>
                    <MyImage src={AttachIcon} width={25} height={25} alt={"Paperclip"} style={{'opacity': '.6' /* to match passive text */}} />
                </div>
            ) : (handlingFileChange ? (
                <Loading text={""} />
            ) : "")}
            <input
                type="file" 
                ref={fileInputRef}
                style={{ display: 'none' }} 
                multiple={!oneFile}
                onChange={handleFileChange}
                id="FileUpload"
            />
        </div>
    )
}

function EditPages({ file, editPagesCallback, startOpen=false }){
    const [showForm, setShowForm] = useState(startOpen)
    const [pageText, setPageText] = useState('')
    const [splitLoadingState, setSplitLoadingState] = useState(0)
    const [errorMessage, setErrorMessage] = useState("")

    async function doSplit(){
        // the function is wrapped so that we simplify error handling and early returns
        async function _doSplit(){
            let pagesArray;

            // Validate the input string
            const containsLetter = (str) => /[a-zA-Z]/.test(str);
            if (containsLetter(pageText)){
                throw Error('Invalid page range')
            }

            // Make an array like [1, 2, 6, 10, ...] of all the pages we need to have in the new PDF
            try {
                pagesArray = pageText.split(",").flatMap(page => {
                    if (page.includes('-')) {
                        const [start, end] = page.split('-').map(Number);
                        return Array.from({ length: end - start + 1 }, (_, i) => start + i - 1);  // -1 because pages are 0-indexed in pdf-lib
                    }
                    else {
                        return parseInt(page.trim()) - 1;
                    }
                });
                setPageText("")
            }
            catch (e) {
                console.log(e)
                throw Error("Invalid page range")
            }
            
            const { pdfDoc, status } = await getPdfDoc(file)
            if (status != 'success'){
                // Shouldn't happen since we should've already validated on upload, but means that we couldn't open the pdf
                throw Error("Couldn't edit file")
            }

            // Pages in pages array have to be within the bounds of the document
            const count = await countPdfPages(pdfDoc)
            if (Math.max(...pagesArray) >= count || pagesArray.length > MAX_PDF_PAGES) {
                throw Error("Invalid page range")
            }
            if (Math.min(...pagesArray) < 0 || pagesArray.length <= 0){
                throw Error("Invalid page range")
            }

            // Now we create the new PDF
            try {
                const newPdfDoc = await PDFDocument.create();
                for (const pageIndex of pagesArray) {
                    const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageIndex]);
                    newPdfDoc.addPage(copiedPage);
                }
                const modifiedPdfBytes = await newPdfDoc.save();
                const modifiedPdfBlob = new Blob([modifiedPdfBytes], { type: "application/pdf"});
                
                // Construct the new file object with the modified PDF blob
                const modifiedFile = new File([modifiedPdfBlob], `${pageText.toString()}_${file.name}`);
                return modifiedFile
            }
            catch (e) {
                console.log(e)
                throw Error("Could not edit PDF")
            }
        }
        
        setSplitLoadingState(1)
        try {
            let modifiedFile = await _doSplit()
            editPagesCallback(file, modifiedFile)
            setSplitLoadingState(2)
            setShowForm(false)
        }
        catch(e) {
            setErrorMessage(e.toString())
            setSplitLoadingState(3)
            setShowForm(false)
        }

    }

    function cancelEdit(event){
        event.stopPropagation()
        setShowForm(false)
        setPageText("")
    }

    function onEditIconClick(event){
        event.stopPropagation()
        setShowForm(true)
        setErrorMessage("")
    }

    return (
        <div style={{'display': 'flex', 'alignItems': 'center', 'gap': '10px'}}>
            {errorMessage ? (
                <div style={{'color': 'var(--logo-red)'}}>
                    {errorMessage}
                </div>
            ) : ""}
            {!showForm ? (
                <Tooltip content={"Edit Pages"} flash={true}>
                    <MyImage
                        src={EditIcon} 
                        alt={"Edit"}
                        width={20}
                        height={20}
                        onClick={onEditIconClick}
                    />
                </Tooltip>
            ) : (
                <div style={{'display': 'flex', 'gap': '5px', 'alignItems': 'center'}}>
                    <ControlledInputText
                        placeholder={`e.g. "1-10" (max is ${MAX_PDF_PAGES})`}
                        id='CreatePageInput'
                        setValue={(x) => setPageText(x)}
                        value={pageText}
                        onClick={(e) => {e.stopPropagation()}}
                        inputStyle={{'backgroundColor': 'var(--light-background)'}}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                doSplit()
                                e.stopPropagation()
                            }
                        }}
                    />
                    {
                        splitLoadingState == 1 ? (
                            <Loading text="" />
                        ) : (
                            <>
                                <Tooltip content={"Submit"}>
                                    <MyImage src={CircleCheckIcon} width={20} height={20} alt={"Edit Pages"}
                                        onClick={(e) => {
                                            doSplit();
                                            e.stopPropagation()
                                        }}
                                        id='CreatePageRangeSubmit'
                                />
                                </Tooltip>
                                <Tooltip content={"Cancel"}>
                                    <MyImage src={RemoveIcon} width={20} height={20} alt={"Remove"} onClick={cancelEdit} id='CreatePageRangeCancel'/>
                                </Tooltip>
                            </>
                        )
                    }
                </div>
            )}
        </div>
    )
}


const BANNED_EXTENSIONS = ['pages', 'key', 'mpeg', 'mp4', 'mov', 'mp3']  // can probably move to config
const fileProblems = {
    'encrypted': {
        'getBadFileMessage': (fileInfo, containerElement) => {
            const fname = shortenText(fileInfo.name)
            return {
                'text': (
                    <div style={{'display': 'flex', 'gap': '10px', 'alignItems': 'center', 'width': '100%'}}>
                        <div>
                            {`${fname} is password protected. Decrypt it and re-upload.`}
                        </div>
                        <Info text={"If you're confused, Google steps to remove the encryption. It can be casued by faulty copyright protection."} />
                    </div>
                ),
                'showEditPages': false
            }
        }
    },
    'extension': {
        'getBadFileMessage': (fileInfo) => {
            return {'text': `.${getFileExtension(fileInfo)} files are not allowed.`, 'showEditPages': false}
        }
    },
    'oversized-pdf': {
        'getBadFileMessage': (fileInfo) => {
            const fname = shortenText(fileInfo.name)
            return {'text': `${fname} has too many pages; select a subset.`, 'showEditPages': true}
        }
    },
    'failed-to-open-pdf': {
        'getBadFileMessage': (fileInfo) => {
            const fname = shortenText(fileInfo.name)
            return {'text': `Could not upload ${fname}`, 'showEditPages': false}
        }
    },
    'failed-to-open-zip': {
        'getBadFileMessage': (fileInfo) => {
            const fname = shortenText(fileInfo.name)
            return {'text': `Could not upload ${fname}`, 'showEditPages': false}
        }
    }
}


// Straight from the docs: https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryEntry/createReader
// Note that calling .readEntries() destroys the ability to reference items inside the event.dataTransfer.items list.
// That behavior may or may not be a bug in the implementation.
async function readDirectory(directory) {
    const dirReader = directory.createReader();
    const entries = [];
  
    while (true) {
        const results = await new Promise((resolve, reject) => {
            dirReader.readEntries(resolve, reject);
        });
    
        if (!results.length) {
            break;
        }
    
        for (const entry of results) {
            entries.push(entry);
        }
    }
  
    return entries;
}

// Takes something returned by .webkitGetAsEntry() and recursively gets all the files if it's a directory
// Straight from the docs: https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem/webkitGetAsEntry
async function scanFiles(item) {
    if (item.isDirectory) {
        let innerItems = await readDirectory(item)
        let innerFiles = []
        for (let innerItem of innerItems){
            let newFiles = await scanFiles(innerItem)
            innerFiles.push(...newFiles)
        }
        return innerFiles
    }
    else {
        return [item]
    }
}

// This weirdness is caused by the fact that the .file has a required callback function instead of using async
const getFileFromEntry = (fileEntry) => {
    return new Promise((resolve) => {
        fileEntry.file(resolve);
    });
};


function getFileExtension(fileInfo){
    const parts = fileInfo.name.split('.');
    return parts[parts.length - 1];
}

function isBannedExt(fileInfo){
    const ext = getFileExtension(fileInfo)
    return BANNED_EXTENSIONS.includes(ext)
}

function isFileHidden(fileInfo) {
    let unixPath = fileInfo.name.split('/')
    let windowsPath = fileInfo.name.split('\\')  // unsure if we need anything for windows since I don't think hidden files are the same.
    let ignoreStartsWith = [".", "~"]
    const doesStartWith = ignoreStartsWith.map((x) => unixPath[unixPath.length - 1].startsWith(x) || windowsPath[windowsPath.length - 1].startsWith(x)).reduce((a, b) => a + b, 0)
    return doesStartWith
}

function isFilePdf(fileInfo){
    const i = fileInfo.name.indexOf('.pdf')
    return i > -1 && i == fileInfo.name.length - 4
}

async function getPdfDoc(fileInfo){
    let status = "success"
    let pdfDoc
    try {
        pdfDoc = await PDFDocument.load(await fileInfo.arrayBuffer());
    }
    catch(e) {
        // Detects whether PDF is encrypted, in which case a specific status is returned
        if (e.message.includes('PDFDocument.load(..., { ignoreEncryption: true })')){
            console.log('Encrypted Error')
            status = "encrypted"
        }
        else {
            status = "failed-to-open"
            console.log(e)
        }
    }
    return { pdfDoc, status }
}

async function countPdfPages(pdfDoc){
    return pdfDoc.getPageCount()
}

function isFileZip(fileInfo) {
    return fileInfo.type === 'application/zip' || (fileInfo.name.length>=4 && fileInfo.name.slice(-4)==='.zip')
}

async function unZip(file) {
    const arrayBuffer = await file.arrayBuffer()
    const zip = new JSZip();
    const unzipContents = await zip.loadAsync(arrayBuffer)
    const unzippedFiles = []
    const zipBaseName = file.name.replace(/\.zip$/i, '');
    for (const filename of Object.keys(unzipContents.files)) {
        if (!filename.startsWith('__MACOSX/') && !unzipContents.files[filename].dir) {
            const blob = await unzipContents.files[filename].async('blob')
            const newFilename = filename.startsWith(zipBaseName + '/') ? filename.replace(zipBaseName + '/', '') : filename;
            let newFile = new File([blob], newFilename, {type: blob.type})
            unzippedFiles.push(newFile)
        }
    }
    return unzippedFiles
} 
