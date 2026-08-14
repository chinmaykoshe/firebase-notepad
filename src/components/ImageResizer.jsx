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
    if (!imgElement || !imgElement.isConnected || !containerRef.current) {
      setRect(null);
      return;
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    const imgRect = imgElement.getBoundingClientRect();

    // Check if the image is within the visible bounds of the container
    const isVisible = !(
      imgRect.bottom < containerRect.top ||
      imgRect.top > containerRect.bottom ||
      imgRect.right < containerRect.left ||
      imgRect.left > containerRect.right
    );

    setRect({
      top: imgRect.top - containerRect.top,
      left: imgRect.left - containerRect.left,
      width: imgRect.width,
      height: imgRect.height,
      visible: isVisible,
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

    const onScrollOrResize = () => {
      requestAnimationFrame(updateRect);
    };

    updateRect();

    window.addEventListener("resize", onScrollOrResize, { passive: true });
    window.addEventListener("scroll", onScrollOrResize, { capture: true, passive: true });

    const obs = new ResizeObserver(onScrollOrResize);
    obs.observe(imgElement);
    if (containerRef.current) obs.observe(containerRef.current);

    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, { capture: true });
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

  if (!rect || !rect.visible || !isEditing) return null;

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

        {/* Floating toolbar above the image (or below if near top) */}
        <div
          style={{
            position: "absolute",
            top: rect.top < 55 ? "calc(100% + 8px)" : (mobile ? -50 : -42),
            left: rect.left < 140 ? 0 : "50%",
            transform: rect.left < 140 ? "none" : "translateX(-50%)",
            display: "flex",
            gap: 6,
            background: "var(--surface, #18181f)",
            border: "1px solid var(--border, #3a3a48)",
            borderRadius: 10,
            padding: mobile ? "6px 12px" : "4px 8px",
            pointerEvents: "auto",
            whiteSpace: "nowrap",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
            zIndex: 200,
            alignItems: "center",
          }}
        >
          <span style={{
            fontSize: mobile ? "12px" : "11px",
            fontWeight: "700",
            fontFamily: "monospace",
            background: "rgba(99, 102, 241, 0.18)",
            color: "#a5b4fc",
            border: "1px solid rgba(99, 102, 241, 0.35)",
            padding: "2px 7px",
            borderRadius: "5px",
            display: "inline-flex",
            alignItems: "center",
          }}>
            {imgSize.width} × {imgSize.height}
          </span>
          
          <button onClick={() => setShowPanel(v => !v)} style={toolbarBtnStyle(mobile, showPanel)}>
            {mobile ? "✎ Size" : "Size"}
          </button>
          
          <button
            onClick={() => { imgElement.style.width = "100%"; imgElement.style.height = "auto"; setTimeout(() => { updateRect(); triggerInput(); }, 0); }}
            style={toolbarBtnStyle(mobile)}
          >
            Full
          </button>
          
          <button
            onClick={() => { imgElement.style.width = ""; imgElement.style.height = ""; setTimeout(() => { updateRect(); triggerInput(); }, 0); }}
            style={toolbarBtnStyle(mobile)}
          >
            Reset
          </button>
          
          <button
            title="Download Image"
            onClick={() => {
              const a = document.createElement("a");
              a.href = imgElement.src;
              a.download = `image_${Date.now()}.png`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}
            style={{ ...toolbarBtnStyle(mobile), display: "flex", alignItems: "center", gap: 4 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            {!mobile && "Download"}
          </button>
          
          <button onClick={onDeselect} style={{ ...toolbarBtnStyle(mobile), color: "#ef4444", padding: mobile ? "6px 10px" : "3px 7px" }}>
            ✕
          </button>
        </div>

        {/* Size input panel — bottom sheet style on mobile */}
        {showPanel && (
          <div style={mobile ? mobilePanel : desktopPanel(rect)}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
              <label style={labelStyle(mobile)}>
                <span>Width (px)</span>
                <input
                  type="number"
                  value={inputW}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  style={numInputStyle(mobile)}
                />
              </label>
              <span style={{ opacity: 0.5, fontSize: "1.2rem", fontWeight: "bold" }}>×</span>
              <label style={labelStyle(mobile)}>
                <span>Height (px)</span>
                <input
                  type="number"
                  value={inputH}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  style={numInputStyle(mobile)}
                />
              </label>
            </div>
            {mobile && (
              <button onClick={() => setShowPanel(false)} style={{ ...toolbarBtnStyle(true, true), marginTop: 12, width: "100%" }}>
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
    fontSize: mobile ? "0.85rem" : "0.75rem",
    padding: mobile ? "6px 12px" : "3px 9px",
    height: mobile ? 36 : "auto",
    minWidth: mobile ? 52 : "auto",
    border: "1px solid var(--border, #2a2a38)",
    borderRadius: 6,
    background: active ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "var(--surface2, #1e1e27)",
    color: active ? "#ffffff" : "var(--text, #f0f0f8)",
    cursor: "pointer",
    fontWeight: 600,
    transition: "all 0.15s ease",
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
    color: "var(--text)",
  };
}

function numInputStyle(mobile) {
  return {
    width: mobile ? 90 : 75,
    padding: mobile ? "8px 10px" : "4px 8px",
    borderRadius: 6,
    border: "1px solid var(--border, #2a2a38)",
    background: "var(--bg, #0f0f14)",
    color: "var(--text, #f0f0f8)",
    fontSize: mobile ? "1rem" : "0.85rem",
    outline: "none",
  };
}

const desktopPanel = (rect) => ({
  position: "absolute",
  top: rect.top < 110 ? "calc(100% + 52px)" : -100,
  left: rect.left < 140 ? 0 : "50%",
  transform: rect.left < 140 ? "none" : "translateX(-50%)",
  background: "var(--surface, #18181f)",
  border: "1px solid var(--border, #3a3a48)",
  borderRadius: 12,
  padding: "12px 16px",
  pointerEvents: "auto",
  boxShadow: "0 12px 36px rgba(0,0,0,0.6)",
  zIndex: 220,
  whiteSpace: "nowrap",
});

const mobilePanel = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  background: "var(--surface, #18181f)",
  border: "1px solid var(--border, #3a3a48)",
  borderTop: "2px solid #6366f1",
  borderRadius: "16px 16px 0 0",
  padding: "20px 24px 32px",
  pointerEvents: "auto",
  boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
  zIndex: 9000,
};
