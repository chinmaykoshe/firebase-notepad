import { useRef, useState } from "react";

function Sidebar({ notes = [], currentNoteId, showEditor, viewMode, theme, username, onSetUsername, onNewNote, onImportFile, onHome, onOpenNote, onGallery, onAdmin, onToggleTheme, onOpenLegal }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [notesListOpen, setNotesListOpen] = useState(false);
  const inputRef = useRef(null);

  const startEdit = () => {
    setDraft(username);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 30);
  };

  const commitEdit = () => {
    const val = draft.trim();
    if (val) onSetUsername(val);
    setEditing(false);
  };

  return (
    <aside id="sidebar" aria-label="Navigation sidebar">

      {/* ── Profile ── */}
      <div className="sidebar-profile">
        <div className="sidebar-avatar" aria-hidden="true">📝</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              style={{
                width: "100%", padding: "3px 6px",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-xs)",
                background: "var(--bg)",
                color: "var(--text)",
                fontSize: "13px", fontWeight: 700,
                fontFamily: "var(--font)", outline: "none",
              }}
              autoFocus
            />
          ) : (
            <div
              className="sidebar-user-name"
              title="Click to edit your display name"
              onClick={startEdit}
              style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
            >
              {username}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, flexShrink: 0 }}>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
          )}
          <div className="sidebar-user-email">Supabase Notepad</div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Main</div>

        <div className={`nav-item ${viewMode === "grid" && !showEditor ? 'active' : ''}`} style={{ display: "flex", alignItems: "center", padding: 0 }}>
          <button 
            onClick={() => { onHome(); setNotesListOpen(true); }}
            style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "inherit", padding: "8px 12px", cursor: "pointer", fontSize: "inherit", fontWeight: "inherit" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            All notes
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setNotesListOpen(!notesListOpen); }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "inherit", padding: "8px 12px", cursor: "pointer", opacity: 0.6 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: notesListOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
        
        {notesListOpen && (
          <div className="sidebar-notes-list" style={{ marginLeft: "14px", borderLeft: "1px solid var(--border)", paddingLeft: "8px", marginTop: "4px", marginBottom: "8px", display: "flex", flexDirection: "column", gap: "2px" }}>
            {notes.map(note => (
              <button
                key={note.id}
                className={`nav-item ${note.id === currentNoteId ? 'active' : ''}`}
                style={{ padding: "6px 8px", fontSize: "12.5px" }}
                onClick={() => onOpenNote(note)}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {note.id || "Untitled"}-{note.author || "Unknown"}
                </span>
              </button>
            ))}
            {notes.length === 0 && (
              <div style={{ padding: "6px 8px", fontSize: "12px", color: "var(--text-xs)" }}>No notes found</div>
            )}
          </div>
        )}

        <button className={`nav-item ${showEditor && !currentNoteId ? 'active' : ''}`} onClick={onNewNote}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14"/>
            <path d="M5 12h14"/>
          </svg>
          New note
        </button>

        <button className="nav-item" onClick={onImportFile}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Import file
        </button>

        <button className={`nav-item ${viewMode === "gallery" ? 'active' : ''}`} onClick={onGallery}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          Public Gallery
        </button>
      </div>

      <div style={{ flex: 1 }} />
      <div className="sidebar-bottom-section">
        <div className="sidebar-section-label">Settings</div>

        <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            </svg>
            Theme
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            {["light", "dark", "sepia", "nord", "dracula", "monokai", "solarized-dark", "gruvbox", "cyberpunk"].map((t) => (
              <button
                key={t}
                onClick={() => onToggleTheme(t)}
                style={{
                  padding: "6px 8px",
                  borderRadius: "var(--r-sm)",
                  border: `1px solid ${theme === t ? "var(--accent)" : "var(--border)"}`,
                  background: theme === t ? "var(--surface)" : "transparent",
                  color: theme === t ? "var(--text)" : "var(--text-dim)",
                  fontSize: "12px",
                  fontWeight: theme === t ? 600 : 500,
                  cursor: "pointer",
                  textTransform: "capitalize",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s"
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-legal">
          <button onClick={onOpenLegal}>Terms & Privacy</button>
        </div>
      </div>

    </aside>
  );
}

export default Sidebar;
