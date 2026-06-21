function CustomDialog({ dialog, onCancel, onConfirm, onChange }) {
  const isOpen = dialog.open;

  return (
    <>
      <div
        className={`dialog-overlay ${isOpen ? "show" : ""}`}
        onClick={dialog.mode === "alert" ? onConfirm : onCancel}
      />
      <div className={`dialog-box ${isOpen ? "show" : ""}`} role="dialog" aria-modal="true">
        <div className="dialog-header">
          <h3>{dialog.title}</h3>
        </div>
        <div className="dialog-body">
          {dialog.kind === "table" ? (
            <div className="table-dialog-fields">
              <label>
                Rows
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={dialog.rows}
                  onChange={(event) => onChange({ rows: event.target.value })}
                />
              </label>
              <span>x</span>
              <label>
                Columns
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={dialog.cols}
                  onChange={(event) => onChange({ cols: event.target.value })}
                />
              </label>
            </div>
          ) : (
            <p>{dialog.message}</p>
          )}
        </div>
        <div className="dialog-footer">
          {dialog.mode !== "alert" && (
            <button className="dialog-btn cancel-btn" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button className={`dialog-btn confirm-btn ${dialog.type || ""}`} onClick={onConfirm}>
            {dialog.confirmText || "OK"}
          </button>
        </div>
      </div>
    </>
  );
}

export default CustomDialog;
