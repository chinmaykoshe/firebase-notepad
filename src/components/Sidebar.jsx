import { useRef, useState } from "react";

function Sidebar({ notes = [], currentNoteId, theme, username, onSetUsername, onNewNote, onHome, onOpenNote, onToggleTheme, onOpenPrivacy, onOpenTerms }) {
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
          <div className="sidebar-user-email">Firebase Notepad</div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Main</div>

        <button className="nav-item active" onClick={() => setNotesListOpen(!notesListOpen)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          All notes
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto", transform: notesListOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        
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

        <button className="nav-item" onClick={onNewNote} style={{ marginTop: "4px" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          New note
        </button>
      </div>

      {/* ── SETTINGS ── */}
      <div className="sidebar-bottom-section">
        <div className="sidebar-section-label">Settings</div>

        <div className="theme-row">
          <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55 }}>
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
            Dark mode
          </span>
          <label className="switch">
            <input
              type="checkbox"
              id="themeToggle"
              checked={theme === "dark-mode"}
              onChange={(e) => onToggleTheme(e.target.checked ? "dark-mode" : "")}
            />
            <span className="slider" />
          </label>
        </div>

        <div className="sidebar-legal">
          <button onClick={onOpenPrivacy}>Privacy</button>
          <button onClick={onOpenTerms}>Terms</button>
        </div>
      </div>

    </aside>
  );
}

export default Sidebar;
