import React, { useMemo, useRef, useState } from 'react';
import { DocumentAnalysis, Explanation } from '../types';
import { CheckCircleIcon, SparklesIcon, CloseIcon } from '../constants';
import { fetchSpeech } from '../services/ttsService';

interface AssistantPanelProps {
  analysis: DocumentAnalysis | null;
  currentExplanation: Explanation | null;
  isLoadingExplanation: boolean;
  onCloseExplanation: () => void;
  onManualSimplify: (text: string) => void;
  targetLanguage: string;
}

const AssistantPanel: React.FC<AssistantPanelProps> = ({ 
  analysis, 
  currentExplanation, 
  isLoadingExplanation,
  onCloseExplanation,
  onManualSimplify,
  targetLanguage
}) => {
  const [inputText, setInputText] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingExplanationAudio, setIsPlayingExplanationAudio] = useState(false);
  const [explanationAudioUrl, setExplanationAudioUrl] = useState<string | null>(null);
  const explanationAudioRef = useRef<HTMLAudioElement | null>(null);

  const contextText = useMemo(() => {
    if (!analysis) return '';
    const labels: Record<string, { purpose: string; summary: string; requirements: string }> = {
      English: { purpose: 'Purpose', summary: 'Summary', requirements: 'Requirements' },
      Spanish: { purpose: 'Proposito', summary: 'Resumen', requirements: 'Requisitos' },
      French: { purpose: 'Objet', summary: 'Resume', requirements: 'Exigences' },
      Vietnamese: { purpose: 'Muc dich', summary: 'Tom tat', requirements: 'Yeu cau' },
    };
    const labelSet = labels[targetLanguage] || labels.English;
    const requirements = analysis.requirements.length
      ? analysis.requirements.join('; ')
      : '';
    return `${labelSet.purpose}: ${analysis.purpose}. ${labelSet.summary}: ${analysis.summary}. ${labelSet.requirements}: ${requirements}.`;
  }, [analysis, targetLanguage]);

  const handlePlayAudio = async () => {
    if (!contextText.trim()) return;
    setIsPlayingAudio(true);
    try {
      const audioBlob = await fetchSpeech(contextText, targetLanguage);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
      }
    } catch (error) {
      console.error(error);
      alert("Failed to generate audio. Please try again.");
    } finally {
      setIsPlayingAudio(false);
    }
  };

  const handleStopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  const handlePlayExplanation = async () => {
    if (!currentExplanation?.simplifiedText?.trim()) return;
    setIsPlayingExplanationAudio(true);
    try {
      const audioBlob = await fetchSpeech(currentExplanation.simplifiedText, targetLanguage);
      if (explanationAudioUrl) {
        URL.revokeObjectURL(explanationAudioUrl);
      }
      const url = URL.createObjectURL(audioBlob);
      setExplanationAudioUrl(url);
      if (explanationAudioRef.current) {
        explanationAudioRef.current.src = url;
        await explanationAudioRef.current.play();
      }
    } catch (error) {
      console.error(error);
      alert("Failed to generate audio. Please try again.");
    } finally {
      setIsPlayingExplanationAudio(false);
    }
  };

  const handleStopExplanation = () => {
    if (explanationAudioRef.current) {
      explanationAudioRef.current.pause();
      explanationAudioRef.current.currentTime = 0;
    }
    if (explanationAudioUrl) {
      URL.revokeObjectURL(explanationAudioUrl);
      setExplanationAudioUrl(null);
    }
  };

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
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePlayExplanation}
                disabled={isLoadingExplanation || isPlayingExplanationAudio || !currentExplanation}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPlayingExplanationAudio ? 'Generating…' : 'Play'}
              </button>
              <button
                onClick={handleStopExplanation}
                disabled={!explanationAudioUrl}
                className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-300 text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Stop
              </button>
              {!isLoadingExplanation && (
                  <button onClick={onCloseExplanation} className="text-slate-400 hover:text-slate-600">
                      <CloseIcon />
                  </button>
              )}
            </div>
          </div>
          <audio ref={explanationAudioRef} hidden />
          
          {isLoadingExplanation ? (
             <div className="animate-pulse space-y-3">
               <div className="h-4 bg-brand-100 rounded w-3/4"></div>
               <div className="h-4 bg-brand-50 rounded w-full"></div>
               <div className="h-4 bg-brand-50 rounded w-5/6"></div>
             </div>
          ) : (
             <div className="space-y-3">
               <div className="bg-brand-50 p-3 rounded-lg border border-brand-100">
                 <p className="text-xs font-bold text-brand-600 uppercase tracking-wide mb-1">
                   Simplified ({targetLanguage})
                 </p>
                 <p className="text-slate-800 font-medium">{currentExplanation?.simplifiedText}</p>
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
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Audio Summary ({targetLanguage})</h3>
            <p className="text-xs text-slate-500">Listen to the purpose, summary, and requirements.</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePlayAudio}
              disabled={!analysis || isPlayingAudio}
              className="px-3 py-2 text-sm font-medium rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPlayingAudio ? 'Generating…' : 'Play'}
            </button>
            <button
              onClick={handleStopAudio}
              disabled={!audioUrl}
              className="px-3 py-2 text-sm font-medium rounded-md border border-slate-300 text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Stop
            </button>
          </div>
          <audio ref={audioRef} hidden />
        </div>
        {/* Document Purpose */}
        <section>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Document Purpose ({targetLanguage})</h3>
          <p className="text-slate-700 leading-relaxed">
            {analysis.purpose}
          </p>
        </section>

        {/* Detailed Summary */}
        <section className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-3">Summary ({targetLanguage})</h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            {analysis.summary}
          </p>
        </section>

        {/* Requirements Checklist */}
        <section>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Action Items & Requirements ({targetLanguage})</h3>
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