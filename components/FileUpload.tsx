import React, { useState, useCallback } from 'react';
import { UploadIcon } from '../constants';
import { FileData } from '../types';

interface FileUploadProps {
  onFileSelect: (file: FileData) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const [dragActive, setDragActive] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const processFile = (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    
    if (isPdf) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as ArrayBuffer;
        onFileSelect({
          name: file.name,
          type: file.type,
          content: content,
          isImage: false,
          isPdf: true
        });
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onFileSelect({
          name: file.name,
          type: file.type,
          content,
          isImage
        });
      };
      if (isImage) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) return;
    onFileSelect({
      name: "Pasted Text",
      type: "text/plain",
      content: pastedText,
      isImage: false
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setMode('upload')}
            className={`flex-1 py-4 text-sm font-medium transition-colors ${
              mode === 'upload' ? 'bg-slate-50 text-brand-600 border-b-2 border-brand-500' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Upload Document
          </button>
          <button
            onClick={() => setMode('paste')}
            className={`flex-1 py-4 text-sm font-medium transition-colors ${
              mode === 'paste' ? 'bg-slate-50 text-brand-600 border-b-2 border-brand-500' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Paste Text
          </button>
        </div>

        <div className="p-8">
          {mode === 'upload' ? (
            <div
              className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                dragActive ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                id="dropzone-file"
                type="file"
                className="hidden"
                accept=".txt,.md,.json,.csv,.png,.jpg,.jpeg,.webp,.pdf"
                onChange={handleChange}
              />
              <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                <UploadIcon />
                <p className="mb-2 text-sm text-slate-500 mt-4">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-slate-400">PDF, TXT, JPG, PNG (Max 5MB)</p>
              </label>
            </div>
          ) : (
            <div className="flex flex-col space-y-4">
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste the confusing text here..."
                className="w-full h-64 p-4 text-sm text-slate-700 bg-slate-50 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
              />
              <button
                onClick={handlePasteSubmit}
                disabled={!pastedText.trim()}
                className="self-end px-6 py-2 text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Analyze Text
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
