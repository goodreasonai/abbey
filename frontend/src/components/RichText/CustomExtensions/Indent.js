import { Extension } from "@tiptap/core"
import { findParentNode } from "prosemirror-utils"

export const Indent = Extension.create({
    name: "indent",
    addKeyboardShortcuts() {
        return {
            Tab: () => {
                const { state, dispatch } = this.editor.view;
                const { selection } = state;
                const listItem = findParentNode(node => node.type.name === 'listItem')(selection);
                if (!listItem) {
                    dispatch(state.tr.insertText('\t'));
                    return true;
                }
                return false;
            }
        }
    }
})