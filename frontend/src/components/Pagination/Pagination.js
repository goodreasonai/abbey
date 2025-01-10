import { useEffect, useState } from 'react'
import styles from './Pagination.module.css'

export default function Pagination({ getPage, currPage, numPages, className='', ...props }) {

    const MAX_SHOWN_PAGES = 6  // not exact

    function makePageNumber(item, i){
        let classString = `${styles.pageNumber}`
        if (currPage == item){
            classString = `${styles.pageNumber} ${styles.currPageNumber}`
        }

        function clickPage(newPage){
            getPage(newPage);
        }

        return (
            <div key={i} className={classString} onClick={() => clickPage(item)}>
                {item}
            </div>
        )
    }
    
    let nextButton = currPage < numPages ? (
        <span style={{'cursor': 'pointer'}} onClick={() => getPage(currPage+1)}>{">>"}</span>
    ) : ""

    let needsDots = false
    let pagesToShow = []
    if (numPages <= MAX_SHOWN_PAGES){
        // Just show all the pages
        pagesToShow = [...Array(numPages).keys()].map(i => i + 1)
    }
    else if (currPage < Math.ceil(MAX_SHOWN_PAGES / 2)){
        // Haven't reached half way of MAX SHOWN PAGES yet
        pagesToShow = [...Array(MAX_SHOWN_PAGES).keys()].map(i => i + 1)
        needsDots = true
    }
    else if (numPages - currPage < Math.floor(MAX_SHOWN_PAGES / 2)) {
        // Close to the end
        for (let i = Math.max(numPages - MAX_SHOWN_PAGES + 1, 1); i <= numPages; i++){
            pagesToShow.push(i)
        }
    }
    else {
        // In the middle somewhere
        for (let i = Math.max(currPage - Math.floor(MAX_SHOWN_PAGES / 2), 1); i <= currPage + Math.floor(MAX_SHOWN_PAGES / 2) && i <= numPages; i++){
            pagesToShow.push(i)
        }
        needsDots = true
    }

    return (
        <div className={`${styles.pagination} ${className}`} {...props}>
            {pagesToShow.map(makePageNumber)}{needsDots ? (<span style={{'paddingRight': '10px'}}>...</span>) : ''}{nextButton}
        </div>
    )
}
