import React, { useState } from 'react';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import TranscriptTable from './components/TranscriptTable';
import { extractTranscript, detectShibariTermsBatch, translateTranscriptBatch } from './services/geminiService';
import { calculatePauses, mergeSegments } from './utils/formatters';
import { ProcessedSegment, ProcessingStatus } from './types';
import { uploadTranscript } from './services/supabaseService';
import { Loader2, Film, AlertTriangle, Clock, PauseCircle, Scissors, Database, CheckCircle, Save, Sparkles, Languages } from 'lucide-react';

function App() {
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [data, setData] = useState<ProcessedSegment[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>("Анализ медиа...");
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  
  // Term Detection State
  const [isDetectingTerms, setIsDetectingTerms] = useState(false);
  const [termsProgress, setTermsProgress] = useState({ current: 0, total: 0 });

  // Translation State
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0 });

  const handleFileSelect = async (file: File) => {
    setCurrentFile(file);
    setStatus(ProcessingStatus.ANALYZING);
    setErrorMessage(null);
    setUploadSuccess(false);
    setProgressMessage("Подготовка файла...");
    setData([]);

    try {
      const rawTranscript = await extractTranscript(file, (msg) => {
        setProgressMessage(msg);
      });
      
      // Merge segments closer than 1010ms before calculating pauses
      const mergedTranscript = mergeSegments(rawTranscript);
      const processedData = calculatePauses(mergedTranscript);
      
      setData(processedData);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "Произошла неожиданная ошибка.");
      setStatus(ProcessingStatus.ERROR);
    }
  };

  const handleTextUpdate = (index: number, newText: string) => {
    setData(prevData => {
      const newData = [...prevData];
      newData[index] = { ...newData[index], text: newText };
      return newData;
    });
    if (uploadSuccess) setUploadSuccess(false);
  };

  const handleTranslationUpdate = (index: number, newText: string) => {
    setData(prevData => {
      const newData = [...prevData];
      newData[index] = { ...newData[index], translatedText: newText };
      return newData;
    });
    if (uploadSuccess) setUploadSuccess(false);
  };

  const handleDetectTerms = async () => {
    if (data.length === 0) return;
    
    setIsDetectingTerms(true);
    setUploadSuccess(false);
    const batchSize = 10;
    const totalBatches = Math.ceil(data.length / batchSize);
    setTermsProgress({ current: 0, total: totalBatches });

    try {
      for (let i = 0; i < data.length; i += batchSize) {
        setTermsProgress({ current: Math.ceil((i + 1) / batchSize), total: totalBatches });
        
        const batchItems = [];
        for (let j = 0; j < batchSize && (i + j) < data.length; j++) {
            batchItems.push({ 
                id: i + j, 
                text: data[i + j].text 
            });
        }

        try {
            const results = await detectShibariTermsBatch(batchItems);
            
            setData(prevData => {
                const newData = [...prevData];
                results.forEach(res => {
                    if (newData[res.id]) {
                        newData[res.id] = {
                            ...newData[res.id],
                            termsRu: res.termsRu,
                            termsEn: res.termsEn
                        };
                    }
                });
                return newData;
            });
        } catch (e) {
            console.error(`Error processing terms batch starting at ${i}`, e);
        }
      }
    } catch (error: any) {
      console.error("Terms detection error", error);
      setErrorMessage(`Ошибка при поиске терминов: ${error.message}`);
    } finally {
      setIsDetectingTerms(false);
    }
  };

  const handleTranslate = async () => {
    if (data.length === 0) return;

    setIsTranslating(true);
    setUploadSuccess(false);
    const batchSize = 10;
    const totalBatches = Math.ceil(data.length / batchSize);
    setTranslationProgress({ current: 0, total: totalBatches });

    try {
      for (let i = 0; i < data.length; i += batchSize) {
        setTranslationProgress({ current: Math.ceil((i + 1) / batchSize), total: totalBatches });
        
        const batchItems = [];
        for (let j = 0; j < batchSize && (i + j) < data.length; j++) {
            batchItems.push({ 
                id: i + j, 
                text: data[i + j].text,
                durationMs: data[i + j].durationMs,
                termsEn: data[i + j].termsEn
            });
        }

        try {
            const results = await translateTranscriptBatch(batchItems);
            
            setData(prevData => {
                const newData = [...prevData];
                results.forEach(res => {
                    if (newData[res.id]) {
                        newData[res.id] = {
                            ...newData[res.id],
                            translatedText: res.translatedText
                        };
                    }
                });
                return newData;
            });
        } catch (e) {
            console.error(`Error translating batch starting at ${i}`, e);
        }
      }
    } catch (error: any) {
      console.error("Translation error", error);
      setErrorMessage(`Ошибка перевода: ${error.message}`);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleUploadToDatabase = async () => {
    if (data.length === 0) return;
    
    setIsUploading(true);
    setErrorMessage(null);
    try {
      await uploadTranscript(data);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 5000);
    } catch (error: any) {
      console.error("Upload failed", error);
      setErrorMessage(`Ошибка загрузки в базу: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/30 selection:text-white">
      <Header />

      <main className="flex-1 flex flex-col items-center p-6 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-30"></div>
          <div className="absolute top-40 -right-20 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl opacity-20"></div>
        </div>

        <div className="w-full max-w-4xl mx-auto text-center mb-10 z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Транскрибация видео в структуру данных
          </h2>
          <p className="text-lg text-secondary max-w-2xl mx-auto leading-relaxed">
            Загрузите видео. Приложение автоматически извлечет аудио, нарежет его на фрагменты по 2.5 минуты и обработает каждый отдельно для максимальной точности.
          </p>
        </div>

        <FileUpload 
          onFileSelect={handleFileSelect} 
          isLoading={status === ProcessingStatus.ANALYZING} 
        />

        {status === ProcessingStatus.ANALYZING && (
          <div className="flex flex-col items-center justify-center p-12 animate-in fade-in zoom-in-95 duration-300">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
              <Loader2 className="w-12 h-12 text-primary animate-spin relative z-10" />
            </div>
            <p className="mt-6 text-lg font-medium text-white">{progressMessage}</p>
            <p className="text-sm text-secondary mt-2">
              Не закрывайте вкладку до завершения процесса.
            </p>
          </div>
        )}

        {(status === ProcessingStatus.ERROR || errorMessage) && (
           <div className="w-full max-w-xl mx-auto p-6 bg-red-500/5 border border-red-500/20 rounded-2xl flex flex-col items-center text-center animate-in fade-in mb-8">
             <div className="p-3 bg-red-500/10 rounded-full mb-4">
               <AlertTriangle className="w-8 h-8 text-red-400" />
             </div>
             <h3 className="text-lg font-semibold text-white mb-2">Ошибка</h3>
             <p className="text-secondary text-sm mb-4">
               {errorMessage}
             </p>
             {status === ProcessingStatus.ERROR && (
               <button 
                 onClick={() => setStatus(ProcessingStatus.IDLE)}
                 className="px-4 py-2 bg-surface hover:bg-white/5 border border-white/10 rounded-lg text-sm text-white transition-colors"
               >
                 Попробовать снова
               </button>
             )}
           </div>
        )}

        {status === ProcessingStatus.COMPLETED && data.length > 0 && (
          <div className="w-full max-w-[95%] flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-end gap-3 mb-2 flex-wrap">
               <button
                onClick={handleDetectTerms}
                disabled={isDetectingTerms || isTranslating || isUploading}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white bg-surface hover:bg-white/10 border border-white/10 hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed"
              >
                {isDetectingTerms ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Батч {termsProgress.current}/{termsProgress.total}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-accent" />
                    1. Найти термины
                  </>
                )}
              </button>

              <button
                onClick={handleTranslate}
                disabled={isDetectingTerms || isTranslating || isUploading}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white bg-surface hover:bg-white/10 border border-white/10 hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed"
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Перевод {translationProgress.current}/{translationProgress.total}
                  </>
                ) : (
                  <>
                    <Languages className="w-5 h-5 text-purple-400" />
                    2. Перевести
                  </>
                )}
              </button>

              <button
                onClick={handleUploadToDatabase}
                disabled={isUploading || isDetectingTerms || isTranslating || uploadSuccess}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition-all shadow-lg ml-auto ${
                  uploadSuccess
                    ? 'bg-green-600 hover:bg-green-700 cursor-default'
                    : 'bg-primary hover:bg-primary-hover hover:scale-105 active:scale-95'
                } disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Сохранение...
                  </>
                ) : uploadSuccess ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Сохранено!
                  </>
                ) : (
                  <>
                    <Database className="w-5 h-5" />
                    3. Выгрузить в базу
                  </>
                )}
              </button>
            </div>
            
            <TranscriptTable 
              data={data} 
              onTextUpdate={handleTextUpdate} 
              onTranslationUpdate={handleTranslationUpdate}
            />
          </div>
        )}
        
        {status === ProcessingStatus.IDLE && !data.length && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full mt-8 opacity-50">
             <div className="p-6 rounded-2xl bg-surface/30 border border-white/5 flex flex-col items-center text-center">
                <Scissors className="w-8 h-8 text-secondary mb-4" />
                <h3 className="text-white font-medium mb-2">Умная нарезка</h3>
                <p className="text-xs text-secondary">Аудио автоматически нарезается на фрагменты по 2.5 минуты для стабильной обработки нейросетью.</p>
             </div>
             <div className="p-6 rounded-2xl bg-surface/30 border border-white/5 flex flex-col items-center text-center">
                <Clock className="w-8 h-8 text-secondary mb-4" />
                <h3 className="text-white font-medium mb-2">Точные тайминги</h3>
                <p className="text-xs text-secondary">Тайм-коды автоматически корректируются и склеиваются в единую хронологию.</p>
             </div>
             <div className="p-6 rounded-2xl bg-surface/30 border border-white/5 flex flex-col items-center text-center">
                <Database className="w-8 h-8 text-secondary mb-4" />
                <h3 className="text-white font-medium mb-2">Экспорт в базу</h3>
                <p className="text-xs text-secondary">Редактируйте результат и сохраняйте его прямо в базу данных Supabase.</p>
             </div>
          </div>
        )}
      </main>
      
      <footer className="w-full py-6 text-center text-xs text-secondary/50 border-t border-white/5">
        &copy; {new Date().getFullYear()} Video Transcript Pro.
      </footer>
    </div>
  );
}

export default App;