import React, { useRef, useState, useEffect } from 'react';

function DrawingPad({ onCancel, onInsert }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(3);

  // Initialize canvas size based on container
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Set actual internal canvas resolution to match display size
    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      // Only resize if it's the first time to preserve drawing
      if (canvas.width === 0 || canvas.width === 300) { // default 300
        canvas.width = rect.width;
        canvas.height = rect.height;
        // Fill white background
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Support both mouse and touch events
    let clientX = e.clientX;
    let clientY = e.clientY;
    
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    
    // Calculate scale in case actual canvas size differs from display size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault(); // Prevent scrolling on touch
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    e.preventDefault(); // Prevent scrolling on touch
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleInsert = () => {
    const canvas = canvasRef.current;
    canvas.toBlob((blob) => {
      if (blob) {
        // Create a File object from the blob
        const file = new File([blob], `drawing_${Date.now()}.png`, { type: "image/png" });
        onInsert([file]);
      }
    }, 'image/png');
  };

  return (
    <>
      <div className="dialog-overlay show" onClick={onCancel} />
      <div className="dialog-box show drawing-dialog" role="dialog" aria-modal="true" style={{ maxWidth: '800px', width: '90vw', height: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="dialog-header">
          <h3>Drawing Pad</h3>
          <button className="icon-btn" onClick={onCancel}>✕</button>
        </div>
        
        <div className="drawing-toolbar" style={{ display: 'flex', gap: '10px', padding: '10px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
          <input 
            type="color" 
            value={color} 
            onChange={(e) => setColor(e.target.value)} 
            style={{ width: '40px', height: '30px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            title="Color"
          />
          
          <div style={{ display: 'flex', gap: '5px' }}>
            {[
              { id: 'thin', width: 2, label: 'Thin' },
              { id: 'normal', width: 5, label: 'Normal' },
              { id: 'thick', width: 10, label: 'Thick' }
            ].map(pen => (
              <button 
                key={pen.id}
                type="button"
                className={`btn ${lineWidth === pen.width ? 'active' : ''}`}
                onClick={() => setLineWidth(pen.width)}
                style={{ 
                  background: lineWidth === pen.width ? 'var(--primary)' : 'var(--surface)',
                  color: lineWidth === pen.width ? 'white' : 'var(--text)'
                }}
                title={pen.label}
              >
                <div style={{ width: '16px', height: `${pen.width}px`, background: 'currentColor', borderRadius: '10px' }} />
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />
          
          <button type="button" className="btn" onClick={clearCanvas} style={{ background: 'var(--surface)', color: 'var(--text)' }}>
            Clear
          </button>
        </div>

        <div 
          className="canvas-container" 
          ref={containerRef}
          style={{ flex: 1, backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', cursor: 'crosshair', touchAction: 'none' }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            onTouchCancel={stopDrawing}
            style={{ display: 'block', width: '100%', height: '100%' }}
          />
        </div>

        <div className="dialog-footer" style={{ marginTop: '0', padding: '15px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border)' }}>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={handleInsert} style={{ background: "var(--primary)", color: "white", fontWeight: "bold" }}>
            Insert Drawing
          </button>
        </div>
      </div>
    </>
  );
}

export default DrawingPad;
