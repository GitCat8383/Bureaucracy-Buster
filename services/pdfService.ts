import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Annotation } from '../types';

// Configure worker (match local pdfjs-dist version)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export const extractTextFromPdf = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  const numPages = pdf.numPages;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += `--- Page ${i} ---\n${pageText}\n\n`;
  }

  return fullText;
};

export const getPdfDocument = async (arrayBuffer: ArrayBuffer) => {
    return pdfjsLib.getDocument({ data: arrayBuffer }).promise;
};

export const saveFilledPdf = async (originalBuffer: ArrayBuffer, annotations: Annotation[]): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.load(originalBuffer);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Courier);

  for (const annotation of annotations) {
    if (annotation.page > pages.length) continue;
    
    const page = pages[annotation.page - 1]; // 0-based index for pdf-lib
    const { height } = page.getSize();
    
    // Convert DOM coordinates (Top-Left) to PDF coordinates (Bottom-Left)
    // We assume the stored x,y are based on the PDF's intrinsic size (scale 1.0)
    // The PDF page height in pdf-lib points is equivalent to the pixel height at 72DPI/scale 1 usually.
    // However, we need to be careful. The input x/y were captured relative to the view port.
    
    // Simple conversion assuming 1px = 1pt for standard view
    const x = annotation.x;
    const y = height - annotation.y - 12; // Subtract font height approx
    
    page.drawText(annotation.text, {
      x: x,
      y: y,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
};