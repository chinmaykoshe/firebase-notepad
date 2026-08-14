import { useState, useEffect } from "react";
import { supabase } from "../supabase.js";

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
  const [loading, setLoading] = useState(true);

  async function loadList() {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_notes_grid');
      
    if (error) {
      console.error("Supabase loadList error:", error);
      throw error;
    }
    
    const loaded = (data || []).map((item) => ({
      id: item.id,
      author: item.author || "Unknown",
      content: item.content || "",
      expiry: item.created_at ? new Date(item.created_at) : null,
      password: item.has_password ? true : "",
    }));
    setNotes(loaded);
    setLoading(false);
  }

  async function autoDeleteExpiredNotes() {
    // Only fetch expired notes to minimize data
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('notes')
      .select('id')
      .lt('expiry', now);
      
    if (error) {
      console.error("Error auto-deleting notes:", error);
      return;
    }
    
    if (data && data.length > 0) {
      const idsToDelete = data.map(n => n.id);
      await supabase.from('notes').delete().in('id', idsToDelete);
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
    let noteData = null;

    if (note.password) {
      const entered = await askPassword(note, "open");
      
      const { data, error } = await supabase.rpc('verify_note_password', {
        note_id: String(note.id),
        attempt_password: entered
      });

      if (error || !data || data.length === 0) {
        await showAlert("Incorrect password!", "Error", "danger");
        return;
      }
      
      setCurrentNotePassword(entered);
      noteData = data[0];
    } else {
      setCurrentNotePassword("");
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', String(note.id))
        .single();

      if (error) {
        console.error("Error opening note:", error);
        await showAlert(`Error opening note: ${error.message}`, "Error", "danger");
        return;
      }
      noteData = data || note;
    }
    setCurrentNoteId(noteData.id);
    setNoteName(noteData.id);
    setAuthor(noteData.author || "Unknown");
    setPassword(noteData.password || "");
    setEditorHtml(noteData.content || "");
    
    setSearchOpen(false);
    setSearchTerm("");
    clearHighlights();
    setIsEditing(false);
    setMenuOpen(false);
    
    return noteData;
  }

  return {
    notes,
    loading,
    loadList,
    openNote,
    setNotes
  };
}
