import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

interface PdfRendererProps {
  pdfData: ArrayBuffer;
  scale?: number;
}

const PdfPage: React.FC<{ pageNumber: number, pdfDoc: any, scale: number }> = ({ pageNumber, pdfDoc, scale }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
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

        // Cancel previous render task if exists to prevent overlapping renders
        if (renderTaskRef.current) {
            try {
                renderTaskRef.current.cancel();
            } catch(e) { /* ignore cancel error */ }
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
                // tx[0] = scaleX, tx[3] = scaleY
                // approximate font height from transform matrix
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

  return (
    <div className="relative mb-6 bg-white shadow-md rounded-sm overflow-hidden" style={{ width: 'fit-content', margin: '0 auto 24px auto' }}>
      <canvas ref={canvasRef} className="block" />
      <div ref={textLayerRef} className="textLayer" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 transition-opacity">
            <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};

const PdfRenderer: React.FC<PdfRendererProps> = ({ pdfData, scale = 1.0 }) => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pages, setPages] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPdf = async () => {
      try {
        setError(null);
        // Copy the buffer to prevent detaching issues if reused
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
        <PdfPage key={pageNum} pageNumber={pageNum} pdfDoc={pdfDoc} scale={scale} />
      ))}
    </div>
  );
};

export default PdfRenderer;