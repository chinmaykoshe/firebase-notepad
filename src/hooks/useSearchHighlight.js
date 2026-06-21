import { useState, useEffect, useCallback } from "react";

export function useSearchHighlight({ editorRef }) {
  const [searchText, setSearchText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [matches, setMatches] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  const clearHighlights = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.querySelectorAll("mark.search-hit").forEach((mark) => {
      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    });
    setMatches([]);
    setCurrentMatchIndex(-1);
  }, [editorRef]);

  const applyHighlights = useCallback((term) => {
    clearHighlights();
    const editor = editorRef.current;
    if (!editor || !term.trim()) return;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node = walker.nextNode();
    while (node) {
      if (node.nodeValue.trim()) textNodes.push(node);
      node = walker.nextNode();
    }
    const found = [];
    textNodes.forEach((textNode) => {
      const text = textNode.nodeValue;
      const lower = text.toLowerCase();
      const needle = term.toLowerCase();
      let from = 0;
      let changed = false;
      const fragment = document.createDocumentFragment();
      while (true) {
        const index = lower.indexOf(needle, from);
        if (index === -1) break;
        changed = true;
        if (index > from) fragment.appendChild(document.createTextNode(text.slice(from, index)));
        const mark = document.createElement("mark");
        mark.className = "search-hit";
        mark.textContent = text.slice(index, index + needle.length);
        fragment.appendChild(mark);
        found.push(mark);
        from = index + needle.length;
      }
      if (changed) {
        if (from < text.length) fragment.appendChild(document.createTextNode(text.slice(from)));
        textNode.parentNode.replaceChild(fragment, textNode);
      }
    });
    setMatches(found);
    setCurrentMatchIndex(found.length ? 0 : -1);
  }, [clearHighlights, editorRef]);

  useEffect(() => {
    matches.forEach((mark, index) => mark.classList.toggle("current-match", index === currentMatchIndex));
    if (matches[currentMatchIndex]) {
      matches[currentMatchIndex].scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [matches, currentMatchIndex]);

  const moveMatch = useCallback((direction) => {
    if (!matches.length) return;
    setCurrentMatchIndex((index) => {
      if (direction === "prev") return index <= 0 ? matches.length - 1 : index - 1;
      return index >= matches.length - 1 ? 0 : index + 1;
    });
  }, [matches.length]);

  return {
    searchText,
    setSearchText,
    searchOpen,
    setSearchOpen,
    searchTerm,
    setSearchTerm,
    matches,
    currentMatchIndex,
    clearHighlights,
    applyHighlights,
    moveMatch,
  };
}
