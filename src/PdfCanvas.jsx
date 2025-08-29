import React, { useEffect, useRef, useState, useLayoutEffect} from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import './PdfWorker';
import './PdfCanvas.css';
import ContextMenu from './ContextMenu';
import {useContextMenu} from './useContextMenu.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function PdfCanvas({
  selectionResults,
  addSelectionResults,
  removeSelectionResults,
  recordAction,
  mode,
  pageNum,
  value }) {
  const canvasRef = useRef(null);
  const maskCanvas1Ref = useRef(null);
  const maskCanvas2Ref = useRef(null);
  const isMaskCanvas1 = useRef(true);
  const pageRef = useRef(null);
  const textLayerRef = useRef(null);
  const selectedIndexRef = useRef(null);
  const figureCoordinate = useRef([]);
  const prevSelectionResults = useRef([]);
  const isFigureAfterMouseDown = useRef(null);
  const overlayCanvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const drawLoopRef = useRef(0);

  const [memo, setMemo] = useState("");
  const [previewRect, setPreviewRect] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [textItems, setTextItems] = useState([]);
  const [viewport, setViewport] = useState(null);
  const [shapePoints, setShapePoints] = useState([]);
  const { contextMenu, openMenu, closeMenu } = useContextMenu();

  const measureRef = useRef(null);
  const [scaleMap, setScaleMap] = useState({});

  useLayoutEffect(() => {
    if (!measureRef.current) return;

    // 描画完了後に測定
    const spans = Array.from(measureRef.current.querySelectorAll('span'));
    const tempMap = {};

    spans.forEach((span, index) => {
      const htmlWidth = span.getBoundingClientRect().width;
      const canvasWidth = textItems[index].width * viewport.scale;
      const scaleX = canvasWidth / htmlWidth;
      console.log(textItems[index].str);
      console.log(textItems[index].width);
      console.log(canvasWidth)
      console.log(htmlWidth)
      tempMap[index] = scaleX;
    });
    console.dir(tempMap);

    setScaleMap(tempMap);
  }, [textItems, viewport]);


  const handleMouseDown = (e) => {
    console.log("handleMouseDown");
    if(e.button !== 0) return;
    isFigureAfterMouseDown.current = true;
    setTimeout(() => {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const startX = (e.clientX - rect.left);
      const startY = (e.clientY - rect.top);
      if(mode === 'figure'){
        figureCoordinate.current = [startX, startY];
        setPreviewRect({
          x: startX,
          y: startY,
          width: 0,
          height: 0
        });
      } else if(mode === 'shape'){
        setShapePoints(prev => [...prev, { x: startX, y: startY }]);
      }
    }, 0);
  }

  const handleMouseMove = (e) => {
    if(!isFigureAfterMouseDown.current) return;
    setTimeout(() => {
      if(mode === 'figure'){
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const currentX = (e.clientX - rect.left);
        const currentY = (e.clientY - rect.top);

        setPreviewRect({
          x: previewRect.x,
          y: previewRect.y,
          width: currentX - previewRect.x,
          height: currentY - previewRect.y,
        });
      }
    }, 0);
  }

  const handleFigureClick = (e) => {
    console.log("handleFigureClick");
    isFigureAfterMouseDown.current = false;
    setPreviewRect(null);
    const startX = figureCoordinate.current[0];
    const startY = figureCoordinate.current[1];
    figureCoordinate.current = [];
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const endX = (e.clientX - rect.left);
    const endY = (e.clientY - rect.top);
    const results = [{
      selectedX: startX,
      selectedY: startY,
      selectedWidth: endX - startX,
      selectedHeight: endY - startY
    }];
    console.log(endX, endY)
    console.dir(results);
    addSelectionResults(results);
    recordAction({ type: 'add', results: results });
  }

  const handleShapeFinalClick = (e) => {
    console.log("handleShapeFinalClick");
    if (shapePoints.length < 2) return;
    const results = [{
      shapeResult: [...shapePoints]
    }];
    console.dir(results);
    addSelectionResults(results);
    recordAction({ type: 'add', results: results });
    setShapePoints([]);
  }

  const handleRedactClick = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !textLayerRef.current) return [];

    const range = selection.getRangeAt(0);
    const results = [];
    const tmpResults = [];
    const spans = textLayerRef.current.querySelectorAll('span[data-index]');
    spans.forEach((span) => {
      const textNode = span.firstChild;
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;

      const spanIndex = parseInt(span.dataset.index, 10);
      const spanText = textNode.textContent;
      const length = range.endOffset - range.startOffset;

      if (
        (range.startContainer === textNode || range.endContainer === textNode) &&
        range.startOffset !== range.endOffset &&
        length !== 0
        ) {
        const scaleFactor = window.devicePixelRatio;
        // console.log(scaleFactor);
        const item = textItems[spanIndex];
        const startOffset = range.startContainer === textNode ? range.startOffset : 0;
        const endOffset = range.endContainer === textNode ? range.endOffset : spanText.length;
        const selectedText = spanText.slice(startOffset, endOffset);
        const preText = spanText.slice(0, startOffset);
        const selected = spanText.slice(startOffset, endOffset);

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.font = `${item.height * viewport.scale}px ` + item.fontName;
        // console.log(ctx.font);
        const xOffset = ctx.measureText(preText).width;
        const x = item.transform[4] * viewport.scale + xOffset;
        const y = viewport.height - (item.transform[5] + item.height) * viewport.scale;
        const selectedWidth = ctx.measureText(selected).width;
        const height = item.height * viewport.scale * 1.2;

        tmpResults.push({
          itemIndex: spanIndex,
          selectedText: selectedText,
          offset: startOffset,
          length: endOffset - startOffset,
          spanLeft: span.offsetLeft * scaleFactor,
          spanTop: span.offsetTop * scaleFactor,
          spanWidth: span.offsetWidth * scaleFactor,
          spanHeight: span.offsetHeight * scaleFactor,
          selectedX: x,
          selectedY: y,
          selectedWidth: selectedWidth,
          selectedHeight: height
        });
      }
    });
    console.dir(tmpResults);

    const groupedRects = tmpResults.reduce((acc, rect) => {
      const existingRow = Object.keys(acc).find(rowY => Math.abs(rowY - rect.selectedY) < 30);
      if (existingRow) acc[existingRow].push(rect);
      else acc[rect.selectedY] = [rect]; // ✅ 新しい行として追加

      return acc;
    }, {});
    console.dir(groupedRects);
    Object.values(groupedRects).forEach(rects => {
        const minX = Math.min(...rects.map(rect => rect.selectedX));
        const maxX = Math.max(...rects.map(rect => rect.selectedX + rect.selectedWidth));
        const minY = Math.min(...rects.map(rect => rect.selectedY));
        const maxY = Math.max(...rects.map(rect => rect.selectedY + rect.selectedHeight));
        results.push({
          selectedX: minX,
          selectedY: minY,
          selectedWidth: maxX-minX,
          selectedHeight: maxY-minY
        });
    });
    addSelectionResults(results);
    recordAction({ type: 'add', results: results });
    selection.removeAllRanges();
  }

  const getSelectionResultIndexByCoordinate = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // console.dir(rect);
    // console.log(e.clientX, e.clientY);
    const correctedX = (e.clientX - rect.left);
    const correctedY = (e.clientY - rect.top);
    // console.log(correctedX, correctedY);
    let matchedIndex = -1;
    selectionResults.forEach((results, index) => {
      const hasMatchedResult = results.some((result) => {
        // console.log(result.selectedX, result.selectedX + result.selectedWidth, result.selectedY, result.selectedY + result.selectedHeight);
        if(result.shapeResult){
          const ctx = overlayCanvasRef.current.getContext("2d");
          ctx.beginPath();
          result.shapeResult.forEach(({ x, y }, index) => {
            index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          });
          ctx.closePath();
          return ctx.isPointInPath(correctedX, correctedY);
        } else {
          return (
            correctedX >= result.selectedX &&
            correctedX <= result.selectedX + result.selectedWidth &&
            correctedY >= result.selectedY &&
            correctedY <= result.selectedY + result.selectedHeight
          );
        }
      });
      console.log("hasMatchedResult: "+hasMatchedResult);
      if(hasMatchedResult) matchedIndex = index;
    });
    return matchedIndex
  }

  const handleEraseClick = (e) => {
    console.log("handleEraseClick");
    const matchedIndex = getSelectionResultIndexByCoordinate(e)
    if(matchedIndex !== -1){
      removeSelectionResults(matchedIndex);
    }
  };

  const handleMouseUp = (e) => {
    setTimeout(() => {
      if(mode == 'redact'){
        handleRedactClick()
      } else if(mode == 'erase'){
        handleEraseClick(e);
      } else if(mode == 'figure'){
        handleFigureClick(e);
      }
    }, 0);
  };

  const handleRightClick = (e) => {
    e.preventDefault();
    console.log(contextMenu.visible, contextMenu.x, contextMenu.y);
    setTimeout(() => {
      if(mode === 'shape'){
        // 任意矩形描画の最後の点
        handleShapeFinalClick(e);
      } else {
        // メモ操作
        const matchedIndex = getSelectionResultIndexByCoordinate(e)
        if(matchedIndex !== -1){
          selectedIndexRef.current = matchedIndex;
          setMemo(selectionResults[matchedIndex].memo? selectionResults[matchedIndex].memo:"");
          openMenu(e.clientX, e.clientY);
        }
      }
    }, 0);
  };

  const handleConfirm = (text) => {
    console.log("入力したメモ:", text);
    setMemo(text);
    selectionResults[selectedIndexRef.current].memo = text;
    closeMenu();
  };

  useEffect(() => {
    console.log("redrawing");
    if (!viewport || !canvasRef.current || !pageRef.current) return;
    if (renderTaskRef.current) {
      console.log("Render in progress, skipping.");
      return;
    }
    // ページが変わらない限り、再描画はしない。
    // const maskCanvas = maskCanvasRef.current;
    // const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
    // if(maskCanvas.width !== viewport.width || maskCanvas.height !== viewport.height){
    //   maskCanvas.width = viewport.width;
    //   maskCanvas.height = viewport.height;
    // }
    // ctx.setTransform(1, 0, 0, 1, 0, 0);
    const overlayCtx = overlayCanvasRef.current.getContext("2d");
    overlayCtx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    // ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    console.dir(prevSelectionResults.current);
    console.dir(selectionResults);

    //差分更新を考えたが、重なるとうまくいかない。
    // const addResults = selectionResults.filter((present) => !prevSelectionResults.current.some(prev => prev.maskId === present.maskId));
    // console.dir(addResults);
    // const delResults = prevSelectionResults.current.filter((prev) => !selectionResults.some(present => prev.maskId === present.maskId));
    // console.dir(delResults);
    isMaskCanvas1.current = !isMaskCanvas1.current;

    const draw = () => {
      const maskCanvas = isMaskCanvas1.current? maskCanvas1Ref.current:maskCanvas2Ref.current;
      const clearCanvas = !isMaskCanvas1.current? maskCanvas1Ref.current:maskCanvas2Ref.current;
      if (!maskCanvas) return;
      const ctxMask = maskCanvas.getContext('2d');
      const ctxClear = clearCanvas.getContext('2d');
      if (!ctxMask) return;
      // addResults.forEach(results => {
      //   ctxMask.fillStyle = "black";
      //   results.forEach(result => {
      //     if (result.shapeResult) {
      //       ctxMask.beginPath();
      //       result.shapeResult.forEach((point, idx) => {
      //         if (idx === 0) ctxMask.moveTo(point.x, point.y);
      //         else ctxMask.lineTo(point.x, point.y);
      //       });
      //       ctxMask.closePath();
      //       ctxMask.fill();
      //     } else {
      //       ctxMask.fillRect(result.selectedX, result.selectedY, result.selectedWidth, result.selectedHeight);
      //     }
      //   })
      // });
      // delResults.forEach(results => {
      //   results.forEach(result => {
      //     if (result.shapeResult) {
      //       ctxMask.save();
      //       ctxMask.beginPath();
      //       result.shapeResult.forEach((point, idx) => {
      //         if (idx === 0) ctxMask.moveTo(point.x, point.y);
      //         else ctxMask.lineTo(point.x, point.y);
      //       });
      //       ctxMask.closePath();
      //       ctxMask.clip();
      //       ctxMask.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      //       ctxMask.restore();
      //     } else {
      //       ctxMask.clearRect(result.selectedX-2, result.selectedY-2, result.selectedWidth+4, result.selectedHeight+4);
      //     }
      //   })
      // });
      selectionResults.forEach((results) => {
        results.forEach((result) => {
          ctxMask.fillStyle = "black";
          if(result.shapeResult){
            ctxMask.beginPath();
            result.shapeResult.forEach((point, index) => {
              if (index === 0) ctxMask.moveTo(point.x, point.y);
              else ctxMask.lineTo(point.x, point.y);
            });
            ctxMask.closePath();
            ctxMask.fill();
          } else {
            ctxMask.fillRect(result.selectedX, result.selectedY, result.selectedWidth, result.selectedHeight);
          }
        });
      });
      ctxClear.clearRect(0, 0, clearCanvas.width, clearCanvas.height);

      drawLoopRef.current = requestAnimationFrame(draw); // ← 再帰的に呼び出す
    };
    drawLoopRef.current = requestAnimationFrame(draw); // ← 初回の呼び出し
    prevSelectionResults.current = structuredClone(selectionResults);

    return () => cancelAnimationFrame(drawLoopRef.current); // クリーンアップ
  }, [viewport, selectionResults, textItems, recordAction]);

  useEffect(() => {
    if (!previewRect || !overlayCanvasRef.current) return;
    const overlayCtx = overlayCanvasRef.current.getContext("2d");
    overlayCtx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    overlayCtx.setLineDash([5, 5]);
    overlayCtx.strokeStyle = "gray";
    overlayCtx.strokeRect(previewRect.x, previewRect.y, previewRect.width, previewRect.height);
    overlayCtx.setLineDash([]);
  }, [previewRect]);

  useEffect(() => {
    console.dir(shapePoints);
    if(!overlayCanvasRef.current) return;
    const overlayCtx = overlayCanvasRef.current.getContext("2d");
    overlayCtx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    if (shapePoints.length < 2) return;
    overlayCtx.setLineDash([5, 5]);
    overlayCtx.strokeStyle = "gray";
    overlayCtx.beginPath();

    shapePoints.forEach((point, index) => {
      index === 0? overlayCtx.moveTo(point.x, point.y):overlayCtx.lineTo(point.x, point.y);
    });

    overlayCtx.closePath();
    overlayCtx.stroke();
    overlayCtx.setLineDash([]);
  }, [shapePoints]);

  function findAllMatches(str, keyword) {
    const result = [];
    const regex = new RegExp(keyword, 'g');
    let match;

    while ((match = regex.exec(str)) !== null) {
      const start = match.index;
      const end = start + keyword.length - 1;
      result.push([start, end]);
    }

    return result;
  }

  useEffect(() =>{
    console.log(value);
    const tmpResults = [];
    const results = [];
    if(!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');

    // textItems.forEach((item) => {
      // const text = item.str;
      // const matches = findAllMatches(text, value);
      // if (matches.length === 0) return;

      // ctx.font = `${item.height * viewport.scale}px ${item.fontName}`;

      // matches.forEach(([start, end]) => {
      //   const preText = text.slice(0, start);
      //   const matchText = text.slice(start, end + 1);

      //   const xOffset = ctx.measureText(preText).width;
      //   const matchWidth = ctx.measureText(matchText).width;

      //   const x = item.transform[4] * viewport.scale + xOffset;
      //   const y = viewport.height - (item.transform[5] + item.height) * viewport.scale;
      //   const height = item.height * viewport.scale * 1.2;

      //   ctx.fillStyle = "rgba(255, 255, 0, 0.4)";
      //   ctx.fillRect(x, y, matchWidth, height);
      // });
    //   const chars = item.str.split("");
    //   let offsetX = 0;

    //   chars.forEach((char, i) => {
    //     const charWidth = ctx.measureText(char).width;

    //     if (char === "公" || char === "紀") {
    //       const x = item.transform[4] * viewport.scale + offsetX;
    //       const y = viewport.height - (item.transform[5] + item.height) * viewport.scale;
    //       const height = item.height * viewport.scale * 1.2;

    //       ctx.fillStyle = "rgba(255, 255, 0, 0.4)";
    //       ctx.fillRect(x, y, charWidth, height);
    //     }

    //     offsetX += charWidth;
    //   });

    // });


    if(!textLayerRef.current) return;
    const spans = textLayerRef.current.querySelectorAll('span[data-index]');
    if(!spans) return;
    spans.forEach((span) => {
      const textNode = span.firstChild;
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
      const spanIndex = parseInt(span.dataset.index, 10);
      const spanText = textNode.textContent;
      const matches = findAllMatches(spanText, value);
      const scaleFactor = window.devicePixelRatio;
      console.log(scaleFactor);
      const item = textItems[spanIndex];
      console.dir(item);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.font = `${item.height * viewport.scale}px ` + item.fontName;
      console.log(ctx.font);
      const domWidth = span.getBoundingClientRect().width;
      const canvasWidth = ctx.measureText(item.str).width;
      const scaleFactor2 = domWidth / canvasWidth;
      console.log(item.str, domWidth, canvasWidth, scaleFactor2);
      matches.forEach((match) => {
        // console.log(match);
        const startOffset = match[0];
        const endOffset = match[1]+1;
        const selectedText = spanText.slice(startOffset, endOffset);
        const preText = spanText.slice(0, startOffset);
        console.log(preText);
        const xOffset = ctx.measureText(preText).width;
        console.log(xOffset);
        const metrics = ctx.measureText(preText);
        console.dir(metrics);
        const width = metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft;
        console.log(width);
        // const x = Math.ceil(item.transform[4] * viewport.scale + xOffset * scaleFactor2);
        const x = Math.ceil(item.transform[4] * viewport.scale + xOffset);
        const y = viewport.height - (item.transform[5] + item.height) * viewport.scale;
        const selectedWidth = Math.ceil(ctx.measureText(selectedText).width * scaleFactor2);
        const height = item.height * viewport.scale * 1.2;
        results.push({
          itemIndex: spanIndex,
          selectedText: selectedText,
          offset: startOffset,
          length: endOffset - startOffset,
          spanLeft: span.offsetLeft * scaleFactor,
          spanTop: span.offsetTop * scaleFactor,
          spanWidth: span.offsetWidth * scaleFactor,
          spanHeight: span.offsetHeight * scaleFactor,
          selectedX: x,
          selectedY: y,
          selectedWidth: selectedWidth,
          selectedHeight: height
        });
        // const groupedRects = tmpResults.reduce((acc, rect) => {
        //   const existingRow = Object.keys(acc).find(rowY => Math.abs(rowY - rect.selectedY) < 30);
        //   if (existingRow) acc[existingRow].push(rect);
        //   else acc[rect.selectedY] = [rect]; // ✅ 新しい行として追加
        //   return acc;
        // }, {});
        // console.dir(tmpResults);
        // results.push(tmpResults);
        // Object.values(tmpResults).forEach(rects => {
        //     const minX = Math.min(...rects.map(rect => rect.selectedX));
        //     const maxX = Math.max(...rects.map(rect => rect.selectedX + rect.selectedWidth));
        //     const minY = Math.min(...rects.map(rect => rect.selectedY));
        //     const maxY = Math.max(...rects.map(rect => rect.selectedY + rect.selectedHeight));
        //     results.push({
        //       selectedX: minX,
        //       selectedY: minY,
        //       selectedWidth: maxX-minX,
        //       selectedHeight: maxY-minY
        //     });
        // });
      });
      addSelectionResults(results);
      recordAction({ type: 'add', results: results });
    });

  }, [value]);


  useEffect(() => {
    const loadingTask = pdfjsLib.getDocument({
      url: '/output7.pdf',
      cMapUrl: '/cmaps/',       // CMapファイルのパス
      cMapPacked: true          // CMapが圧縮されているかどうか
    }
    );
    loadingTask.promise.then((loadedPdf) => setPdf(loadedPdf));
  }, []);

  useEffect(() => {
    if (pdf) {
      pdf.getPage(pageNum).then((page) => {
        page.get
        const vp = page.getViewport({ scale: 1.5, rotation: page.rotate });
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
    console.log("first drawing");
    if (!viewport || !canvasRef.current || !pageRef.current) return;
    if (renderTaskRef.current) {
      console.log("Render in progress, skipping.");
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const rotation = pageRef.current.rotate; // PDFの回転角度（0, 90, 180, 270）
    const task = pageRef.current.render({ canvasContext: ctx, viewport: pageRef.current.getViewport({ scale: 1.5, rotation: rotation }) });
    renderTaskRef.current = task;

    task.promise.then(() => {
      renderTaskRef.current = null;
    }).catch((error) => {
      console.warn("Render cancelled or failed:", error);
    });
  }, [viewport, textItems]);

  return (
    viewport && (
      <div className="pdf-container" onContextMenu={(event) => handleRightClick(event)}>
        {/* ← Canvasを表示！ */}
        <canvas
          ref={canvasRef}
          width={viewport.width}
          height={viewport.height}
          style={{ border: '1px solid #ccc', position: 'absolute', top: '48px', zIndex: 1, pointerEvents: 'none' }}
        />
        <canvas
          ref={maskCanvas1Ref}
          width={viewport.width}
          height={viewport.height}
          style={{ border: '1px solid #ccc', position: 'absolute', top: '48px', zIndex: 10, pointerEvents: 'none', opacity: '1' }}
        />
        <canvas
          ref={maskCanvas2Ref}
          width={viewport.width}
          height={viewport.height}
          style={{ border: '1px solid #ccc', position: 'absolute', top: '48px', zIndex: 10, pointerEvents: 'none', opacity: '1' }}
        />
        <canvas
          ref={overlayCanvasRef}
          width={viewport.width}
          height={viewport.height}
          className="overlay-canvas"
          style={{ border: '1px solid #ccc', position: 'absolute', top: '48px', zIndex: 20, pointerEvents: 'none' }}
        />
        {/* ← 自前で描いたテキストレイヤー */}
        <div
          id="text-layer"
          className="textLayer"
          ref={textLayerRef}
          style={{
            position: 'absolute',
            top: '48px',
            zIndex: 10,
            width: viewport.width,
            height: viewport.height,
            userSelect: 'text',
            pointerEvents: 'auto',
            color: 'blue',
            // transformOrigin: 'top left',
          }}
          onMouseDown={(event) => handleMouseDown(event)}
          onMouseMove={(event) => handleMouseMove(event)}
          onMouseUp={(event) => handleMouseUp(event)}
        >
          {textItems.map((item, index) => {
            const [a, b, c, d, e, f] = item.transform;
            // const angle = Math.round(Math.atan2(b, a) * (180 / Math.PI)); // 回転角度を算出
            // const transform = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
            return (
              <span
                key={index}
                data-index={index}
                style={{
                  // position: 'absolute',
                  // transform: `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`,
                  // transformOrigin: '0 0',
                  //left: `${item.transform[4] * viewport.scale}px`,
                  left: `${item.transform[4] * viewport.scale}px`,
                  top: `${3+(viewport.height - item.transform[5] * viewport.scale - item.height * viewport.scale)}px`,
                  // top: `${3+(item.transform[5] * viewport.scale)}px`,
                  width: `${item.width * viewport.scale}px`,
                  // width: 'auto',
                  height: `${item.height * viewport.scale}px`,
                  // fontFamily: item.fontName || 'monospace',

                  // 90度違い
                  // left: `${f * viewport.scale}px`,
                  // top: `${e * viewport.scale - item.height * viewport.scale + 3}px`,

                  // 0度
                  // left: `${e * viewport.scale}px`,
                  // top: `${4+(viewport.height - f * viewport.scale - item.height * viewport.scale)}px`,
                  // width: `${item.width * viewport.scale}px`,
                  // height: `${item.height * viewport.scale}px`,
                  fontSize: `${item.height * viewport.scale}px`,
                  lineHeight: `${item.height * viewport.scale}px`,
                  fontFamily: item.fontName,
                  // transform: `scaleX(${a/d* item.str.length>10&&item.height*viewport.scale>11? 1.03:1})`,
                  // fontSize: `${item.height*viewport.scale}px`,
                  // lineHeight: `${item.height*viewport.scale}px`,
                  whiteSpace: 'pre',
                  transform: `scaleX(${scaleMap[index] ?? ""})`,
                  // letterSpacing: '0.4px',
                }}
              >
                {item.str}
              </span>
            );
          })}
        </div>
        {contextMenu.visible && <ContextMenu x={contextMenu.x} y={contextMenu.y} memo={memo} onClose={closeMenu} onConfirm={handleConfirm}/>}
        {/* 計測用の非表示DOM */}
        <div
          ref={measureRef}
          style={{
            // visibility: 'hidden',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1000,
          }}
        >
          {textItems.map((item, index) => (
            <div key={`measure-${index}`}>
              <span
                key={index}
                style={{
                  fontSize: `${item.height * viewport.scale}px`,
                  fontFamily: item.fontName || 'serif',
                  whiteSpace: 'pre',
                }}
              >
                {item.str}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  );
}
