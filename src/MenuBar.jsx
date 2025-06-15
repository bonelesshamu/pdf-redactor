import React from 'react';
import './MenuBar.css';

export default function MenuBar({ onUndo, onRedo, mode, setMode, pageNum, setPageNum }) {
  return (
    <div className="menu-bar-buttons">
      <button onClick={() => setMode('redact')} style={{ fontWeight: mode === 'redact' ? 'bold' : 'normal', backgroundColor: mode === 'redact' ? '#ff7bff' : '#007bff'  }}>
        黒塗りモード
      </button>
      <button onClick={() => setMode('erase')} style={{ fontWeight: mode === 'erase' ? 'bold' : 'normal', backgroundColor: mode === 'erase' ? '#ff7bff' : '#007bff'  }}>
        消しゴムモード
      </button>
      <button onClick={() => setMode('figure')} style={{ fontWeight: mode === 'figure' ? 'bold' : 'normal', backgroundColor: mode === 'figure' ? '#ff7bff' : '#007bff' }}>
        図形描画モード
      </button>
      <button onClick={() => setMode('shape')} style={{ fontWeight: mode === 'shape' ? 'bold' : 'normal', backgroundColor: mode === 'shape' ? '#ff7bff' : '#007bff' }}>
        任意図形描画モード
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