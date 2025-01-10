import styles from './LoadingSkeleton.module.css'

/*
Explanation of the type argument: the type determines the look and feel of a loading skeleton. They are presets.
- default: like an assets table row by row gray thing
- default-small: default but narrower
- horizontal: like an assets table recently viewed, horizontally spaced rectangles
- green-pills: like a table of flex-wrap:wrap'ed LinkedSelectorItems
- grid: evenly spaced, with wrap, 2 wide.
- video: single grey thing
- blocks: used for the home page
- chat: used for <Chat />
*/

export default function LoadingSkeleton({ numResults=10, type='default', className, ...props }) { 
    
    let containerClassName = ""
    let itemClassName = ""
    // I hate switch statements!
    if (type == 'default'){
        containerClassName = styles.container
        itemClassName = styles.loadingRow
    }
    else if (type == 'default-small'){
        containerClassName = styles.containerSmall
        itemClassName = styles.loadingRowSmall
    }
    else if (type == 'horizontal'){
        containerClassName = styles.containerHorizontal
        itemClassName = styles.loadingRowHorizontal
    }
    else if (type == 'green-pills'){
        containerClassName = styles.containerGreenPills
        itemClassName = styles.loadingRowGreenPills
    }
    else if (type == 'grid'){
        containerClassName = styles.containerGrid
        itemClassName = styles.loadingRowGrid
    }
    else if (type == 'video'){
        containerClassName = styles.video
    }
    else if (type == 'blocks'){
        containerClassName = styles.containerBlocks
        itemClassName = styles.loadingBlock
    }
    else if (type == 'chat'){
        containerClassName = styles.chatContainer
        itemClassName = styles.chatLoadingRow
    }
    else {
        throw Error("Unknown loading skeleton type")
    }

    if (className){  // user provided class name
        containerClassName = `${containerClassName} ${className}`
    }
    
    return (
        <div className={containerClassName} {...props}>
            {
                Array.from(Array(numResults).keys()).map((i) => {
                    return (
                        <div key={i} className={itemClassName}>
                        </div>
                    )
                })
            }
        </div>
    )
}
