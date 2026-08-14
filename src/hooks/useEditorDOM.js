import { useCallback } from "react";
import { jsPDF } from "jspdf";

export function useEditorDOM({
  editorRef,
  isEditing,
  searchTerm,
  applyHighlights,
  noteName,
  setExportOpen
}) {

  const getEditorHtml = useCallback(() => {
    const html = editorRef.current?.innerHTML || "";
    const cleaned = html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+="[^"]*"/gi, "")
      .replace(/\son\w+='[^']*'/gi, "")
      .trim();
    return cleaned === "<br>" ? "" : cleaned;
  }, [editorRef]);

  const getEditorText = useCallback(() => {
    return (editorRef.current?.innerText || "").replace(/\n{3,}/g, "\n\n").trimEnd();
  }, [editorRef]);

  const setEditorHtml = useCallback((html) => {
    if (editorRef.current) {
      const cleaned = (html || "")
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/\son\w+="[^"]*"/gi, "")
        .replace(/\son\w+='[^']*'/gi, "")
        .trim();
      const finalHtml = window.DOMPurify ? window.DOMPurify.sanitize(cleaned === "<br>" ? "" : cleaned) : (cleaned === "<br>" ? "" : cleaned);
      editorRef.current.innerHTML = finalHtml;
    }
  }, [editorRef]);

  const placeCaretInside = useCallback((element) => {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const insertHtmlAtCursor = useCallback((html) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const temp = document.createElement("div");
    const safeHtml = window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
    temp.innerHTML = safeHtml;
    const fragment = document.createDocumentFragment();
    let lastNode = null;
    while (temp.firstChild) lastNode = fragment.appendChild(temp.firstChild);

    const selection = window.getSelection();
    if (!selection.rangeCount || !editor.contains(selection.anchorNode)) {
      editor.appendChild(fragment);
      placeCaretInside(editor);
      return;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(fragment);

    if (lastNode) {
      range.setStartAfter(lastNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, [editorRef, placeCaretInside]);

  const createHtmlTable = useCallback((rows, cols, data = []) => {
    let html = '<table class="freenote-table">';
    for (let row = 0; row < rows; row += 1) {
      html += "<tr>";
      for (let col = 0; col < cols; col += 1) {
        const tag = row === 0 ? "th" : "td";
        const text = data[row]?.[col] ?? (row === 0 ? `Col ${col + 1}` : "");
        html += `<${tag}>${text}</${tag}>`;
      }
      html += "</tr>";
    }
    return `${html}</table><p><br></p>`;
  }, []);

  const handleFormat = useCallback((command, value = null) => {
    if (!isEditing || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    if (searchTerm) applyHighlights(searchTerm);
  }, [isEditing, editorRef, searchTerm, applyHighlights]);

  const handlePaste = useCallback((event) => {
    if (!isEditing) return;

    const text = event.clipboardData.getData("text/plain");
    const html = event.clipboardData.getData("text/html");

    if (html && html.toLowerCase().includes("<table")) {
      event.preventDefault();

      const parsed = new DOMParser().parseFromString(html, "text/html");
      const tables = Array.from(parsed.querySelectorAll("table"));
      const body = parsed.body;

      const escapeHtml = (str) =>
        String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      const chunks = [];

      const visit = (node) => {
        if (!node) return;

        if (node.nodeType === 1) {
          const name = node.nodeName?.toLowerCase?.();
          if (name === "table") {
            chunks.push({ type: "table", html: node.outerHTML });
            return;
          }
          if (node.querySelector && node.querySelector("table")) {
            Array.from(node.childNodes || []).forEach(visit);
            return;
          }
          const t = node.textContent;
          if (t && t.trim()) chunks.push({ type: "text", html: t });
          return;
        }

        if (node.nodeType === Node.TEXT_NODE) {
          const t = node.textContent;
          if (t && t.trim()) chunks.push({ type: "text", html: t });
        }
      };

      if (body) Array.from(body.childNodes).forEach(visit);

      if (!chunks.length && tables.length) {
        if (text && text.trim()) {
          insertHtmlAtCursor(`${escapeHtml(text).replace(/\n/g, "<br/>")}<p><br></p>`);
        }
        tables.forEach((t) => insertHtmlAtCursor(`${t.outerHTML}<p><br></p>`));
        return;
      }

      chunks.forEach((chunk) => {
        if (chunk.type === "table") {
          insertHtmlAtCursor(`${chunk.html}<p><br></p>`);
        } else {
          const raw = chunk.html || "";
          if (!raw.trim()) return;
          insertHtmlAtCursor(`${escapeHtml(raw).replace(/\n/g, "<br/>")}<p><br></p>`);
        }
      });

      if (tables.length && !chunks.some((c) => c.type === "table")) {
        tables.forEach((t) => insertHtmlAtCursor(`${t.outerHTML}<p><br></p>`));
      }

      return;
    }

    const rows = text.trim().split("\n").map((line) => line.split("\t"));
    if (rows.length > 1 && rows.some((row) => row.length > 1)) {
      event.preventDefault();
      insertHtmlAtCursor(createHtmlTable(rows.length, Math.max(...rows.map((row) => row.length)), rows));
    }
  }, [isEditing, insertHtmlAtCursor, createHtmlTable]);

  const handleEditorKeyDown = useCallback((event) => {
    if (!isEditing || event.key !== "Tab") return;
    const cell =
      document.activeElement.closest?.("td, th") || window.getSelection().anchorNode?.parentElement?.closest?.("td, th");
    if (!cell || !editorRef.current?.contains(cell)) return;
    event.preventDefault();
    const cells = [...editorRef.current.querySelectorAll("th, td")];
    const index = cells.indexOf(cell);
    const nextIndex = event.shiftKey ? Math.max(0, index - 1) : Math.min(cells.length - 1, index + 1);
    cells[nextIndex]?.focus();
    if (cells[nextIndex]) placeCaretInside(cells[nextIndex]);
  }, [isEditing, editorRef, placeCaretInside]);

  const exportTXT = useCallback(() => {
    const blob = new Blob([getEditorText()], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${noteName.trim() || "note"}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
    setExportOpen(false);
  }, [getEditorText, noteName, setExportOpen]);

  const exportPDF = useCallback(() => {
    const documentPdf = new jsPDF({ unit: "mm", format: "a4" });
    const left = 12;
    const top = 12;
    const pageWidth = documentPdf.internal.pageSize.getWidth();
    const pageHeight = documentPdf.internal.pageSize.getHeight();
    const lines = documentPdf.splitTextToSize(getEditorText(), pageWidth - 24);
    let y = top;
    lines.forEach((line) => {
      if (y + 7 > pageHeight - 12) {
        documentPdf.addPage();
        y = top;
      }
      documentPdf.text(line, left, y);
      y += 7;
    });
    documentPdf.save(`${noteName.trim() || "note"}.pdf`);
    setExportOpen(false);
  }, [getEditorText, noteName, setExportOpen]);

  return {
    getEditorHtml,
    setEditorHtml,
    insertHtmlAtCursor,
    createHtmlTable,
    handleFormat,
    handlePaste,
    handleEditorKeyDown,
    exportTXT,
    exportPDF
  };
}
