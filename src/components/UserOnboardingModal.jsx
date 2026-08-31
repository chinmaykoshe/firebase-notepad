import React, { useState } from "react";

export default function UserOnboardingModal({ isOpen, initialUsername, onSave }) {
  const [name, setName] = useState(initialUsername || `User_${Math.floor(1000 + Math.random() * 9000)}`);

  if (!isOpen) return null;

  const handleRandomize = () => {
    setName(`User_${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const finalName = name.trim() || initialUsername || "User";
    onSave(finalName);
  };

  return (
    <>
      <div className="dialog-overlay show" style={{ zIndex: 10000, backdropFilter: "blur(4px)" }} />
      <div 
        className="dialog-box show" 
        style={{ 
          zIndex: 10001, 
          width: "min(92vw, 440px)",
          padding: "24px",
          borderRadius: "var(--r-lg, 16px)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          animation: "scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
        role="dialog"
        aria-modal="true"
      >
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ 
            fontSize: "36px", 
            marginBottom: "12px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "var(--surface2)",
            boxShadow: "var(--shadow-xs)"
          }}>
            👋
          </div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 6px 0", color: "var(--text)" }}>
            Let's get started!
          </h2>
          <p style={{ margin: 0, fontSize: "13.5px", color: "var(--text-dim)", lineHeight: 1.45 }}>
            Choose a display name for your notes. You can continue with the assigned name below or customize it directly.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ position: "relative" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-dim)", marginBottom: "6px" }}>
              Your Name
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={name}
                maxLength={25}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name..."
                autoFocus
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  fontSize: "14px",
                  fontWeight: 600,
                  borderRadius: "var(--r-sm)",
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--text)",
                  outline: "none"
                }}
              />
              <button
                type="button"
                onClick={handleRandomize}
                title="Generate another random name"
                style={{
                  padding: "0 12px",
                  borderRadius: "var(--r-sm)",
                  border: "1px solid var(--border)",
                  background: "var(--surface2)",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                🎲
              </button>
            </div>
            <span style={{ display: "block", fontSize: "11.5px", color: "var(--text-xs)", marginTop: "5px" }}>
              You can always change this anytime from the sidebar.
            </span>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: "11px 16px",
                borderRadius: "var(--r-sm)",
                border: "none",
                background: "var(--accent)",
                color: "var(--surface)",
                fontSize: "13.5px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "var(--shadow-sm)",
                transition: "transform 0.15s, opacity 0.15s"
              }}
            >
              Continue with "{name || 'User'}" →
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
