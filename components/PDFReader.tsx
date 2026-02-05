import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, Highlighter, MessageCircle, BrainCircuit, X, Trophy } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFReaderProps {
  onExplain: (text: string) => void;
  onQuiz: (text: string) => void;
  file: File | null;
}

export const PDFReader: React.FC<PDFReaderProps> = ({ onExplain, onQuiz, file }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [selection, setSelection] = useState<{text: string, x: number, y: number} | null>(null);
  
  // Resizing state
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState<number>(600);

  // Resize Observer for auto-fitting PDF
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        // Calculate width: Container width minus padding (e.g., 64px for p-8)
        // We leave some breathing room so it looks like paper on a desk
        const newWidth = Math.floor(entry.contentRect.width) - 48;
        setPageWidth(newWidth > 0 ? newWidth : 600);
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    const windowSelection = window.getSelection();
    if (windowSelection && windowSelection.toString().trim().length > 0) {
      const range = windowSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Calculate position relative to the viewport/container
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
              onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
              disabled={pageNumber <= 1}
              className="p-1 hover:bg-slate-100 rounded disabled:opacity-50"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-mono whitespace-nowrap">{pageNumber} / {numPages || '--'}</span>
            <button 
              onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}
              disabled={pageNumber >= numPages}
              className="p-1 hover:bg-slate-100 rounded disabled:opacity-50"
            >
              <ChevronRight size={20} />
            </button>
          </div>
       </div>

       {/* PDF Viewport */}
       <div 
         ref={containerRef}
         className="flex-1 overflow-auto bg-slate-200/50 relative flex flex-col items-center py-6" 
         onMouseUp={handleMouseUp}
       >
          {file ? (
            <div className="relative shadow-xl flex flex-col gap-6 items-center">
               <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
                <Page 
                  pageNumber={pageNumber} 
                  renderTextLayer={true} 
                  renderAnnotationLayer={false}
                  width={pageWidth} 
                  className="bg-white border border-slate-300"
                />
              </Document>
              
              {/* QUIZ SECTION (Appears below the last page) */}
              {isLastPage && (
                <div className="w-full max-w-2xl mt-4 animate-in slide-in-from-bottom-4 duration-700 fade-in">
                    <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-2xl border border-indigo-500/30 flex flex-col items-center text-center">
                        <div className="bg-indigo-600 p-3 rounded-full mb-4 shadow-lg shadow-indigo-500/50">
                          <Trophy size={32} className="text-yellow-300" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Chapter Complete!</h2>
                        <p className="text-slate-300 mb-6 text-sm">
                          You've finished this section. Verify your mastery before moving on.
                        </p>
                        <button 
                          onClick={() => onQuiz("Generate a summary quiz for the entire chapter I just read.")}
                          className="w-full py-4 bg-white text-indigo-700 rounded-xl font-bold text-lg hover:bg-indigo-50 transition-colors shadow-lg flex items-center justify-center gap-2"
                        >
                          <BrainCircuit size={20} />
                          Take Chapter Quiz
                        </button>
                    </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
              <Highlighter size={48} />
              <p>Load the Ministry of Education PDF to begin.</p>
            </div>
          )}

          {/* Context Menu Popup (Floating) */}
          {selection && (
            <div 
              style={{ position: 'fixed', left: selection.x, top: selection.y }}
              className="z-50 -translate-x-1/2 -translate-y-full mb-2 flex flex-col items-center gap-2"
            >
              <div className="bg-slate-900 text-white rounded-xl shadow-xl p-1 flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                <button 
                  onClick={() => { onExplain(selection.text); clearSelection(); }}
                  className="px-3 py-2 hover:bg-slate-700 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <MessageCircle size={16} className="text-indigo-400" />
                  Explain
                </button>
                <div className="w-px h-6 bg-slate-700 mx-1"></div>
                <button 
                  onClick={() => { onQuiz(selection.text); clearSelection(); }}
                  className="px-3 py-2 hover:bg-slate-700 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <BrainCircuit size={16} className="text-emerald-400" />
                  Quiz Me
                </button>
                <div className="w-px h-6 bg-slate-700 mx-1"></div>
                <button 
                  onClick={clearSelection}
                  className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="w-3 h-3 bg-slate-900 rotate-45 transform -translate-y-1.5"></div>
            </div>
          )}
       </div>
    </div>
  );
};