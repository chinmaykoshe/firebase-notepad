export default function LegalDialog({ isOpen, type, onClose }) {
  if (!isOpen) return null;

  const content = type === "privacy" ? (
    <>
      <h3>Privacy Policy</h3>
      <p>Your privacy is important to us. It is our policy to respect your privacy regarding any information we may collect from you across our website. We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent.</p>
      <p>We only retain collected information for as long as necessary to provide you with your requested service. What data we store, we'll protect within commercially acceptable means to prevent loss and theft, as well as unauthorized access, disclosure, copying, use or modification.</p>
    </>
  ) : (
    <>
      <h3>Terms & Conditions</h3>
      <p>By accessing this website, you are agreeing to be bound by these website Terms and Conditions of Use, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws. If you do not agree with any of these terms, you are prohibited from using or accessing this site.</p>
      <p>The materials contained in this website are protected by applicable copyright and trademark law. Permission is granted to temporarily download one copy of the materials for personal, non-commercial transitory viewing only.</p>
    </>
  );

  return (
    <>
      <div className="dialog-overlay show" onClick={onClose} />
      <div className="dialog-box show" style={{ width: "min(90vw, 600px)" }} role="dialog">
        <div className="dialog-header">
          <h3>{type === "privacy" ? "Privacy Policy" : "Terms & Conditions"}</h3>
        </div>
        <div className="dialog-body" style={{ maxHeight: "60vh", overflowY: "auto", fontSize: "0.95rem" }}>
          {content}
        </div>
        <div className="dialog-footer">
          <button className="dialog-btn confirm-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}
