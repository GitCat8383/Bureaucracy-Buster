import React, { useState } from 'react';
import { DocumentAnalysis, Explanation } from '../types';
import { CheckCircleIcon, SparklesIcon, CloseIcon } from '../constants';

interface AssistantPanelProps {
  analysis: DocumentAnalysis | null;
  currentExplanation: Explanation | null;
  isLoadingExplanation: boolean;
  onCloseExplanation: () => void;
  onManualSimplify: (text: string) => void;
}

const AssistantPanel: React.FC<AssistantPanelProps> = ({ 
  analysis, 
  currentExplanation, 
  isLoadingExplanation,
  onCloseExplanation,
  onManualSimplify
}) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onManualSimplify(inputText);
      setInputText('');
    }
  };

  if (!analysis) return null;

  return (
    <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200 overflow-y-auto w-full">
      
      {/* Quick Simplifier Input */}
      <div className="p-4 bg-white border-b border-slate-200">
        <form onSubmit={handleSubmit} className="relative">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Quick Simplifier</label>
          <div className="flex space-x-2">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste confusing text from the document..."
              className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
            />
            <button 
              type="submit"
              disabled={!inputText.trim() || isLoadingExplanation}
              className="bg-brand-600 text-white rounded-lg px-3 py-2 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <SparklesIcon />
            </button>
          </div>
        </form>
      </div>

      {/* Active Explanation Card (Sticky Top) */}
      {(currentExplanation || isLoadingExplanation) && (
        <div className="p-4 bg-white border-b border-brand-100 shadow-sm sticky top-0 z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center text-brand-600 font-semibold">
              <SparklesIcon />
              <span className="ml-2">Simplification</span>
            </div>
            {!isLoadingExplanation && (
                <button onClick={onCloseExplanation} className="text-slate-400 hover:text-slate-600">
                    <CloseIcon />
                </button>
            )}
          </div>
          
          {isLoadingExplanation ? (
             <div className="animate-pulse space-y-3">
               <div className="h-4 bg-brand-100 rounded w-3/4"></div>
               <div className="h-4 bg-brand-50 rounded w-full"></div>
               <div className="h-4 bg-brand-50 rounded w-5/6"></div>
             </div>
          ) : (
             <div className="space-y-3">
               <div className="bg-brand-50 p-3 rounded-lg border border-brand-100">
                 <p className="text-slate-800 font-medium">{currentExplanation?.explanation}</p>
               </div>
               {currentExplanation?.keyTerms && currentExplanation.keyTerms.length > 0 && (
                 <div>
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Key Terms</span>
                   <ul className="mt-1 space-y-1">
                     {currentExplanation.keyTerms.map((term, idx) => (
                       <li key={idx} className="text-sm text-slate-600 flex items-start">
                         <span className="mr-2 text-brand-400">•</span>
                         {term}
                       </li>
                     ))}
                   </ul>
                 </div>
               )}
               {/* Original Context Preview */}
               <div className="mt-2 text-xs text-slate-400 italic border-l-2 border-slate-200 pl-2">
                 "{currentExplanation?.originalText.substring(0, 50)}..."
               </div>
             </div>
          )}
        </div>
      )}

      <div className="p-6 space-y-8">
        {/* Document Purpose */}
        <section>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Document Purpose</h3>
          <p className="text-slate-700 leading-relaxed">
            {analysis.purpose}
          </p>
        </section>

        {/* Detailed Summary */}
        <section className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-3">Plain English Summary</h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            {analysis.summary}
          </p>
        </section>

        {/* Requirements Checklist */}
        <section>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Action Items & Requirements</h3>
          <ul className="space-y-3">
            {analysis.requirements.map((req, idx) => (
              <li key={idx} className="flex items-start bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                <div className="flex-shrink-0 mt-0.5">
                  <CheckCircleIcon />
                </div>
                <span className="ml-3 text-sm text-slate-700">{req}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default AssistantPanel;