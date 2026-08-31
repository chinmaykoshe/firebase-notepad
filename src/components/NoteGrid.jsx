const CARD_COLORS = ["c-pink", "c-blue", "c-green", "c-amber", "c-grey"];

function cardColor(id) {
  // Deterministic colour based on the note's ID string so it stays stable
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return CARD_COLORS[Math.abs(hash) % CARD_COLORS.length];
}

function formatExpiry(expiry) {
  if (!expiry) return null;
  const date = expiry.toDate ? expiry.toDate() : new Date(expiry);
  const diff = date - new Date();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function NoteGrid({
  notes,
  loading,
  openMenuId,
  onNewNote,
  onOpenNote,
  onDeleteNote,
  onToggleNoteMenu,
  onShareNote,
}) {
  return (
    <div className="note-grid-area">
      <div className="note-grid-header">
        <span className="note-grid-title">
          {loading ? "Loading notes..." : (notes.length === 0 ? "No notes" : `${notes.length} note${notes.length !== 1 ? "s" : ""}`)}
        </span>
      </div>

      <div className="note-grid">
        {loading && Array.from({ length: 6 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="note-card c-grey" style={{ opacity: 0.5, animation: "pulse 1.5s infinite" }}>
            <div className="note-card-header">
              <div style={{ height: "18px", width: "60%", background: "var(--surface2)", borderRadius: "4px" }}></div>
            </div>
            <div className="note-card-body">
              <div style={{ height: "12px", width: "90%", background: "var(--surface2)", borderRadius: "4px", marginBottom: "8px" }}></div>
              <div style={{ height: "12px", width: "80%", background: "var(--surface2)", borderRadius: "4px", marginBottom: "8px" }}></div>
              <div style={{ height: "12px", width: "40%", background: "var(--surface2)", borderRadius: "4px" }}></div>
            </div>
          </div>
        ))}

        {!loading && notes.length === 0 && (
          <div className="note-grid-empty">
            <div className="note-grid-empty-icon">📝</div>
            <h3>No notes yet</h3>
            <p>Click "New note" to create your first note.</p>
          </div>
        )}

        {!loading && notes.map((note) => {
          const snippet = stripHtml(note.content);
          const expiry = formatExpiry(note.expiry);
          const color = cardColor(note.id);

          return (
            <div
              key={note.id}
              className={`note-card ${color}`}
              onClick={() => onOpenNote(note)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onOpenNote(note)}
            >
              <div className="note-card-header">
                <span className="note-card-name">{note.id}</span>
                <div className="note-card-actions">
                  <button
                    className="note-card-btn"
                    title="Share direct link"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShareNote(note);
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3"></circle>
                      <circle cx="6" cy="12" r="3"></circle>
                      <circle cx="18" cy="19" r="3"></circle>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                  </button>
                  <button
                    className="note-card-btn"
                    title="More options"
                    aria-haspopup="menu"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleNoteMenu(openMenuId === note.id ? "" : note.id);
                    }}
                  >
                    ···
                  </button>
                </div>

                {/* Dropdown */}
                <div
                  className={`note-menu menu ${openMenuId === note.id ? "open" : ""}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {expiry && <div className="menu-timer">{expiry}</div>}
                  <button
                    className="menu-item"
                    onClick={(e) => { e.stopPropagation(); onOpenNote(note); }}
                  >
                    Open
                  </button>
                  <button
                    className="menu-item"
                    onClick={(e) => { e.stopPropagation(); onShareNote(note); }}
                  >
                    Share Link
                  </button>
                  <button
                    className="menu-item"
                    style={{ color: "var(--danger)" }}
                    onClick={(e) => { e.stopPropagation(); onDeleteNote(note); }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {snippet && (
                <div className="note-card-body">
                  <p className="note-card-snippet">{snippet}</p>
                </div>
              )}

              <div className="note-card-footer">
                <span className={`status-dot ${note.password ? "protected" : "open"}`} />
                <span className="note-card-meta">
                  {note.password ? "Protected" : "Open"} · {note.author || "Unknown"}
                </span>
                {expiry && <span className="note-card-expiry">{expiry}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default NoteGrid;
