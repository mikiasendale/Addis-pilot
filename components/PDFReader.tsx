import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, Highlighter, MessageCircle, BrainCircuit, X, Trophy } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFReaderProps {
  onExplain: (text: string) => void;
  onQuiz: (text: string) => void;
  file: File | null;
  startPage?: number;
}

export const PDFReader: React.FC<PDFReaderProps> = ({ onExplain, onQuiz, file, startPage = 1 }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(startPage);
  const [selection, setSelection] = useState<{text: string, x: number, y: number} | null>(null);
  
  // Resizing state
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState<number>(600);

  // Resize Observer for auto-fitting PDF
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        // Leave some margin for the "desk" look
        const newWidth = Math.floor(entry.contentRect.width) - 64;
        setPageWidth(newWidth > 200 ? newWidth : 600);
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Reset to startPage whenever file or startPage changes
  useEffect(() => {
    setPageNumber(startPage);
  }, [file, startPage]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    const windowSelection = window.getSelection();
    if (windowSelection && windowSelection.toString().trim().length > 0) {
      const range = windowSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Calculate position relative to the viewport
      setSelection({
        text: windowSelection.toString(),
        x: rect.left + (rect.width / 2),
        y: rect.top - 10 
      });
    } else {
      setSelection(null);
    }
  };

  const clearSelection = () => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const isLastPage = pageNumber === numPages && numPages > 0;

  return (
    <div className="flex flex-col h-full bg-slate-100 text-slate-900 rounded-xl overflow-hidden shadow-2xl relative">
       {/* PDF Controls */}
       <div className="h-12 bg-white border-b flex items-center justify-between px-4 z-10 shadow-sm shrink-0">
          <span className="font-bold text-slate-700 truncate max-w-[200px]">{file?.name || 'Textbook'}</span>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setPageNumber(prev => Math.max(prev - 1, startPage))}
              disabled={pageNumber <= startPage}
              className="p-1 hover:bg-slate-100 rounded disabled:opacity-50 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-mono whitespace-nowrap bg-slate-100 px-3 py-1 rounded-full border">{pageNumber} / {numPages || '--'}</span>
            <button 
              onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}
              disabled={pageNumber >= numPages}
              className="p-1 hover:bg-slate-100 rounded disabled:opacity-50 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
       </div>

       {/* PDF Viewport */}
       <div 
         ref={containerRef}
         className="flex-1 overflow-auto bg-slate-200/50 relative flex flex-col items-center py-8" 
         onMouseUp={handleMouseUp}
       >
          {file ? (
            <div className="relative flex flex-col items-center">
               <Document 
                 file={file} 
                 onLoadSuccess={onDocumentLoadSuccess}
                 loading={<div className="h-[800px] bg-white animate-pulse rounded-lg border border-slate-300" style={{ width: pageWidth }} />}
               >
                <Page 
                  pageNumber={pageNumber} 
                  renderTextLayer={true} 
                  renderAnnotationLayer={false}
                  width={pageWidth}
                  className="bg-white"
                />
              </Document>
              
              {/* QUIZ SECTION (Appears below the last page) */}
              {isLastPage && (
                <div className="w-full max-w-2xl mt-8 animate-in slide-in-from-bottom-6 duration-700 fade-in px-4">
                    <div className="bg-slate-900 text-white rounded-2xl p-8 shadow-2xl border border-indigo-500/30 flex flex-col items-center text-center">
                        <div className="bg-indigo-600 p-4 rounded-full mb-4 shadow-lg shadow-indigo-500/50">
                          <Trophy size={40} className="text-yellow-300" />
                        </div>
                        <h2 className="text-3xl font-bold mb-2">Chapter Complete!</h2>
                        <p className="text-slate-400 mb-8 text-base">
                          Excellent progress! Verify your mastery of these concepts with Empress Taytu's challenge.
                        </p>
                        <button 
                          onClick={() => onQuiz("Generate a summary quiz for the entire chapter I just read.")}
                          className="w-full py-4 bg-white text-indigo-700 rounded-xl font-bold text-lg hover:bg-indigo-50 transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                          <BrainCircuit size={24} />
                          Start Mastery Quiz
                        </button>
                    </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
              <div className="p-4 bg-slate-100 rounded-full border border-slate-200">
                <Highlighter size={48} className="text-indigo-400" />
              </div>
              <p className="font-medium">Please select a textbook to begin learning.</p>
            </div>
          )}

          {/* Context Menu Popup (Floating) */}
          {selection && (
            <div 
              style={{ position: 'fixed', left: selection.x, top: selection.y }}
              className="z-50 -translate-x-1/2 -translate-y-full mb-3 flex flex-col items-center gap-2"
            >
              <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-1.5 flex items-center gap-1 animate-in fade-in zoom-in duration-200 border border-slate-700/50 backdrop-blur-md">
                <button 
                  onClick={() => { onExplain(selection.text); clearSelection(); }}
                  className="px-4 py-2 hover:bg-indigo-600 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all group"
                >
                  <MessageCircle size={18} className="text-indigo-400 group-hover:text-white" />
                  Explain
                </button>
                <div className="w-px h-6 bg-slate-700/50 mx-1"></div>
                <button 
                  onClick={() => { onQuiz(selection.text); clearSelection(); }}
                  className="px-4 py-2 hover:bg-emerald-600 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all group"
                >
                  <BrainCircuit size={18} className="text-emerald-400 group-hover:text-white" />
                  Quiz Me
                </button>
                <div className="w-px h-6 bg-slate-700/50 mx-1"></div>
                <button 
                  onClick={clearSelection}
                  className="p-2 hover:bg-red-500 rounded-xl transition-all text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="w-4 h-4 bg-slate-900 rotate-45 transform -translate-y-2.5 border-r border-b border-slate-700/50"></div>
            </div>
          )}
       </div>
    </div>
  );
};