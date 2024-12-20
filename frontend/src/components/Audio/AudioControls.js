import { useEffect, useMemo, useRef, useState } from "react"
import Loading from "../Loading/Loading"
import Tooltip from "../Tooltip/Tooltip"
import MyImage from "../MyImage/MyImage"
import PlayIcon from '../../../public/icons/PlayIcon.png'
import SkipForwardIcon from '../../../public/icons/SkipForwardIcon.png'
import SlowDownIcon from '../../../public/icons/SlowDownIcon.png'
import SpeedUpIcon from '../../../public/icons/SpeedUpIcon.png'
import PauseIcon from '../../../public/icons/PauseIcon.png'
import RecentIcon from '../../../public/icons/RecentIcon.png'
import io from 'socket.io-client';
import { secondsToFormattedTime } from "@/utils/time"
import { Auth } from "@/auth/auth"
import { extractPath } from "@/utils/text"


export default function AudioControls({ text, assetId, name, iconSize=20, loadingText='', loadingFlipped=false }){

    const [loadState, setLoadState] = useState(0)
    const [audioPaused, setAudioPaused] = useState(false)
    const [audioStats, setAudioStats] = useState({})
    const [audioTime, setAudioTime] = useState(undefined)
    
    const [audioDuration, setAudioDuration] = useState(undefined)
    const [officialAudioDuration, setOfficialAudioDuration] = useState(undefined)
    const [audioDurationIsEstimate, setAudioDurationIsEstimate] = useState(false)
    const useBufferedTime = useRef(null)  // should we use buffered time as audioDuration or not

    const mediaSources = useRef([])
    const audios = useRef([])
    const sourceBuffers = useRef([])
    const currIndex = useRef(undefined)
    
    const targetAudioTime = useRef(undefined)
    const setTargetAudioTime = useRef(false)

    const { getToken } = Auth.useAuth()

    function speedUp(){
        let myAudio = audios.current[currIndex.current]
        if (!myAudio) {
            return
        }
        myAudio.playbackRate = myAudio.playbackRate + .1;
        setAudioStats({...audioStats, 'playbackRate': myAudio.playbackRate})
    }

    function slowAudio(){
        let myAudio = audios.current[currIndex.current]
        if (!myAudio) {
            return
        }
        myAudio.playbackRate = myAudio.playbackRate - .1;
        setAudioStats({...audioStats, 'playbackRate': myAudio.playbackRate})
    }

    function switchToAudio(newAudioIndex, toZero){
        if (newAudioIndex === undefined || currIndex.current == newAudioIndex || newAudioIndex >= audios.current.length || newAudioIndex < 0){
            return
        }
        let currAudio = audios.current[currIndex.current]
        currAudio.pause()
        currIndex.current = newAudioIndex
        let newAudio = audios.current[currIndex.current]
        newAudio.playbackRate = currAudio.playbackRate
        if (toZero){
            newAudio.currentTime = 0
        }
        newAudio.play()
    }

    // Function to skip ahead by a certain number of seconds
    function skipForward(seconds) {
        let fullyBufferedTime = Infinity
        try {
            fullyBufferedTime = getTimeOffset(audios.current.length - 1) + audios.current[audios.current.length - 1].buffered.end(0)
        }
        catch(e){
            console.log(`Couldn't get fully buffered time: ${e}`)
        }
        try {
            let desiredTime = Math.min(getTimeOffset(currIndex.current) + audios.current[currIndex.current].currentTime + seconds, fullyBufferedTime);
            jumpToTime(desiredTime)
        }
        catch(e) {
            console.log(`Couldn't skip forward: ${e}`)
        }
    }

    // Function to skip back by a certain number of seconds
    function skipBackward(seconds) {
        try {
            let desiredTime = Math.max(getTimeOffset(currIndex.current) + audios.current[currIndex.current].currentTime - seconds, 0);
            jumpToTime(desiredTime)
        }
        catch(e) {
            console.log(`Couldn't skip backward: ${e}`)
        }
    }


    // Function to pause audio
    function pauseAudio(audio) {
        if (!audio){
            let myAudio = audios.current[currIndex.current]
            if (myAudio){
                myAudio.pause()
                setAudioPaused(true)
            }
        }
        else {
            audio.pause();
        }
    }

    // Function to resume audio
    function resumeAudio() {
        setAudioPaused(false)
        let myAudio = audios.current[currIndex.current]
        myAudio.play();
    }

    function setFullDuration(){
        let totalTime = 0
        for (let buffer of sourceBuffers.current){
            if (buffer.buffered.length){
                totalTime += buffer.buffered.end(0)
            }
        }
        setAudioDuration(totalTime)
    }

    function getTimeOffset(index) {
        let offset = audios.current.filter((_, i) => i < index).map((audio) => {
            if (audio.buffered && audio.buffered.length){
                return audio.buffered.end(0)
            }
            return 0
        }).reduce((a, b) => a + b, 0)

        return offset
    }

    function jumpToTime(time) {
        let allAudiosOffset = audios.current.map((_, i) => getTimeOffset(i))
        let neededAudioIndex = 0
        for (let i = 0; i < allAudiosOffset.length; i++){
            if (allAudiosOffset[i] > time){
                break
            }
            neededAudioIndex = i;
        }
        switchToAudio(neededAudioIndex)
        let myAudio = audios.current[currIndex.current]
        if (!myAudio.buffered || !myAudio.buffered.length){
            console.log("Could not jump; audio is unbuffered.")
            return
        }
        let thisAudioTime = time - allAudiosOffset[neededAudioIndex]

        // Now, why do we need this? Why would this happen?
        // I noticed that sometimes the browser was un-buffering the beginnings of audio clips! Very annoying!
        // i hate javascript i hate web audio api i hate chromium i hate i hate i hate i hate
        if ((myAudio.buffered.start(0) > thisAudioTime || myAudio.buffered.end(0) < thisAudioTime) && currIndex.current != audios.current.length - 1){
            console.log("Requested time outside buffered area; cannot do it atm.")
            return
        }
        myAudio.currentTime = thisAudioTime
        setAudioTime(time)
    }

    async function onListenClick(newSocket, firstAudio) {
        let queue = [];
        let seenFirst = false;
        try {
            const speed = 1.0; // Adjust as needed
            // Prepare the TTS request data
            const data = {
                'txt': text,
                'speed': speed,
                'id': assetId,
                'name': name,
                'x-access-token': await getToken()
            };
    
            // Emit the event to start streaming
            newSocket.emit('start_stream', data);
            function smartAddToBuffer(optionalVal){
                if (queue.length > 0) {
                    if (mediaSources.current.length > 0 && sourceBuffers.current.length == mediaSources.current.length){
                        let index = mediaSources.current.length - 1
                        let currMediaSource = mediaSources.current[index]
                        let currSourceBuffer = sourceBuffers.current[index]
                        if (!currSourceBuffer.updating && currMediaSource.readyState === 'open'){
                            let val = optionalVal ? optionalVal : queue.shift()
                            try {
                                if (audios.current[index].buffered && audios.current[index].buffered.length){
                                    // Why? I noticed that toward the end, even before a quota exceeded error,
                                    // the browser was deleting stuff from the start of the clip.
                                    if (audios.current[index].buffered.start(0) > 0){
                                        throw Error("ClippingStartError")
                                    }
                                }
                                currSourceBuffer.appendBuffer(val);
                                if (useBufferedTime.current){
                                    setFullDuration()
                                }
                            }
                            catch(e) {
                                queue.push(val);
                                if (e.name === "QuotaExceededError" || e == 'Error: ClippingStartError') {
                                    console.log("Quota Exceeded Error")
                                    buildNewAudio(newSocket)
                                    smartAddToBuffer(val)
                                } else {
                                    console.error("Error appending buffer:", e);
                                }
                            }
                        }
                        else {
                            setTimeout(() => {
                                smartAddToBuffer()
                            }, 100);
                        }
                    }
                    else {
                        setTimeout(() => {
                            smartAddToBuffer()
                        }, 100);
                    }
                }
            }
    
            newSocket.on('set_audio_time', async (data) => {
                await new Promise(r => setTimeout(r, 2000))
                targetAudioTime.current = data['seconds'];
            });

            newSocket.on('total_time', (data) => {
                setOfficialAudioDuration(data.data)
                setAudioDurationIsEstimate(data.estimate)
            });

            newSocket.on('audio_chunk', (data) => {
                
                // Jump to current time if it's just loaded.
                let currAudio = audios.current[audios.current.length - 1]
                if (currAudio && currAudio.buffered.length > 0){
                    let offset = getTimeOffset(audios.current.length - 1)
                    let bufferedSeconds = currAudio.buffered.end(0) + offset
                    if (!setTargetAudioTime.current && targetAudioTime.current && targetAudioTime.current < bufferedSeconds - .5){
                        setTargetAudioTime.current = true
                        jumpToTime(targetAudioTime.current)
                    }
                }

                if (!seenFirst) {
                    setLoadState(1);
                    seenFirst = true;
                }
                let value = new Uint8Array(data.data);
                queue.push(value)
                smartAddToBuffer()
            });         
    
            // Handle playback errors
            newSocket.on('error', (error) => {
                console.error('Streaming error:', error.message);
                setLoadState(3); // Update load state to indicate an error
            });

            await firstAudio.play().catch(e => console.log('Playback error:', e));
        } catch (e) {
            console.log(`Error in onListenClick: ${e}`)
        }
    }

    async function sendTime(newSocket, currentTime){
        try {
            let data = {
                'id': assetId,
                'name': name,
                'time': currentTime,
                'x-access-token': await getToken()
            }
            newSocket.emit('time_update', data);
        }
        catch(e) {
            console.log("Failed to update time")
            console.log(e)
        }
    }

    function checkForJumpAhead(){
        if (!setTargetAudioTime.current && targetAudioTime.current){
            for (let i = 0; i < audios.current.length; i++){
                let audio = audios.current[i]
                let offset = getTimeOffset(i)
                if (audio.buffered.length && audio.buffered.end(0) + offset > targetAudioTime.current){
                    setTargetAudioTime.current = true;
                    jumpToTime(targetAudioTime.current)
                    break
                }
            }
        }
    }

    function buildNewAudio(newSocket){
        let mediaSource = new MediaSource();
        let audio = new Audio();

        mediaSources.current.push(mediaSource)
        audios.current.push(audio)

        let index = audios.current.length - 1

        mediaSource.addEventListener('sourceopen', () => {
            let sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');

            // Why is it done like this? Because the Web Audio API is **the worst API humanly possible**
            // Note that source open could complete after the sourceBuffers gets reset, so this is a sloppy but usually fine fix.
            if (sourceBuffers.current.length == mediaSources.current.length){
                sourceBuffers.current[index] = sourceBuffer
            }
            else {
                sourceBuffers.current.push(sourceBuffer)
            }
        }, {'once': true})

        audio.addEventListener('timeupdate', function() {

            // If we're close to the end, switch audio! Should only happen once every 10 minutes or so.
            // ended event wasn't working + duration time not consistent...
            if (audio.buffered.length && audio.buffered.end(0) <= audio.currentTime + .5){
                setTimeout(() => {
                    switchToAudio(index+1, true)  // index+1 is provided in case this double fires
                }, .5)
            }

            let offset = getTimeOffset(index)
            let timeWithOffset = audio.currentTime + offset
            setAudioTime(timeWithOffset)
            checkForJumpAhead()  // We do this because it's possible for buffering to end before it gets a chance to set the time
            sendTime(newSocket, timeWithOffset)
        });

        audio.preload = "none";
        audio.src = URL.createObjectURL(mediaSource);

        return audio

    }    

    useEffect(() => {
        // Connect to the WebSocket server
        const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL + '/speak', {'path': extractPath(process.env.NEXT_PUBLIC_BACKEND_URL + '/socket.io')});
        newSocket.on('connect', function() {
            console.log('Socket connected to the server.');
        });
        mediaSources.current = []
        audios.current = []
        sourceBuffers.current = []
        currIndex.current = 0
        let firstAudio = buildNewAudio(newSocket)

        let prom = onListenClick(newSocket, firstAudio)

        return async () => {
            newSocket.close()
            await prom  // it has to do with pausing AFTER starting is complete.
            try {
                pauseAudio(firstAudio)
                if (audios.current.length > 1){
                    pauseAudio()
                }
            }
            catch(e) {
                console.log(e)
                // probably a play during a pause if the useEffect double triggered
            }
        };
    }, []);

    // We love an early return right folks
    if (loadState == 0) {
        return (
            <Loading flipped={loadingFlipped} size={iconSize} text={loadingText} />
        )
    }
    if (loadState == 3) {
        return (
            "Error"
        )
    }

    const audioTimeString = (targetAudioTime.current && !setTargetAudioTime.current) ? (<Loading text="" />) : secondsToFormattedTime(audioTime)
    let audioDurationTimeString = secondsToFormattedTime(officialAudioDuration ? officialAudioDuration : audioDuration)
    let audioDurationString = audioDurationIsEstimate ? `~${audioDurationTimeString}` : audioDurationTimeString

    return (
        <div style={{'display': 'flex', 'gap': '5px', 'alignItems': 'center'}}>
            <div>
                {audioTimeString}
            </div>
            <Tooltip content={"Back 5 seconds"}>
                <MyImage
                    src={RecentIcon}
                    width={iconSize}
                    height={iconSize}
                    alt={"Back 5 seconds"}
                    className={'_clickable'}
                    onClick={() => skipBackward(5)}
                />
            </Tooltip>
            <Tooltip content={audioStats && audioStats.playbackRate ? `Slow down (${audioStats.playbackRate.toFixed(1)})` : "Slow down"}>
                <MyImage
                    src={SlowDownIcon}
                    width={iconSize}
                    height={iconSize}
                    alt={"Slow down"}
                    className={'_clickable'}
                    onClick={() => slowAudio()}
                />
            </Tooltip>
            {
                !audioPaused ? (
                    <MyImage
                        title={"Pause"}
                        src={PauseIcon}
                        width={iconSize}
                        height={iconSize}
                        alt={"Pause"}
                        className={'_clickable'}
                        onClick={() => pauseAudio()}
                        priority={true}
                    />
                ) : (
                    <MyImage
                        title={"Play"}
                        src={PlayIcon}
                        width={iconSize}
                        height={iconSize}
                        alt={"Pause"}
                        className={'_clickable'}
                        onClick={resumeAudio}
                        priority={true}
                    />
                )
            }
            <Tooltip content={audioStats && audioStats.playbackRate ? `Speed up (${audioStats.playbackRate.toFixed(1)})` : "Speed up"}>
                <MyImage
                    src={SpeedUpIcon}
                    width={iconSize}
                    height={iconSize}
                    alt={"Speed up"}
                    className={'_clickable'}
                    onClick={() => speedUp()}
                />
            </Tooltip>
            <Tooltip content={"Skip 5 seconds"}>
                <MyImage
                    src={SkipForwardIcon}
                    width={iconSize}
                    height={iconSize}
                    alt={"Skip forward"}
                    className={'_clickable'}
                    onClick={() => skipForward(5)}
                />
            </Tooltip>
            <Tooltip content={"Total time of buffered audio"}>
                <div>
                    {audioDurationString}
                </div>
            </Tooltip>
        </div>
    )
}