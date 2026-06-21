import { useEffect, useState } from "react";

export default function ImageResizer({ imgElement, containerRef, isEditing }) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!imgElement || !containerRef.current || !isEditing) return;

    const scrollContainer = containerRef.current.querySelector("#noteContent");

    const updateRect = () => {
      if (!scrollContainer) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const imgRect = imgElement.getBoundingClientRect();
      
      setRect({
        top: imgRect.top - containerRect.top,
        left: imgRect.left - containerRect.left,
        width: imgRect.width,
        height: imgRect.height
      });
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", updateRect);
    }
    
    const observer = new ResizeObserver(updateRect);
    observer.observe(imgElement);

    return () => {
      window.removeEventListener("resize", updateRect);
      if (scrollContainer) scrollContainer.removeEventListener("scroll", updateRect);
      observer.disconnect();
    };
  }, [imgElement, containerRef, isEditing]);

  if (!rect || !isEditing) return null;

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = imgElement.clientWidth;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(20, startWidth + deltaX);
      imgElement.style.width = `${newWidth}px`;
      imgElement.style.height = "auto";
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      // Trigger input event so App.jsx saves the new width
      const inputEvent = new Event('input', { bubbles: true });
      if (containerRef.current) {
        const noteContent = containerRef.current.querySelector("#noteContent");
        if (noteContent) noteContent.dispatchEvent(inputEvent);
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      style={{
        position: "absolute",
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        border: "2px solid #1a73e8",
        pointerEvents: "none",
        zIndex: 100
      }}
    >
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: "absolute",
          right: -6,
          bottom: -6,
          width: 12,
          height: 12,
          backgroundColor: "#1a73e8",
          cursor: "nwse-resize",
          pointerEvents: "auto",
          borderRadius: "50%",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
        }}
        title="Drag to resize"
      />
    </div>
  );
}
