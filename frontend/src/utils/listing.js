

export const getLetterFromIndex = (index) => {
    if (index <= 0) {
        return 'A';
    }
    else if (index > 25){
        return 'Z'
    }
    else {
        return String.fromCharCode(65 + index);
    }
}
