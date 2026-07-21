import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import Sidebar from "./components/Sidebar.jsx";
import Editor from "./components/Editor.jsx";
import PasswordDialog from "./components/PasswordDialog.jsx";
import CustomDialog from "./components/CustomDialog.jsx";
import CookieConsent from "./components/CookieConsent.jsx";
import LegalDialog from "./components/LegalDialog.jsx";
import {
  db,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  notesCollection,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "./firebase.js";

const emptyDialog = {
  open: false,
  mode: "alert",
  kind: "message",
  title: "",
  message: "",
  type: "",
  confirmText: "OK",
  rows: 3,
  cols: 3,
};

// Slash commands for Notion-like block insertion
const SLASH_COMMANDS = [
  { id: "h1",      label: "Heading 1",    icon: "H1",  hint: "Large section heading" },
  { id: "h2",      label: "Heading 2",    icon: "H2",  hint: "Medium section heading" },
  { id: "h3",      label: "Heading 3",    icon: "H3",  hint: "Small section heading" },
  { id: "ul",      label: "Bullet List",  icon: "•—",  hint: "Unordered list" },
  { id: "ol",      label: "Numbered List",icon: "1.",  hint: "Ordered list" },
  { id: "table",   label: "Table",        icon: "⊞",   hint: "Insert a table" },
  { id: "code",    label: "Code Block",   icon: "</>", hint: "Preformatted code" },
  { id: "divider", label: "Divider",      icon: "—",   hint: "Horizontal rule" },
  { id: "quote",   label: "Quote",        icon: "\"",   hint: "Block quotation" },
];

function normalizeEditorHtml(html) {
  const cleaned = (html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .trim();
  return cleaned === "<br>" ? "" : cleaned;
}

/**
 * Clean pasted HTML: strip Word/MSO noise, inline styles, class attrs,
 * keep only safe semantic tags and their content.
 */
function cleanPastedHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Remove Word/MSO conditional comments, xml tags, style/meta blocks
  const STRIP_TAGS = ["style", "meta", "link", "script", "xml", "o:p", "w:sdt", "w:sdtContent"];
  STRIP_TAGS.forEach((tag) => doc.querySelectorAll(tag).forEach((el) => el.remove()));

  // Walk all elements and clean attributes / unwanted spans
  const walk = (node) => {
    if (node.nodeType !== 1) return;
    // Remove class and style attributes (Word junk)
    node.removeAttribute("class");
    node.removeAttribute("style");
    node.removeAttribute("lang");
    node.removeAttribute("valign");
    node.removeAttribute("nowrap");
    node.removeAttribute("bgcolor");
    node.removeAttribute("width");
    node.removeAttribute("height");
    // Remove MSO / data attributes
    Array.from(node.attributes).forEach((attr) => {
      if (attr.name.startsWith("data-") || attr.name.startsWith("x:") || attr.name.startsWith("o:")) {
        node.removeAttribute(attr.name);
      }
    });
    Array.from(node.childNodes).forEach(walk);
  };
  walk(doc.body);

  // Unwrap meaningless <span> / <font> wrappers that have no attrs left
  doc.querySelectorAll("span, font").forEach((el) => {
    if (!el.attributes.length) {
      const frag = doc.createDocumentFragment();
      while (el.firstChild) frag.appendChild(el.firstChild);
      el.replaceWith(frag);
    }
  });

  // Collapse empty <p> / <div> runs to single <br>
  doc.querySelectorAll("p, div").forEach((el) => {
    if (!el.textContent.trim() && !el.querySelector("img, table, br")) {
      el.replaceWith(doc.createElement("br"));
    }
  });

  return doc.body.innerHTML;
}

function App() {
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const dialogResolver = useRef(null);
  const passwordResolver = useRef(null);
  const [notes, setNotes] = useState([]);
  const [noteName, setNoteName] = useState("");
  const [author, setAuthor] = useState("");
  const [password, setPassword] = useState("");
  const [currentNoteId, setCurrentNoteId] = useState("");
  const [currentNotePassword, setCurrentNotePassword] = useState("");
  const [isEditing, setIsEditing] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem("notepad-theme") || "dark");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [matches, setMatches] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [exportOpen, setExportOpen] = useState(false);
  const [formatToolbarOpen, setFormatToolbarOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dialog, setDialog] = useState(emptyDialog);
  const [passwordDialog, setPasswordDialog] = useState({ open: false, note: null, action: "open", title: "", authorText: "", submitText: "Open" });
  const [passwordInput, setPasswordInput] = useState("");
  const [legalDialog, setLegalDialog] = useState({ open: false, type: "" });
  const [slashCmd, setSlashCmd] = useState({ open: false, query: "", anchor: null });
  const slashMenuRef = useRef(null);

  const filteredNotes = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    if (!text) return notes;
    return notes.filter(
      (note) => note.id.toLowerCase().includes(text) || (note.author || "").toLowerCase().includes(text)
    );
  }, [notes, searchText]);

  const getEditorHtml = () => normalizeEditorHtml(editorRef.current?.innerHTML || "");
  const getEditorText = () => (editorRef.current?.innerText || "").replace(/\n{3,}/g, "\n\n").trimEnd();
  const setEditorHtml = (html) => {
    if (editorRef.current) editorRef.current.innerHTML = normalizeEditorHtml(html);
  };

  const showAlert = (message, title = "Alert", type = "info") =>
    new Promise((resolve) => {
      dialogResolver.current = resolve;
      setDialog({ ...emptyDialog, open: true, mode: "alert", title, message, type, confirmText: "OK" });
    });

  const showConfirm = (message, title = "Confirm", type = "info") =>
    new Promise((resolve) => {
      dialogResolver.current = resolve;
      setDialog({ ...emptyDialog, open: true, mode: "confirm", title, message, type, confirmText: "OK" });
    });

  const showTableDialog = () =>
    new Promise((resolve) => {
      dialogResolver.current = resolve;
      setDialog({ ...emptyDialog, open: true, mode: "table", kind: "table", title: "Insert Table", confirmText: "Insert", rows: 3, cols: 3 });
    });

  const closeDialog = (value) => {
    setDialog(emptyDialog);
    dialogResolver.current?.(value);
    dialogResolver.current = null;
  };

  async function loadList() {
    const snapshot = await getDocs(query(notesCollection, orderBy("__name__")));
    const loaded = snapshot.docs.map((item) => {
      const data = item.data() || {};
      return {
        id: item.id,
        author: data.author || "Unknown",
        content: data.content || "",
        expiry: data.expiry || null,
        password: data.password || "",
      };
    });
    setNotes(loaded);
  }

  async function autoDeleteExpiredNotes() {
    const snapshot = await getDocs(notesCollection);
    const batch = writeBatch(db);
    let deletedCount = 0;
    snapshot.forEach((item) => {
      const expiry = item.data().expiry;
      if (expiry?.toDate && expiry.toDate() < new Date()) {
        batch.delete(item.ref);
        deletedCount += 1;
      }
    });
    if (deletedCount) {
      await batch.commit();
      await loadList();
    }
  }

  useEffect(() => {
    const savedTheme = localStorage.getItem("notepad-theme") || "dark";
    setTheme(savedTheme);
    loadList().catch((error) => showAlert(`Error loading notes: ${error.message}`, "Error", "danger"));
    autoDeleteExpiredNotes().catch(console.error);
    const interval = setInterval(() => autoDeleteExpiredNotes().catch(console.error), 5 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("light-mode", theme === "light");
    document.body.classList.toggle("menu-open", menuOpen);
    localStorage.setItem("notepad-theme", theme);
  }, [theme, menuOpen]);

  useEffect(() => {
    const update = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  function clearEditor() {
    setCurrentNoteId("");
    setCurrentNotePassword("");
    setNoteName("");
    setAuthor("");
    setPassword("");
    setEditorHtml("");
    clearHighlights();
    setSearchTerm("");
    setIsEditing(true);
    setExportOpen(false);
  }

  function placeCaretInside(element) {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function insertHtmlAtCursor(html) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const temp = document.createElement("div");
    temp.innerHTML = html;
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
  }

  function createHtmlTable(rows, cols, data = []) {
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
  }

  async function openNote(note) {
    setOpenMenuId("");
    if (note.password) {
      const entered = await askPassword(note, "open");
      if (entered !== note.password) {
        await showAlert("Incorrect password!", "Error", "danger");
        return;
      }
      setCurrentNotePassword(entered);
    } else {
      setCurrentNotePassword("");
    }

    const snapshot = await getDoc(doc(notesCollection, note.id));
    const data = snapshot.data() || note;
    setCurrentNoteId(note.id);
    setNoteName(note.id);
    setAuthor(data.author || "Unknown");
    setPassword(data.password || "");
    setEditorHtml(data.content || "");
    setSearchOpen(false);
    setSearchTerm("");
    clearHighlights();
    setIsEditing(false);
    setMenuOpen(false);
  }

  function askPassword(note, action) {
    return new Promise((resolve) => {
      passwordResolver.current = resolve;
      setPasswordInput("");
      setPasswordDialog({
        open: true,
        note,
        action,
        title: `${action === "delete" ? "Delete" : "Open"}: ${note.id}`,
        authorText: action === "delete" ? "This action cannot be undone" : `By: ${note.author || "Unknown"}`,
        submitText: action === "delete" ? "Delete" : "Open",
      });
    });
  }

  function closePasswordDialog(value = "") {
    setPasswordDialog((current) => ({ ...current, open: false }));
    passwordResolver.current?.(value);
    passwordResolver.current = null;
  }

  async function saveNote() {
    const id = noteName.trim();
    const writer = author.trim();
    if (!id) return showAlert("Enter a note name", "Validation Error", "danger");
    if (!writer) return showAlert("Enter author name", "Validation Error", "danger");

    const content = getEditorHtml();
    const expiry = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    await setDoc(doc(notesCollection, id), {
      content,
      author: writer,
      password: password.trim(),
      expiry: Timestamp.fromDate(expiry),
      updatedAt: serverTimestamp(),
    });
    setCurrentNoteId(id);
    setCurrentNotePassword(password.trim());
    await loadList();
    setIsEditing(false);
    await showAlert(`Note saved as ${password.trim() ? "password-protected" : "open with no password"}, expires in 4 days.`, "Success", "success");
  }

  async function deleteNote(note) {
    setOpenMenuId("");
    if (note.password) {
      const entered = await askPassword(note, "delete");
      if (entered !== note.password) {
        await showAlert("Incorrect password!", "Error", "danger");
        return;
      }
    }
    const confirmed = await showConfirm(`Delete "${note.id}"?`, "Confirm Deletion", "danger");
    if (!confirmed) return;
    try {
      await deleteDoc(doc(notesCollection, note.id));
      if (currentNoteId === note.id) clearEditor();
      await loadList();
      await showAlert(`"${note.id}" deleted successfully`, "Success", "success");
    } catch (err) {
      await showAlert(`Failed to delete: ${err.message}`, "Error", "danger");
    }
  }

  async function deleteOpenNote() {
    const id = currentNoteId || noteName.trim();
    if (!id) return showAlert("No note open", "Error", "danger");
    const snapshot = await getDoc(doc(notesCollection, id));
    const data = snapshot.data() || {};
    if (data.password && data.password !== (currentNotePassword || password.trim())) {
      await showAlert("Incorrect password!", "Error", "danger");
      return;
    }
    await deleteNote({ id, ...data });
    setExportOpen(false);
  }

  function copyNoteToClipboard() {
    const textToCopy = `${noteName ? noteName.trim() + "\n\n" : ""}${getEditorText()}`.trim();
    navigator.clipboard.writeText(textToCopy).then(() => {
      showAlert("Note copied to clipboard!", "Success", "success");
    }).catch((err) => {
      showAlert(`Copy failed: ${err.message}`, "Error", "danger");
    });
  }

  function exportTXT() {
    const blob = new Blob([getEditorText()], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${noteName.trim() || "note"}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
    setExportOpen(false);
  }

  function exportPDF() {
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
  }

  async function extendNoteLife() {
    if (!currentNoteId) return showAlert("Open a note first", "Error", "danger");
    const noteRef = doc(notesCollection, currentNoteId);
    const snapshot = await getDoc(noteRef);
    const data = snapshot.data() || {};
    if (data.password && data.password !== (currentNotePassword || password.trim())) {
      await showAlert("Incorrect password!", "Error", "danger");
      return;
    }
    const currentExpiry = data.expiry?.toDate ? data.expiry.toDate() : new Date();
    const newExpiry = new Date(currentExpiry.getTime() + 24 * 60 * 60 * 1000);
    await updateDoc(noteRef, { expiry: Timestamp.fromDate(newExpiry), updatedAt: serverTimestamp() });
    await loadList();
    setExportOpen(false);
    await showAlert("Note extended by 24 hours!", "Success", "success");
  }

  async function handleInsertTable() {
    if (!isEditing) return showAlert("Switch to edit mode first", "Error", "danger");
    const value = await showTableDialog();
    if (!value) return;
    insertHtmlAtCursor(createHtmlTable(value.rows, value.cols));
    setExportOpen(false);
  }

  function clearHighlights() {
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
  }

  function applyHighlights(term) {
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
  }

  useEffect(() => {
    matches.forEach((mark, index) => mark.classList.toggle("current-match", index === currentMatchIndex));
    if (matches[currentMatchIndex]) matches[currentMatchIndex].scrollIntoView({ block: "center", behavior: "smooth" });
  }, [matches, currentMatchIndex]);

  function moveMatch(direction) {
    if (!matches.length) return;
    setCurrentMatchIndex((index) => {
      if (direction === "prev") return index <= 0 ? matches.length - 1 : index - 1;
      return index >= matches.length - 1 ? 0 : index + 1;
    });
  }

  function handlePaste(event) {
    if (!isEditing) return;

    const clipboardTypes = event.clipboardData.types;
    const hasHtml = clipboardTypes.includes("text/html");
    const text = event.clipboardData.getData("text/plain");
    const html = hasHtml ? event.clipboardData.getData("text/html") : "";

    // Ctrl+Shift+V or similar: only plain text available — always paste as plain text
    if (!hasHtml || !html.trim()) {
      event.preventDefault();
      if (!text.trim()) return;

      // Tab-delimited plain text -> auto table
      const rows = text.trim().split("\n").map((line) => line.split("\t"));
      if (rows.length > 1 && rows.some((row) => row.length > 1)) {
        insertHtmlAtCursor(createHtmlTable(rows.length, Math.max(...rows.map((r) => r.length)), rows));
      } else {
        // Insert as plain text preserving line breaks
        const escaped = text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>");
        insertHtmlAtCursor(`<span>${escaped}</span>`);
      }
      return;
    }

    // HTML paste — check for tables first
    const lowerHtml = html.toLowerCase();
    if (lowerHtml.includes("<table")) {
      event.preventDefault();
      const cleaned = cleanPastedHtml(html);
      const parsed = new DOMParser().parseFromString(cleaned, "text/html");
      const body = parsed.body;

      // Walk top-level children, split on table vs non-table content
      const chunks = [];
      const visit = (node) => {
        if (!node) return;
        if (node.nodeType === 1) {
          const name = node.nodeName.toLowerCase();
          if (name === "table") {
            // Wrap table with our class
            node.classList.add("freenote-table");
            chunks.push({ type: "table", html: node.outerHTML });
            return;
          }
          // Container that wraps a table — recurse into children
          if (node.querySelector && node.querySelector("table")) {
            Array.from(node.childNodes).forEach(visit);
            return;
          }
          const t = (node.textContent || "").trim();
          if (t) chunks.push({ type: "block", html: node.outerHTML });
          return;
        }
        if (node.nodeType === Node.TEXT_NODE) {
          const t = (node.textContent || "").trim();
          if (t) chunks.push({ type: "block", html: `<p>${t}</p>` });
        }
      };

      Array.from(body.childNodes).forEach(visit);

      if (!chunks.length) {
        // Fallback: insert plain text then any tables found
        if (text.trim()) {
          const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
          insertHtmlAtCursor(`<p>${escaped}</p>`);
        }
        parsed.querySelectorAll("table").forEach((t) => {
          t.classList.add("freenote-table");
          insertHtmlAtCursor(`${t.outerHTML}<p><br></p>`);
        });
        return;
      }

      chunks.forEach((chunk) => {
        if (chunk.type === "table") {
          insertHtmlAtCursor(`${chunk.html}<p><br></p>`);
        } else {
          insertHtmlAtCursor(chunk.html);
        }
      });
      return;
    }

    // Rich HTML paste (no tables) — clean and insert
    event.preventDefault();
    const cleaned = cleanPastedHtml(html);
    if (cleaned.trim()) {
      insertHtmlAtCursor(cleaned);
    } else if (text.trim()) {
      const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
      insertHtmlAtCursor(`<span>${escaped}</span>`);
    }
  }

  function handleEditorKeyDown(event) {
    if (!isEditing) return;

    const editor = editorRef.current;
    const sel = window.getSelection();
    const anchorNode = sel?.anchorNode;

    // ── Tab key ─────────────────────────────────────────────────────────────
    if (event.key === "Tab") {
      // Table navigation
      const cell =
        document.activeElement.closest?.("td, th") ||
        anchorNode?.parentElement?.closest?.("td, th");
      if (cell && editor?.contains(cell)) {
        event.preventDefault();
        const cells = [...editor.querySelectorAll("th, td")];
        const index = cells.indexOf(cell);
        const nextIndex = event.shiftKey ? Math.max(0, index - 1) : Math.min(cells.length - 1, index + 1);
        cells[nextIndex]?.focus();
        if (cells[nextIndex]) placeCaretInside(cells[nextIndex]);
        return;
      }
      // List indentation
      const listItem = anchorNode?.parentElement?.closest?.("li");
      if (listItem && editor?.contains(listItem)) {
        event.preventDefault();
        document.execCommand(event.shiftKey ? "outdent" : "indent", false, null);
        return;
      }
      // Default: insert 2 spaces instead of focusing next element
      event.preventDefault();
      document.execCommand("insertText", false, "  ");
      return;
    }

    // ── Enter on empty list item → exit list ────────────────────────────────
    if (event.key === "Enter" && !event.shiftKey) {
      const listItem = anchorNode?.parentElement?.closest?.("li");
      if (listItem && editor?.contains(listItem) && !listItem.textContent.trim()) {
        event.preventDefault();
        // Outdent or break out of list
        const list = listItem.closest("ul, ol");
        if (list) {
          document.execCommand("outdent", false, null);
          // If we're still in a list item after outdent, convert to paragraph
          const stillIn = window.getSelection()?.anchorNode?.parentElement?.closest?.("li");
          if (stillIn) {
            document.execCommand("outdent", false, null);
          }
        }
        return;
      }
    }

    // ── Slash command trigger ────────────────────────────────────────────────
    // Only fire when / is typed and caret is at start of an empty block
    if (event.key === "/" && !event.ctrlKey && !event.metaKey) {
      const block =
        anchorNode?.parentElement?.closest?.("p, div, h1, h2, h3, h4, h5, h6") ||
        anchorNode?.parentElement;
      if (block && editor?.contains(block) && !block.textContent.trim()) {
        // Let the / be inserted first, then show the menu
        setTimeout(() => setSlashCmd({ open: true, query: "", anchor: block }), 0);
      }
    }
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) await containerRef.current?.requestFullscreen();
    else await document.exitFullscreen();
  }

  function handleFormat(command, value = null) {
    if (!isEditing || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    if (searchTerm) applyHighlights(searchTerm);
  }

  // Close slash menu on outside click / Escape
  useEffect(() => {
    if (!slashCmd.open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setSlashCmd((s) => ({ ...s, open: false }));
        editorRef.current?.focus();
      }
    };
    const onDown = (e) => {
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target)) {
        setSlashCmd((s) => ({ ...s, open: false }));
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [slashCmd.open]);

  async function executeSlashCommand(cmdId) {
    // Remove the trailing slash that triggered the menu
    const anchor = slashCmd.anchor;
    setSlashCmd({ open: false, query: "", anchor: null });

    // Clean up the / that was typed to open the menu
    if (anchor && anchor.isConnected) {
      anchor.textContent = "";
      // Place caret inside the empty block
      placeCaretInside(anchor);
    }
    editorRef.current?.focus();

    switch (cmdId) {
      case "h1":
        document.execCommand("formatBlock", false, "h1"); break;
      case "h2":
        document.execCommand("formatBlock", false, "h2"); break;
      case "h3":
        document.execCommand("formatBlock", false, "h3"); break;
      case "ul":
        document.execCommand("insertUnorderedList", false, null); break;
      case "ol":
        document.execCommand("insertOrderedList", false, null); break;
      case "table": {
        const value = await showTableDialog();
        if (value) insertHtmlAtCursor(createHtmlTable(value.rows, value.cols));
        break;
      }
      case "code": {
        const pre = document.createElement("pre");
        pre.className = "freenote-code";
        pre.textContent = "";
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(pre);
          placeCaretInside(pre);
        } else {
          editorRef.current?.appendChild(pre);
          placeCaretInside(pre);
        }
        break;
      }
      case "divider":
        document.execCommand("insertHorizontalRule", false, null);
        break;
      case "quote":
        document.execCommand("formatBlock", false, "blockquote");
        break;
      default: break;
    }
  }

  // Filtered slash commands based on query typed after /
  const filteredSlashCmds = useMemo(() => {
    const q = slashCmd.query.toLowerCase();
    if (!q) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(
      (c) => c.label.toLowerCase().includes(q) || c.id.includes(q)
    );
  }, [slashCmd.query]);

  // Listen for typing after / to filter slash menu
  useEffect(() => {
    if (!slashCmd.open) return;
    const onKey = (e) => {
      if (e.key === "Backspace") {
        setSlashCmd((s) => ({
          ...s,
          query: s.query.slice(0, -1),
          open: s.query.length > 0,
        }));
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        setSlashCmd((s) => ({ ...s, query: s.query + e.key }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slashCmd.open]);

  return (
    <>
      <div id="overlay" onClick={() => setMenuOpen(false)} />
      <Sidebar
        notes={filteredNotes}
        searchText={searchText}
        theme={theme}
        openMenuId={openMenuId}
        onNewNote={() => {
          clearEditor();
          setMenuOpen(false);
        }}
        onSearchTextChange={setSearchText}
        onOpenNote={openNote}
        onDeleteNote={deleteNote}
        onToggleTheme={setTheme}
        onToggleNoteMenu={setOpenMenuId}
        onOpenPrivacy={() => setLegalDialog({ open: true, type: "privacy" })}
        onOpenTerms={() => setLegalDialog({ open: true, type: "terms" })}
      />
      <Editor
        editorRef={editorRef}
        containerRef={containerRef}
        noteName={noteName}
        author={author}
        password={password}
        isEditing={isEditing}
        isFullscreen={isFullscreen}
        formatToolbarOpen={formatToolbarOpen}
        searchOpen={searchOpen}
        exportOpen={exportOpen}
        searchTerm={searchTerm}
        matchInfo={matches.length ? `${currentMatchIndex + 1} / ${matches.length}` : "No matches"}
        hasMatches={matches.length > 0}
        onNoteNameChange={setNoteName}
        onAuthorChange={setAuthor}
        onPasswordChange={setPassword}
        onContentInput={() => searchTerm && applyHighlights(searchTerm)}
        onPaste={handlePaste}
        onKeyDown={handleEditorKeyDown}
        onSave={saveNote}
        onCopyNote={copyNoteToClipboard}
        onExportTXT={exportTXT}
        onExportPDF={exportPDF}
        onDeleteOpenNote={deleteOpenNote}
        onExtendNote={extendNoteLife}
        onInsertTable={handleInsertTable}
        onToggleEdit={() => setIsEditing((value) => !value)}
        onToggleSearch={() => {
          setSearchOpen((value) => !value);
          if (searchOpen) {
            setSearchTerm("");
            clearHighlights();
          }
        }}
        onSearchChange={(value) => {
          setSearchTerm(value);
          applyHighlights(value);
        }}
        onCloseSearch={() => {
          setSearchOpen(false);
          setSearchTerm("");
          clearHighlights();
        }}
        onPrevMatch={() => moveMatch("prev")}
        onNextMatch={() => moveMatch("next")}
        onToggleExport={() => setExportOpen((value) => !value)}
        onToggleFullscreen={toggleFullscreen}
        onOpenMenu={() => setMenuOpen(true)}
        onFormat={handleFormat}
        onToggleFormatToolbar={() => setFormatToolbarOpen((value) => !value)}
      />
      <PasswordDialog
        passwordDialog={passwordDialog}
        value={passwordInput}
        onValueChange={setPasswordInput}
        onCancel={() => closePasswordDialog("")}
        onSubmit={() => closePasswordDialog(passwordInput)}
      />
      <CustomDialog
        dialog={dialog}
        onChange={(patch) => setDialog((current) => ({ ...current, ...patch }))}
        onCancel={() => closeDialog(false)}
        onConfirm={() => {
          if (dialog.kind === "table") {
            closeDialog({
              rows: Math.min(50, Math.max(1, parseInt(dialog.rows || 3, 10))),
              cols: Math.min(20, Math.max(1, parseInt(dialog.cols || 3, 10))),
            });
          } else {
            closeDialog(dialog.mode === "alert" ? true : true);
          }
        }}
      />
      <CookieConsent />
      <LegalDialog
        isOpen={legalDialog.open}
        type={legalDialog.type}
        onClose={() => setLegalDialog({ open: false, type: "" })}
      />

      {/* Notion-style slash command menu */}
      {slashCmd.open && (
        <div
          className="slash-menu"
          ref={slashMenuRef}
          role="menu"
          aria-label="Block type picker"
        >
          <div className="slash-menu-header">Turn into &rarr;</div>
          {filteredSlashCmds.length === 0 && (
            <div className="slash-menu-empty">No commands match</div>
          )}
          {filteredSlashCmds.map((cmd) => (
            <button
              key={cmd.id}
              className="slash-menu-item"
              role="menuitem"
              onMouseDown={(e) => {
                e.preventDefault();
                executeSlashCommand(cmd.id);
              }}
            >
              <span className="slash-menu-icon">{cmd.icon}</span>
              <span className="slash-menu-text">
                <span className="slash-menu-label">{cmd.label}</span>
                <span className="slash-menu-hint">{cmd.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export default App;

