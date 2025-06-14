import React from 'react';
import './MenuBar.css';

export default function MenuBar({ onUndo, onRedo, mode, setMode, pageNum, setPageNum }) {
  return (
    <div style={{ padding: '10px', backgroundColor: '#eee' }}>
      <button onClick={() => setMode('redact')} style={{ fontWeight: mode === 'redact' ? 'bold' : 'normal' }}>
        黒塗りモード
      </button>
      <button onClick={() => setMode('erase')} style={{ fontWeight: mode === 'erase' ? 'bold' : 'normal' }}>
        消しゴムモード
      </button>
      <button onClick={onUndo}>Undo</button>
      <button onClick={onRedo}>Redo</button>
      <span style={{ marginLeft: '20px' }}>ページ: {pageNum}</span>
      <input
        type="number"
        value={pageNum}
        min={1}
        onChange={(e) => setPageNum(parseInt(e.target.value))}
        style={{ width: '50px', marginLeft: '10px' }}
      />
    </div>
  );
}