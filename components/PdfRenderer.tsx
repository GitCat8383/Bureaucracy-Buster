import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Annotation } from '../types';

interface PdfRendererProps {
  pdfData: ArrayBuffer;
  scale?: number;
  annotations: Annotation[];
  onAddAnnotation: (a: Annotation) => void;
  onUpdateAnnotation: (id: string, text: string) => void;
  onRemoveAnnotation: (id: string) => void;
}

const PdfPage: React.FC<{ 
  pageNumber: number, 
  pdfDoc: any, 
  scale: number,
  pageAnnotations: Annotation[],
  onAddAnnotation: (a: Annotation) => void,
  onUpdateAnnotation: (id: string, text: string) => void,
  onRemoveAnnotation: (id: string) => void
}> = ({ 
  pageNumber, 
  pdfDoc, 
  scale, 
  pageAnnotations, 
  onAddAnnotation, 
  onUpdateAnnotation, 
  onRemoveAnnotation 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let isCancelled = false;

    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current || !textLayerRef.current) return;
      setLoading(true);

      try {
        const page = await pdfDoc.getPage(pageNumber);
        
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";

        const transform = outputScale !== 1
          ? [outputScale, 0, 0, outputScale, 0, 0]
          : null;

        const renderContext = {
          canvasContext: context,
          transform: transform,
          viewport: viewport,
        };

        if (renderTaskRef.current) {
            try {
                renderTaskRef.current.cancel();
            } catch(e) { /* ignore */ }
        }

        renderTaskRef.current = page.render(renderContext);
        await renderTaskRef.current.promise;

        if (isCancelled) return;

        // Render Text Layer
        const textContent = await page.getTextContent();
        
        if (isCancelled) return;

        if (textLayerRef.current) {
            textLayerRef.current.innerHTML = ''; 
            textLayerRef.current.style.width = Math.floor(viewport.width) + "px";
            textLayerRef.current.style.height = Math.floor(viewport.height) + "px";
            textLayerRef.current.style.setProperty('--scale-factor', `${scale}`);
            
            for (const item of textContent.items as any[]) {
                const itemStr = item.str;
                if (!itemStr.trim()) continue;
                
                const tx = item.transform;
                let fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]));
                let fontHeightPx = fontHeight * scale; 
                
                const [x, y] = viewport.transform ? 
                    pdfjsLib.Util.applyTransform([tx[4], tx[5]], viewport.transform) : 
                    [tx[4], tx[5]];

                const span = document.createElement('span');
                span.textContent = itemStr;
                span.style.left = `${x}px`;
                span.style.top = `${y - fontHeightPx * 0.8}px`; 
                span.style.fontSize = `${fontHeightPx}px`;
                span.style.position = 'absolute';
                span.style.transformOrigin = '0% 0%';
                
                textLayerRef.current.appendChild(span);
            }
        }
        
        setLoading(false);
      } catch (error: any) {
        if (error.name !== 'RenderingCancelledException') {
            console.error('Render error:', error);
        }
      }
    };

    renderPage();

    return () => {
        isCancelled = true;
        if (renderTaskRef.current) {
            try {
                renderTaskRef.current.cancel();
            } catch(e) { /* ignore */ }
        }
    };
  }, [pageNumber, pdfDoc, scale]);

  const handlePageDoubleClick = (e: React.MouseEvent) => {
    if (!wrapperRef.current) return;
    
    // Prevent creating input if clicking on existing input components
    if ((e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('button')) return;

    // Do not create annotation if user is selecting text
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) return;

    const rect = wrapperRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert screen coordinates back to unscaled PDF coordinates
    const pdfX = clickX / scale;
    const pdfY = clickY / scale;

    onAddAnnotation({
      id: Math.random().toString(36).substr(2, 9),
      page: pageNumber,
      x: pdfX,
      y: pdfY,
      text: ''
    });
  };

  return (
    <div 
      ref={wrapperRef}
      className="relative mb-6 bg-white shadow-md rounded-sm overflow-hidden"
      style={{ width: 'fit-content', margin: '0 auto 24px auto' }}
      onDoubleClick={handlePageDoubleClick}
    >
      <canvas ref={canvasRef} className="block" />
      
      {/* Text Layer (for selection) */}
      <div ref={textLayerRef} className="textLayer" />

      {/* Form Inputs Overlay */}
      {pageAnnotations.map(ann => (
        <div
            key={ann.id}
            className="absolute z-20 group"
            style={{
                left: `${ann.x * scale}px`,
                top: `${ann.y * scale - 7}px`, 
            }}
        >
            <input
                type="text"
                value={ann.text}
                onChange={(e) => onUpdateAnnotation(ann.id, e.target.value)}
                autoFocus={!ann.text}
                placeholder="Type..."
                className="pdf-input text-sm rounded"
                style={{
                    fontSize: `${12 * scale}px`,
                    minWidth: `${100 * scale}px`,
                    background: ann.text ? 'transparent' : 'rgba(255, 255, 255, 0.9)',
                }}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
            />
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    onRemoveAnnotation(ann.id);
                }}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600 focus:opacity-100"
                title="Delete field"
            >
                ×
            </button>
        </div>
      ))}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 transition-opacity">
            <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};

const PdfRenderer: React.FC<PdfRendererProps> = ({ 
  pdfData, 
  scale = 1.0, 
  annotations,
  onAddAnnotation,
  onUpdateAnnotation,
  onRemoveAnnotation
}) => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pages, setPages] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPdf = async () => {
      try {
        setError(null);
        const bufferCopy = pdfData.slice(0); 
        const loadingTask = pdfjsLib.getDocument({ data: bufferCopy });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setPages(Array.from({ length: doc.numPages }, (_, i) => i + 1));
      } catch (e: any) {
        console.error("Error loading PDF", e);
        setError(e.message || "Failed to load PDF");
      }
    };
    loadPdf();
  }, [pdfData]);

  if (error) return (
      <div className="flex flex-col items-center justify-center h-64 text-red-400 space-y-3 p-6 text-center">
          <p className="font-semibold">Error loading PDF</p>
          <p className="text-sm">{error}</p>
      </div>
  );

  if (!pdfDoc) return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-3">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-brand-500 rounded-full animate-spin"></div>
          <p className="text-sm font-medium">Processing PDF...</p>
      </div>
  );

  return (
    <div className="flex flex-col items-center bg-slate-200/50 p-6 min-h-full">
      {pages.map(pageNum => (
        <PdfPage 
          key={pageNum} 
          pageNumber={pageNum} 
          pdfDoc={pdfDoc} 
          scale={scale} 
          pageAnnotations={annotations.filter(a => a.page === pageNum)}
          onAddAnnotation={onAddAnnotation}
          onUpdateAnnotation={onUpdateAnnotation}
          onRemoveAnnotation={onRemoveAnnotation}
        />
      ))}
    </div>
  );
};

export default PdfRenderer;