import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import './PdfWorker';
import './PdfCanvas.css';
import { v4 as uuid } from "uuid";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function PdfCanvas({ mode, pageNum }) {
  const canvasRef = useRef(null);
  const pageRef = useRef(null);
  const textLayerRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [redactions, setRedactions] = useState(new Map());
  const [actionHistory, setActionHistory] = useState([]);
  const [textItems, setTextItems] = useState([]);
  const [viewport, setViewport] = useState(null);

  const getSelectedItemIndices = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return [];

    const range = selection.getRangeAt(0);
    const selectedSpans = [];

    // span を全部調べて、選択範囲内のものを拾う
    if (textLayerRef.current) {
      const spans = textLayerRef.current.querySelectorAll('span[data-index]');
      spans.forEach((span) => {
        const rect = span.getBoundingClientRect();
        const selRects = range.getClientRects();
        for (const selRect of selRects) {
          if (
            rect.left < selRect.right &&
            rect.right > selRect.left &&
            rect.top < selRect.bottom &&
            rect.bottom > selRect.top
          ) {
            selectedSpans.push(span);
            break;
          }
        }
      });
    }

    const indices = selectedSpans.map((span) =>
      parseInt(span.dataset.index, 10)
    );
    return indices;
  };

  const addRedaction = (itemIndex, rect, text) => {
    setRedactions(prev => {
      const newMap = new Map(prev);
      newMap.set(itemIndex, {
        id: uuid(),
        rect,
        text: text
      });
      return newMap;
    });
  };

  const removeRedaction = (itemIndex) => {
    setRedactions(prev => {
      const newMap = new Map(prev);
      newMap.delete(itemIndex);
      return newMap;
    });
  };

  const drawRedaction = (indices, ctx, viewport) => {
    const scale = viewport.scale;
    indices.forEach((i) => {
      const item = textItems[i];
      const x = item.transform[4] * scale;
      const y = viewport.height - (item.transform[5] + item.height) * scale;

      // const yTop = canvasRef.current.height - item.transform[5] * scale - item.height * scale;
      const width = item.width * scale;
      const height = item.height * scale * 1.2;
      console.log(viewport.height, canvasRef.current.height);
      console.log(y, scale, width, height);
      console.dir(item);

      if (mode === 'erase') {
        removeRedaction(i);
        ctx.clearRect(x, y, width, height);
      } else {
        addRedaction(i, [x, y, width, height], item.str);
      }
    });
  };


  const handleMouseUp = () => {
    const indices = getSelectedItemIndices();
    if (indices.length > 0 && canvasRef.current && viewport) {
      const ctx = canvasRef.current.getContext('2d');
      drawRedaction(indices, ctx, viewport);
    }
  };

  useEffect(() => {
    const loadingTask = pdfjsLib.getDocument('/sample.pdf');
    loadingTask.promise.then((loadedPdf) => setPdf(loadedPdf));
  }, []);

  const redrawCanvas = useCallback(() => {
    if (!canvasRef.current || !pageRef.current || !viewport) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // 1. キャンバスを初期化
    ctx.setTransform(1, 0, 0, 1, 0, 0); // 必ずリセット（反転防止）
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. PDFを再描画
    pageRef.current.render({
      canvasContext: ctx,
      viewport,
    }).promise.then(() => {
      // 3. redactions を上書き描画（非同期で待つ）
      redactions.forEach((item) => {
        ctx.fillStyle = 'black';
        ctx.fillRect(item.rect[0], item.rect[1], item.rect[2], item.rect[3]);
      });
    });
  }, [viewport, pageRef, canvasRef, redactions]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas])

  useEffect(() => {
    if (pdf) {
      pdf.getPage(pageNum).then((page) => {
        const vp = page.getViewport({ scale: 1.5, rotation: 0 });
        page.getTextContent().then((textContent) => {
          setTextItems(textContent.items.filter(item => item.str.trim().length > 0));
        });

        // ページ本体だけ一旦保持
        pageRef.current = page;
        setViewport(vp); // ← viewportだけ先に保存
      });
    }
  }, [pdf, pageNum]);

  useEffect(() => {
    if (!viewport || !canvasRef.current || !pageRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      pageRef.current.render({
        canvasContext: ctx,
        viewport
      });

  }, [viewport])


  return (
    viewport && (
      <div style={{ position: 'relative' }}>
        {/* ← Canvasを表示！ */}
        <canvas
          ref={canvasRef}
          width={viewport.width}
          height={viewport.height}
          style={{ border: '1px solid #ccc', position: 'absolute', top: 0, left: 0 }}
        />

        {/* ← 自前で描いたテキストレイヤー */}
        <div
          className="textLayer"
          ref={textLayerRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 10,
            width: viewport.width,
            height: viewport.height,
            color: 'transparent',
            userSelect: 'text',
            pointerEvents: 'auto',
          }}
          onMouseUp={handleMouseUp}
        >
          {textItems.map((item, index) => {
            const [a, b, c, d, e, f] = item.transform;
            return (
              <span
                key={index}
                data-index={index}
                style={{
                  position: 'absolute',
                  left: `${item.transform[4] * viewport.scale}px`,
                  top: `${(viewport.height - item.transform[5] * viewport.scale - item.height * viewport.scale)}px`,
                  width: `${item.width * viewport.scale}px`,
                  height: `${item.height * viewport.scale}px`,
                  transformOrigin: '0 0',
                  whiteSpace: 'pre',
                  fontSize: `${item.height}px`,
                  lineHeight: `${item.height}px`,
                }}
              >
                {item.str}
              </span>
            );
          })}
        </div>
      </div>
    )
  );
}
