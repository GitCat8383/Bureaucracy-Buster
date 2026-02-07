export enum AnalysisStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

export interface DocumentAnalysis {
  summary: string;
  transcribedText: string; // If image, this is the OCR text. If text file, this is content.
  requirements: string[];
  purpose: string;
}

export interface Explanation {
  originalText: string;
  simplifiedText: string;
  keyTerms: string[];
}

export interface FileData {
  name: string;
  type: string;
  content: string | ArrayBuffer; // Text content, Base64 string, or ArrayBuffer for PDF
  isImage: boolean;
  isPdf?: boolean;
}