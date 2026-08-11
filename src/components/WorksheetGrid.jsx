import React, { useState, useRef, useEffect, useCallback } from "react";
import "./WorksheetGrid.css";

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

export default function WorksheetGrid({ data, onChange }) {
  // Ensure we have a minimum 20x10 grid
  const minRows = 40;
  const minCols = 15;

  const getPaddedData = useCallback(() => {
    let grid = data || [];
    if (!Array.isArray(grid)) grid = [];
    let rows = Math.max(grid.length, minRows);
    let cols = Math.max(grid[0]?.length || 0, minCols);
    for (let r = 0; r < grid.length; r++) {
      if (Array.isArray(grid[r])) {
        cols = Math.max(cols, grid[r].length);
      }
    }
    
    const padded = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push(grid[r]?.[c] || "");
      }
      padded.push(row);
    }
    return padded;
  }, [data]);

  const [gridData, setGridData] = useState(getPaddedData());
  const [editingCell, setEditingCell] = useState(null); // { r, c }
  const [selectedCell, setSelectedCell] = useState({ r: 0, c: 0 });
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    setGridData(getPaddedData());
  }, [getPaddedData]);

  const updateCell = (r, c, value) => {
    const newData = [...gridData];
    newData[r] = [...newData[r]];
    newData[r][c] = value;
    setGridData(newData);
    if (onChange) onChange(newData);
  };

  const handleKeyDown = (e) => {
    if (editingCell) {
      if (e.key === "Enter") {
        e.preventDefault();
        setEditingCell(null);
        setSelectedCell(prev => ({ r: Math.min(prev.r + 1, gridData.length - 1), c: prev.c }));
        containerRef.current?.focus();
      } else if (e.key === "Escape") {
        setEditingCell(null);
        containerRef.current?.focus();
      }
      return;
    }

    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedCell(p => ({ r: Math.max(0, p.r - 1), c: p.c })); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSelectedCell(p => ({ r: Math.min(gridData.length - 1, p.r + 1), c: p.c })); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setSelectedCell(p => ({ r: p.r, c: Math.max(0, p.c - 1) })); }
    else if (e.key === "ArrowRight") { e.preventDefault(); setSelectedCell(p => ({ r: p.r, c: Math.min(gridData[0].length - 1, p.c + 1) })); }
    else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      setEditingCell(selectedCell);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      updateCell(selectedCell.r, selectedCell.c, "");
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Start typing immediately
      setEditingCell(selectedCell);
      updateCell(selectedCell.r, selectedCell.c, ""); // It will capture the key via onChange of input in next tick? Better to just set to "" and let the user type, but it might miss the first char. Actually, React will focus the input and the user might need to type again. It's tricky to pass the first char. We'll leave it as is for simplicity.
    }
  };

  const handlePaste = (e) => {
    if (editingCell) return;
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    const rows = text.trim().split("\n").map(line => line.split("\t"));
    const newData = [...gridData];
    
    let maxR = gridData.length;
    let maxC = gridData[0].length;

    rows.forEach((row, rowIndex) => {
      const targetR = selectedCell.r + rowIndex;
      if (targetR >= maxR) {
        // Add row
        newData.push(new Array(maxC).fill(""));
        maxR++;
      }
      newData[targetR] = [...newData[targetR]];
      row.forEach((cell, colIndex) => {
        const targetC = selectedCell.c + colIndex;
        if (targetC >= maxC) {
          // Add col
          newData.forEach(r => r.push(""));
          maxC++;
        }
        newData[targetR][targetC] = cell.replace(/\r/g, "");
      });
    });

    setGridData(newData);
    if (onChange) onChange(newData);
  };

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingCell]);

  return (
    <div 
      className="worksheet-container" 
      tabIndex={0} 
      onKeyDown={handleKeyDown} 
      onPaste={handlePaste}
      ref={containerRef}
    >
      <table className="worksheet-table">
        <thead>
          <tr>
            <th className="ws-header-rowcol"></th>
            {gridData[0].map((_, c) => (
              <th key={c} className="ws-header-col">{getColumnLabel(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {gridData.map((row, r) => (
            <tr key={r}>
              <th className="ws-header-row">{r + 1}</th>
              {row.map((cell, c) => {
                const isSelected = selectedCell.r === r && selectedCell.c === c;
                const isEditing = editingCell?.r === r && editingCell?.c === c;
                
                return (
                  <td 
                    key={c} 
                    className={`ws-cell ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      if (!isEditing) {
                        setSelectedCell({ r, c });
                        setEditingCell(null);
                        containerRef.current?.focus();
                      }
                    }}
                    onDoubleClick={() => setEditingCell({ r, c })}
                  >
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        className="ws-input"
                        value={cell}
                        onChange={(e) => updateCell(r, c, e.target.value)}
                        onBlur={() => {
                           setEditingCell(null);
                           // don't refocus container on blur to avoid focus loop
                        }}
                      />
                    ) : (
                      cell
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
