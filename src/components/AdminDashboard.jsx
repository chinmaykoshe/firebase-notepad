import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';

export default function AdminDashboard({ onExit, theme, onToggleTheme }) {
  // ── State ──
  const [allNotes, setAllNotes] = useState([]);
  const [allFiles, setAllFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('notes'); // 'notes' | 'files' | 'authors' | 'analytics'
  
  // Filtering & Searching
  const [searchQuery, setSearchQuery] = useState('');
  const [notesFilter, setNotesFilter] = useState('all'); // 'all' | 'locked' | 'public'
  const [notesSort, setNotesSort] = useState('id-asc');
  const [filesSort, setFilesSort] = useState('newest');
  
  // Selection & Actions
  const [selectedNoteIds, setSelectedNoteIds] = useState(new Set());
  const [selectedFileNames, setSelectedFileNames] = useState(new Set());
  const [deletingKey, setDeletingKey] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  
  // Modals / Drawers
  const [inspectingNote, setInspectingNote] = useState(null);
  const [lightboxFile, setLightboxFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // ── Load Data ──
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [notesRes, filesRes] = await Promise.all([
        supabase.rpc('admin_get_all_notes', { admin_pass: import.meta.env.VITE_ADMIN_PASS }),
        supabase.storage.from('images').list(),
      ]);

      if (!notesRes.error && notesRes.data) {
        setAllNotes(notesRes.data);
      } else if (notesRes.error) {
        console.error("Notes load error:", notesRes.error);
      }

      if (!filesRes.error && filesRes.data) {
        setAllFiles(filesRes.data.filter(f => f.name && f.name !== '.emptyFolderPlaceholder'));
      } else if (filesRes.error) {
        console.error("Files load error:", filesRes.error);
      }
    } catch (err) {
      console.error("Admin load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const showToast = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(''), 3000);
  };

  // ── Helper: Format Bytes ──
  const formatBytes = (bytes) => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // ── Deletion Logic ──
  const extractImageFilenames = (note) => {
    const filenames = new Set();
    const parse = (str) => {
      if (!str) return;
      const matches = [...str.matchAll(/src="([^"]*?supabase\.co[^"]*?)"/g)];
      matches.forEach(m => {
        const parts = m[1].split('/');
        const fn = parts[parts.length - 1];
        if (fn) filenames.add(decodeURIComponent(fn));
      });
    };
    parse(note.content);
    if (note.worksheets) {
      note.worksheets.forEach(ws => {
        if (ws.type === 'note') parse(ws.data);
      });
    }
    return Array.from(filenames);
  };

  async function handleDeleteSingleNote(note) {
    if (!window.confirm(`Permanently delete note "${note.id}" and any media attached to it?`)) return;
    setDeletingKey(note.id);
    
    try {
      const filesToDelete = extractImageFilenames(note);
      if (filesToDelete.length > 0) {
        await supabase.storage.from('images').remove(filesToDelete);
        setAllFiles(prev => prev.filter(f => !filesToDelete.includes(f.name)));
      }
      const { error } = await supabase.rpc('admin_delete_notes', { note_ids: [note.id], admin_pass: import.meta.env.VITE_ADMIN_PASS });
      if (!error) {
        setAllNotes(prev => prev.filter(n => n.id !== note.id));
        if (inspectingNote?.id === note.id) setInspectingNote(null);
        showToast(`Note "${note.id}" deleted successfully`);
      } else {
        alert("Failed to delete note: " + error.message);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingKey(null);
    }
  }

  async function handleBatchDeleteNotes() {
    const count = selectedNoteIds.size;
    if (count === 0) return;
    if (!window.confirm(`Delete ${count} selected note(s) and all their associated files?`)) return;

    setLoading(true);
    const ids = Array.from(selectedNoteIds);
    const notesToDelete = allNotes.filter(n => ids.includes(n.id));
    
    // Collect all media
    const allFilesToDelete = new Set();
    notesToDelete.forEach(n => {
      extractImageFilenames(n).forEach(fn => allFilesToDelete.add(fn));
    });

    const fileArr = Array.from(allFilesToDelete);
    if (fileArr.length > 0) {
      await supabase.storage.from('images').remove(fileArr);
      setAllFiles(prev => prev.filter(f => !fileArr.includes(f.name)));
    }

    const { error } = await supabase.rpc('admin_delete_notes', { note_ids: ids, admin_pass: import.meta.env.VITE_ADMIN_PASS });
    if (!error) {
      setAllNotes(prev => prev.filter(n => !ids.includes(n.id)));
      setSelectedNoteIds(new Set());
      showToast(`Deleted ${count} notes successfully`);
    } else {
      alert("Batch delete failed: " + error.message);
    }
    setLoading(false);
  }

  async function handleDeleteSingleFile(fileName) {
    if (!window.confirm(`Permanently delete "${fileName}" from storage?`)) return;
    setDeletingKey(fileName);
    const { error } = await supabase.storage.from('images').remove([fileName]);
    if (!error) {
      setAllFiles(prev => prev.filter(f => f.name !== fileName));
      if (lightboxFile?.name === fileName) setLightboxFile(null);
      showToast(`File "${fileName}" deleted`);
    } else {
      alert("Failed to delete file: " + error.message);
    }
    setDeletingKey(null);
  }

  async function handleBatchDeleteFiles() {
    const count = selectedFileNames.size;
    if (count === 0) return;
    if (!window.confirm(`Delete ${count} selected image file(s) permanently?`)) return;

    setLoading(true);
    const names = Array.from(selectedFileNames);
    const { error } = await supabase.storage.from('images').remove(names);
    if (!error) {
      setAllFiles(prev => prev.filter(f => !names.includes(f.name)));
      setSelectedFileNames(new Set());
      showToast(`Deleted ${count} files`);
    } else {
      alert("Batch delete files failed: " + error.message);
    }
    setLoading(false);
  }

  async function handleFileUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let uploadedCount = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('images')
        .upload(fileName, file);
        
      if (error) {
        console.error("Upload failed for", file.name, error);
      } else {
        uploadedCount++;
      }
    }
    
    setIsUploading(false);
    if (uploadedCount > 0) {
      showToast(`Successfully uploaded ${uploadedCount} file(s)`);
      handleRefresh();
    }
  }

  // ── Export JSON ──
  const handleExportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      notesCount: allNotes.length,
      filesCount: allFiles.length,
      notes: allNotes,
      files: allFiles,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `database_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Export downloaded!");
  };

  // ── Statistics Computations ──
  const stats = useMemo(() => {
    const totalNotes = allNotes.length;
    const lockedNotes = allNotes.filter(n => n.password).length;
    const publicNotes = totalNotes - lockedNotes;
    
    // Size computations
    const rawNotesJson = JSON.stringify(allNotes);
    const notesSizeBytes = totalNotes > 0 ? new Blob([rawNotesJson]).size : 0;
    const storageSizeBytes = allFiles.reduce((acc, f) => acc + (f.metadata?.size || 0), 0);
    
    // Authors breakdown
    const authorMap = {};
    allNotes.forEach(n => {
      const auth = n.author || 'Anonymous';
      if (!authorMap[auth]) authorMap[auth] = { count: 0, notes: [], totalChars: 0 };
      authorMap[auth].count += 1;
      authorMap[auth].notes.push(n);
      authorMap[auth].totalChars += (n.content?.length || 0);
    });

    const uniqueAuthorsCount = Object.keys(authorMap).length;

    // File extensions
    const fileTypes = { webp: 0, png: 0, jpg: 0, other: 0 };
    allFiles.forEach(f => {
      const ext = f.name?.split('.').pop()?.toLowerCase();
      if (ext === 'webp') fileTypes.webp++;
      else if (ext === 'png') fileTypes.png++;
      else if (ext === 'jpg' || ext === 'jpeg') fileTypes.jpg++;
      else fileTypes.other++;
    });

    return {
      totalNotes,
      lockedNotes,
      publicNotes,
      notesSizeBytes,
      storageSizeBytes,
      authorMap,
      uniqueAuthorsCount,
      fileTypes,
    };
  }, [allNotes, allFiles]);

  // ── Filtered & Sorted Notes ──
  const filteredNotes = useMemo(() => {
    let list = [...allNotes];
    
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => 
        (n.id && n.id.toLowerCase().includes(q)) ||
        (n.author && n.author.toLowerCase().includes(q)) ||
        (n.password && n.password.toLowerCase().includes(q)) ||
        (n.content && n.content.toLowerCase().includes(q))
      );
    }

    // Type filter
    if (notesFilter === 'locked') list = list.filter(n => n.password);
    if (notesFilter === 'public') list = list.filter(n => !n.password);

    // Sorting
    if (notesSort === 'id-asc') list.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    if (notesSort === 'id-desc') list.sort((a, b) => String(b.id).localeCompare(String(a.id)));
    if (notesSort === 'author') list.sort((a, b) => String(a.author).localeCompare(String(b.author)));
    if (notesSort === 'size-desc') list.sort((a, b) => (b.content?.length || 0) - (a.content?.length || 0));

    return list;
  }, [allNotes, searchQuery, notesFilter, notesSort]);

  // ── Filtered & Sorted Files ──
  const filteredFiles = useMemo(() => {
    let list = [...allFiles];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(f => f.name && f.name.toLowerCase().includes(q));
    }
    if (filesSort === 'newest') list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    if (filesSort === 'oldest') list.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    if (filesSort === 'size-desc') list.sort((a, b) => (b.metadata?.size || 0) - (a.metadata?.size || 0));
    if (filesSort === 'size-asc') list.sort((a, b) => (a.metadata?.size || 0) - (b.metadata?.size || 0));
    return list;
  }, [allFiles, searchQuery, filesSort]);

  // ── Select Helpers ──
  const toggleSelectNote = (id) => {
    const next = new Set(selectedNoteIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedNoteIds(next);
  };

  const toggleSelectAllNotes = () => {
    if (selectedNoteIds.size === filteredNotes.length) {
      setSelectedNoteIds(new Set());
    } else {
      setSelectedNoteIds(new Set(filteredNotes.map(n => n.id)));
    }
  };

  const toggleSelectFile = (name) => {
    const next = new Set(selectedFileNames);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedFileNames(next);
  };

  const toggleSelectAllFiles = () => {
    if (selectedFileNames.size === filteredFiles.length) {
      setSelectedFileNames(new Set());
    } else {
      setSelectedFileNames(new Set(filteredFiles.map(f => f.name)));
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg, #0f0f14)',
      color: 'var(--text, #f0f0f8)',
      fontFamily: 'var(--font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
      overflow: 'hidden',
    }}>
      
      {/* ── TOAST NOTIFICATION ── */}
      {actionMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          color: '#ffffff',
          padding: '12px 24px',
          borderRadius: '12px',
          fontWeight: '600',
          fontSize: '14px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <span>✨</span> {actionMessage}
        </div>
      )}

      {/* ── TOPBAR / HEADER ── */}
      <header style={{
        height: '68px',
        background: 'var(--surface, #18181f)',
        borderBottom: '1px solid var(--border, #2a2a38)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 clamp(16px, 3vw, 36px)',
        flexShrink: 0,
        gap: '16px',
        zIndex: 10,
      }}>
        {/* Left: Branding & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.3px' }}>Master Admin</span>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '20px',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                Supabase Live
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-dim, #8888a0)' }}>System Controls & Moderation</span>
          </div>
        </div>

        {/* Center: Live Global Search */}
        <div style={{ flex: '1', maxWidth: '480px', position: 'relative', display: 'flex', alignItems: 'center' }}>
          <svg style={{ position: 'absolute', left: '14px', color: 'var(--text-dim)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search notes, IDs, authors, passwords, files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: '38px',
              padding: '0 36px 0 38px',
              borderRadius: '10px',
              border: '1px solid var(--border, #2a2a38)',
              background: 'var(--surface2, #1e1e27)',
              color: 'var(--text, #f0f0f8)',
              fontSize: '13px',
              outline: 'none',
              transition: 'border 0.2s',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                background: 'none',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '4px',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <select
            value={theme || "light"}
            onChange={(e) => onToggleTheme(e.target.value)}
            style={{
              height: '36px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--border, #2a2a38)',
              background: 'var(--surface2, #1e1e27)',
              color: 'var(--text)',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="light">Light Theme</option>
            <option value="dark">Dark Theme</option>
            <option value="sepia">Sepia Theme</option>
            <option value="nord">Nord Theme</option>
            <option value="dracula">Dracula Theme</option>
            <option value="monokai">Monokai Theme</option>
            <option value="solarized-dark">Solarized Dark Theme</option>
            <option value="gruvbox">Gruvbox Theme</option>
            <option value="cyberpunk">Cyberpunk Theme</option>
          </select>

          <button
            onClick={handleExportData}
            title="Export Entire Database as JSON"
            style={{
              height: '36px',
              padding: '0 14px',
              borderRadius: '8px',
              border: '1px solid var(--border, #2a2a38)',
              background: 'var(--surface2, #1e1e27)',
              color: 'var(--text)',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span style={{ display: 'inline-block' }}>Export DB</span>
          </button>

          <button
            onClick={handleRefresh}
            title="Refresh database records"
            style={{
              height: '36px',
              padding: '0 14px',
              borderRadius: '8px',
              border: '1px solid var(--border, #2a2a38)',
              background: 'var(--surface2, #1e1e27)',
              color: 'var(--text)',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <svg style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
          </button>

          <button
            onClick={onExit}
            style={{
              height: '36px',
              padding: '0 16px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 10px rgba(239, 68, 68, 0.3)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Exit Portal
          </button>
        </div>
      </header>

      {/* ── MAIN BODY CONTAINER ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        padding: 'clamp(16px, 2.5vw, 32px)',
        gap: '24px',
      }}>
        
        {/* ── KPI METRICS CARDS ROW ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}>
          {/* Card 1: Notes */}
          <div style={{
            background: 'var(--surface, #18181f)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '16px',
            padding: '20px 24px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-dim)' }}>Total Active Notes</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
            </div>
            <div style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '4px' }}>
              {stats.totalNotes}
            </div>
            <div style={{ fontSize: '12px', color: '#818cf8', fontWeight: '500' }}>
              ~{formatBytes(stats.notesSizeBytes)} DB storage payload
            </div>
          </div>

          {/* Card 2: Media Storage */}
          <div style={{
            background: 'var(--surface, #18181f)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            borderRadius: '16px',
            padding: '20px 24px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-dim)' }}>Storage Bucket Files</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>
            </div>
            <div style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '4px' }}>
              {allFiles.length}
            </div>
            <div style={{ fontSize: '12px', color: '#22d3ee', fontWeight: '500' }}>
              {formatBytes(stats.storageSizeBytes)} total bucket footprint
            </div>
          </div>

          {/* Card 3: Authors */}
          <div style={{
            background: 'var(--surface, #18181f)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '16px',
            padding: '20px 24px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-dim)' }}>Unique Authors</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
            </div>
            <div style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '4px' }}>
              {stats.uniqueAuthorsCount}
            </div>
            <div style={{ fontSize: '12px', color: '#c084fc', fontWeight: '500' }}>
              Active note creators
            </div>
          </div>

          {/* Card 4: Security */}
          <div style={{
            background: 'var(--surface, #18181f)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '16px',
            padding: '20px 24px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-dim)' }}>Password Protected</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
            </div>
            <div style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '4px' }}>
              {stats.lockedNotes}
            </div>
            <div style={{ fontSize: '12px', color: '#fbbf24', fontWeight: '500' }}>
              {stats.publicNotes} public / unprotected notes
            </div>
          </div>
        </div>

        {/* ── TABS NAVIGATION BAR ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border, #2a2a38)',
          paddingBottom: '12px',
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          {/* Pill Tab Switchers */}
          <div style={{
            display: 'flex',
            gap: '6px',
            background: 'var(--surface, #18181f)',
            padding: '5px',
            borderRadius: '12px',
            border: '1px solid var(--border, #2a2a38)',
          }}>
            {[
              { id: 'notes', label: 'Notes Database', count: allNotes.length, icon: '📝' },
              { id: 'files', label: 'Storage Bucket', count: allFiles.length, icon: '🖼️' },
              { id: 'authors', label: 'Authors', count: stats.uniqueAuthorsCount, icon: '👥' },
              { id: 'analytics', label: 'System Analytics', icon: '📊' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === tab.id ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                  color: activeTab === tab.id ? '#ffffff' : 'var(--text-dim)',
                  fontWeight: activeTab === tab.id ? '700' : '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                  boxShadow: activeTab === tab.id ? '0 4px 12px rgba(99, 102, 241, 0.35)' : 'none',
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 7px',
                    borderRadius: '12px',
                    background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : 'var(--surface2, #222230)',
                    color: activeTab === tab.id ? '#fff' : 'var(--text-dim)',
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Quick Toolbar per tab */}
          {activeTab === 'notes' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <select
                value={notesFilter}
                onChange={(e) => setNotesFilter(e.target.value)}
                style={{
                  height: '34px',
                  borderRadius: '8px',
                  background: 'var(--surface, #18181f)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  fontSize: '12px',
                  padding: '0 10px',
                  outline: 'none',
                }}
              >
                <option value="all">Filter: All Notes</option>
                <option value="locked">Filter: Password Protected</option>
                <option value="public">Filter: Public Only</option>
              </select>

              <select
                value={notesSort}
                onChange={(e) => setNotesSort(e.target.value)}
                style={{
                  height: '34px',
                  borderRadius: '8px',
                  background: 'var(--surface, #18181f)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  fontSize: '12px',
                  padding: '0 10px',
                  outline: 'none',
                }}
              >
                <option value="id-asc">Sort: ID (A-Z)</option>
                <option value="id-desc">Sort: ID (Z-A)</option>
                <option value="author">Sort: Author</option>
                <option value="size-desc">Sort: Longest Content</option>
              </select>

              {selectedNoteIds.size > 0 && (
                <button
                  onClick={handleBatchDeleteNotes}
                  style={{
                    height: '34px',
                    padding: '0 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Delete Selected ({selectedNoteIds.size})
                </button>
              )}
            </div>
          )}

          {activeTab === 'files' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                value={filesSort}
                onChange={(e) => setFilesSort(e.target.value)}
                style={{
                  height: '34px',
                  borderRadius: '8px',
                  background: 'var(--surface, #18181f)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  fontSize: '12px',
                  padding: '0 10px',
                  outline: 'none',
                }}
              >
                <option value="newest">Sort: Newest Uploads</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="size-desc">Sort: Largest File</option>
                <option value="size-asc">Sort: Smallest</option>
              </select>

              <label style={{
                height: '34px',
                padding: '0 14px',
                borderRadius: '8px',
                border: 'none',
                background: '#3b82f6',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: isUploading ? 0.7 : 1,
              }}>
                {isUploading ? 'Uploading...' : '📤 Upload'}
                <input 
                  type="file" 
                  multiple 
                  accept="image/*,video/*" 
                  onChange={handleFileUpload} 
                  disabled={isUploading}
                  style={{ display: 'none' }} 
                />
              </label>

              {selectedFileNames.size > 0 && (
                <button
                  onClick={handleBatchDeleteFiles}
                  style={{
                    height: '34px',
                    padding: '0 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Delete Selected ({selectedFileNames.size})
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── TAB 1: NOTES MANAGEMENT ── */}
        {activeTab === 'notes' && (
          <div style={{
            background: 'var(--surface, #18181f)',
            borderRadius: '16px',
            border: '1px solid var(--border, #2a2a38)',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          }}>
            {loading ? (
              <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-dim)' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏳</div>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>Fetching notes from database...</div>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-dim)' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔍</div>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>No notes match your filter or search query.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2, #1e1e27)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ width: '40px', padding: '16px 20px' }}>
                        <input
                          type="checkbox"
                          checked={selectedNoteIds.size === filteredNotes.length && filteredNotes.length > 0}
                          onChange={toggleSelectAllNotes}
                          style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                        />
                      </th>
                      <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Note Identifier</th>
                      <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Author</th>
                      <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Security / Password</th>
                      <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Content Size</th>
                      <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-dim)', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNotes.map((note, index) => {
                      const isSelected = selectedNoteIds.has(note.id);
                      const isDeleting = deletingKey === note.id;
                      const hasImages = note.content && note.content.includes('supabase.co');

                      return (
                        <tr
                          key={note.id}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: isSelected ? 'rgba(99, 102, 241, 0.08)' : index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '14px 20px' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectNote(note.id)}
                              style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                            />
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                fontFamily: 'monospace',
                                fontWeight: '700',
                                fontSize: '13px',
                                background: 'rgba(99, 102, 241, 0.15)',
                                color: '#a5b4fc',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: '1px solid rgba(99, 102, 241, 0.25)',
                              }}>
                                {note.id}
                              </span>
                              {hasImages && (
                                <span title="Contains image or drawing attachments" style={{ fontSize: '13px' }}>🖼️</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: '700',
                                color: '#fff',
                              }}>
                                {(note.author || 'A').charAt(0).toUpperCase()}
                              </div>
                              <span style={{ fontWeight: '500', fontSize: '13px' }}>{note.author || 'Anonymous'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            {note.password ? (
                              <span style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                padding: '4px 12px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: '700',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}>
                                🔒 {note.password}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
                                🔓 Public (No pass)
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '14px 20px', color: 'var(--text-dim)', fontSize: '13px' }}>
                            {(note.content?.length || 0).toLocaleString()} chars
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '8px' }}>
                              <button
                                onClick={() => setInspectingNote(note)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '7px',
                                  border: '1px solid var(--border)',
                                  background: 'var(--surface2, #222230)',
                                  color: 'var(--text)',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                }}
                              >
                                👁️ View
                              </button>
                              <button
                                onClick={() => handleDeleteSingleNote(note)}
                                disabled={isDeleting}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '7px',
                                  border: 'none',
                                  background: isDeleting ? 'var(--border)' : 'rgba(239, 68, 68, 0.15)',
                                  color: isDeleting ? 'var(--text-dim)' : '#ef4444',
                                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                }}
                              >
                                {isDeleting ? 'Deleting...' : '🗑 Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: STORAGE & MEDIA BUCKET ── */}
        {activeTab === 'files' && (
          <div>
            {loading ? (
              <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-dim)' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏳</div>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>Fetching storage bucket files...</div>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-dim)' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>🖼️</div>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>No image or drawing files found in Supabase storage.</div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '20px',
              }}>
                {filteredFiles.map((file) => {
                  const isSelected = selectedFileNames.has(file.name);
                  const isDeleting = deletingKey === file.name;
                  const publicUrl = supabase.storage.from('images').getPublicUrl(file.name).data.publicUrl;
                  const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';

                  return (
                    <div
                      key={file.id || file.name}
                      style={{
                        background: 'var(--surface, #18181f)',
                        border: isSelected ? '2px solid #6366f1' : '1px solid var(--border, #2a2a38)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                      }}
                    >
                      {/* Checkbox select */}
                      <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 2 }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectFile(file.name)}
                          style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                        />
                      </div>

                      {/* Extension Pill */}
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        zIndex: 2,
                        background: 'rgba(0,0,0,0.75)',
                        color: '#22d3ee',
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backdropFilter: 'blur(4px)',
                      }}>
                        {ext}
                      </div>

                      {/* Image Preview */}
                      <div
                        onClick={() => setLightboxFile({ ...file, publicUrl })}
                        style={{
                          height: '180px',
                          background: '#0a0a0e',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        {['MP4', 'WEBM', 'MOV', 'OGG'].includes(ext) ? (
                          <video
                            src={publicUrl}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            muted
                            loop
                            onMouseEnter={(e) => e.target.play()}
                            onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0; }}
                          />
                        ) : (
                          <img
                            src={publicUrl}
                            alt={file.name}
                            loading="lazy"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              transition: 'transform 0.2s ease',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                          />
                        )}
                      </div>

                      {/* Card Meta & Actions */}
                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                        <div
                          title={file.name}
                          style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            fontFamily: 'monospace',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {file.name}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#22d3ee',
                            background: 'rgba(6, 182, 212, 0.1)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                          }}>
                            {formatBytes(file.metadata?.size || 0)}
                          </span>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(publicUrl);
                                showToast("Image URL copied!");
                              }}
                              title="Copy URL"
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                                background: 'var(--surface2)',
                                color: 'var(--text)',
                                cursor: 'pointer',
                                fontSize: '11px',
                              }}
                            >
                              📋
                            </button>
                            <button
                              onClick={() => handleDeleteSingleFile(file.name)}
                              disabled={isDeleting}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                background: isDeleting ? 'var(--border)' : 'rgba(239, 68, 68, 0.15)',
                                color: isDeleting ? 'var(--text-dim)' : '#ef4444',
                                cursor: isDeleting ? 'not-allowed' : 'pointer',
                                fontSize: '11px',
                                fontWeight: '700',
                              }}
                            >
                              {isDeleting ? '...' : '🗑'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: AUTHORS DIRECTORY ── */}
        {activeTab === 'authors' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}>
            {Object.entries(stats.authorMap).map(([authorName, data]) => (
              <div
                key={authorName}
                style={{
                  background: 'var(--surface, #18181f)',
                  border: '1px solid var(--border, #2a2a38)',
                  borderRadius: '16px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: '800',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)',
                  }}>
                    {authorName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '700' }}>{authorName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{data.count} note(s) published</div>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-dim)', background: 'var(--surface2)', padding: '10px 14px', borderRadius: '8px' }}>
                  Total written payload: <strong>{data.totalChars.toLocaleString()}</strong> characters
                </div>

                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-dim)' }}>Authored Notes:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {data.notes.map(n => (
                    <button
                      key={n.id}
                      onClick={() => setInspectingNote(n)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        color: '#a5b4fc',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      {n.id}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB 4: SYSTEM ANALYTICS ── */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
            {/* Storage Meter */}
            <div style={{
              background: 'var(--surface, #18181f)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}>
              <div style={{ fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>💽</span> Supabase Free Tier Storage Usage
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                  <span>Used: <strong>{formatBytes(stats.storageSizeBytes)}</strong></span>
                  <span>Limit: <strong>1.00 GB</strong></span>
                </div>
                <div style={{ width: '100%', height: '12px', background: 'var(--surface2)', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, Math.max(1, (stats.storageSizeBytes / (1024 * 1024 * 1024)) * 100))}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #22c55e, #3b82f6)',
                    borderRadius: '99px',
                  }} />
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: '1.6' }}>
                Your media compression engine automatically optimizes uploaded PNG and drawing files to WebP format, saving up to 80% bandwidth.
              </div>
            </div>

            {/* File Format Distribution */}
            <div style={{
              background: 'var(--surface, #18181f)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}>
              <div style={{ fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📊</span> Media Format Breakdown
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: 'WebP (Optimized)', count: stats.fileTypes.webp, color: '#22d3ee' },
                  { label: 'PNG Images', count: stats.fileTypes.png, color: '#a855f7' },
                  { label: 'JPEG / JPG', count: stats.fileTypes.jpg, color: '#f59e0b' },
                  { label: 'Other', count: stats.fileTypes.other, color: '#6b7280' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color }} />
                      {item.label}
                    </span>
                    <strong style={{ color: item.color }}>{item.count} files</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── MODAL: INSPECT NOTE DRAWER / MODAL ── */}
      {inspectingNote && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            width: '100%',
            maxWidth: '750px',
            maxHeight: '90vh',
            background: 'var(--surface, #18181f)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--surface2)',
            }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: '800' }}>Note Inspector: {inspectingNote.id}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Created by {inspectingNote.author || 'Anonymous'}</div>
              </div>
              <button
                onClick={() => setInspectingNote(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Security info */}
              <div style={{
                background: inspectingNote.password ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                border: `1px solid ${inspectingNote.password ? '#ef4444' : '#22c55e'}`,
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-dim)' }}>Password Protection</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: inspectingNote.password ? '#f87171' : '#4ade80' }}>
                    {inspectingNote.password ? `🔒 ${inspectingNote.password}` : '🔓 Unprotected / Public'}
                  </div>
                </div>
                {inspectingNote.password && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inspectingNote.password);
                      showToast("Password copied!");
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    Copy Password
                  </button>
                )}
              </div>

              {/* Note Content */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Rendered Content:</div>
                <div
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '16px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: 'var(--text, #f0f0f8)'
                  }}
                  dangerouslySetInnerHTML={{ 
                    __html: window.DOMPurify 
                      ? window.DOMPurify.sanitize(inspectingNote.content || '<em>(Empty note)</em>') 
                      : (inspectingNote.content || '<em>(Empty note)</em>') 
                  }}
                />
              </div>

              {/* Media attachments */}
              {extractImageFilenames(inspectingNote).length > 0 && (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Embedded Storage Files:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {extractImageFilenames(inspectingNote).map(fn => (
                      <span
                        key={fn}
                        style={{
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          background: 'var(--surface2)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                        }}
                      >
                        🖼️ {fn}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              background: 'var(--surface2)',
            }}>
              <button
                onClick={() => handleDeleteSingleNote(inspectingNote)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Delete Note & Media
              </button>
              <button
                onClick={() => setInspectingNote(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: IMAGE LIGHTBOX ── */}
      {lightboxFile && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px',
        }}
          onClick={() => setLightboxFile(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: 'var(--surface, #18181f)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 70px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: '700' }}>{lightboxFile.name}</span>
              <button onClick={() => setLightboxFile(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', background: '#050508', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: '70vh', overflow: 'hidden' }}>
              {['MP4', 'WEBM', 'MOV', 'OGG'].includes(lightboxFile.name.split('.').pop()?.toUpperCase()) ? (
                <video
                  src={lightboxFile.publicUrl}
                  controls
                  autoPlay
                  style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: '8px' }}
                />
              ) : (
                <img
                  src={lightboxFile.publicUrl}
                  alt={lightboxFile.name}
                  style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '8px' }}
                />
              )}
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface2)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Size: {formatBytes(lightboxFile.metadata?.size || 0)}</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <a
                  href={lightboxFile.publicUrl}
                  download={lightboxFile.name}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    textDecoration: 'none',
                    fontSize: '13px',
                    fontWeight: '600',
                  }}
                >
                  Download File
                </a>
                <button
                  onClick={() => handleDeleteSingleFile(lightboxFile.name)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Delete Image
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
