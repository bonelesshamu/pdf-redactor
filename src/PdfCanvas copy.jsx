import './PdfWorker';
import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

export default function PdfCanvas({ mode, pageNum }) {
  const canvasRef = useRef();
  const overlayRef = useRef();
  const pageItemsRef = useRef([]);
  const selectionStart = useRef([])
  const selectionEnd = useRef([]);
  const viewportRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [ctx, setCtx] = useState(null);

  function isSelectionInItem(rect){
    const scale = viewportRef.current.scale;
    const canvasHeight = viewportRef.current.height;
    console.log(canvasHeight);
    console.log(rect.height);

    const selRect = [
      Math.min(selectionStart.current[0], selectionEnd.current[0]),
      Math.min(selectionStart.current[1], selectionEnd.current[1]),
      Math.max(selectionStart.current[0], selectionEnd.current[0]),
      Math.max(selectionStart.current[1], selectionEnd.current[1])
    ];

    console.log(selRect);
    return pageItemsRef.current.some(item => {
      const [,,,, x, y] = item.transform;
      const itemX = x * scale;
      const itemW = item.width * scale;
      const itemYBottom = canvasHeight - y * scale;
      const itemYTop = itemYBottom - item.height * scale; // ← 上から下に向かって増える座標

      const itemRect = [itemX, itemYTop, itemX + itemW, itemYBottom];
      // console.log(item.str);
      // console.log(itemRect);

      return !(
        itemRect[2] < selRect[0] ||
        itemRect[0] > selRect[2] ||
        itemRect[3] < selRect[1] ||
        itemRect[1] > selRect[3]
      );

    });
  }

  const handleMouseDown = (event) => {
    console.log(event);
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = event.clientX - rect.left;
    const startY = event.clientY - rect.top;
    selectionStart.current = [startX, startY];
  }

  const handleMouseUp = (event) => {
    console.log(event);
    const rect = canvasRef.current.getBoundingClientRect();
    const endX = event.clientX - rect.left;
    const endY = event.clientY - rect.top;
    console.log("rect.left: " + rect.left);
    console.log("rect.top: " + rect.top);
    selectionEnd.current = [endX, endY];
    console.log([endX, endY]);
    if(isSelectionInItem(rect)){
      // 描画矩形が含まれるアイテムあり
      console.log("true");
    } else {
      // 描画矩形が含まれるアイテムなし
      console.log("false");
    }
  }

  useEffect(() => {
    const loadingTask = pdfjsLib.getDocument('/sample.pdf');
    loadingTask.promise.then((loadedPdf) => setPdf(loadedPdf));
  }, []);

  useEffect(() => {
    if (pdf && canvasRef.current) {
      pdf.getPage(pageNum).then((page) => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: 1.5, rotation: 0 });
        viewportRef.current = viewport;

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        context.setTransform(1, 0, 0, 1, 0, 0); // ← 変なtransformリセット
        context.clearRect(0, 0, canvas.width, canvas.height); // ← 前の描画クリア

        page.render({ canvasContext: context, viewport });
        setCtx(context);
        page.getTextContent().then((textContent) => {
          pageItemsRef.current = textContent.items;
        });
      });
    }
  }, [pdf, pageNum]);

  const handleDraw = (e) => {
    if (!drawing || !ctx) return;
    const rectSize = 20;
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
    if (mode === 'redact') {
      ctx.fillStyle = 'black';
      ctx.fillRect(x - rectSize / 2, y - rectSize / 2, rectSize, rectSize);
    } else if (mode === 'erase') {
      ctx.clearRect(x - rectSize / 2, y - rectSize / 2, rectSize, rectSize);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        style={{ border: '1px solid #ccc' }}
      />
      <canvas
        ref={overlayRef}
        width={canvasWidth}
        height={canvasHeight}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none' // ← 選択操作は下のcanvasが受ける
        }}
      />
    </div>

  );
}