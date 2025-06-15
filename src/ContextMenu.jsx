// 📌 ContextMenu.jsx
import React, { useEffect, useRef} from 'react';
import "./ContextMenu.css";

export default function ContextMenu({ x, y, memo, onClose, onConfirm }){
  const contextMenuRef = useRef(null);

  useEffect(() => {
    if (!contextMenuRef.current) return;

    const handleClickOutside = (event) => {
      if (!contextMenuRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div ref={contextMenuRef} className="context-menu" style={{top: y, left: x, zIndex: "30"}}>
      <textarea id="memoInput" rows="3" placeholder="メモを入力してください" defaultValue={memo}></textarea>
      <div className="context-menu-buttons">
        <button onClick={() => {onConfirm(document.getElementById("memoInput").value); onClose;}}>OK</button>
        <button onClick={onClose}>キャンセル</button>
      </div>
    </div>

  );
}