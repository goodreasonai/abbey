import { Auth } from "@/auth/auth";
import { useEffect, useRef } from "react";

// Give it an assetId + name, or directUrl
export default function AudioPlayer({ assetId, name, directUrl=undefined }) {

    const playerRef = useRef()
    const { getToken, isSignedIn } = Auth.useAuth()

    useEffect(() => {
        async function fetchAudio() {
            try {
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL + `/audio/get?id=${assetId}&name=${name}`
                const response = await fetch(backendUrl, {
                    headers: {
                        'x-access-token': await getToken()
                    }
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                playerRef.current.src = url;
            } catch (error) {
                console.error('There has been a problem with your fetch operation:', error);
            }
        };

        if (assetId && name && playerRef.current && isSignedIn !== undefined){
            fetchAudio();
        }
    }, [assetId, name, playerRef.current, isSignedIn]);

    return (
        <div>
            <audio ref={playerRef} controls></audio>
        </div>
    )
}
