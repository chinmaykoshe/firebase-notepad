import { useState } from "react";

function PasswordDialog({ passwordDialog, value, onValueChange, onCancel, onSubmit }) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <>
      <div className={`dialog-overlay ${passwordDialog.open ? "show" : ""}`} onClick={onCancel} />
      <div className={`password-dialog ${passwordDialog.open ? "show" : ""}`} role="dialog" aria-modal="true">
        <h3>{passwordDialog.title}</h3>
        <div className="author-info">{passwordDialog.authorText}</div>
        <div style={{ position: "relative", marginBottom: "15px" }}>
          <input
            type={showPassword ? "text" : "password"}
            value={value}
            placeholder="Enter password"
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSubmit();
              if (event.key === "Escape") onCancel();
            }}
            autoFocus={passwordDialog.open}
            style={{ paddingRight: "30px", marginBottom: 0 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", opacity: 0.6,
              padding: 0, display: "flex", alignItems: "center", justifyContent: "center"
            }}
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            )}
          </button>
        </div>
        <div className="dialog-buttons">
          <button className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-submit" onClick={onSubmit}>
            {passwordDialog.submitText}
          </button>
        </div>
      </div>
    </>
  );
}

export default PasswordDialog;
