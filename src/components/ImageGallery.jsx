import React, { useState } from 'react';

function ImageGallery({ images, onHome }) {
  const [fullscreenImage, setFullscreenImage] = useState(null);

  return (
    <main id="main" className="gallery-main" style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexShrink: 0 }}>
        <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          Public Gallery
        </h2>
        <button className="btn" onClick={onHome} style={{ background: "var(--surface)", color: "var(--text)" }}>
          Back to Notes
        </button>
      </header>

      {images.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", flexDirection: "column", gap: "10px" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          <p>No public images found.</p>
        </div>
      ) : (
        <div className="gallery-grid" style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "15px",
          alignItems: "start"
        }}>
          {images.map((src, index) => (
            <div 
              key={index} 
              style={{ 
                borderRadius: "var(--r-md)", 
                overflow: "hidden", 
                backgroundColor: "var(--surface)",
                boxShadow: "var(--shadow-sm)",
                cursor: "pointer",
                transition: "transform 0.2s ease",
                aspectRatio: "1 / 1"
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.03)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              onClick={() => setFullscreenImage(src)}
            >
              <img 
                src={src} 
                alt={`Public uploaded image ${index + 1}`} 
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} 
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Image Modal */}
      {fullscreenImage && (
        <div 
          className="dialog-overlay show" 
          onClick={() => setFullscreenImage(null)}
          style={{ zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
        >
          <div 
            style={{ position: "relative", maxWidth: "100%", maxHeight: "100%" }}
            onClick={(e) => e.stopPropagation()} // prevent closing when clicking the image
          >
            <img 
              src={fullscreenImage} 
              alt="Fullscreen view" 
              style={{ maxWidth: "100%", maxHeight: "90vh", display: "block", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-lg)" }} 
            />
            <button 
              className="icon-btn" 
              title="Close"
              onClick={() => setFullscreenImage(null)}
              style={{ position: "absolute", top: "-40px", right: "0", color: "white", background: "rgba(0,0,0,0.5)" }}
            >
              ✕
            </button>
            <button 
              className="icon-btn" 
              title="Download Image"
              onClick={() => {
                const a = document.createElement("a");
                a.href = fullscreenImage;
                a.download = `downloaded_image_${Date.now()}.png`; // Supabase storage sets content-disposition
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
              style={{ position: "absolute", top: "-40px", right: "40px", color: "white", background: "rgba(0,0,0,0.5)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default ImageGallery;
