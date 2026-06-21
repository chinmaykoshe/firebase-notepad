import { useEffect, useState, useRef } from "react";

const MIN_SIZE = 30;

// Corner handles only for mobile simplicity, all 8 on desktop
const ALL_HANDLES = [
  { id: "nw", cursor: "nwse-resize", top: 0, left: 0, xDir: -1, yDir: -1 },
  { id: "n",  cursor: "ns-resize",   top: 0, left: "50%", xDir: 0,  yDir: -1 },
  { id: "ne", cursor: "nesw-resize", top: 0, right: 0, xDir: 1,  yDir: -1 },
  { id: "e",  cursor: "ew-resize",   top: "50%", right: 0, xDir: 1,  yDir: 0  },
  { id: "se", cursor: "nwse-resize", bottom: 0, right: 0, xDir: 1,  yDir: 1  },
  { id: "s",  cursor: "ns-resize",   bottom: 0, left: "50%", xDir: 0, yDir: 1  },
  { id: "sw", cursor: "nesw-resize", bottom: 0, left: 0, xDir: -1, yDir: 1  },
  { id: "w",  cursor: "ew-resize",   top: "50%", left: 0, xDir: -1, yDir: 0  },
];

// Only corner + edge handles visible on mobile - bigger hit areas
const MOBILE_HANDLES = [
  { id: "nw", cursor: "nwse-resize", top: 0, left: 0, xDir: -1, yDir: -1 },
  { id: "ne", cursor: "nesw-resize", top: 0, right: 0, xDir: 1,  yDir: -1 },
  { id: "se", cursor: "nwse-resize", bottom: 0, right: 0, xDir: 1,  yDir: 1  },
  { id: "sw", cursor: "nesw-resize", bottom: 0, left: 0, xDir: -1, yDir: 1  },
];

const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

function getHandleStyle(handle, mobile) {
  const SIZE = mobile ? 22 : 12;
  const OFFSET = mobile ? -11 : -6;

  const style = {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    backgroundColor: "#1a73e8",
    border: mobile ? "3px solid #fff" : "2px solid #fff",
    borderRadius: mobile ? "50%" : "3px",
    cursor: handle.cursor,
    pointerEvents: "auto",
    boxShadow: "0 1px 6px rgba(0,0,0,0.45)",
    zIndex: 10,
    // Make touch hit area much larger with padding trick
    touchAction: "none",
  };

  // Position flush to edges with offset
  if (handle.top === 0)       style.top = OFFSET;
  if (handle.top === "50%")   { style.top = "50%"; style.marginTop = -SIZE/2; }
  if (handle.bottom === 0)    style.bottom = OFFSET;
  if (handle.left === 0)      style.left = OFFSET;
  if (handle.left === "50%")  { style.left = "50%"; style.marginLeft = -SIZE/2; }
  if (handle.right === 0)     style.right = OFFSET;

  return style;
}

export default function ImageResizer({ imgElement, containerRef, isEditing, onDeselect }) {
  const [rect, setRect] = useState(null);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [showPanel, setShowPanel] = useState(false);
  const [inputW, setInputW] = useState("");
  const [inputH, setInputH] = useState("");
  const [mobile, setMobile] = useState(false);
  const aspectRef = useRef(1);

  useEffect(() => {
    const checkMobile = () => setMobile(isMobile());
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const updateRect = () => {
    if (!imgElement || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const imgRect = imgElement.getBoundingClientRect();
    setRect({
      top: imgRect.top - containerRect.top,
      left: imgRect.left - containerRect.left,
      width: imgRect.width,
      height: imgRect.height,
    });
    const w = Math.round(imgRect.width);
    const h = Math.round(imgRect.height);
    setImgSize({ width: w, height: h });
    setInputW(String(w));
    setInputH(String(h));
    if (h > 0) aspectRef.current = imgRect.width / imgRect.height;
  };

  useEffect(() => {
    if (!imgElement || !containerRef.current || !isEditing) return;
    const scrollEl = containerRef.current.querySelector("#noteContent");
    updateRect();
    window.addEventListener("resize", updateRect);
    if (scrollEl) scrollEl.addEventListener("scroll", updateRect);
    const obs = new ResizeObserver(updateRect);
    obs.observe(imgElement);
    return () => {
      window.removeEventListener("resize", updateRect);
      if (scrollEl) scrollEl.removeEventListener("scroll", updateRect);
      obs.disconnect();
    };
  }, [imgElement, containerRef, isEditing]);

  const triggerInput = () => {
    const noteContent = containerRef.current?.querySelector("#noteContent");
    if (noteContent) noteContent.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const applySize = (w, h) => {
    imgElement.style.width = `${Math.max(MIN_SIZE, w)}px`;
    imgElement.style.height = `${Math.max(MIN_SIZE, h)}px`;
    imgElement.style.display = "inline-block";
    setTimeout(() => { updateRect(); triggerInput(); }, 0);
  };

  // ── Mouse drag ──────────────────────────────────────────────────────────────
  const handleMouseDown = (e, handle) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = imgElement.clientWidth;
    const startH = imgElement.clientHeight;
    const isCorner = handle.xDir !== 0 && handle.yDir !== 0;

    const onMove = (mv) => {
      const dx = mv.clientX - startX;
      const dy = mv.clientY - startY;
      let newW = handle.xDir !== 0 ? Math.max(MIN_SIZE, startW + dx * handle.xDir) : startW;
      let newH = handle.yDir !== 0 ? Math.max(MIN_SIZE, startH + dy * handle.yDir) : startH;
      if (isCorner) {
        const scale = Math.max(newW / startW, newH / startH);
        newW = Math.max(MIN_SIZE, startW * scale);
        newH = Math.max(MIN_SIZE, startH * scale);
      }
      imgElement.style.width = `${newW}px`;
      imgElement.style.height = (handle.yDir !== 0 || isCorner) ? `${newH}px` : "auto";
      updateRect();
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      triggerInput();
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ── Touch drag ──────────────────────────────────────────────────────────────
  const touchState = useRef({});

  const handleTouchStart = (e, handle) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    touchState.current = {
      handle,
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      startW: imgElement.clientWidth,
      startH: imgElement.clientHeight,
    };
  };

  const handleTouchMove = (e) => {
    const { handle, startX, startY, startW, startH } = touchState.current;
    if (!handle || e.touches.length !== 1) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    const isCorner = handle.xDir !== 0 && handle.yDir !== 0;
    let newW = handle.xDir !== 0 ? Math.max(MIN_SIZE, startW + dx * handle.xDir) : startW;
    let newH = handle.yDir !== 0 ? Math.max(MIN_SIZE, startH + dy * handle.yDir) : startH;
    if (isCorner) {
      const scale = Math.max(newW / startW, newH / startH);
      newW = Math.max(MIN_SIZE, startW * scale);
      newH = Math.max(MIN_SIZE, startH * scale);
    }
    imgElement.style.width = `${newW}px`;
    imgElement.style.height = (handle.yDir !== 0 || isCorner) ? `${newH}px` : "auto";
    updateRect();
  };

  const handleTouchEnd = () => {
    touchState.current = {};
    triggerInput();
  };

  // ── Exact size inputs ────────────────────────────────────────────────────────
  const handleWidthChange = (val) => {
    setInputW(val);
    const w = parseInt(val, 10);
    if (!isNaN(w) && w > 0) {
      const h = Math.round(w / aspectRef.current);
      applySize(w, h);
      setInputH(String(h));
    }
  };

  const handleHeightChange = (val) => {
    setInputH(val);
    const h = parseInt(val, 10);
    if (!isNaN(h) && h > 0) {
      const w = Math.round(h * aspectRef.current);
      applySize(w, h);
      setInputW(String(w));
    }
  };

  if (!rect || !isEditing) return null;

  const handles = mobile ? MOBILE_HANDLES : ALL_HANDLES;

  return (
    <>
      {/* Selection border + handles */}
      <div
        style={{
          position: "absolute",
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          outline: "2px solid #1a73e8",
          outlineOffset: "2px",
          pointerEvents: "none",
          zIndex: 100,
          boxSizing: "border-box",
        }}
      >
        {/* Resize handles */}
        {handles.map((handle) => (
          <div
            key={handle.id}
            style={getHandleStyle(handle, mobile)}
            onMouseDown={(e) => handleMouseDown(e, handle)}
            onTouchStart={(e) => handleTouchStart(e, handle)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        ))}

        {/* Floating toolbar above the image */}
        <div
          style={{
            position: "absolute",
            top: mobile ? -52 : -44,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 4,
            background: "var(--panel-bg)",
            border: "1px solid var(--input-border)",
            borderRadius: 8,
            padding: mobile ? "5px 10px" : "3px 8px",
            pointerEvents: "auto",
            whiteSpace: "nowrap",
            boxShadow: "0 3px 12px rgba(0,0,0,0.22)",
            zIndex: 20,
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: mobile ? "0.8rem" : "0.72rem", opacity: 0.65, marginRight: 6 }}>
            {imgSize.width} × {imgSize.height}
          </span>
          <button onClick={() => setShowPanel(v => !v)} style={toolbarBtnStyle(mobile, showPanel)}>
            {mobile ? "✎ Size" : "Size"}
          </button>
          <button
            onClick={() => { imgElement.style.width = "100%"; imgElement.style.height = "auto"; setTimeout(() => { updateRect(); triggerInput(); }, 0); }}
            style={toolbarBtnStyle(mobile)}
          >Full</button>
          <button
            onClick={() => { imgElement.style.width = ""; imgElement.style.height = ""; setTimeout(() => { updateRect(); triggerInput(); }, 0); }}
            style={toolbarBtnStyle(mobile)}
          >Reset</button>
          <button onClick={onDeselect} style={{ ...toolbarBtnStyle(mobile), color: "var(--danger-bg)" }}>✕</button>
        </div>

        {/* Size input panel — bottom sheet style on mobile */}
        {showPanel && (
          <div style={mobile ? mobilePanel : desktopPanel}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
              <label style={labelStyle(mobile)}>
                W (px)
                <input
                  type="number"
                  value={inputW}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  style={numInputStyle(mobile)}
                />
              </label>
              <span style={{ opacity: 0.4, fontSize: "1.1rem" }}>×</span>
              <label style={labelStyle(mobile)}>
                H (px)
                <input
                  type="number"
                  value={inputH}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  style={numInputStyle(mobile)}
                />
              </label>
            </div>
            {mobile && (
              <button onClick={() => setShowPanel(false)} style={{ ...toolbarBtnStyle(true), marginTop: 8, width: "100%" }}>
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function toolbarBtnStyle(mobile, active = false) {
  return {
    fontSize: mobile ? "0.85rem" : "0.72rem",
    padding: mobile ? "5px 12px" : "2px 8px",
    height: mobile ? 36 : "auto",
    minWidth: mobile ? 52 : "auto",
    border: "1px solid var(--input-border)",
    borderRadius: 5,
    background: active ? "var(--btn-bg)" : "var(--input-bg)",
    color: active ? "var(--btn-text)" : "var(--text-color)",
    cursor: "pointer",
    fontWeight: 600,
  };
}

function labelStyle(mobile) {
  return {
    fontSize: mobile ? "0.85rem" : "0.75rem",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    alignItems: "flex-start",
    fontWeight: 600,
  };
}

function numInputStyle(mobile) {
  return {
    width: mobile ? 90 : 70,
    padding: mobile ? "8px 10px" : "3px 6px",
    borderRadius: 5,
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--text-color)",
    fontSize: mobile ? "1rem" : "0.82rem",
  };
}

const desktopPanel = {
  position: "absolute",
  top: -108,
  left: "50%",
  transform: "translateX(-50%)",
  background: "var(--panel-bg)",
  border: "1px solid var(--input-border)",
  borderRadius: 8,
  padding: "10px 14px",
  pointerEvents: "auto",
  boxShadow: "0 3px 12px rgba(0,0,0,0.22)",
  zIndex: 30,
  whiteSpace: "nowrap",
};

const mobilePanel = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  background: "var(--panel-bg)",
  border: "1px solid var(--input-border)",
  borderTop: "2px solid var(--btn-bg)",
  borderRadius: "16px 16px 0 0",
  padding: "20px 24px 32px",
  pointerEvents: "auto",
  boxShadow: "0 -4px 24px rgba(0,0,0,0.28)",
  zIndex: 9000,
};
