import { useEffect, useMemo, useRef, useState } from "react";
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

function normalizeEditorHtml(html) {
  const cleaned = (html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .trim();
  return cleaned === "<br>" ? "" : cleaned;
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
    document.body.setAttribute("data-theme", savedTheme);
    loadList().catch((error) => showAlert(`Error loading notes: ${error.message}`, "Error", "danger"));
    autoDeleteExpiredNotes().catch(console.error);
    const interval = setInterval(() => autoDeleteExpiredNotes().catch(console.error), 5 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
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

    const text = event.clipboardData.getData("text/plain");
    const html = event.clipboardData.getData("text/html");

    // If Word clipboard contains both paragraphs and <table>, insert:
    // - non-table text as word content
    // - table(s) as tables
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

    // Tab-delimited -> auto-table
    const rows = text.trim().split("\n").map((line) => line.split("\t"));
    if (rows.length > 1 && rows.some((row) => row.length > 1)) {
      event.preventDefault();
      insertHtmlAtCursor(createHtmlTable(rows.length, Math.max(...rows.map((row) => row.length)), rows));
    }
  }

  function handleEditorKeyDown(event) {
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
    </>
  );
}

export default App;

