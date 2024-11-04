import DefaultPage from "@/components/DefaultPage";
import Button from "@/components/form/Button";
import { useEffect, useState } from "react";
import Textarea from "@/components/form/Textarea";
import { useRouter } from 'next/router'
import { Auth } from '@/auth/auth';
import ButtonSelect from "@/components/form/ButtonSelect";


export default function Bug(){

    const [description, setDescription] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const { getToken } = Auth.useAuth();

    const router = useRouter()

    // The currentPath from previous page, decoded
    const previousPath = decodeURIComponent(router.query.from || '')
    const [isBug, setIsBug] = useState(true);
    
    useEffect(() => {
        setIsBug(router.query.type == 'bug')
    }, [router.query.type])

    const bugToggle = (
        <ButtonSelect
            value={isBug}
            setValue={setIsBug}
            options={[
                {'element': ('Bug Report'), 'name': true},
                {'element': ('Feature Request'), 'name': false}
            ]} />
    )

    const handleSubmit = async (e) => {
        e.preventDefault();

        const type = isBug ? 'bug' : 'feature';

        const token = await getToken();

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/activity/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                body: JSON.stringify({ description: description, type: type, from: previousPath })
            });
            const data = await res.json();
            if (data['response'] != 'success'){
                throw Error("Server Error: " + data['reason'])
            }
            setSubmitted(true);
        }
        catch (e){
            console.log(e)
        }

        // Handle response here
    }

    let innerHtml = submitted ? "Successfully submitted." : (
        <div>
            <div>
                {bugToggle}
            </div>
            <br/>
            <form onSubmit={handleSubmit}>
                <Textarea 
                    placeholder={"Description..."} 
                    value={description} 
                    setValue={setDescription}
                /> <br/><br/>
                <Button type='submit' value="Submit" />
            </form>
        </div>
    )

    return (
        <DefaultPage title={"Bug Report"}>
            {innerHtml}
        </DefaultPage>
    )
}