import { useState } from "react";
import SearchPanel from "./SearchPanel.jsx";
import ImageResizer from "./ImageResizer.jsx";

function Editor({
    noteName,
    author,
    password,
    isEditing,
    isFullscreen,
    formatToolbarOpen,
    searchOpen,
    exportOpen,
    searchTerm,
    matchInfo,
    hasMatches,
    onNoteNameChange,
    onAuthorChange,
    onPasswordChange,
    onContentInput,
    onPaste,
    onKeyDown,
    onSave,
    onExportTXT,
    onExportPDF,
    onDeleteOpenNote,
    onExtendNote,
    onInsertTable,
    onToggleEdit,
    onToggleSearch,
    onSearchChange,
    onCloseSearch,
    onPrevMatch,
    onNextMatch,
    onToggleExport,
    onToggleFullscreen,
    onOpenMenu,
    onFormat,
    onToggleFormatToolbar,
    editorRef,
    containerRef,
  }) {
  const [selectedImg, setSelectedImg] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const handleEditorClick = (e) => {
    if (e.target.tagName === "IMG") {
      setSelectedImg(e.target);
    } else {
      setSelectedImg(null);
    }
  };

  return (
    <main id="main">
      <header className="topbar">
        <div className="left-group">
          <button id="hamburgerBtn" className="icon-btn hamburger" aria-label="Menu" title="Menu" onClick={onOpenMenu}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
            </svg>
          </button>
          <h1 className="title">Notes</h1>
          <div className="title-free">
            <h6>
              <a href="/index.html">Firebase Notepad</a>
            </h6>
          </div>
        </div>

        <div className="actions">
          <button className="icon-btn toolbar-btn" id="findToggle" title="Find in note" onClick={onToggleSearch}>
            Find
          </button>
          <button className="icon-btn toolbar-btn" id="editToggle" title="Toggle edit mode" onClick={onToggleEdit}>
            {isEditing ? "Read" : "Edit"}
          </button>
          <div className="desktop-actions">
            <button className="btn subtle-btn" onClick={onExportTXT}>TXT</button>
            <button className="btn subtle-btn" onClick={onExportPDF}>PDF</button>
            <button className="btn subtle-btn" id="extendBtn" onClick={onExtendNote}>Extend</button>
            <button className="btn subtle-btn" onClick={onInsertTable}>Table</button>
            <button className="btn danger-action" onClick={onDeleteOpenNote}>Delete</button>
          </div>
          <button
            id="exportToggle"
            className="icon-btn"
            aria-haspopup="menu"
            aria-expanded={exportOpen}
            title="More actions"
            onClick={onToggleExport}
          >
            More
          </button>
        </div>

        <SearchPanel
          open={searchOpen}
          searchTerm={searchTerm}
          matchInfo={matchInfo}
          hasMatches={hasMatches}
          onSearchChange={onSearchChange}
          onClose={onCloseSearch}
          onPrev={onPrevMatch}
          onNext={onNextMatch}
        />

        <div className={`export-menu ${exportOpen ? "open" : ""}`} id="exportMenu">
          <button className="export-menu-item" onClick={onExportTXT}>Export TXT</button>
          <button className="export-menu-item" onClick={onExportPDF}>Export PDF</button>
          <button className="export-menu-item" onClick={onExtendNote}>Extend 24h</button>
          <button className="export-menu-item" onClick={onInsertTable}>Insert Table</button>
          <button className="export-menu-item" onClick={onDeleteOpenNote}>Delete Note</button>
        </div>
      </header>

      <section className="editor-panel">
        {isEditing && (
          <>
            {/* Note metadata: collapses on mobile */}
            <details className="meta-fields" open>
              <summary className="meta-summary">Note details ▾</summary>
              <div className="meta-body">
                <input
                  id="noteName"
                  type="text"
                  placeholder="Note name"
                  value={noteName}
                  onChange={(event) => onNoteNameChange(event.target.value)}
                />
                <div className="author-field">
                  <input
                    id="noteAuthor"
                    type="text"
                    placeholder="Author name"
                    value={author}
                    onChange={(event) => onAuthorChange(event.target.value)}
                  />
                  <div className="password-wrapper">
                    <input
                      id="notePassword"
                      type="password"
                      placeholder="Password (optional)"
                      value={password}
                      onChange={(event) => onPasswordChange(event.target.value)}
                    />
                  </div>
                </div>
              </div>
            </details>

            {/* Formatting toolbar — always visible, scrolls horizontally */}
            <div className="edit-bar">
              <button className="btn" id="saveBtn" onClick={onSave}>Save</button>
              <div className={`format-toolbar always-open`} aria-label="Text formatting toolbar">
                <select
                  className="format-select font-select"
                  defaultValue=""
                  title="Font"
                  onChange={(event) => {
                    if (event.target.value) onFormat("fontName", event.target.value);
                    event.target.value = "";
                  }}
                >
                  <option value="">Font</option>
                  <option value="Arial">Arial</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Courier New">Courier</option>
                  <option value="Times New Roman">Times</option>
                  <option value="Verdana">Verdana</option>
                </select>
                <select
                  className="format-select size-select"
                  defaultValue=""
                  title="Text size"
                  onChange={(event) => {
                    if (event.target.value) onFormat("fontSize", event.target.value);
                    event.target.value = "";
                  }}
                >
                  <option value="">Size</option>
                  <option value="2">Small</option>
                  <option value="3">Normal</option>
                  <option value="4">Medium</option>
                  <option value="5">Large</option>
                  <option value="6">Huge</option>
                </select>
                <button type="button" className="format-btn" title="Bold" onClick={() => onFormat("bold")}>B</button>
                <button type="button" className="format-btn italic" title="Italic" onClick={() => onFormat("italic")}>I</button>
                <button type="button" className="format-btn underline" title="Underline" onClick={() => onFormat("underline")}>U</button>
                <span className="format-divider" />
                <button type="button" className="format-btn" title="Bullet list" onClick={() => onFormat("insertUnorderedList")}>• List</button>
                <button type="button" className="format-btn" title="Numbered list" onClick={() => onFormat("insertOrderedList")}>1. List</button>
                <button type="button" className="format-btn" title="Outdent" onClick={() => onFormat("outdent")}>Out</button>
                <button type="button" className="format-btn" title="Indent" onClick={() => onFormat("indent")}>In</button>
                <span className="format-divider" />
                <button type="button" className="format-btn" title="Align left" onClick={() => onFormat("justifyLeft")}>Left</button>
                <button type="button" className="format-btn" title="Align center" onClick={() => onFormat("justifyCenter")}>Center</button>
                <button type="button" className="format-btn" title="Align right" onClick={() => onFormat("justifyRight")}>Right</button>
                <button type="button" className="format-btn" title="Clear formatting" onClick={() => onFormat("removeFormat")}>Clear</button>
              </div>
            </div>
          </>
        )}

          <div
            className="textarea-container"
            ref={containerRef}
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                containerRef.current._initialDistance = Math.sqrt(dx * dx + dy * dy);
                containerRef.current._initialZoom = zoomLevel;
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 2 && containerRef.current._initialDistance) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const scale = dist / containerRef.current._initialDistance;
                const newZoom = Math.min(3.0, Math.max(0.5, containerRef.current._initialZoom * scale));
                setZoomLevel(+(newZoom.toFixed(2)));
              }
            }}
            onTouchEnd={(e) => {
              if (e.touches.length < 2 && containerRef.current) {
                containerRef.current._initialDistance = null;
              }
            }}
          >
            <div
              id="noteContent"
              ref={editorRef}
              contentEditable={isEditing}
              suppressContentEditableWarning
              data-placeholder="Start typing..."
              className={isEditing ? "" : "readonly"}
              style={{ fontSize: `${zoomLevel}rem`, touchAction: "pan-x pan-y" }}
              onInput={(e) => {
                if (selectedImg && !selectedImg.isConnected) setSelectedImg(null);
                onContentInput(e);
              }}
              onPaste={onPaste}
              onKeyDown={(e) => {
                if (e.key === "Backspace" || e.key === "Delete") setSelectedImg(null);
                onKeyDown(e);
              }}
              onClick={handleEditorClick}
            />
            <ImageResizer imgElement={selectedImg} containerRef={containerRef} isEditing={isEditing} onDeselect={() => setSelectedImg(null)} />
          
          <div className="zoom-controls">
            <button className="icon-btn" title="Zoom out" onClick={() => setZoomLevel(z => Math.max(0.5, +(z - 0.1).toFixed(1)))}>-</button>
            <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
            <button className="icon-btn" title="Zoom in" onClick={() => setZoomLevel(z => Math.min(3.0, +(z + 0.1).toFixed(1)))}>+</button>
          </div>

          <button className="icon-btn read-fs-btn" title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} onClick={onToggleFullscreen}>
            <img src={isFullscreen ? "/collapse.svg" : "/expand.svg"} alt="" />
          </button>
        </div>
      </section>
    </main>
  );
}

export default Editor;
