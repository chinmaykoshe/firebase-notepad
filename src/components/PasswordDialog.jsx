function PasswordDialog({ passwordDialog, value, onValueChange, onCancel, onSubmit }) {
  return (
    <>
      <div className={`dialog-overlay ${passwordDialog.open ? "show" : ""}`} onClick={onCancel} />
      <div className={`password-dialog ${passwordDialog.open ? "show" : ""}`} role="dialog" aria-modal="true">
        <h3>{passwordDialog.title}</h3>
        <div className="author-info">{passwordDialog.authorText}</div>
        <input
          type="password"
          value={value}
          placeholder="Enter password"
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSubmit();
            if (event.key === "Escape") onCancel();
          }}
          autoFocus={passwordDialog.open}
        />
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
