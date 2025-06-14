import React, { useEffect, useRef, useState} from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import './PdfWorker';
import './PdfCanvas.css';

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
  pageNum }) {
  const canvasRef = useRef(null);
  const pageRef = useRef(null);
  const textLayerRef = useRef(null);
  const [pdf, setPdf] = useState(null);
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

  const handleRedactClick = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !textLayerRef.current) return [];

    const range = selection.getRangeAt(0);
    const results = [];
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
        console.log(scaleFactor);
        const item = textItems[spanIndex];
        const startOffset = range.startContainer === textNode ? range.startOffset : 0;
        const endOffset = range.endContainer === textNode ? range.endOffset : spanText.length;
        const selectedText = spanText.slice(startOffset, endOffset);
        const preText = spanText.slice(0, startOffset);
        const selected = spanText.slice(startOffset, endOffset);

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.font = `${item.height * viewport.scale}px sans-serif`;
        const xOffset = ctx.measureText(preText).width;
        const x = item.transform[4] * viewport.scale + xOffset;
        const y = viewport.height - (item.transform[5] + item.height) * viewport.scale;
        const selectedWidth = ctx.measureText(selected).width;
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
      }
    });
    console.dir(results);
    addSelectionResults(results);
    recordAction({ type: 'add', results: results });
    selection.removeAllRanges();
  }

  const handleEraseClick = (e) => {
    console.log("handleEraseClick");
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // console.dir(rect);
    // console.log(e.clientX, e.clientY);
    const correctedX = (e.clientX - rect.left);
    const correctedY = (e.clientY - rect.top);
    // console.log(correctedX, correctedY);
    selectionResults.forEach((results, index) => {
      const hasMatchedResult = results.some((result) => {
        // console.log(result.selectedX, result.selectedX + result.selectedWidth, result.selectedY, result.selectedY + result.selectedHeight);
        return (
          correctedX >= result.selectedX &&
          correctedX <= result.selectedX + result.selectedWidth &&
          correctedY >= result.selectedY &&
          correctedY <= result.selectedY + result.selectedHeight
        );
      });
      console.log("hasMatchedResult: "+hasMatchedResult);
      if(hasMatchedResult){
        removeSelectionResults(index);
      }
    });
  };

  const handleMouseUp = (e) => {
    setTimeout(() => {
      if(mode == 'redact'){
        handleRedactClick()
      } else if(mode == 'erase'){
        handleEraseClick(e);
      }
    }, 0);
  };

  useEffect(() => {
    const loadingTask = pdfjsLib.getDocument('/sample.pdf');
    loadingTask.promise.then((loadedPdf) => setPdf(loadedPdf));
  }, []);

  const renderTaskRef = useRef(null);

  useEffect(() => {
    console.log("redrawing");
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
    //ctx.clearRect(0, 0, canvas.width, canvas.height); // ← 全面クリア
    const task = pageRef.current.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;

    task.promise.then(() => {
      renderTaskRef.current = null;
      if (selectionResults){
        console.dir(selectionResults);
        selectionResults.forEach((results) => {
          results.forEach(({ selectedX, selectedY, selectedWidth, selectedHeight }) => {
            ctx.fillStyle = 'black';
            ctx.fillRect(selectedX, selectedY, selectedWidth, selectedHeight);
          });
        });
      }
    }).catch((error) => {
      console.warn("Render cancelled or failed:", error);
      renderTaskRef.current = null;
    });
  }, [viewport, selectionResults, textItems, recordAction]);

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

  return (
    viewport && (
      <div className="pdf-container">
        {/* ← Canvasを表示！ */}
        <canvas
          ref={canvasRef}
          width={viewport.width}
          height={viewport.height}
          style={{ border: '1px solid #ccc', position: 'absolute', top: '48px', zIndex: 1, pointerEvents: 'none' }}
        />

        {/* ← 自前で描いたテキストレイヤー */}
        <div
          className="textLayer"
          ref={textLayerRef}
          style={{
            position: 'absolute',
            top: '48px',
            zIndex: 10,
            width: viewport.width,
            height: viewport.height,
            color: 'transparent',
            userSelect: 'text',
            pointerEvents: 'auto',
          }}
          onMouseUp={(event) => handleMouseUp(event)}
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
                  top: `${3+(viewport.height - item.transform[5] * viewport.scale - item.height * viewport.scale)}px`,
                  width: `${item.width * viewport.scale}px`,
                  height: `${item.height * viewport.scale}px`,
                  transformOrigin: '0 0',
                  whiteSpace: 'pre',
                  fontSize: `${item.height * viewport.scale}px`,
                  lineHeight: `${item.height * viewport.scale }px`,
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
