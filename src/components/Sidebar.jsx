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
        <label id="themeToggleLabel">Light Mode</label>
        <label className="switch">
          <input
            type="checkbox"
            id="themeToggle"
            checked={theme === "light"}
            onChange={(event) => onToggleTheme(event.target.checked ? "light" : "dark")}
          />
          <span className="slider" />
        </label>
      </div>
    </aside>
  );
}

export default Sidebar;
