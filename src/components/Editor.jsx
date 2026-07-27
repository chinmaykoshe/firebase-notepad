import { useState, useRef } from "react";
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
    onCopyAll,
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
  const savedRangeRef = useRef(null);

  // Save the current editor selection so toolbar interactions don't lose it
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      // Only save if the range is inside the editor
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
  };

  // Restore saved selection then apply the format command
  const safeFormat = (command, value = null) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
    onFormat(command, value);
  };

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
          <button className="icon-btn toolbar-btn" id="copyToggle" title="Copy to clipboard" onClick={onCopyAll}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
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
            {/* Note metadata — collapses on mobile via <details> */}
            <details className="meta-fields" open>
              <summary className="meta-summary">📝 Note Details</summary>
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

            {/* Full-wrap formatting toolbar */}
            <div
              className="format-panel"
              aria-label="Text formatting toolbar"
              onMouseDown={saveSelection}
              onTouchStart={saveSelection}
            >
              {/* Row 1: Save + Font controls */}
              <div className="fmt-row">
                <button className="btn fmt-save" id="saveBtn" onClick={onSave}>
                  💾 Save
                </button>
                <span className="fmt-sep" />
                <select
                  className="format-select font-select"
                  defaultValue=""
                  title="Font family"
                  onChange={(event) => { if (event.target.value) safeFormat("fontName", event.target.value); event.target.value = ""; }}
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
                  title="Font size"
                  onChange={(event) => { if (event.target.value) safeFormat("fontSize", event.target.value); event.target.value = ""; }}
                >
                  <option value="">Size</option>
                  <option value="2">Small</option>
                  <option value="3">Normal</option>
                  <option value="4">Medium</option>
                  <option value="5">Large</option>
                  <option value="6">Huge</option>
                </select>
              </div>

              {/* Row 2: Style + Lists + Indent + Align + Clear */}
              <div className="fmt-row">
                <div className="fmt-group">
                  <button type="button" className="format-btn bold-btn" title="Bold" onClick={() => safeFormat("bold")}><b>B</b></button>
                  <button type="button" className="format-btn italic-btn" title="Italic" onClick={() => safeFormat("italic")}><i>I</i></button>
                  <button type="button" className="format-btn underline-btn" title="Underline" onClick={() => safeFormat("underline")}><u>U</u></button>
                </div>
                <span className="fmt-sep" />
                <div className="fmt-group">
                  <button type="button" className="format-btn" title="Bullet list" onClick={() => safeFormat("insertUnorderedList")}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="4" cy="6" r="2"/><rect x="8" y="5" width="13" height="2" rx="1"/><circle cx="4" cy="12" r="2"/><rect x="8" y="11" width="13" height="2" rx="1"/><circle cx="4" cy="18" r="2"/><rect x="8" y="17" width="13" height="2" rx="1"/></svg>
                  </button>
                  <button type="button" className="format-btn" title="Numbered list" onClick={() => safeFormat("insertOrderedList")}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><text x="2" y="8" fontSize="8" fontWeight="bold">1.</text><rect x="8" y="5" width="13" height="2" rx="1"/><text x="2" y="14" fontSize="8" fontWeight="bold">2.</text><rect x="8" y="11" width="13" height="2" rx="1"/><text x="2" y="20" fontSize="8" fontWeight="bold">3.</text><rect x="8" y="17" width="13" height="2" rx="1"/></svg>
                  </button>
                  <button type="button" className="format-btn" title="Decrease indent" onClick={() => safeFormat("outdent")}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18v2H3V5zm8 4h10v2H11V9zm0 4h10v2H11v-2zm-8 4h18v2H3v-2zM3 9l4 3-4 3V9z"/></svg>
                  </button>
                  <button type="button" className="format-btn" title="Increase indent" onClick={() => safeFormat("indent")}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18v2H3V5zm8 4h10v2H11V9zm0 4h10v2H11v-2zm-8 4h18v2H3v-2zM3 9l4 3-4 3V9z" transform="scale(-1,1) translate(-24,0)"/></svg>
                  </button>
                </div>
                <span className="fmt-sep" />
                <div className="fmt-group">
                  <button type="button" className="format-btn" title="Align left" onClick={() => safeFormat("justifyLeft")}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="18" height="2" rx="1"/><rect x="3" y="9" width="12" height="2" rx="1"/><rect x="3" y="13" width="18" height="2" rx="1"/><rect x="3" y="17" width="10" height="2" rx="1"/></svg>
                  </button>
                  <button type="button" className="format-btn" title="Align center" onClick={() => safeFormat("justifyCenter")}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="18" height="2" rx="1"/><rect x="6" y="9" width="12" height="2" rx="1"/><rect x="3" y="13" width="18" height="2" rx="1"/><rect x="7" y="17" width="10" height="2" rx="1"/></svg>
                  </button>
                  <button type="button" className="format-btn" title="Align right" onClick={() => safeFormat("justifyRight")}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="18" height="2" rx="1"/><rect x="9" y="9" width="12" height="2" rx="1"/><rect x="3" y="13" width="18" height="2" rx="1"/><rect x="11" y="17" width="10" height="2" rx="1"/></svg>
                  </button>
                </div>
                <span className="fmt-sep" />
                <button type="button" className="format-btn clear-btn" title="Clear formatting" onClick={() => safeFormat("removeFormat")}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.3 18.9 12 13.2l5.7 5.7 1.4-1.4-5.7-5.7 5.7-5.7-1.4-1.4L12 10.4 6.3 4.7 4.9 6.1l5.7 5.7-5.7 5.7z"/></svg>
                  <span className="fmt-btn-label">Clear</span>
                </button>
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
              data-placeholder="Start typing... or type / for commands"
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
