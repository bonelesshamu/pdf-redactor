import React, { useCallback, useState } from 'react';
import MenuBar from './MenuBar';
import PdfCanvas from './PdfCanvas';
import { v4 as uuid } from "uuid";
import "./App.css";

let maskIdCounter = 0;
function generateMaskId() {
  return `mask-${Date.now()}-${maskIdCounter++}`;
}

export default function App() {
  const [mode, setMode] = useState('redact'); // 'redact' or 'erase'
  const [pageNum, setPageNum] = useState(1);
  const [selectionResults, setSelectionResults] = useState([]);
  const [actionHistory, setActionHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [value, setValue] = useState("");


  const recordAction = useCallback((action) => {
    console.dir(action);
    setActionHistory(prev => [...prev, action])}, []);

  const addSelectionResults = useCallback((results) => {
    results.maskId = generateMaskId();
    setSelectionResults(prev => [...prev, results]);
  }, []);

  const removeSelectionResults = useCallback((matchedIndex) => {
    const removedResults = selectionResults.filter((_, i) => i === matchedIndex)[0];
    setSelectionResults(prev => prev.filter((_, i) => i !== matchedIndex));
    recordAction({ type: 'remove', results: removedResults });
  }, [selectionResults, recordAction]);

  const undo = useCallback(() => {
    console.log("undo");
    console.dir(actionHistory);
    if (actionHistory.length === 0) return;
    const lastResults = actionHistory[actionHistory.length - 1];
    console.dir(lastResults);

    setActionHistory(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, lastResults]);

    if(lastResults.type === 'add') {
      console.log('add');
      setSelectionResults(prev => prev.slice(0, -1));
    } else if (lastResults.type === 'remove') {
      console.log('remove');
      console.dir(lastResults);
      console.dir(lastResults.results);
      addSelectionResults(lastResults.results);
    }
  }, [actionHistory, addSelectionResults, setSelectionResults]);

  const redo = useCallback(() => {
    console.log("redo");
    console.dir(redoStack);
    if (redoStack.length === 0) return;
    const lastUndo = redoStack[redoStack.length - 1];

    setRedoStack(prev => prev.slice(0, -1));
    setActionHistory(prev => [...prev, lastUndo]);

    if (lastUndo.type === 'add') {
      addSelectionResults(lastUndo.results);
    } else if (lastUndo.type === 'remove') {
      setSelectionResults(prev => prev.slice(0, -1));
    }
  }, [redoStack, addSelectionResults, setSelectionResults]);

  return (
    <div>
      <div className="menu-bar">
        <MenuBar onUndo={undo} onRedo={redo} mode={mode} setMode={setMode} pageNum={pageNum} setPageNum={setPageNum} setValue={setValue}/>
      </div>
      <div className={`pdf-wrapper ${mode}-mode`}>
        <PdfCanvas selectionResults={selectionResults}
          addSelectionResults={addSelectionResults}
          removeSelectionResults={removeSelectionResults}
          recordAction={recordAction}
          mode={mode}
          pageNum={pageNum}
          value={value} />
      </div>
    </div>
  );
};