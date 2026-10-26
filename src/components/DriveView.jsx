import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { 
  MAX_FILE_SIZE, 
  OVERALL_CLOUD_STORAGE_CAP, 
  formatBytes, 
  getOverallCloudUsage 
} from "../utils/cloudStorage.js";

const DRIVE_FOLDER = "drive";

// Fast SHA-256 hash using Web Crypto API
async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
}

// Encode filename format:
// Public:  `P_<timestamp>_<cleanName>`
// Lock:    `L_<passHash16>_<timestamp>_<cleanName>`
function parseDriveFileName(storedName) {
  const parts = storedName.split("_");
  if (parts[0] === "L" && parts.length >= 4) {
    const passHash = parts[1];
    const timestamp = parts[2];
    const originalName = parts.slice(3).join("_");
    return { isLocked: true, passHash, timestamp, originalName, storedName };
  }
  if (parts[0] === "P" && parts.length >= 3) {
    const timestamp = parts[1];
    const originalName = parts.slice(2).join("_");
    return { isLocked: false, passHash: null, timestamp, originalName, storedName };
  }
  // Fallback for older uploaded files
  const clean = storedName.replace(/^\d+_/, "");
  return { isLocked: false, passHash: null, timestamp: null, originalName: clean, storedName };
}

function getFileIcon(name = "") {
  const ext = name.split(".").pop().toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    );
  }
  if (["pdf"].includes(ext)) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    );
  }
  if (["zip", "tar", "gz", "rar", "7z"].includes(ext)) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="21 8 21 21 3 21 3 8"/>
        <rect x="1" y="3" width="22" height="5"/>
        <line x1="10" y1="12" x2="14" y2="12"/>
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

export default function DriveView({ onHome, onToast }) {
  const [files, setFiles] = useState([]);
  const [cloudUsage, setCloudUsage] = useState({
    totalCloudBytes: 0,
    driveFilesBytes: 0,
    rootMediaBytes: 0,
    dbNotesBytes: 0,
    availableBytes: OVERALL_CLOUD_STORAGE_CAP
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef(null);

  // Upload modal state (with optional password protection)
  const [uploadModal, setUploadModal] = useState({
    open: false,
    files: [],
    password: "",
    isPasswordProtected: false
  });

  // Password verification modal for Download or Delete
  const [authDialog, setAuthDialog] = useState({
    open: false,
    fileParsed: null,
    action: "", // 'download' | 'delete' | 'preview'
    password: "",
    error: ""
  });

  // Sharable link modal (shows full link + auto-copied feedback)
  const [shareModal, setShareModal] = useState({
    open: false,
    url: "",
    fileName: "",
    isLocked: false
  });

  // Preview modal
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    refreshData();
  }, []);

  async function refreshData() {
    setLoading(true);
    try {
      const usage = await getOverallCloudUsage();
      setCloudUsage(usage);
      setFiles(usage.driveFiles || []);
    } catch (err) {
      console.error("Failed to load cloud drive usage:", err);
      onToast?.("Failed to calculate cloud usage");
    } finally {
      setLoading(false);
    }
  }

  const overallUsedBytes = cloudUsage.totalCloudBytes;
  const usedPercentage = Math.min(100, (overallUsedBytes / OVERALL_CLOUD_STORAGE_CAP) * 100);

  function handleFileSelection(selectedFiles) {
    if (!selectedFiles || selectedFiles.length === 0) return;
    const fileList = Array.from(selectedFiles);

    // Validate 10 MB per-file rule immediately
    for (const file of fileList) {
      if (file.size > MAX_FILE_SIZE) {
        onToast?.(`"${file.name}" is ${formatBytes(file.size)}. Max size is 10 MB per file.`);
        return;
      }
    }

    // Validate 45 MB total cloud storage ceiling
    const incomingBytes = fileList.reduce((acc, f) => acc + f.size, 0);
    if (overallUsedBytes + incomingBytes > OVERALL_CLOUD_STORAGE_CAP) {
      onToast?.(`Upload blocked! Overall cloud storage would exceed 45 MB.`);
      return;
    }

    setUploadModal({
      open: true,
      files: fileList,
      password: "",
      isPasswordProtected: false
    });
  }

  async function confirmUpload() {
    const { files: fileList, isPasswordProtected, password } = uploadModal;
    if (isPasswordProtected && !password.trim()) {
      onToast?.("Please enter a password or uncheck password protection.");
      return;
    }

    setUploadModal(prev => ({ ...prev, open: false }));
    setUploading(true);

    let passHash = null;
    if (isPasswordProtected) {
      passHash = await sha256(password.trim());
    }

    let successCount = 0;
    for (const file of fileList) {
      try {
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const uniquePath = isPasswordProtected
          ? `${DRIVE_FOLDER}/L_${passHash}_${Date.now()}_${cleanName}`
          : `${DRIVE_FOLDER}/P_${Date.now()}_${cleanName}`;

        const { error } = await supabase.storage.from("images").upload(uniquePath, file, {
          cacheControl: "3600",
          upsert: false
        });
        if (error) throw error;
        successCount++;
      } catch (err) {
        console.error("Upload error:", err);
        onToast?.(`Failed to upload ${file.name}: ${err.message || "Unknown error"}`);
      }
    }

    setUploading(false);
    if (successCount > 0) {
      onToast?.(`Uploaded ${successCount} file(s) successfully!`);
      await refreshData();
    }
  }

  function getFileUrl(storedName) {
    const { data } = supabase.storage.from("images").getPublicUrl(`${DRIVE_FOLDER}/${storedName}`);
    return data?.publicUrl || "";
  }

  function triggerDirectDownload(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Handle Download Request
  async function handleDownloadRequest(fileParsed) {
    if (!fileParsed.isLocked) {
      triggerDirectDownload(getFileUrl(fileParsed.storedName), fileParsed.originalName);
      onToast?.(`Downloading "${fileParsed.originalName}"...`);
      return;
    }

    // File is password-protected -> prompt for password
    setAuthDialog({
      open: true,
      fileParsed,
      action: "download",
      password: "",
      error: ""
    });
  }

  // Handle Delete Request
  async function handleDeleteRequest(fileParsed) {
    if (!fileParsed.isLocked) {
      if (!window.confirm(`Delete "${fileParsed.originalName}" permanently from Cloud Drive?`)) return;
      await performDelete(fileParsed.storedName);
      return;
    }

    // Password-protected -> prompt for password
    setAuthDialog({
      open: true,
      fileParsed,
      action: "delete",
      password: "",
      error: ""
    });
  }

  async function performDelete(storedName) {
    try {
      const { error } = await supabase.storage.from("images").remove([`${DRIVE_FOLDER}/${storedName}`]);
      if (error) throw error;
      onToast?.("File deleted from Cloud Drive.");
      setFiles(prev => prev.filter(f => f.name !== storedName));
      if (previewFile?.storedName === storedName) setPreviewFile(null);
      await refreshData();
    } catch (err) {
      console.error("Delete error:", err);
      onToast?.("Failed to delete file: " + err.message);
    }
  }

  async function handleAuthSubmit() {
    const { fileParsed, action, password } = authDialog;
    if (!password) {
      setAuthDialog(prev => ({ ...prev, error: "Please enter the password" }));
      return;
    }

    const inputHash = await sha256(password.trim());
    if (inputHash !== fileParsed.passHash) {
      setAuthDialog(prev => ({ ...prev, error: "Incorrect password! Access denied." }));
      return;
    }

    setAuthDialog({ open: false, fileParsed: null, action: "", password: "", error: "" });

    if (action === "download") {
      triggerDirectDownload(getFileUrl(fileParsed.storedName), fileParsed.originalName);
      onToast?.(`Password verified! Downloading "${fileParsed.originalName}"...`);
    } else if (action === "delete") {
      await performDelete(fileParsed.storedName);
    } else if (action === "preview") {
      openPreview(fileParsed);
    }
  }

  function handleShare(fileParsed) {
    const url = getFileUrl(fileParsed.storedName);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setShareModal({
      open: true,
      url,
      fileName: fileParsed.originalName,
      isLocked: fileParsed.isLocked
    });
    onToast?.("Link copied to clipboard!");
  }

  function openPreview(fileParsed, rawFile) {
    const fileUrl = getFileUrl(fileParsed.storedName);
    const isImg = rawFile?.metadata?.mimetype?.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(fileParsed.originalName);
    setPreviewFile({
      name: fileParsed.originalName,
      storedName: fileParsed.storedName,
      url: fileUrl,
      isImg,
      size: rawFile?.metadata?.size,
      fileParsed
    });
  }

  const parsedFiles = files.map(f => ({
    raw: f,
    ...parseDriveFileName(f.name)
  }));

  const filteredFiles = parsedFiles.filter(f => 
    f.originalName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main id="main" className="drive-main" style={{ padding: "24px", display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", background: "var(--bg)", color: "var(--text)" }}>
      {/* Top Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "var(--r-md)", background: "var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em" }}>Cloud Drive</h2>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--text-dim)" }}>
              Password protection • Share links • Max 10 MB/file • <strong>45 MB total cloud limit</strong>
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button 
            className="btn btn-primary" 
            onClick={() => fileInputRef.current?.click()} 
            disabled={uploading}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {uploading ? "Uploading..." : "Upload File"}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => handleFileSelection(e.target.files)} 
            style={{ display: "none" }} 
            multiple 
          />
          <button 
            className="btn" 
            onClick={onHome} 
            style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}
          >
            Back to Notes
          </button>
        </div>
      </header>

      {/* Storage Gauge Card */}
      <section style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "16px 20px",
        marginBottom: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        boxShadow: "var(--shadow-sm)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", flexWrap: "wrap", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
            <span>🌐</span>
            <span>Overall Cloud Storage Footprint</span>
          </div>
          <div style={{ color: "var(--text-dim)" }}>
            <strong style={{ color: "var(--text)" }}>{formatBytes(overallUsedBytes)}</strong> used of 45 MB ({usedPercentage.toFixed(1)}%)
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{
          width: "100%",
          height: "8px",
          background: "var(--bg)",
          borderRadius: "999px",
          overflow: "hidden",
          border: "1px solid var(--border)"
        }}>
          <div style={{
            height: "100%",
            width: `${usedPercentage}%`,
            background: usedPercentage > 90 ? "#ef4444" : usedPercentage > 75 ? "#f59e0b" : "var(--accent)",
            borderRadius: "999px",
            transition: "width 0.3s ease"
          }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-dim)", flexWrap: "wrap", gap: "6px" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <span>📁 Drive: <strong>{formatBytes(cloudUsage.driveFilesBytes)}</strong></span>
            <span>🖼️ Media: <strong>{formatBytes(cloudUsage.rootMediaBytes)}</strong></span>
            <span>📝 Notes: <strong>{formatBytes(cloudUsage.dbNotesBytes)}</strong></span>
          </div>
          <span>Free cloud space: <strong style={{ color: "var(--text)" }}>{formatBytes(Math.max(0, OVERALL_CLOUD_STORAGE_CAP - overallUsedBytes))}</strong></span>
        </div>
      </section>

      {/* Drag & Drop Upload Zone */}
      <section 
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFileSelection(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "var(--r-md)",
          padding: "24px",
          textAlign: "center",
          marginBottom: "24px",
          background: dragOver ? "var(--accent-glow)" : "var(--surface)",
          cursor: "pointer",
          transition: "all 0.2s ease"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", color: "var(--text-dim)" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>
            Drop files here to upload with password or public access
          </div>
          <div style={{ fontSize: "12px" }}>
            Max 10 MB per file • Strict 45 MB total cloud cap • One-click share links
          </div>
        </div>
      </section>

      {/* Files Filter & Grid */}
      <section style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", gap: "12px", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>Drive Files ({filteredFiles.length})</h3>
          <input 
            type="text" 
            placeholder="Search files..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "6px 12px",
              fontSize: "13px",
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
              width: "200px"
            }}
          />
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>
            Loading Drive files...
          </div>
        ) : filteredFiles.length === 0 ? (
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px",
            color: "var(--text-dim)",
            gap: "8px"
          }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <div style={{ fontSize: "14px" }}>
              {files.length === 0 ? "No files stored in your Drive yet." : "No files match your search."}
            </div>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "14px",
            overflowY: "auto"
          }}>
            {filteredFiles.map((fileParsed) => {
              const { raw, originalName, storedName, isLocked } = fileParsed;
              const fileUrl = getFileUrl(storedName);
              const isImg = raw.metadata?.mimetype?.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(originalName);

              return (
                <div
                  key={storedName}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-md)",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    boxShadow: "var(--shadow-sm)",
                    transition: "transform 0.15s, border-color 0.15s",
                    position: "relative"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                >
                  {/* Lock Indicator Badge */}
                  <div style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 6px",
                    borderRadius: "999px",
                    fontSize: "10px",
                    fontWeight: 700,
                    background: isLocked ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)",
                    color: isLocked ? "#ef4444" : "#22c55e",
                    border: `1px solid ${isLocked ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.3)"}`
                  }}>
                    {isLocked ? (
                      <>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        Locked
                      </>
                    ) : (
                      <>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                        </svg>
                        Public
                      </>
                    )}
                  </div>

                  {/* Thumbnail / Icon preview */}
                  <div 
                    onClick={() => {
                      if (isLocked) {
                        setAuthDialog({ open: true, fileParsed, action: "preview", password: "", error: "" });
                      } else {
                        openPreview(fileParsed, raw);
                      }
                    }}
                    style={{
                      height: "110px",
                      background: "var(--bg)",
                      borderRadius: "var(--r-sm)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      cursor: "pointer",
                      border: "1px solid var(--border)"
                    }}
                  >
                    {isImg && !isLocked ? (
                      <img 
                        src={fileUrl} 
                        alt={originalName} 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                        loading="lazy"
                      />
                    ) : isLocked ? (
                      <div style={{ color: "#ef4444", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        <span style={{ fontSize: "11px", fontWeight: 600 }}>Password Protected</span>
                      </div>
                    ) : (
                      <div style={{ color: "var(--accent)", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                        {getFileIcon(originalName)}
                        <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>
                          {originalName.split(".").pop()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Title & Info */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div 
                      title={originalName} 
                      style={{ 
                        fontWeight: 600, 
                        fontSize: "13px", 
                        overflow: "hidden", 
                        textOverflow: "ellipsis", 
                        whiteSpace: "nowrap" 
                      }}
                    >
                      {originalName}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px" }}>
                      {formatBytes(raw.metadata?.size)} • {raw.created_at ? new Date(raw.created_at).toLocaleDateString() : ""}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: "6px", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                    <button 
                      className="btn" 
                      title="Shareable Link" 
                      onClick={() => handleShare(fileParsed)}
                      style={{ flex: 1, padding: "5px 8px", fontSize: "11px", background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="18" cy="5" r="3"/>
                        <circle cx="6" cy="12" r="3"/>
                        <circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                      Share
                    </button>
                    <button 
                      className="btn" 
                      title={isLocked ? "Download (Requires Password)" : "Download"}
                      onClick={() => handleDownloadRequest(fileParsed)}
                      style={{ padding: "5px 8px", fontSize: "11px", background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                    <button 
                      className="btn" 
                      title={isLocked ? "Delete (Requires Password)" : "Delete"}
                      onClick={() => handleDeleteRequest(fileParsed)}
                      style={{ padding: "5px 8px", fontSize: "11px", background: "var(--bg)", color: "#ef4444", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 1. UPLOAD CONFIG MODAL (PASSWORD OR NO PASSWORD) ── */}
      {uploadModal.open && (
        <div 
          className="dialog-overlay show" 
          onClick={() => setUploadModal(prev => ({ ...prev, open: false }))}
          style={{ zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
        >
          <div 
            style={{ 
              background: "var(--surface)", 
              borderRadius: "var(--r-md)", 
              padding: "20px", 
              width: "100%", 
              maxWidth: "420px",
              boxShadow: "var(--shadow-lg)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>Upload File Options</h3>
            <div style={{ fontSize: "13px", color: "var(--text-dim)" }}>
              {uploadModal.files.length} file(s) selected:{" "}
              <strong>{uploadModal.files.map(f => f.name).join(", ")}</strong>
            </div>

            {/* Checkbox for Password Protection */}
            <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 600, cursor: "pointer", userSelect: "none" }}>
              <input 
                type="checkbox" 
                checked={uploadModal.isPasswordProtected}
                onChange={(e) => setUploadModal(prev => ({ ...prev, isPasswordProtected: e.target.checked }))}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <span>Protect with Password</span>
            </label>

            {uploadModal.isPasswordProtected && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <input 
                  type="password"
                  placeholder="Set download & delete password"
                  value={uploadModal.password}
                  onChange={(e) => setUploadModal(prev => ({ ...prev, password: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmUpload(); }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "var(--r-sm)",
                    background: "var(--bg)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    outline: "none"
                  }}
                  autoFocus
                />
                <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                  Only users who enter this password will be able to download or delete this file.
                </div>
              </div>
            )}

            {!uploadModal.isPasswordProtected && (
              <div style={{ fontSize: "12px", color: "var(--text-dim)", background: "var(--bg)", padding: "10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}>
                🔓 <strong>Public File</strong>: Anyone with the shareable link can download directly without a password.
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "6px" }}>
              <button 
                className="btn" 
                onClick={() => setUploadModal(prev => ({ ...prev, open: false }))}
                style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)" }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={confirmUpload}
              >
                Upload Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. PASSWORD AUTH DIALOG (FOR DOWNLOAD OR DELETE) ── */}
      {authDialog.open && (
        <div 
          className="dialog-overlay show" 
          onClick={() => setAuthDialog({ open: false, fileParsed: null, action: "", password: "", error: "" })}
          style={{ zIndex: 10001, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
        >
          <div 
            style={{ 
              background: "var(--surface)", 
              borderRadius: "var(--r-md)", 
              padding: "20px", 
              width: "100%", 
              maxWidth: "400px",
              boxShadow: "var(--shadow-lg)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "20px" }}>🔒</span>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
                {authDialog.action === "delete" ? "Confirm File Deletion" : "Protected Download"}
              </h3>
            </div>

            <div style={{ fontSize: "13px", color: "var(--text-dim)" }}>
              "{authDialog.fileParsed?.originalName}" is password protected. Enter the password to {authDialog.action}:
            </div>

            <input 
              type="password"
              placeholder="Enter file password"
              value={authDialog.password}
              onChange={(e) => setAuthDialog(prev => ({ ...prev, password: e.target.value, error: "" }))}
              onKeyDown={(e) => { if (e.key === "Enter") handleAuthSubmit(); }}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--r-sm)",
                background: "var(--bg)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                fontSize: "13px",
                outline: "none"
              }}
              autoFocus
            />

            {authDialog.error && (
              <div style={{ fontSize: "12px", color: "#ef4444", fontWeight: 600 }}>
                {authDialog.error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button 
                className="btn" 
                onClick={() => setAuthDialog({ open: false, fileParsed: null, action: "", password: "", error: "" })}
                style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)" }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleAuthSubmit}
                style={{ background: authDialog.action === "delete" ? "#ef4444" : "var(--accent)" }}
              >
                {authDialog.action === "delete" ? "Unlock & Delete" : "Unlock & Download"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. SHARABLE LINK MODAL (DISPLAYS URL + COPIED FEEDBACK) ── */}
      {shareModal.open && (
        <div 
          className="dialog-overlay show" 
          onClick={() => setShareModal(prev => ({ ...prev, open: false }))}
          style={{ zIndex: 10001, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
        >
          <div 
            style={{ 
              background: "var(--surface)", 
              borderRadius: "var(--r-md)", 
              padding: "20px", 
              width: "100%", 
              maxWidth: "500px",
              boxShadow: "var(--shadow-lg)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🔗</span> Share File Link
              </h3>
              <button 
                onClick={() => setShareModal(prev => ({ ...prev, open: false }))}
                style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "16px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: "13px", color: "var(--text-dim)" }}>
              Shareable link for: <strong>{shareModal.fileName}</strong>
              {shareModal.isLocked && (
                <span style={{ color: "#ef4444", fontWeight: 600, marginLeft: "6px" }}>(Password Protected)</span>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <input 
                type="text" 
                readOnly 
                value={shareModal.url}
                onClick={(e) => e.target.select()}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  fontSize: "12px",
                  borderRadius: "var(--r-sm)",
                  background: "var(--bg)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  outline: "none"
                }}
              />
              <button 
                className="btn btn-primary"
                onClick={() => {
                  navigator.clipboard.writeText(shareModal.url);
                  onToast?.("Link copied to clipboard!");
                }}
                style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", whiteSpace: "nowrap" }}
              >
                Copy Link
              </button>
            </div>

            <div style={{ fontSize: "12px", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>✓</span> Link has been automatically copied to your clipboard!
            </div>
          </div>
        </div>
      )}

      {/* ── 4. PREVIEW MODAL ── */}
      {previewFile && (
        <div 
          className="dialog-overlay show" 
          onClick={() => setPreviewFile(null)}
          style={{ zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
        >
          <div 
            style={{ 
              position: "relative", 
              maxWidth: "90vw", 
              maxHeight: "90vh", 
              background: "var(--surface)", 
              borderRadius: "var(--r-md)", 
              padding: "16px",
              boxShadow: "var(--shadow-lg)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              border: "1px solid var(--border)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "400px" }}>
                {previewFile.name}
              </strong>
              <div style={{ display: "flex", gap: "8px" }}>
                <button 
                  className="btn btn-primary"
                  onClick={() => handleShare(previewFile.fileParsed)}
                  style={{ padding: "4px 8px", fontSize: "12px" }}
                >
                  Share Link
                </button>
                <button 
                  className="btn"
                  onClick={() => setPreviewFile(null)}
                  style={{ padding: "4px 8px", fontSize: "12px", background: "var(--bg)", color: "var(--text)" }}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", maxHeight: "70vh", overflow: "auto" }}>
              {previewFile.isImg ? (
                <img 
                  src={previewFile.url} 
                  alt={previewFile.name} 
                  style={{ maxWidth: "100%", maxHeight: "65vh", objectFit: "contain", borderRadius: "var(--r-sm)" }} 
                />
              ) : (
                <div style={{ textAlign: "center", padding: "30px", color: "var(--text-dim)" }}>
                  <div style={{ color: "var(--accent)", marginBottom: "12px" }}>
                    {getFileIcon(previewFile.name)}
                  </div>
                  <div>Preview not available for this file type.</div>
                  <button 
                    onClick={() => handleDownloadRequest(previewFile.fileParsed)}
                    className="btn btn-primary"
                    style={{ marginTop: "14px", display: "inline-block" }}
                  >
                    Download File ({formatBytes(previewFile.size)})
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
