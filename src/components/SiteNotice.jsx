import { useEffect, useState } from "react";

const CONSENT_KEY = "cookie_consent_v1";

export default function SiteNotice({ onOpenLegal }) {
  const [show, setShow] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) {
        setShow(true);
      }
    } catch {
      // localStorage unavailable (e.g. private mode with strict settings)
    }
  }, []);

  const handleAccept = () => {
    if (!agreed) return;
    try {
      localStorage.setItem(CONSENT_KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "16px 20px",
      zIndex: 9999,
      width: "min(92vw, 580px)",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      boxShadow: "var(--shadow-lg)"
    }}>
      <p style={{ margin: 0, fontSize: "13px", color: "var(--text-dim)", lineHeight: 1.5 }}>
        This site uses cookies and local storage to save your preferences, ensure security, and provide the best experience. By continuing to use this site, you acknowledge that you have read and understood our policies.
      </p>
      
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text)", cursor: "pointer", userSelect: "none" }}>
          <input 
            type="checkbox" 
            checked={agreed} 
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ cursor: "pointer" }}
          />
          I agree to the <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenLegal?.(); }} style={{ color: "var(--accent)", textDecoration: "underline" }}>Privacy Policy & Terms of Service</span>
        </label>

        <button
          onClick={handleAccept}
          disabled={!agreed}
          style={{
            flexShrink: 0,
            padding: "8px 16px",
            borderRadius: "var(--radius)",
            border: "none",
            background: agreed ? "var(--text)" : "var(--surface2)",
            color: agreed ? "var(--bg)" : "var(--text-dim)",
            fontSize: "13px",
            fontWeight: 600,
            cursor: agreed ? "pointer" : "not-allowed",
            fontFamily: "var(--font)",
            whiteSpace: "nowrap",
            transition: "all 0.2s"
          }}
        >
          Accept & Continue
        </button>
      </div>
    </div>
  );
}
