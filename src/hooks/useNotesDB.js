import { useState, useEffect } from "react";
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
} from "../firebase.js";

export function useNotesDB({
  showAlert,
  showConfirm,
  askPassword,
  clearEditor,
  getEditorHtml,
  setNoteName,
  setAuthor,
  setPassword,
  setEditorHtml,
  setSearchOpen,
  setSearchTerm,
  clearHighlights,
  setIsEditing,
  setMenuOpen,
  setExportOpen,
  setCurrentNoteId,
  setCurrentNotePassword,
  setOpenMenuId,
  currentNoteId,
  currentNotePassword,
  noteName,
  author,
  password,
}) {
  const [notes, setNotes] = useState([]);

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
    loadList().catch((error) => showAlert(`Error loading notes: ${error.message}`, "Error", "danger"));
    autoDeleteExpiredNotes().catch(console.error);
    const interval = setInterval(() => autoDeleteExpiredNotes().catch(console.error), 5 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    await deleteDoc(doc(notesCollection, note.id));
    if (currentNoteId === note.id) clearEditor();
    await loadList();
    await showAlert(`"${note.id}" deleted successfully`, "Success", "success");
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

  return {
    notes,
    openNote,
    saveNote,
    deleteNote,
    deleteOpenNote,
    extendNoteLife,
    loadList,
  };
}
