

export function animateTitle(newTitle, delay) {
    let currentTitle = '';
    let index = 0;

    const typeTitle = () => {
        if (index < newTitle.length) {
            currentTitle += newTitle.charAt(index);
            document.getElementById("titleFromIndex").innerHTML = currentTitle;
            index++;
            setTimeout(typeTitle, delay); // Adjust time for typing speed
        }
    };

    typeTitle();
};
