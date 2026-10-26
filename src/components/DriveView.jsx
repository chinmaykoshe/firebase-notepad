import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { 
  MAX_FILE_SIZE, 
  OVERALL_CLOUD_STORAGE_CAP, 
  formatBytes, 
  getOverallCloudUsage 
} from "../utils/cloudStorage.js";

const DRIVE_FOLDER = "drive";

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
  const [previewFile, setPreviewFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef(null);

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

  async function handleUpload(selectedFiles) {
    if (!selectedFiles || selectedFiles.length === 0) return;
    const fileList = Array.from(selectedFiles);

    // 1. Check individual file size limit (max 10 MB per file)
    for (const file of fileList) {
      if (file.size > MAX_FILE_SIZE) {
        onToast?.(`"${file.name}" is ${formatBytes(file.size)}. Max allowed size per file is 10 MB.`);
        return;
      }
    }

    // 2. Refresh usage & enforce strict 45 MB overall cloud data ceiling
    const latestUsage = await getOverallCloudUsage();
    const incomingBytes = fileList.reduce((acc, f) => acc + f.size, 0);

    if (latestUsage.totalCloudBytes + incomingBytes > OVERALL_CLOUD_STORAGE_CAP) {
      const currentUsed = formatBytes(latestUsage.totalCloudBytes);
      onToast?.(`Upload blocked! Total cloud data footprint would exceed the 45 MB limit (${currentUsed} currently used).`);
      return;
    }

    setUploading(true);
    let successCount = 0;

    for (const file of fileList) {
      try {
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const uniquePath = `${DRIVE_FOLDER}/${Date.now()}_${cleanName}`;
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
      onToast?.(`Uploaded ${successCount} file(s) to Cloud Drive!`);
      await refreshData();
    }
  }

  async function handleDelete(fileName) {
    if (!window.confirm(`Delete "${fileName}" permanently from Cloud Drive?`)) return;
    try {
      const { error } = await supabase.storage.from("images").remove([`${DRIVE_FOLDER}/${fileName}`]);
      if (error) throw error;
      onToast?.("File deleted from Cloud Drive.");
      setFiles(prev => prev.filter(f => f.name !== fileName));
      if (previewFile?.name === fileName) setPreviewFile(null);
      await refreshData();
    } catch (err) {
      console.error("Delete error:", err);
      onToast?.("Failed to delete file: " + err.message);
    }
  }

  function getFileUrl(fileName) {
    const { data } = supabase.storage.from("images").getPublicUrl(`${DRIVE_FOLDER}/${fileName}`);
    return data?.publicUrl || "";
  }

  function handleShare(fileName) {
    const url = getFileUrl(fileName);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      onToast?.("Shareable link copied to clipboard!");
    } else {
      prompt("Shareable file link:", url);
    }
  }

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
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
              Shareable cloud storage • Max 10 MB per file • <strong>Strict 45 MB total cloud limit</strong>
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
            onChange={(e) => handleUpload(e.target.files)} 
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

        {/* Breakdown of all cloud data */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-dim)", flexWrap: "wrap", gap: "6px" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <span>📁 Drive: <strong>{formatBytes(cloudUsage.driveFilesBytes)}</strong></span>
            <span>🖼️ Uploaded Media: <strong>{formatBytes(cloudUsage.rootMediaBytes)}</strong></span>
            <span>📝 Notes DB: <strong>{formatBytes(cloudUsage.dbNotesBytes)}</strong></span>
          </div>
          <span>Remaining: <strong style={{ color: "var(--text)" }}>{formatBytes(Math.max(0, OVERALL_CLOUD_STORAGE_CAP - overallUsedBytes))}</strong></span>
        </div>
      </section>

      {/* Drag & Drop Upload Zone */}
      <section 
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleUpload(e.dataTransfer.files);
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
            Drop files here to upload or <span style={{ color: "var(--accent)", textDecoration: "underline" }}>browse</span>
          </div>
          <div style={{ fontSize: "12px" }}>
            Max 10 MB per file • Overall cloud ceiling 45 MB • Instant public share links
          </div>
        </div>
      </section>

      {/* Files Filter & List */}
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
            Calculating overall cloud storage & loading Drive files...
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
            {filteredFiles.map((file) => {
              const fileUrl = getFileUrl(file.name);
              const isImg = file.metadata?.mimetype?.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name);
              const displayName = file.name.replace(/^\d+_/, "");

              return (
                <div
                  key={file.id || file.name}
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
                  {/* File Thumbnail or Icon Preview */}
                  <div 
                    onClick={() => setPreviewFile({ name: file.name, url: fileUrl, isImg, size: file.metadata?.size })}
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
                    {isImg ? (
                      <img 
                        src={fileUrl} 
                        alt={displayName} 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                        loading="lazy"
                      />
                    ) : (
                      <div style={{ color: "var(--accent)", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                        {getFileIcon(file.name)}
                        <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>
                          {file.name.split(".").pop()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Metadata & Name */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div 
                      title={displayName} 
                      style={{ 
                        fontWeight: 600, 
                        fontSize: "13px", 
                        overflow: "hidden", 
                        textOverflow: "ellipsis", 
                        whiteSpace: "nowrap" 
                      }}
                    >
                      {displayName}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px" }}>
                      {formatBytes(file.metadata?.size)} • {file.created_at ? new Date(file.created_at).toLocaleDateString() : ""}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: "flex", gap: "6px", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                    <button 
                      className="btn" 
                      title="Copy Share Link" 
                      onClick={() => handleShare(file.name)}
                      style={{ flex: 1, padding: "5px 8px", fontSize: "11px", background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3"/>
                        <circle cx="6" cy="12" r="3"/>
                        <circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                      Share
                    </button>
                    <a 
                      href={fileUrl} 
                      download={displayName} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn" 
                      title="Download"
                      style={{ padding: "5px 8px", fontSize: "11px", background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </a>
                    <button 
                      className="btn" 
                      title="Delete File" 
                      onClick={() => handleDelete(file.name)}
                      style={{ padding: "5px 8px", fontSize: "11px", background: "var(--bg)", color: "#ef4444", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

      {/* Preview Modal */}
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
                {previewFile.name.replace(/^\d+_/, "")}
              </strong>
              <div style={{ display: "flex", gap: "8px" }}>
                <button 
                  className="btn btn-primary"
                  onClick={() => handleShare(previewFile.name)}
                  style={{ padding: "4px 8px", fontSize: "12px" }}
                >
                  Copy Share Link
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
                  <a 
                    href={previewFile.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    download
                    className="btn btn-primary"
                    style={{ marginTop: "14px", display: "inline-block" }}
                  >
                    Download File ({formatBytes(previewFile.size)})
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
