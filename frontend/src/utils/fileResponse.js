
export default async function fileResponse(response){
    const blob = await response.blob();

    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'file.ext'; // default filename if Content-Disposition is not provided

    if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
            filename = match[1].replace(/['"]/g, '');
        }
    }
    downloadFromBlob(filename, blob)
}

export function downloadFromBlob(filename, blob){
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename; // you can name the file whatever you like
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
}

export const stripExt = (fileName) => {
    return fileName.replace(/\.[^/.]+$/, "");
}

export function getMimetypeFromResponse(response) {
    const mimetype = response.headers.get('Content-Type').split(';')[0].trim();
    return mimetype
}

export const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};


// Only needed for UX reasons, not downloading files
// There's a backend analog you should keep updated with this
const EXT_TO_MIMETYPE = {
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'pdf': 'application/pdf',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'md': 'text/markdown',
    'epub': 'application/epub+zip',
    'html': 'text/html',
    'ahtml': 'abbey/html',
    'csv': 'text/csv'
}
const MIMETYPE_TO_EXT = {}
// Populate MIMETYPE_TO_EXT by reversing EXT_TO_MIMETYPE
for (const [ext, mimetype] of Object.entries(EXT_TO_MIMETYPE)) {
    MIMETYPE_TO_EXT[mimetype] = ext;
}

export function getExtFromMimetype(mimetype){
    if (!mimetype){
        return ""
    }
    if (MIMETYPE_TO_EXT[mimetype]) {
        return MIMETYPE_TO_EXT[mimetype]
    }
    return ""    
}
