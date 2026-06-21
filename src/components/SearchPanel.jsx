function SearchPanel({
  open,
  searchTerm,
  matchInfo,
  hasMatches,
  onSearchChange,
  onClose,
  onPrev,
  onNext,
}) {
  return (
    <div className={`search-panel ${open ? "open" : ""}`} id="searchPanel">
      <div className="search-input-row">
        <input
          id="findBoxDropdown"
          type="text"
          value={searchTerm}
          placeholder="Find in note..."
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.shiftKey ? onPrev() : onNext();
            }
            if (event.key === "Escape") onClose();
          }}
        />
        <button className="icon-btn" onClick={onClose} title="Close search">
          x
        </button>
      </div>
      <div className="search-nav">
        <button className="nav-btn" onClick={onPrev} disabled={!hasMatches} title="Previous match">
          ↑
        </button>
        <span className="match-info">{matchInfo}</span>
        <button className="nav-btn" onClick={onNext} disabled={!hasMatches} title="Next match">
          ↓
        </button>
      </div>
    </div>
  );
}

export default SearchPanel;
