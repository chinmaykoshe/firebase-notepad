import { useEffect, useState } from "react";

const CONSENT_KEY = "cookie_consent_v1";

export default function CookieConsent() {
  const [show, setShow] = useState(false);

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
      padding: "12px 20px",
      zIndex: 9999,
      width: "min(92vw, 560px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "16px",
    }}>
      <p style={{ margin: 0, fontSize: "13px", color: "var(--text-dim)", lineHeight: 1.5 }}>
        This site uses local storage to save your theme preference.
      </p>
      <button
        onClick={handleAccept}
        style={{
          flexShrink: 0,
          padding: "6px 14px",
          borderRadius: "var(--radius)",
          border: "none",
          background: "var(--text)",
          color: "var(--bg)",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "var(--font)",
          whiteSpace: "nowrap",
        }}
      >
        Got it
      </button>
    </div>
  );
}
