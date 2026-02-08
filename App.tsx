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
  const languageOptions = [
    { label: 'English', value: 'English' },
    { label: 'Spanish', value: 'Spanish' },
    { label: 'French', value: 'French' },
    { label: 'Vietnamese', value: 'Vietnamese' },
  ];

  const [targetLanguage, setTargetLanguage] = useState(languageOptions[0].value);
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [currentExplanation, setCurrentExplanation] = useState<Explanation | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  
  // Annotation State
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  const runAnalysis = async (file: FileData, language: string, overrideText?: string) => {
    setStatus(AnalysisStatus.ANALYZING);
    setCurrentExplanation(null);
    
    try {
      let textContent = overrideText || '';
      let isImageForGemini = file.isImage;
      let contentForGemini = '';
      let mimeType = file.type;

      if (textContent) {
        isImageForGemini = false;
        contentForGemini = textContent;
        mimeType = 'text/plain';
      } else if (file.isPdf && file.content instanceof ArrayBuffer) {
        try {
          const bufferClone = file.content.slice(0);
          textContent = await extractTextFromPdf(bufferClone);
          contentForGemini = textContent;
          isImageForGemini = false;
          mimeType = 'text/plain';
        } catch (e) {
          console.error("PDF Extraction failed", e);
          throw new Error("Could not read PDF text.");
        }
      } else if (typeof file.content === 'string') {
        textContent = file.content;
        contentForGemini = file.content;
      } else {
        throw new Error("Unsupported file content.");
      }

      const result = await analyzeDocument(contentForGemini, isImageForGemini, mimeType, language);
      
      if (!result.transcribedText && textContent) {
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

  const handleFileSelect = async (file: FileData) => {
    setFileData(file);
    setAnnotations([]); // Reset annotations for new file
    await runAnalysis(file, targetLanguage);
  };

  const handleTextSelection = async (text: string) => {
    if (!analysis) return;
    
    setIsExplaining(true);
    setCurrentExplanation(null); 

    const result = await simplifyText(text, analysis, targetLanguage);
    setCurrentExplanation({
        originalText: text,
        simplifiedText: result.explanation,
        translatedText: result.translatedText,
        translatedLanguage: result.translatedLanguage,
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
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Language</label>
              <select
                value={targetLanguage}
                onChange={async (e) => {
                  const nextLanguage = e.target.value;
                  setTargetLanguage(nextLanguage);
                  if (fileData && analysis && status === AnalysisStatus.COMPLETE) {
                    await runAnalysis(fileData, nextLanguage, analysis.transcribedText);
                  }
                }}
                className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
                targetLanguage={targetLanguage}
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
                  targetLanguage={targetLanguage}
               />
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

export default App;