import React, { useRef, useState, useEffect } from 'react';
import { DocumentIcon, SparklesIcon, CloseIcon } from '../constants';
import { Explanation, Annotation } from '../types';
import PdfRenderer from './PdfRenderer';

interface DocumentViewerProps {
  title: string;
  content: string | ArrayBuffer;
  isPdf?: boolean;
  onTextSelected: (text: string) => void;
  currentExplanation: Explanation | null;
  isExplaining: boolean;
  onClearExplanation: () => void;
  annotations: Annotation[];
  onAddAnnotation: (a: Annotation) => void;
  onUpdateAnnotation: (id: string, text: string) => void;
  onRemoveAnnotation: (id: string) => void;
  onDownload: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ 
  title, 
  content,
  isPdf, 
  onTextSelected,
  currentExplanation,
  isExplaining,
  onClearExplanation,
  annotations,
  onAddAnnotation,
  onUpdateAnnotation,
  onRemoveAnnotation,
  onDownload
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [selectionTooltip, setSelectionTooltip] = useState<{ x: number, y: number, show: boolean } | null>(null);
  const [resultPopover, setResultPopover] = useState<{ x: number, y: number, show: boolean } | null>(null);
  const [scale, setScale] = useState(1.0);

  // Handle Selection Logic
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      
      // Basic check: is selection inside contentRef?
      if (!selection || selection.isCollapsed || !contentRef.current?.contains(selection.anchorNode)) {
        setSelectionTooltip(null);
        return;
      }
      
      // Also ignore if selection is inside an input field (user editing text)
      if (selection.anchorNode && (selection.anchorNode as HTMLElement).nodeName === 'INPUT') {
          setSelectionTooltip(null);
          return;
      }

      const text = selection.toString().trim();
      if (text.length < 3) {
        setSelectionTooltip(null);
        return;
      }

      // Ensure we have a valid range to position tooltip
      if (selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      setSelectionTooltip({
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
        show: true
      });
    };

    document.addEventListener('selectionchange', handleSelection);
    const handleMouseUp = () => setTimeout(handleSelection, 10);
    const handleKeyUp = () => setTimeout(handleSelection, 10);

    contentRef.current?.addEventListener('mouseup', handleMouseUp);
    contentRef.current?.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('selectionchange', handleSelection);
      contentRef.current?.removeEventListener('mouseup', handleMouseUp);
      contentRef.current?.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleSimplifyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const selection = window.getSelection();
    if (selection && selectionTooltip) {
      const text = selection.toString();
      onTextSelected(text);
      
      setResultPopover({
        x: selectionTooltip.x,
        y: selectionTooltip.y,
        show: true
      });
      setSelectionTooltip(null);
      selection.removeAllRanges();
    }
  };

  const handleClosePopover = () => {
    setResultPopover(null);
    onClearExplanation();
  };

  // Close popover if clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const popoverEl = document.getElementById('explanation-popover');
      if (popoverEl && !popoverEl.contains(target) && resultPopover?.show) {
        handleClosePopover();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [resultPopover]);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50 rounded-t-xl shrink-0">
        <div className="flex items-center">
          <DocumentIcon />
          <h2 className="ml-3 font-semibold text-slate-700 truncate max-w-[180px]">{title}</h2>
        </div>
        
        {/* Toolbar */}
        <div className="flex items-center space-x-2">
            {isPdf && (
                 <button 
                    onClick={onDownload}
                    className="flex items-center px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-md hover:bg-brand-700 transition-colors shadow-sm"
                 >
                    <span className="hidden sm:inline">Download PDF</span>
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </button>
            )}
        </div>
      </div>
      
      {/* Helper Banner */}
      {isPdf && (
        <div className="bg-brand-50 border-b border-brand-100 px-4 py-2 text-xs text-brand-700 text-center font-medium flex justify-center gap-4">
            <span>✨ Select text to Explain</span>
            <span className="text-brand-300">|</span>
            <span>🖱️ Double-click to Add Text</span>
        </div>
      )}

      <div className="relative flex-1 overflow-hidden" ref={contentRef}>
        {isPdf ? (
            <div className="h-full overflow-auto bg-slate-200 scroll-smooth">
                {/* Floating Zoom Controls */}
                <div className="sticky top-4 right-4 z-20 flex justify-end px-4 pointer-events-none">
                    <div className="bg-white/90 backdrop-blur shadow-md border border-slate-200 rounded-lg p-1 pointer-events-auto flex gap-1 items-center">
                        <button 
                          onClick={() => setScale(s => Math.max(0.5, s - 0.2))} 
                          className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600 font-bold"
                          title="Zoom Out"
                        >−</button>
                        <span className="w-12 text-center text-xs font-mono text-slate-600 font-medium">
                          {Math.round(scale * 100)}%
                        </span>
                        <button 
                          onClick={() => setScale(s => Math.min(3.0, s + 0.2))} 
                          className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600 font-bold"
                          title="Zoom In"
                        >+</button>
                    </div>
                </div>

                <PdfRenderer 
                    pdfData={content as ArrayBuffer} 
                    scale={scale} 
                    annotations={annotations}
                    onAddAnnotation={onAddAnnotation}
                    onUpdateAnnotation={onUpdateAnnotation}
                    onRemoveAnnotation={onRemoveAnnotation}
                />
            </div>
        ) : (
            <div className="h-full overflow-auto p-6 md:p-8 bg-white">
                <div className="prose prose-slate max-w-none">
                {(content as string).split('\n').map((paragraph, idx) => (
                    <p key={idx} className="mb-4 text-slate-700 leading-relaxed text-lg whitespace-pre-wrap">
                    {paragraph}
                    </p>
                ))}
                </div>
            </div>
        )}
      </div>

      {/* Selection Tooltip */}
      {selectionTooltip?.show && !resultPopover?.show && (
        <button
          onClick={handleSimplifyClick}
          style={{ 
            position: 'fixed', 
            left: selectionTooltip.x, 
            top: selectionTooltip.y, 
            transform: 'translate(-50%, -100%)' 
          }}
          className="z-50 flex items-center gap-2 px-4 py-2 mb-2 text-sm font-semibold text-white bg-brand-600 rounded-full shadow-xl hover:bg-brand-700 hover:scale-105 transition-all animate-bounce"
        >
          <SparklesIcon />
          <span>Explain</span>
        </button>
      )}

      {/* Result Popover */}
      {resultPopover?.show && (
        <div 
          id="explanation-popover"
          style={{ 
            position: 'fixed', 
            left: Math.min(Math.max(resultPopover.x, 20), window.innerWidth - 340), 
            top: resultPopover.y + 20, 
            width: '320px',
            zIndex: 100
          }}
          className="bg-white rounded-xl shadow-2xl border border-brand-100 flex flex-col overflow-hidden animate-fade-in-up"
        >
          <div className="bg-brand-50 px-4 py-3 flex items-center justify-between border-b border-brand-100">
            <div className="flex items-center text-brand-700 text-sm font-bold">
              <SparklesIcon />
              <span className="ml-2">Plain English</span>
            </div>
            {!isExplaining && (
              <button onClick={handleClosePopover} className="text-brand-400 hover:text-brand-600 transition-colors">
                <CloseIcon />
              </button>
            )}
          </div>
          
          <div className="p-4 max-h-64 overflow-y-auto">
            {isExplaining ? (
              <div className="flex flex-col items-center justify-center py-4 space-y-3">
                <div className="w-6 h-6 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                <p className="text-xs text-slate-400 font-medium">Translating...</p>
              </div>
            ) : currentExplanation ? (
              <div className="space-y-3">
                 <p className="text-slate-800 text-sm leading-relaxed font-medium">
                   {currentExplanation.simplifiedText}
                 </p>
                 
                 {currentExplanation.keyTerms.length > 0 && (
                   <div className="pt-2 border-t border-slate-100">
                     <p className="text-xs font-bold text-slate-400 uppercase mb-2">Key Terms</p>
                     <ul className="space-y-1">
                       {currentExplanation.keyTerms.map((term, i) => (
                         <li key={i} className="text-xs text-slate-600 flex items-start">
                           <span className="text-brand-400 mr-1.5">•</span>
                           {term}
                         </li>
                       ))}
                     </ul>
                   </div>
                 )}
              </div>
            ) : (
              <p className="text-sm text-red-500">Could not explain text.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;