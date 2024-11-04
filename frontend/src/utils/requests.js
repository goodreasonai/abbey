// delete contents means delete the resources as well
// loading state is optional
export const deleteAsset = async (id, token, deleteContents, setLoadingState) => {
    
    try {
        if (setLoadingState){
            setLoadingState(1)
        }

        let url = process.env.NEXT_PUBLIC_BACKEND_URL + `/assets/delete`;
        let formData = new FormData();
        formData.append('id', id);
        if (deleteContents){
            formData.append('delete_contents', 1)
        }

        const response = await fetch(url, {method:"POST", headers:{'x-access-token': token}, body: formData});
        const myJson = await response.json(); //extract JSON from the http response

        if (myJson['response'] != 'success'){
            throw Error(`Response was not success: ${myJson[['reason']]}`)
        }
        else if (setLoadingState){
            setLoadingState(2)
        }

        return true
    }
    catch(e) {
        if (setLoadingState){
            setLoadingState(3)
        }
        console.log(e)
    }
    return false
}


export async function saveResources(id, selections, setLoadingState, token){
    try {
        setLoadingState(1)
        const url = process.env.NEXT_PUBLIC_BACKEND_URL + "/assets/add-resources"
        const data = {
            'id': id,
            'resource_ids': selections.map(x => x.id)
        }
        const response = await fetch(url, {
            'headers': {
                'x-access-token': token,
                'Content-Type': 'application/json'
            },
            'body': JSON.stringify(data),
            'method': 'POST'
        })

        const myJson = await response.json()

        if (myJson['response'] != 'success'){
            throw Error(`Response was not success: ${myJson['reason']}`)
        }
        setLoadingState(2)
    }
    catch(e) {
        console.log(e)
        setLoadingState(3)
    }
}