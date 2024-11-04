
import React from 'react';
import { useRef, useEffect } from 'react';
import styles from './Editor.module.css'
import { useCurrentEditor } from '@tiptap/react';

const TableToolbar = ({ position, onClose }) => {
    const { editor } = useCurrentEditor()
    const toolbarRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    const options = [
        {'value': 'Delete Table', 'onClick': ()=>editor.chain().focus().deleteTable().run()},
        {'value': 'Add Column Right', 'onClick': ()=>editor.chain().focus().addColumnAfter().run()},
        {'value': 'Add Column Left', 'onClick': ()=>editor.chain().focus().addColumnBefore().run()},
        {'value': 'Delete Column', 'onClick': ()=>editor.chain().focus().deleteColumn().run()},
        {'value': 'Add Row Above', 'onClick': ()=>editor.chain().focus().addRowBefore().run()},
        {'value': 'Add Row Below', 'onClick': ()=>editor.chain().focus().addRowAfter().run()},
        {'value': 'Delete Row', 'onClick': ()=>editor.chain().focus().deleteRow().run()},
    ]

    function makeOption(item, i) {
        return (
            <div key={i} style={i != 0 ? {'borderTop': '1px solid var(--light-border)'} : {}} className={styles.tableToolbarOption} onClick={()=>{onClose(); item.onClick()}}>
                {item.value}
            </div>
        )
    }

    return (
        <div
            style={{
                'border': '1px var(--light-border) solid',
                'position': 'absolute',
                'top': position.y,
                'left': position.x,
                'display': 'flex',
                'flexDirection': 'column'
            }}
            ref={toolbarRef}
            >
            {options.map(makeOption)}
        </div>
    );
};

export default TableToolbar;
