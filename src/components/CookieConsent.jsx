import { useEffect, useState } from "react";
import "./CookieConsent.css";

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      setShow(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "true");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="cookie-consent">
      <div className="cookie-content">
        <p>
          We use cookies and local storage to ensure you get the best experience on our website, such as remembering your theme preferences.
        </p>
        <button className="btn confirm-btn" onClick={handleAccept}>Got it!</button>
      </div>
    </div>
  );
}
