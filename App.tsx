import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import DocumentViewer from './components/DocumentViewer';
import AssistantPanel from './components/AssistantPanel';
import Spinner from './components/Spinner';
import { analyzeDocument, simplifyText } from './services/geminiService';
import { extractTextFromPdf, saveFilledPdf } from './services/pdfService';
import { AnalysisStatus, DocumentAnalysis, FileData, Explanation, Annotation } from './types';
import { RefreshIcon } from './constants';

const App: React.FC = () => {
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [currentExplanation, setCurrentExplanation] = useState<Explanation | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  
  // Annotation State
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  const handleFileSelect = async (file: FileData) => {
    setFileData(file);
    setStatus(AnalysisStatus.ANALYZING);
    setAnnotations([]); // Reset annotations for new file
    
    try {
      let textContent = '';
      
      if (file.isPdf && file.content instanceof ArrayBuffer) {
        // Extract text from PDF using PDF.js before sending to Gemini
        try {
            // Clone the buffer because PDF.js might transfer ownership (detach it)
            // preventing the renderer from using it later.
            const bufferClone = file.content.slice(0);
            textContent = await extractTextFromPdf(bufferClone);
        } catch (e) {
            console.error("PDF Extraction failed", e);
            throw new Error("Could not read PDF text.");
        }
      } else if (typeof file.content === 'string') {
        textContent = file.content;
      }

      // Now we have text, send to Gemini
      const isImageForGemini = file.isImage; 
      const contentForGemini = file.isPdf ? textContent : (file.content as string);

      const result = await analyzeDocument(contentForGemini, isImageForGemini, file.type);
      
      // Update result with transcribed text if it was empty (e.g. from PDF extraction)
      if (file.isPdf && !result.transcribedText) {
          result.transcribedText = textContent;
      }
      
      setAnalysis(result);
      setStatus(AnalysisStatus.COMPLETE);
    } catch (error) {
      console.error(error);
      setStatus(AnalysisStatus.ERROR);
      alert("Failed to analyze the document. Please ensure your API Key is valid and try again.");
    }
  };

  const handleTextSelection = async (text: string) => {
    if (!analysis) return;
    
    setIsExplaining(true);
    setCurrentExplanation(null); 

    const result = await simplifyText(text, analysis.transcribedText);
    setCurrentExplanation({
        originalText: text,
        simplifiedText: result.explanation,
        ...result
    });
    setIsExplaining(false);
  };

  const resetApp = () => {
    setFileData(null);
    setAnalysis(null);
    setStatus(AnalysisStatus.IDLE);
    setCurrentExplanation(null);
    setAnnotations([]);
  };

  // Annotation Handlers
  const handleAddAnnotation = (a: Annotation) => {
    setAnnotations(prev => [...prev, a]);
  };

  const handleUpdateAnnotation = (id: string, text: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, text } : a));
  };

  const handleRemoveAnnotation = (id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  };

  const handleDownload = async () => {
    if (!fileData || !fileData.isPdf || !(fileData.content instanceof ArrayBuffer)) return;

    try {
        const bufferCopy = fileData.content.slice(0);
        const pdfBytes = await saveFilledPdf(bufferCopy, annotations);
        
        // Create Blob and trigger download
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `filled_${fileData.name}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Failed to save PDF", error);
        alert("Failed to generate download. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm z-20 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-brand-600 w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-lg">B</div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Bureaucracy Buster</h1>
          </div>
          {status === AnalysisStatus.COMPLETE && (
            <button 
              onClick={resetApp}
              className="flex items-center space-x-1 text-sm font-medium text-slate-500 hover:text-brand-600 transition-colors"
            >
              <RefreshIcon />
              <span>Start Over</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        
        {status === AnalysisStatus.IDLE && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-fade-in">
             <div className="text-center max-w-lg">
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Make paperwork painless</h2>
                <p className="text-slate-600 text-lg">
                  Upload any confusing form or legal document. We'll summarize it and help you translate jargon into plain English instantly.
                </p>
             </div>
             <FileUpload onFileSelect={handleFileSelect} />
          </div>
        )}

        {status === AnalysisStatus.ANALYZING && (
           <div className="flex flex-col items-center justify-center min-h-[60vh]">
             <Spinner />
           </div>
        )}

        {status === AnalysisStatus.COMPLETE && analysis && fileData && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-8rem)]">
            
            {/* Left: Document Viewer */}
            <div className="lg:col-span-7 h-full flex flex-col min-h-[500px]">
              <DocumentViewer 
                title={fileData.name || "Document"} 
                content={fileData.content} 
                isPdf={fileData.isPdf}
                onTextSelected={handleTextSelection}
                currentExplanation={currentExplanation}
                isExplaining={isExplaining}
                onClearExplanation={() => setCurrentExplanation(null)}
                annotations={annotations}
                onAddAnnotation={handleAddAnnotation}
                onUpdateAnnotation={handleUpdateAnnotation}
                onRemoveAnnotation={handleRemoveAnnotation}
                onDownload={handleDownload}
              />
            </div>

            {/* Right: Assistant Panel */}
            <div className="lg:col-span-5 h-full min-h-[500px] bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
               <AssistantPanel 
                  analysis={analysis} 
                  currentExplanation={currentExplanation}
                  isLoadingExplanation={isExplaining}
                  onCloseExplanation={() => setCurrentExplanation(null)}
                  onManualSimplify={handleTextSelection}
               />
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

export default App;