import { Extension } from '@tiptap/core';

// Meant to be configured 
const CustomShortcuts = Extension.create({
    name: 'customShortcuts',
    
    addKeyboardShortcuts() {
        let shortcuts = {}
        for (let shortcut of this.options.shortcuts){
            shortcuts[shortcut['key']] = () => {
                shortcut['fnRef'].current()
            }
        }
        return shortcuts
    },
});
  
export default CustomShortcuts;