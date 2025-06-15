// 📌 hooks/useContextMenu.js
import { useState } from "react";

export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });

  const openMenu = (x, y, text) => {
    console.log("openMenu: " + text);
    setContextMenu({ visible: true, x, y, text });
  };

  const closeMenu = () => {
    console.log("closeMenu");
    setContextMenu({ visible: false, x: 0, y: 0 });
  };

  return { contextMenu, openMenu, closeMenu };
}