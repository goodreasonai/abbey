import React, { memo } from 'react';

const VideoEmbed = memo(({ videoUrl, height="70vh", width="100%" }) => {

    const videoId = getVideoIdFromUrl(videoUrl)
    return (
            <iframe
                style={{'height': height, 'width': width}}
                frameBorder="0"
                src={`https://www.youtube.com/embed/${videoId}`}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Embedded YouTube Video"
            />
    );
});

export const getVideoIdFromUrl = (url) => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[7].length === 11 ? match[7] : null;
};

export default VideoEmbed;
