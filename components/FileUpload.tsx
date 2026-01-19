import React, { useState } from 'react';
import { UploadCloud, FileVideo, AlertCircle, Link as LinkIcon, Info } from 'lucide-react';
import { validateFile } from '../services/geminiService';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isLoading }) => {
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'link'>('upload');
  const [linkInput, setLinkInput] = useState('');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    setError(null);
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    onFileSelect(file);
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate checking the link
    if (linkInput.includes('youtube.com') || linkInput.includes('youtu.be')) {
      setError("Из-за ограничений безопасности браузера (CORS) мы не можем скачивать видео с YouTube напрямую. Пожалуйста, скачайте видео через сторонний сервис и загрузите файл в первой вкладке.");
    } else {
      setError("Пожалуйста, введите корректную ссылку.");
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-12">
      <div className="flex mb-6 bg-surface p-1 rounded-lg w-fit mx-auto border border-white/5">
        <button
          onClick={() => { setActiveTab('upload'); setError(null); }}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'upload' 
              ? 'bg-primary text-white shadow-lg' 
              : 'text-secondary hover:text-white'
          }`}
        >
          Загрузить файл
        </button>
        <button
          onClick={() => { setActiveTab('link'); setError(null); }}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'link' 
              ? 'bg-primary text-white shadow-lg' 
              : 'text-secondary hover:text-white'
          }`}
        >
          YouTube Ссылка
        </button>
      </div>

      {activeTab === 'upload' ? (
        <div
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 ${
            dragActive 
              ? 'border-primary bg-primary/5 scale-[1.01]' 
              : 'border-white/10 bg-surface/50 hover:border-white/20'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onChange={handleChange}
            accept="video/*,audio/*"
            disabled={isLoading}
          />
          
          <div className="flex flex-col items-center justify-center gap-4">
            <div className={`p-4 rounded-full bg-surface border border-white/5 shadow-xl transition-transform duration-300 ${dragActive ? 'scale-110' : ''}`}>
              <UploadCloud className={`w-8 h-8 ${dragActive ? 'text-primary' : 'text-secondary'}`} />
            </div>
            
            <div className="space-y-1">
              <p className="text-lg font-medium text-white">
                Перетащите видео или аудио сюда
              </p>
              <p className="text-sm text-secondary">
                Поддерживаются MP4, MOV, MP3, WAV (Макс. 2GB)
              </p>
            </div>

            <button className="px-6 py-2 bg-surface hover:bg-white/5 border border-white/10 text-white text-sm font-medium rounded-lg transition-colors">
              Выбрать файл
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-surface/50 border border-white/10 rounded-2xl p-8">
           <form onSubmit={handleLinkSubmit} className="flex flex-col gap-4">
              <label className="text-sm font-medium text-secondary flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Вставьте ссылку на YouTube
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..." 
                  className="flex-1 bg-background border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button type="submit" className="bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-lg font-medium transition-colors">
                  Найти
                </button>
              </div>
              <div className="flex items-start gap-2 text-xs text-secondary bg-background/50 p-3 rounded-lg border border-white/5">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                <p>
                  Прямое скачивание с YouTube недоступно в браузере без сервера. Пожалуйста, используйте сторонний инструмент для скачивания, затем загрузите файл во вкладке <strong>Загрузить файл</strong>.
                </p>
              </div>
           </form>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default FileUpload;