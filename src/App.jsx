import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import Sidebar from "./components/Sidebar.jsx";
import Editor from "./components/Editor.jsx";
import NoteGrid from "./components/NoteGrid.jsx";
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

// ── Username helpers ────────────────────────────────────────────────────
const USERNAME_KEY = "notepad-username";

function getOrCreateUsername() {
  try {
    const saved = localStorage.getItem(USERNAME_KEY);
    const systemName = import.meta.env.VITE_SYSTEM_USERNAME;
    
    // If the saved name is just a generic random 'User_XXXX' and we have a system name, overwrite it
    if (systemName && (!saved || /^User_\d{4}$/.test(saved))) {
      localStorage.setItem(USERNAME_KEY, systemName);
      return systemName;
    }
    
    if (saved) return saved;
    
    // Fallback if no system name is available
    const generated = `User_${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem(USERNAME_KEY, generated);
    return generated;
  } catch {
    return "User";
  }
}

function saveUsername(name) {
  try { localStorage.setItem(USERNAME_KEY, name); } catch {}
}

/** Extract first 5 words from HTML content for use as note name */
function guessNoteName(html) {
  if (!html) return "";
  const text = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  const words = text.split(" ").slice(0, 5).join(" ");
  return words.slice(0, 24).trim() || "";
}

function App() {
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const dialogResolver = useRef(null);
  const passwordResolver = useRef(null);
  const pendingContentRef = useRef(""); // content waiting to be applied once editor mounts
  const [notes, setNotes] = useState([]);
  const [noteName, setNoteName] = useState("");
  const [noteNameManuallySet, setNoteNameManuallySet] = useState(false);
  const [author, setAuthor] = useState("");
  const [password, setPassword] = useState("");
  const [currentNoteId, setCurrentNoteId] = useState("");
  const [currentNotePassword, setCurrentNotePassword] = useState("");
  const [isEditing, setIsEditing] = useState(true);
  const [worksheets, setWorksheets] = useState([]); // [{id, name, data}]
  const [activeTab, setActiveTab] = useState("text"); // "text" or sheet id
  const [username, setUsernameState] = useState(getOrCreateUsername);
  const [theme, setTheme] = useState(() => localStorage.getItem("notepad-theme") || "");
  const [showEditor, setShowEditor] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
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
  const [toast, setToast] = useState("");
  const slashMenuRef = useRef(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  /** Persist username change */
  const handleSetUsername = (name) => {
    saveUsername(name);
    setUsernameState(name);
  };

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
    const cleaned = normalizeEditorHtml(html);
    if (editorRef.current) {
      editorRef.current.innerHTML = cleaned;
    } else {
      // Editor not mounted yet — store for later
      pendingContentRef.current = cleaned;
    }
  };

  // Apply pending content once the editor mounts (showEditor becomes true)
  useEffect(() => {
    if (!showEditor) return;
    if (pendingContentRef.current === "") return;
    // Wait one tick for the DOM to mount
    const id = setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = pendingContentRef.current;
        pendingContentRef.current = "";
      }
    }, 0);
    return () => clearTimeout(id);
  }, [showEditor]);

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
        worksheets: (data.worksheets || []).map(ws => ({
          ...ws,
          data: typeof ws.data === "string" ? JSON.parse(ws.data) : ws.data
        })),
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
    document.body.classList.toggle("dark-mode", theme === "dark-mode");
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
    setNoteNameManuallySet(false);
    setAuthor(username);
    setPassword("");
    setWorksheets([]);
    setActiveTab("text");
    pendingContentRef.current = "";
    if (editorRef.current) editorRef.current.innerHTML = "";
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
    setWorksheets((data.worksheets || []).map(ws => ({
      ...ws,
      data: typeof ws.data === "string" ? JSON.parse(ws.data) : ws.data
    })));
    setActiveTab("text");
    setEditorHtml(data.content || "");
    setSearchOpen(false);
    setSearchTerm("");
    clearHighlights();
    setIsEditing(false);
    setMenuOpen(false);
    setShowEditor(true);
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
    const content = getEditorHtml();
    const writer = author.trim() || username;

    // Auto-derive note name from first words of content if not manually set
    let id = noteName.trim();
    if (!id) {
      id = guessNoteName(content);
      
      // If content is empty but there's a worksheet, use the first cell
      if (!id && worksheets.length > 0 && worksheets[0]?.data?.length > 0 && worksheets[0].data[0]?.length > 0) {
        id = worksheets[0].data[0][0]?.toString().trim();
        if (id) id = id.replace(/[^a-zA-Z0-9_\- ]/g, "").slice(0, 24).trim();
      }
      
      if (!id) id = `Note ${new Date().toLocaleDateString("en-GB")}`;
    }

    // Auto-increment name if it already exists (to avoid overwriting)
    if (id !== currentNoteId) {
      let baseId = id;
      let counter = 1;
      while (notes.some((n) => n.id === id)) {
        id = `${baseId} (${counter})`;
        counter++;
      }
      if (id !== noteName.trim()) setNoteName(id);
    }

    const expiry = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    
    // Firestore does not support nested arrays. Serialize the 2D grid data to JSON.
    const serializedWorksheets = worksheets.map(ws => ({
      ...ws,
      data: JSON.stringify(ws.data)
    }));

    await setDoc(doc(notesCollection, id), {
      content,
      worksheets: serializedWorksheets,
      author: writer,
      password: password.trim(),
      expiry: Timestamp.fromDate(expiry),
      updatedAt: serverTimestamp(),
    });
    
    // If the note was renamed, delete the old document
    if (currentNoteId && currentNoteId !== id) {
      await deleteDoc(doc(notesCollection, currentNoteId));
    }

    setCurrentNoteId(id);
    setCurrentNotePassword(password.trim());
    await loadList();
    showToast(`Saved as "${id}"`);
  }

  async function handleBack() {
    if (isEditing) {
      const savedNote = notes.find((n) => n.id === currentNoteId);
      const currentHtml = getEditorHtml();
      const currentName = noteName.trim();
      const currentAuthor = author.trim();
      
      let isDirty = false;
      if (savedNote) {
        if (savedNote.content !== currentHtml || savedNote.author !== currentAuthor) {
          isDirty = true;
        }
      } else {
        if (currentHtml || currentName || (currentAuthor && currentAuthor !== username)) {
          isDirty = true;
        }
      }
      
      if (isDirty) {
        const confirmed = await showConfirm("You have unsaved changes. Discard them and go back?", "Unsaved Changes", "danger");
        if (!confirmed) return;
      }
    }
    
    setShowEditor(false);
    clearEditor();
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

  async function copyAllText() {
    try {
      const textToCopy = getEditorText();
      await navigator.clipboard.writeText(textToCopy);
      await showAlert("Copied to clipboard!", "Success", "success");
    } catch (err) {
      await showAlert(`Copy failed: ${err.message}`, "Error", "danger");
    }
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

    const editor = editorRef.current;
    const clipboardTypes = event.clipboardData.types;
    const hasHtml = clipboardTypes.includes("text/html");
    const text = event.clipboardData.getData("text/plain");
    const html = hasHtml ? event.clipboardData.getData("text/html") : "";

    // ── Check if caret is inside an existing table cell ──────────────────────
    const sel = window.getSelection();
    const anchorNode = sel?.anchorNode;
    const currentCell =
      anchorNode?.parentElement?.closest?.("td, th") ||
      (anchorNode?.nodeType === 1 ? anchorNode.closest?.("td, th") : null);
    const isInsideTable = currentCell && editor?.contains(currentCell);

    const lowerHtml = html.toLowerCase();
    const isExcel = lowerHtml.includes("excel") || 
                    lowerHtml.includes("mso-") || 
                    lowerHtml.includes("office:excel") || 
                    lowerHtml.includes("data-sheets-value") || 
                    lowerHtml.includes("data-mesh-id") || 
                    lowerHtml.includes("progid");
    const hasTable = lowerHtml.includes("<table");
    
    // Detect code copied from IDEs or code editors
    const isIDE = clipboardTypes.includes("vscode-editor-data") ||
                  lowerHtml.includes("intellij") ||
                  lowerHtml.includes("eclipse") ||
                  lowerHtml.includes("font-family: consolas") ||
                  lowerHtml.includes("font-family: 'courier new'") ||
                  lowerHtml.includes("font-family: monospace") ||
                  lowerHtml.includes("white-space: pre");

    // Force plain text if it's a non-Excel table, or if it's code from an IDE
    const forcePlainText = (hasTable && !isExcel) || isIDE;

    // ── Plain-text paste ─────────────────────────────────────────────────────
    if (!hasHtml || !html.trim() || forcePlainText) {
      event.preventDefault();
      if (!text.trim()) return;

      // If caret is inside an existing table cell, fill cells with tab/newline data
      if (isInsideTable) {
        const rows = text.trim().split("\n").map((line) => line.split("\t"));
        const table = currentCell.closest("table");
        const allCells = [...(table?.querySelectorAll("th, td") || [])];
        const startIndex = allCells.indexOf(currentCell);
        // Count columns
        const colCount = table?.rows[0]?.cells.length || 1;
        let cellIdx = startIndex;
        rows.forEach((rowData) => {
          rowData.forEach((cellText) => {
            if (allCells[cellIdx]) {
              allCells[cellIdx].textContent = cellText;
            }
            cellIdx += 1;
          });
          // Align to start of next row
          const filled = cellIdx - startIndex;
          const rowsFilled = Math.floor(filled / colCount);
          const colsInRow = filled % colCount;
          if (colsInRow !== 0) {
            cellIdx += colCount - colsInRow;
          }
        });
        // Place caret after the last filled cell
        const lastFilled = allCells[Math.min(cellIdx - 1, allCells.length - 1)];
        if (lastFilled) placeCaretInside(lastFilled);
        return;
      }

      // Otherwise, always paste as plain text (no forced table conversion)
      const escaped = text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>")
        .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;"); // preserve tabs as spaces
      insertHtmlAtCursor(`<span>${escaped}</span>`);
      return;
    }

    // ── HTML paste — check for tables ────────────────────────────────────────
    if (hasTable) {
      event.preventDefault();
      
      // If it's an Excel paste, create a new worksheet instead of inserting HTML
      if (isExcel) {
        const parsed = new DOMParser().parseFromString(html, "text/html");
        const table = parsed.querySelector("table");
        const sheetData = [];
        if (table) {
          const rows = table.querySelectorAll("tr");
          rows.forEach((tr) => {
            const rowData = [];
            tr.querySelectorAll("th, td").forEach((td) => {
              rowData.push(td.textContent.replace(/\r/g, "").replace(/\n/g, " ").trim());
            });
            sheetData.push(rowData);
          });
        }
        if (sheetData.length > 0) {
          const newSheet = { id: Date.now().toString(), name: `Sheet ${worksheets.length + 1}`, data: sheetData };
          setWorksheets(prev => {
             const updated = [...prev, newSheet];
             return updated;
          });
          setActiveTab(newSheet.id);
          return;
        }
      }

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

    // ── Rich HTML paste (no tables) — clean and insert ───────────────────────
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
      {toast && <div className="toast-notification">{toast}</div>}
      <Sidebar
        notes={notes}
        currentNoteId={currentNoteId}
        theme={theme}
        username={username}
        onSetUsername={handleSetUsername}
        onNewNote={() => { setMenuOpen(false); clearEditor(); setShowEditor(true); }}
        onHome={() => { setMenuOpen(false); handleBack(); }}
        onOpenNote={(note) => { setMenuOpen(false); openNote(note); }}
        onToggleTheme={setTheme}
        onOpenPrivacy={() => { setMenuOpen(false); setLegalDialog({ open: true, type: "privacy" }); }}
        onOpenTerms={() => { setMenuOpen(false); setLegalDialog({ open: true, type: "terms" }); }}
      />

      {/* ── HOME: Note grid ── */}
      {!showEditor && (
        <div id="main" style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <header className={`topbar topbar-3col ${mobileSearchOpen ? "mobile-search-active" : ""}`}>
            {/* Left — breadcrumb */}
            <div className="left-group" style={{ display: mobileSearchOpen ? "none" : "flex" }}>
              <button id="hamburgerBtn" className="icon-btn hamburger" aria-label="Menu" onClick={() => setMenuOpen(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
              <nav className="breadcrumb">
                <span className="breadcrumb-home">Home</span>
                <span className="breadcrumb-sep">/</span>
                <span className="breadcrumb-current">All notes</span>
              </nav>
            </div>

            {/* Mobile search toggle button */}
            <button
              className="icon-btn mobile-search-toggle"
              onClick={() => setMobileSearchOpen(true)}
              style={{ display: mobileSearchOpen ? "none" : "" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>

            {/* Center — search */}
            <div className={`topbar-search topbar-search-center ${mobileSearchOpen ? "mobile-open" : ""}`}>
              <svg className="topbar-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search a note…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                autoFocus={mobileSearchOpen}
              />
              {mobileSearchOpen && (
                <button
                  className="icon-btn mobile-search-close"
                  onClick={() => { setMobileSearchOpen(false); setSearchText(""); }}
                  style={{ position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}
            </div>

            {/* Right — new note shortcut */}
            <div className="right-group" style={{ display: mobileSearchOpen ? "none" : "flex", justifyContent: "flex-end", alignItems: "center" }}>
              <button
                className="note-grid-new"
                onClick={() => { clearEditor(); setShowEditor(true); }}
                style={{ fontSize: "12px", padding: "7px 14px" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                New
              </button>
            </div>
          </header>
          <NoteGrid
            notes={filteredNotes}
            searchText={searchText}
            openMenuId={openMenuId}
            onNewNote={() => { clearEditor(); setShowEditor(true); }}
            onSearchTextChange={setSearchText}
            onOpenNote={openNote}
            onDeleteNote={deleteNote}
            onToggleNoteMenu={setOpenMenuId}
          />
        </div>
      )}

      {/* ── EDITOR view ── */}
      {showEditor && (
      <Editor
        editorRef={editorRef}
        containerRef={containerRef}
        noteName={noteName}
        author={author}
        password={password}
        isEditing={isEditing}
        worksheets={worksheets}
        setWorksheets={setWorksheets}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
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
        onExportTXT={exportTXT}
        onExportPDF={exportPDF}
        onCopyAll={copyAllText}
        onDeleteOpenNote={deleteOpenNote}
        onExtendNote={extendNoteLife}
        onInsertTable={handleInsertTable}
        onToggleEdit={() => setIsEditing((value) => !value)}
        onToggleSearch={() => {
          setSearchOpen((value) => !value);
          if (searchOpen) { setSearchTerm(""); clearHighlights(); }
        }}
        onSearchChange={(value) => { setSearchTerm(value); applyHighlights(value); }}
        onCloseSearch={() => { setSearchOpen(false); setSearchTerm(""); clearHighlights(); }}
        onPrevMatch={() => moveMatch("prev")}
        onNextMatch={() => moveMatch("next")}
        onToggleExport={() => setExportOpen((value) => !value)}
        onToggleFullscreen={toggleFullscreen}
        onOpenMenu={() => setMenuOpen(true)}
        onBack={handleBack}
        onFormat={handleFormat}
        onToggleFormatToolbar={() => setFormatToolbarOpen((value) => !value)}
      />
      )}
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

