import { useState, useRef } from "react";
import SearchPanel from "./SearchPanel.jsx";
import ImageResizer from "./ImageResizer.jsx";
import WorksheetGrid from "./WorksheetGrid.jsx";
import DrawingPad from "./DrawingPad.jsx";

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
    onBack,
    onFormat,
    onToggleFormatToolbar,
    editorsRef,
    containerRef,
    worksheets,
    setWorksheets,
    activeTab,
    setActiveTab,
    onInsertImage,
  }) {
  const [selectedImg, setSelectedImg] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showDrawingPad, setShowDrawingPad] = useState(false);
  const savedRangeRef = useRef(null);
  const imageInputRef = useRef(null);

  const getActiveEditor = () => editorsRef.current[activeTab] || null;

  // Save the current editor selection so toolbar interactions don't lose it
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const editor = getActiveEditor();
      // Only save if the range is inside the editor
      if (editor && editor.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
  };

  // Restore saved selection then apply the format command
  const safeFormat = (command, value = null) => {
    const editor = getActiveEditor();
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

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (onInsertImage) onInsertImage(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <main id="main" className="editor-shell">
      <header className="topbar">
        <div className="left-group">
          <button id="hamburgerBtn" className="icon-btn hamburger" aria-label="Menu" title="Menu" onClick={onOpenMenu}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <button className="breadcrumb-home icon-btn" style={{ padding: "4px 6px", minHeight: 0 }} onClick={onBack} title="Back to notes">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15,18 9,12 15,6"/>
              </svg>
              Home
            </button>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{noteName || "New note"}</span>
          </nav>
        </div>

        <div className="actions">
          {/* Find */}
          <button className="icon-btn toolbar-btn" id="findToggle" title="Find in note (Ctrl+F)" onClick={onToggleSearch}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span className="desktop-label">Find</span>
          </button>

          {/* Edit / Read toggle */}
          <button className="icon-btn toolbar-btn" id="editToggle" title="Toggle edit mode" onClick={onToggleEdit} style={{ fontWeight: 600 }}>
            {isEditing ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                <span className="desktop-label">Read</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                <span className="desktop-label">Edit</span>
              </>
            )}
          </button>
          
          <button className="icon-btn toolbar-btn" id="copyToggle" title="Copy to clipboard" onClick={onCopyAll}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
          </button>

          {/* Desktop secondary actions */}
          <div className="desktop-actions">
            <button className="icon-btn toolbar-btn" onClick={onExportTXT} title="Export as TXT">TXT</button>
            <button className="icon-btn toolbar-btn" onClick={onExportPDF} title="Export as PDF">PDF</button>
            <button className="icon-btn toolbar-btn" id="extendBtn" onClick={onExtendNote} title="Extend note lifetime by 24h">Extend</button>
            <button className="icon-btn toolbar-btn" onClick={onInsertTable} title="Insert table">Table</button>
            <button className="icon-btn danger-action" onClick={onDeleteOpenNote} title="Delete this note">Delete</button>
          </div>

          {/* Mobile overflow menu */}
          <button id="exportToggle" className="icon-btn toolbar-btn" aria-haspopup="menu" aria-expanded={exportOpen} title="More actions" onClick={onToggleExport}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>
            </svg>
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
          <button className="export-menu-item" style={{ color: "var(--danger)" }} onClick={onDeleteOpenNote}>Delete Note</button>
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
                  placeholder="Auto-generated note name"
                  maxLength={30}
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
                  <div className="password-wrapper" style={{ position: "relative" }}>
                    <input
                      id="notePassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Password (optional)"
                      value={password}
                      onChange={(event) => onPasswordChange(event.target.value)}
                      style={{ paddingRight: "30px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer", opacity: 0.6,
                        padding: 0, display: "flex", alignItems: "center", justifyContent: "center"
                      }}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      )}
                    </button>
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
                <span className="fmt-sep" />
                {(activeTab === "text" || worksheets.find(s => s.id === activeTab)?.type === "note") && (
                  <>
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      ref={imageInputRef} 
                      style={{ display: "none" }} 
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          onInsertImage(e.target.files);
                          e.target.value = ""; // Reset input
                        }
                      }} 
                    />
                    <button 
                      className="btn fmt-save" 
                      title="Insert Image"
                      onClick={() => imageInputRef.current?.click()}
                      style={{ background: "var(--surface)", color: "var(--text)" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                      Image
                    </button>
                    <span className="fmt-sep" />
                    <button 
                      className="btn fmt-save" 
                      title="Draw"
                      onClick={() => setShowDrawingPad(true)}
                      style={{ background: "var(--surface)", color: "var(--text)" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.58 7.58"></path><circle cx="11" cy="11" r="2"></circle></svg>
                      Draw
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
                  </>
                )}
              </div>

              {/* Row 2: Style + Lists + Indent + Align + Clear */}
              {(activeTab === "text" || worksheets.find(s => s.id === activeTab)?.type === "note") && (
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
              )}
            </div>
          </>
        )}

          {/* Main Note Editor */}
          <div
            className="textarea-container"
            ref={containerRef}
            style={{ display: activeTab === "text" ? "block" : "none" }}
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
              ref={(el) => { if (editorsRef) editorsRef.current["text"] = el; }}
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
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onKeyDown={(e) => {
                if (e.key === "Backspace" || e.key === "Delete") setSelectedImg(null);
                onKeyDown(e);
              }}
              onClick={handleEditorClick}
            />
            {activeTab === "text" && <ImageResizer imgElement={selectedImg} containerRef={containerRef} isEditing={isEditing} onDeselect={() => setSelectedImg(null)} />}

            <div className="zoom-controls">
              <button className="icon-btn" title="Zoom out" onClick={() => setZoomLevel(z => Math.max(0.5, +(z - 0.1).toFixed(1)))}>-</button>
              <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
              <button className="icon-btn" title="Zoom in" onClick={() => setZoomLevel(z => Math.min(3.0, +(z + 0.1).toFixed(1)))}>+</button>
            </div>

            <button className="icon-btn read-fs-btn" title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} onClick={onToggleFullscreen}>
              <img src={isFullscreen ? "/collapse.svg" : "/expand.svg"} alt="" />
            </button>
          </div>

          {/* Custom Note Editors */}
          {worksheets.filter(s => s.type === "note").map(note => (
            <div
              key={`note-container-${note.id}`}
              className="textarea-container"
              style={{ display: activeTab === note.id ? "block" : "none" }}
            >
              <div
                id={`noteContent-${note.id}`}
                ref={(el) => { if (editorsRef) editorsRef.current[note.id] = el; }}
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
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" || e.key === "Delete") setSelectedImg(null);
                  onKeyDown(e);
                }}
                onClick={handleEditorClick}
              />
              {activeTab === note.id && <ImageResizer imgElement={selectedImg} containerRef={containerRef} isEditing={isEditing} onDeselect={() => setSelectedImg(null)} />}

              <div className="zoom-controls">
                <button className="icon-btn" title="Zoom out" onClick={() => setZoomLevel(z => Math.max(0.5, +(z - 0.1).toFixed(1)))}>-</button>
                <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
                <button className="icon-btn" title="Zoom in" onClick={() => setZoomLevel(z => Math.min(3.0, +(z + 0.1).toFixed(1)))}>+</button>
              </div>

              <button className="icon-btn read-fs-btn" title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} onClick={onToggleFullscreen}>
                <img src={isFullscreen ? "/collapse.svg" : "/expand.svg"} alt="" />
              </button>
            </div>
          ))}
          
          {/* Render the WorksheetGrid if a sheet tab is active */}
          {activeTab !== "text" && worksheets.find(s => s.id === activeTab)?.type !== "note" && (
            <WorksheetGrid
              data={worksheets.find(s => s.id === activeTab)?.data}
              onChange={(newData) => {
                const updated = worksheets.map(s => s.id === activeTab ? { ...s, data: newData } : s);
                setWorksheets(updated);
              }}
            />
          )}

          {/* Bottom Tab Bar for Worksheets */}
          <div style={{ display: "flex", alignItems: "center", background: "var(--surface2)", borderTop: "1px solid var(--border)" }}>
            <div className="editor-tabs" style={{ flex: "0 1 auto", borderTop: "none", background: "transparent", paddingRight: "4px" }}>
              <button 
                className={`tab-item ${activeTab === "text" ? "active" : ""}`}
                onClick={() => setActiveTab("text")}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                Note
              </button>
            {worksheets.map(sheet => (
              <div
                key={sheet.id}
                className={`tab-item ${activeTab === sheet.id ? "active" : ""}`}
                onClick={() => setActiveTab(sheet.id)}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                {sheet.type === "note" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                )}
                <span>{sheet.name}</span>
                {isEditing && (
                  <button
                    className="tab-delete-btn"
                    title={`Delete ${sheet.type === "note" ? "note" : "sheet"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const updated = worksheets.filter(s => s.id !== sheet.id);
                      setWorksheets(updated);
                      if (activeTab === sheet.id) setActiveTab("text");
                      if (editorsRef.current) delete editorsRef.current[sheet.id];
                    }}
                    style={{
                      background: "transparent", border: "none", color: "inherit",
                      cursor: "pointer", fontSize: "14px", opacity: 0.6, padding: "0 4px"
                    }}
                    onMouseEnter={(e) => e.target.style.opacity = 1}
                    onMouseLeave={(e) => e.target.style.opacity = 0.6}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                )}
              </div>
            ))}
            </div>
            
            {isEditing && (
              <div style={{ position: "relative", display: "flex", alignItems: "center", paddingRight: "12px", flex: "0 0 auto" }}>
                <button
                  className="tab-item add-tab"
                  title="Add empty worksheet or note"
                  onClick={() => setAddMenuOpen(!addMenuOpen)}
                  style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 12px", fontWeight: "bold" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: "1px" }}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {addMenuOpen && (
                  <>
                    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 }} onClick={() => setAddMenuOpen(false)} />
                    <div className="add-tab-menu" style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "6px", zIndex: 10, display: "flex", flexDirection: "column", gap: "4px", whiteSpace: "nowrap", boxShadow: "var(--shadow-md)" }}>
                      <button 
                        style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "transparent", border: "none", color: "var(--text)", cursor: "pointer", textAlign: "left", borderRadius: "6px", fontSize: "13px", fontWeight: 500 }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        onClick={() => {
                          const numNotes = worksheets.filter(s => s.type === "note").length + 2;
                          const newSheet = { id: Date.now().toString(), name: `Note ${numNotes}`, data: "", type: "note" };
                          setWorksheets([...worksheets, newSheet]);
                          setActiveTab(newSheet.id);
                          setAddMenuOpen(false);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                        Add Note
                      </button>
                      <button 
                        style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "transparent", border: "none", color: "var(--text)", cursor: "pointer", textAlign: "left", borderRadius: "6px", fontSize: "13px", fontWeight: 500 }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        onClick={() => {
                          const numSheets = worksheets.filter(s => s.type !== "note").length + 1;
                          const newSheet = { id: Date.now().toString(), name: `Sheet ${numSheets}`, data: [] };
                          setWorksheets([...worksheets, newSheet]);
                          setActiveTab(newSheet.id);
                          setAddMenuOpen(false);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                        Add Worksheet
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

        </section>

        {showDrawingPad && (
          <DrawingPad 
            onCancel={() => setShowDrawingPad(false)} 
            onInsert={(files) => {
              setShowDrawingPad(false);
              const editor = getActiveEditor();
              if (editor) {
                editor.focus();
                const sel = window.getSelection();
                sel.removeAllRanges();
                const range = document.createRange();
                range.selectNodeContents(editor);
                range.collapse(false); // Move to the absolute end
                sel.addRange(range);
              }
              if (onInsertImage) onInsertImage(files);
            }} 
          />
        )}
      </main>
    );
}

export default Editor;
