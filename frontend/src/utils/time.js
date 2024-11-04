import { useEffect, useState } from "react";


export const formatTimestampDefault = (timestamp, isLocalTime) => {
    // Create a date object assuming the timestamp is in UTC
    const date = new Date(timestamp + (isLocalTime || timestamp.endsWith('Z') ? '' : 'Z')); // Adding 'Z' indicates the timestamp is in UTC

    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const yyyy = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');

    // Determine AM/PM suffix based on the hour value
    const ampm = hours >= 12 ? 'PM' : 'AM';

    // Convert the hour from 24-hour format to 12-hour format
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'

    // Construct the formatted string
    const formattedTime = `${mm}/${dd}/${yyyy} ${hours}:${minutes} ${ampm}`;

    return formattedTime;
}

export const formatTimestampSmall = (timestamp, isLocalTime) => {
    // Create a date object assuming the timestamp is in UTC
    const date = new Date(timestamp + (isLocalTime || timestamp.endsWith('Z') ? '' : 'Z')); // Adding 'Z' indicates the timestamp is in UTC

    const now = new Date(); // Get the current date/time in user's timezone

    // Check if the date is the same day
    const isSameDay = date.getDate() === now.getDate() &&
                      date.getMonth() === now.getMonth() &&
                      date.getFullYear() === now.getFullYear();

    if (isSameDay) {
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');

        // Determine AM/PM suffix based on the hour value
        const ampm = hours >= 12 ? 'PM' : 'AM';

        // Convert the hour from 24-hour format to 12-hour format
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'

        // Construct the formatted time string
        const formattedTime = `${hours}:${minutes} ${ampm}`;

        return formattedTime;
    } else {
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const yyyy = date.getFullYear();

        // Construct the formatted date string
        const formattedDate = `${mm}/${dd}/${yyyy}`;

        return formattedDate;
    }
}


// Like "Sept 22 2024"
export function formatTimestampIntl(timestamp, isLocalTime){
    const date = new Date(timestamp + (isLocalTime || timestamp.endsWith('Z') ? '' : 'Z')); // Adding 'Z' indicates the timestamp is in UTC
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    let formattedDate = date.toLocaleDateString('en-US', options);
    return formattedDate
}


export function getCurrentUTCTimestamp() {
    const now = new Date();
    const utcTimestamp = now.toISOString();
    return utcTimestamp;
}


export const secondsToFormattedTime = (secs) => {
    if (!secs){
        return "0:00"
    }

    var hours = Math.floor(secs / 3600);
    var minutes = Math.floor((secs - (hours * 3600)) / 60);
    var seconds = Math.floor(secs - (hours * 3600) - (minutes * 60));

    if (seconds < 10) {
        seconds = "0" + seconds;
    }

    if (hours <= 0){
        return minutes + ":" + seconds
    }

    if (hours > 0 && minutes < 10){
        minutes = "0" + minutes
    }

    return hours + ':' + minutes + ':' + seconds;
}
