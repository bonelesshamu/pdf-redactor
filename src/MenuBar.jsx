import React, { useState, useRef } from 'react';
import './MenuBar.css';

export default function MenuBar({ onUndo, onRedo, mode, setMode, pageNum, setPageNum, setValue }) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);

  const openDialog = () => dialogRef.current?.showModal();
  const applyAndClose = () => {
    const inputValue = inputRef.current?.value || "";
    setValue(inputValue);
    dialogRef.current?.close();
  };

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
      <button onClick={openDialog} style={{ fontWeight: mode === 'shape' ? 'bold' : 'normal', backgroundColor: mode === 'shape' ? '#ff7bff' : '#007bff' }}>
        辞書モード
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
      <dialog ref={dialogRef} className="dictionary-dialog">
        <p>これはダイアログです</p>
        <p>テキストを入力してください：</p>
        <input ref={inputRef} type="text" defaultValue={inputRef.current?.value} />
        <div style={{ marginTop: "1em" }}>
          <button onClick={applyAndClose}>適用</button>
        </div>
      </dialog>
   </div>
  );
}