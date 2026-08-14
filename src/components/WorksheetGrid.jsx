import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import "./WorksheetGrid.css";

// ─── HELPERS ────────────────────────────────────────────────────────────
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function getColumnLabel(index) {
  let label = "";
  let i = index;
  while (i >= 0) {
    label = ALPHABET[i % 26] + label;
    i = Math.floor(i / 26) - 1;
  }
  return label;
}

function parseCellReference(ref) {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const colStr = match[1];
  let c = 0;
  for (let i = 0; i < colStr.length; i++) {
    c = c * 26 + (colStr.charCodeAt(i) - 64);
  }
  return { r: parseInt(match[2], 10) - 1, c: c - 1 };
}

function evaluateFormula(formula, getCellValue) {
  if (!formula || !formula.toString().startsWith("=")) return formula;
  let expr = formula.substring(1).toUpperCase();

  // 1. Expand ranges A1:B2 -> A1, A2, B1, B2
  expr = expr.replace(/([A-Z]+\d+):([A-Z]+\d+)/g, (match, startRef, endRef) => {
    const s = parseCellReference(startRef);
    const e = parseCellReference(endRef);
    if (!s || !e) return match;
    const cells = [];
    for (let r = Math.min(s.r, e.r); r <= Math.max(s.r, e.r); r++) {
      for (let c = Math.min(s.c, e.c); c <= Math.max(s.c, e.c); c++) {
        cells.push(getColumnLabel(c) + (r + 1));
      }
    }
    return cells.join(",");
  });

  // 2. Replace references with values
  expr = expr.replace(/[A-Z]+\d+/g, (match) => {
    const cell = parseCellReference(match);
    if (!cell) return 0;
    const val = getCellValue(cell.r, cell.c);
    if (val === "") return 0;
    const num = parseFloat(val);
    return isNaN(num) ? `"${val.replace(/"/g, '\\"')}"` : num;
  });

  try {
    const mathContext = {
      SUM: (...args) => args.reduce((a, b) => (parseFloat(a) || 0) + (parseFloat(b) || 0), 0),
      AVERAGE: (...args) => args.length ? args.reduce((a, b) => (parseFloat(a) || 0) + (parseFloat(b) || 0), 0) / args.length : 0,
      MIN: (...args) => Math.min(...args.map(a => parseFloat(a) || 0)),
      MAX: (...args) => Math.max(...args.map(a => parseFloat(a) || 0)),
      COUNT: (...args) => args.filter(a => a !== "" && a !== null).length,
    };
    const keys = Object.keys(mathContext);
    const values = Object.values(mathContext);
    const func = new Function(...keys, `return ${expr}`);
    const result = func(...values);
    return (isNaN(result) && typeof result !== 'string') || !isFinite(result) ? "#ERROR!" : result;
  } catch (err) {
    return "#ERROR!";
  }
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────
export default function WorksheetGrid({ data, onChange }) {
  const minRows = 40;
  const minCols = 15;

  // Transform data (string[][] or object[][]) into { value, formula }[][]
  const getInitialData = useCallback(() => {
    let grid = data || [];
    if (!Array.isArray(grid)) grid = [];
    let rows = Math.max(grid.length, minRows);
    let cols = Math.max(grid[0]?.length || 0, minCols);
    for (let r = 0; r < grid.length; r++) {
      if (Array.isArray(grid[r])) cols = Math.max(cols, grid[r].length);
    }
    
    const padded = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const cell = grid[r]?.[c];
        if (typeof cell === "object" && cell !== null) {
          row.push({ value: cell.value || "", formula: cell.formula || null });
        } else {
          row.push({ value: cell || "", formula: null });
        }
      }
      padded.push(row);
    }
    return padded;
  }, [data]);

  const [gridData, setGridData] = useState(() => getInitialData());
  const [computedGrid, setComputedGrid] = useState([]);

  const [activeCell, setActiveCell] = useState({ r: 0, c: 0 });
  const [selection, setSelection] = useState({ start: { r: 0, c: 0 }, end: { r: 0, c: 0 } });
  const [editingCell, setEditingCell] = useState(null); // { r, c, overwrite: boolean }
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, r, c }
  
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Compute values whenever gridData changes
  useEffect(() => {
    const getCellValue = (r, c) => gridData[r]?.[c]?.value || "";
    // Note: a real engine would build a dependency graph. 
    // For simplicity, we just do a 2-pass evaluate.
    let currentGrid = gridData.map(row => row.map(cell => ({ ...cell, computed: cell.value })));
    for (let pass = 0; pass < 2; pass++) {
      const getComputed = (r, c) => currentGrid[r]?.[c]?.computed || "";
      for (let r = 0; r < currentGrid.length; r++) {
        for (let c = 0; c < currentGrid[r].length; c++) {
          const cell = currentGrid[r][c];
          if (cell.formula && cell.formula.startsWith("=")) {
             cell.computed = evaluateFormula(cell.formula, getComputed);
          } else {
             cell.computed = cell.value;
          }
        }
      }
    }
    setComputedGrid(currentGrid);
  }, [gridData]);

  const updateCell = (r, c, newValue, newFormula = null) => {
    const newData = [...gridData];
    newData[r] = [...newData[r]];
    
    // Auto-detect formulas
    let formula = newFormula;
    let value = newValue;
    if (typeof newValue === "string" && newValue.startsWith("=")) {
      formula = newValue;
      value = ""; // Computed later
    } else if (formula === null) {
      formula = null; // Clear formula if just typing value
    }

    newData[r][c] = { value, formula };
    setGridData(newData);
    if (onChange) onChange(newData);
  };

  const getRangeName = () => {
    const r1 = Math.min(selection.start.r, selection.end.r);
    const r2 = Math.max(selection.start.r, selection.end.r);
    const c1 = Math.min(selection.start.c, selection.end.c);
    const c2 = Math.max(selection.start.c, selection.end.c);
    
    if (r1 === r2 && c1 === c2) return `${getColumnLabel(c1)}${r1 + 1}`;
    
    // Check if full row or full col
    if (c1 === 0 && c2 === gridData[0].length - 1) return `${r1 + 1}:${r2 + 1}`;
    if (r1 === 0 && r2 === gridData.length - 1) return `${getColumnLabel(c1)}:${getColumnLabel(c2)}`;
    
    return `${getColumnLabel(c1)}${r1 + 1}:${getColumnLabel(c2)}${r2 + 1}`;
  };

  const handleMouseDown = (e, r, c) => {
    if (e.button !== 0) return; // Only left click
    if (editingCell) {
      // If clicking same cell, do nothing. Else, commit and exit edit mode.
      if (editingCell.r !== r || editingCell.c !== c) {
        setEditingCell(null);
      } else {
        return;
      }
    }
    
    let start = { r, c };
    let end = { r, c };
    
    // Header clicks
    if (r === -1 && c === -1) {
      // Select all
      start = { r: 0, c: 0 };
      end = { r: gridData.length - 1, c: gridData[0].length - 1 };
    } else if (r === -1) {
      // Col header
      start = { r: 0, c };
      end = { r: gridData.length - 1, c };
    } else if (c === -1) {
      // Row header
      start = { r, c: 0 };
      end = { r, c: gridData[0].length - 1 };
    }

    if (e.shiftKey) {
      setSelection(prev => ({ start: prev.start, end }));
    } else {
      setActiveCell({ r: Math.max(0, start.r), c: Math.max(0, start.c) });
      setSelection({ start, end });
    }
    setIsDragging(true);
    setContextMenu(null);
  };

  const handleMouseEnter = (r, c) => {
    if (!isDragging) return;
    
    let end = { r: Math.max(0, r), c: Math.max(0, c) };
    
    // If dragging a full row/col
    if (selection.start.r === 0 && selection.start.c === 0 && selection.end.c === gridData[0].length - 1 && r === -1 && c === -1) {
      // selecting all, do nothing
    } else if (selection.start.r === 0 && selection.end.r === gridData.length - 1 && r === -1) {
      // Dragging col headers
      end = { r: gridData.length - 1, c };
    } else if (selection.start.c === 0 && selection.end.c === gridData[0].length - 1 && c === -1) {
      // Dragging row headers
      end = { r, c: gridData[0].length - 1 };
    }
    
    setSelection(prev => ({ start: prev.start, end }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    containerRef.current?.focus();
  };

  // Handle global mouse events for drag-scrolling outside the grid
  useEffect(() => {
    if (!isDragging) return;

    let rafId;
    let lastX = 0;
    let lastY = 0;

    const handleGlobalMouseMove = (e) => {
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    const checkScrollAndSelect = () => {
      const container = containerRef.current;
      if (!container || !isDragging) return;

      const rect = container.getBoundingClientRect();
      const margin = 40;
      let dx = 0;
      let dy = 0;

      if (lastX < rect.left + margin) dx = -15;
      else if (lastX > rect.right - margin) dx = 15;

      if (lastY < rect.top + margin) dy = -15;
      else if (lastY > rect.bottom - margin) dy = 15;

      if (dx !== 0 || dy !== 0) {
        container.scrollLeft += dx;
        container.scrollTop += dy;

        // Find which cell is under the mouse
        const el = document.elementFromPoint(lastX, lastY);
        const cell = el?.closest('td, th');
        if (cell) {
          const r = parseInt(cell.dataset.r);
          const c = parseInt(cell.dataset.c);
          if (!isNaN(r) && !isNaN(c)) {
            let end = { r: Math.max(0, r), c: Math.max(0, c) };
            // Adjust for full row/col selections if needed, simplified here
            if (selection.start.r === 0 && selection.end.r === gridData.length - 1 && r === -1) end = { r: gridData.length - 1, c };
            else if (selection.start.c === 0 && selection.end.c === gridData[0].length - 1 && c === -1) end = { r, c: gridData[0].length - 1 };
            
            setSelection(prev => ({ start: prev.start, end }));
          }
        }
      }

      rafId = requestAnimationFrame(checkScrollAndSelect);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    rafId = requestAnimationFrame(checkScrollAndSelect);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      cancelAnimationFrame(rafId);
    };
  }, [isDragging, selection.start.r, selection.start.c, selection.end.r, selection.end.c, gridData.length]);

  const handleKeyDown = (e) => {
    if (editingCell) {
      if (e.key === "Enter") {
        e.preventDefault();
        setEditingCell(null);
        const shift = e.shiftKey ? -1 : 1;
        const newR = Math.max(0, Math.min(activeCell.r + shift, gridData.length - 1));
        setActiveCell({ r: newR, c: activeCell.c });
        setSelection({ start: { r: newR, c: activeCell.c }, end: { r: newR, c: activeCell.c } });
        containerRef.current?.focus();
      } else if (e.key === "Escape") {
        setEditingCell(null);
        containerRef.current?.focus();
      } else if (e.key === "Tab") {
        e.preventDefault();
        setEditingCell(null);
        const shift = e.shiftKey ? -1 : 1;
        const newC = Math.max(0, Math.min(activeCell.c + shift, gridData[0].length - 1));
        setActiveCell({ r: activeCell.r, c: newC });
        setSelection({ start: { r: activeCell.r, c: newC }, end: { r: activeCell.r, c: newC } });
        containerRef.current?.focus();
      }
      return;
    }

    const { r, c } = activeCell;
    const maxR = gridData.length - 1;
    const maxC = gridData[0].length - 1;

    let nr = r, nc = c;
    
    if (e.key === "ArrowUp") nr = Math.max(0, r - 1);
    else if (e.key === "ArrowDown") nr = Math.min(maxR, r + 1);
    else if (e.key === "ArrowLeft") nc = Math.max(0, c - 1);
    else if (e.key === "ArrowRight") nc = Math.min(maxC, c + 1);
    else if (e.key === "Tab") { e.preventDefault(); nc = e.shiftKey ? Math.max(0, c - 1) : Math.min(maxC, c + 1); }
    else if (e.key === "Enter") { e.preventDefault(); nr = e.shiftKey ? Math.max(0, r - 1) : Math.min(maxR, r + 1); }
    
    if (nr !== r || nc !== c) {
      if (e.key.startsWith("Arrow") || e.key === "Tab" || e.key === "Enter") e.preventDefault();
      
      if (e.shiftKey && e.key.startsWith("Arrow")) {
        // Expand selection
        let er = selection.end.r;
        let ec = selection.end.c;
        if (e.key === "ArrowUp") er = Math.max(0, er - 1);
        if (e.key === "ArrowDown") er = Math.min(maxR, er + 1);
        if (e.key === "ArrowLeft") ec = Math.max(0, ec - 1);
        if (e.key === "ArrowRight") ec = Math.min(maxC, ec + 1);
        setSelection(prev => ({ start: prev.start, end: { r: er, c: ec } }));
      } else {
        setActiveCell({ r: nr, c: nc });
        setSelection({ start: { r: nr, c: nc }, end: { r: nr, c: nc } });
      }
      return;
    }

    if (e.key === "F2") {
      e.preventDefault();
      setEditingCell({ r, c, overwrite: false });
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      const newData = [...gridData];
      let changed = false;
      const minR = Math.min(selection.start.r, selection.end.r);
      const maxR = Math.max(selection.start.r, selection.end.r);
      const minC = Math.min(selection.start.c, selection.end.c);
      const maxC = Math.max(selection.start.c, selection.end.c);
      for (let rr = minR; rr <= maxR; rr++) {
        newData[rr] = [...newData[rr]];
        for (let cc = minC; cc <= maxC; cc++) {
          newData[rr][cc] = { value: "", formula: null };
          changed = true;
        }
      }
      if (changed) {
        setGridData(newData);
        if (onChange) onChange(newData);
      }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      setEditingCell({ r, c, overwrite: true, initialValue: e.key });
      // updateCell is called in the input's mount effect
    }
  };

  const handleCopy = (e) => {
    if (editingCell) return;
    e.preventDefault();
    const minR = Math.min(selection.start.r, selection.end.r);
    const maxR = Math.max(selection.start.r, selection.end.r);
    const minC = Math.min(selection.start.c, selection.end.c);
    const maxC = Math.max(selection.start.c, selection.end.c);

    let text = "";
    for (let r = minR; r <= maxR; r++) {
      const rowData = [];
      for (let c = minC; c <= maxC; c++) {
        rowData.push(computedGrid[r][c].computed);
      }
      text += rowData.join("\t") + "\n";
    }
    e.clipboardData.setData("text/plain", text.trimEnd());
  };

  const handlePaste = (e) => {
    if (editingCell) return;
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    const rows = text.replace(/\r/g, "").trimEnd().split("\n").map(line => line.split("\t"));
    const newData = [...gridData];
    
    let maxR = gridData.length;
    let maxC = gridData[0].length;

    rows.forEach((row, rowIndex) => {
      const targetR = activeCell.r + rowIndex;
      if (targetR >= maxR) {
        newData.push(new Array(maxC).fill({ value: "", formula: null }));
        maxR++;
      }
      newData[targetR] = [...newData[targetR]];
      row.forEach((cellVal, colIndex) => {
        const targetC = activeCell.c + colIndex;
        if (targetC >= maxC) {
          newData.forEach(r => r.push({ value: "", formula: null }));
          maxC++;
        }
        
        let value = cellVal;
        let formula = null;
        if (value.startsWith("=")) {
          formula = value;
          value = "";
        }
        newData[targetR][targetC] = { value, formula };
      });
    });

    setGridData(newData);
    if (onChange) onChange(newData);
    
    // Update selection to match pasted range
    setSelection({
      start: { r: activeCell.r, c: activeCell.c },
      end: { r: activeCell.r + rows.length - 1, c: activeCell.c + Math.max(...rows.map(r=>r.length)) - 1 }
    });
  };

  const handleContextMenu = (e, r, c) => {
    e.preventDefault();
    
    // Select cell if not in selection
    const minR = Math.min(selection.start.r, selection.end.r);
    const maxR = Math.max(selection.start.r, selection.end.r);
    const minC = Math.min(selection.start.c, selection.end.c);
    const maxC = Math.max(selection.start.c, selection.end.c);
    
    if (r >= 0 && c >= 0) {
      if (!(r >= minR && r <= maxR && c >= minC && c <= maxC)) {
        setActiveCell({ r, c });
        setSelection({ start: { r, c }, end: { r, c } });
      }
    }
    
    setContextMenu({ x: e.clientX, y: e.clientY, r, c });
  };
  
  useEffect(() => {
    const clickOut = () => setContextMenu(null);
    if (contextMenu) window.addEventListener("click", clickOut);
    return () => window.removeEventListener("click", clickOut);
  }, [contextMenu]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      if (editingCell.overwrite) {
        updateCell(editingCell.r, editingCell.c, editingCell.initialValue);
        // Turn off overwrite so subsequent typing appends
        setEditingCell(p => ({ ...p, overwrite: false }));
      }
    }
  }, [editingCell]);

  const activeCellData = gridData[activeCell.r]?.[activeCell.c] || { value: "", formula: null };
  const displayFormula = activeCellData.formula !== null ? activeCellData.formula : activeCellData.value;

  const minR = Math.min(selection.start.r, selection.end.r);
  const maxR = Math.max(selection.start.r, selection.end.r);
  const minC = Math.min(selection.start.c, selection.end.c);
  const maxC = Math.max(selection.start.c, selection.end.c);

  return (
    <div className="worksheet-wrapper" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      
      {/* ── Formula Bar ── */}
      <div className="ws-formula-bar">
        <div className="ws-name-box">{getRangeName()}</div>
        <div className="ws-fx">fx</div>
        <input 
          className="ws-formula-input"
          value={displayFormula}
          onChange={(e) => updateCell(activeCell.r, activeCell.c, e.target.value)}
          onFocus={() => {
            // If they click the formula bar, ensure we are editing the active cell
            if (!editingCell) setEditingCell({ r: activeCell.r, c: activeCell.c, overwrite: false });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setEditingCell(null);
              containerRef.current?.focus();
            }
          }}
        />
      </div>

      <div 
        className="worksheet-container" 
        tabIndex={0} 
        onKeyDown={handleKeyDown} 
        onCopy={handleCopy}
        onPaste={handlePaste}
        ref={containerRef}
      >
        <table className="worksheet-table">
          <thead>
            <tr>
              <th className="ws-header-rowcol" data-r="-1" data-c="-1" onMouseDown={(e) => handleMouseDown(e, -1, -1)} onMouseEnter={() => handleMouseEnter(-1, -1)}></th>
              {gridData[0].map((_, c) => {
                const isSelected = c >= minC && c <= maxC;
                return (
                  <th key={c} className={`ws-header-col ${isSelected ? "selected-header" : ""}`} data-r="-1" data-c={c} onMouseDown={(e) => handleMouseDown(e, -1, c)} onMouseEnter={() => handleMouseEnter(-1, c)}>
                    {getColumnLabel(c)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {computedGrid.map((row, r) => {
              const isRowSelected = r >= minR && r <= maxR;
              return (
                <tr key={r}>
                  <th className={`ws-header-row ${isRowSelected ? "selected-header" : ""}`} data-r={r} data-c="-1" onMouseDown={(e) => handleMouseDown(e, r, -1)} onMouseEnter={() => handleMouseEnter(r, -1)}>
                    {r + 1}
                  </th>
                  {row.map((cell, c) => {
                    const inSelection = r >= minR && r <= maxR && c >= minC && c <= maxC;
                    const isActive = activeCell.r === r && activeCell.c === c;
                    const isEditing = editingCell?.r === r && editingCell?.c === c;
                    
                    let classes = "ws-cell";
                    if (inSelection) classes += " in-selection";
                    if (isActive) classes += " is-active";

                    return (
                      <td 
                        key={c} 
                        className={classes}
                        data-r={r}
                        data-c={c}
                        onMouseDown={(e) => handleMouseDown(e, r, c)}
                        onMouseEnter={() => handleMouseEnter(r, c)}
                        onContextMenu={(e) => handleContextMenu(e, r, c)}
                        onDoubleClick={() => setEditingCell({ r, c, overwrite: false })}
                      >
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            type="text"
                            className="ws-input"
                            value={gridData[r][c].formula !== null ? gridData[r][c].formula : gridData[r][c].value}
                            onChange={(e) => updateCell(r, c, e.target.value)}
                            onBlur={() => setEditingCell(null)}
                          />
                        ) : (
                          cell.computed
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Context Menu ── */}
      {contextMenu && (
        <div className="ws-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button onClick={() => {
            const el = document.createElement("textarea");
            let text = "";
            for (let r = minR; r <= maxR; r++) {
              let row = [];
              for (let c = minC; c <= maxC; c++) row.push(computedGrid[r][c].computed);
              text += row.join("\t") + "\n";
            }
            el.value = text.trimEnd();
            document.body.appendChild(el);
            el.select();
            document.execCommand("copy");
            document.body.removeChild(el);
          }}>Copy</button>
          <button onClick={() => {
            const newData = [...gridData];
            for (let rr = minR; rr <= maxR; rr++) {
              newData[rr] = [...newData[rr]];
              for (let cc = minC; cc <= maxC; cc++) newData[rr][cc] = { value: "", formula: null };
            }
            setGridData(newData);
            if (onChange) onChange(newData);
          }}>Clear contents</button>
        </div>
      )}
    </div>
  );
}
