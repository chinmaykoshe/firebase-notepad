const THEMES = [
  { id: "dark",     label: "Dark",     bg: "#202124", dot: "#e8eaed" },
  { id: "light",    label: "Light",    bg: "#f8fafd", dot: "#202124" },
  { id: "sepia",    label: "Sepia",    bg: "#f4ede4", dot: "#3d2b1f" },
  { id: "ocean",    label: "Ocean",    bg: "#0a1628", dot: "#0ea5e9" },
  { id: "forest",   label: "Forest",   bg: "#1a2318", dot: "#4caf50" },
  { id: "midnight", label: "Midnight", bg: "#0f0e17", dot: "#7c5cfc" },
];

function formatExpiry(expiry) {
  if (!expiry) return "No expiration";
  const date = expiry.toDate ? expiry.toDate() : new Date(expiry);
  const diff = date - new Date();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${minutes}m left`;
}

function Sidebar({
  notes,
  searchText,
  theme,
  openMenuId,
  onNewNote,
  onSearchTextChange,
  onOpenNote,
  onDeleteNote,
  onToggleTheme,
  onToggleNoteMenu,
  onOpenPrivacy,
  onOpenTerms,
}) {
  return (
    <aside id="sidebar" aria-label="Saved notes sidebar">
      <div id="sidebartop">
        <button id="newFileBtn" className="btn" title="Create new note" onClick={onNewNote}>
          + New File
        </button>
        <input
          type="text"
          id="searchNotesInput"
          placeholder="Search notes..."
          autoComplete="off"
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
        />
      </div>

      <div id="notesList">
        <h3>Saved Notes</h3>
        <ul id="notesUl">
          {!notes.length && (
            <li className="note-item empty-note">No notes found.</li>
          )}
          {notes.map((note) => (
            <li className="note-item" tabIndex="0" key={note.id}>
              <div className="note-item-content" onClick={() => onOpenNote(note)}>
                <span className="note-title">{note.id}</span>
                <div className="note-author-display">
                  <span className={`status-dot ${note.password ? "protected" : "open"}`} />
                  {note.password ? "Protected" : "Open"} · By {note.author || "Unknown"}
                </div>
              </div>
              <button
                className="icon-btn kebab"
                title="More actions"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleNoteMenu(openMenuId === note.id ? "" : note.id);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 8a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
              <div className={`note-menu menu ${openMenuId === note.id ? "open" : ""}`}>
                <div className="menu-timer">{formatExpiry(note.expiry)}</div>
                <button className="menu-item" onClick={() => onDeleteNote(note)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="theme-row">
        <span className="theme-label">Theme</span>
        <div className="theme-swatches">
          {THEMES.map((t) => (
            <button
              key={t.id}
              title={t.label}
              aria-label={`${t.label} theme`}
              aria-pressed={theme === t.id}
              className={`theme-swatch${theme === t.id ? " active" : ""}`}
              style={{
                background: `radial-gradient(circle at 65% 35%, ${t.dot}44 0%, ${t.bg} 55%)`,
                backgroundColor: t.bg,
                outline: "none",
              }}
              onClick={() => onToggleTheme(t.id)}
            />
          ))}
        </div>
      </div>
      
      <div style={{ marginTop: "16px", display: "flex", gap: "12px", justifyContent: "center", opacity: 0.6, fontSize: "0.8rem" }}>
        <button className="subtle-btn" style={{ border: "none", padding: 0, minHeight: 0 }} onClick={onOpenPrivacy}>Privacy</button>
        <span>&middot;</span>
        <button className="subtle-btn" style={{ border: "none", padding: 0, minHeight: 0 }} onClick={onOpenTerms}>Terms</button>
      </div>
    </aside>
  );
}

export default Sidebar;
