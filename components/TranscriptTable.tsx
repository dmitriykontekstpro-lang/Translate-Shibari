import React from 'react';
import { ProcessedSegment } from '../types';
import { Clock, PlayCircle, PauseCircle, Type, Edit2, BookOpen, Globe, Languages } from 'lucide-react';

interface TranscriptTableProps {
  data: ProcessedSegment[];
  onTextUpdate: (index: number, newText: string) => void;
  onTranslationUpdate: (index: number, newText: string) => void;
}

const TranscriptTable: React.FC<TranscriptTableProps> = ({ data, onTextUpdate, onTranslationUpdate }) => {
  if (data.length === 0) return null;

  // Auto-resize textarea function
  const autoResize = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = element.scrollHeight + 'px';
  };

  return (
    <div className="w-full max-w-full mx-auto animate-in fade-in duration-500 slide-in-from-bottom-4">
      <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-white/5 border-b border-white/5 text-xs uppercase tracking-wider text-secondary">
                <th className="p-4 font-medium w-24">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Тайм
                  </div>
                </th>
                <th className="p-4 font-medium w-20">
                  <div className="flex items-center gap-2">
                    <PlayCircle className="w-4 h-4" />
                    Дл.
                  </div>
                </th>
                <th className="p-4 font-medium w-20">
                  <div className="flex items-center gap-2">
                    <PauseCircle className="w-4 h-4" />
                    Пз.
                  </div>
                </th>
                <th className="p-4 font-medium w-[25%]">
                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    Исходник
                    <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-primary/20 text-primary normal-case font-normal border border-primary/20 flex items-center gap-1">
                      <Edit2 className="w-3 h-3" />
                    </span>
                  </div>
                </th>
                <th className="p-4 font-medium w-[25%]">
                  <div className="flex items-center gap-2">
                    <Languages className="w-4 h-4 text-purple-400" />
                    Перевод (EN)
                    <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-400 normal-case font-normal border border-purple-500/20 flex items-center gap-1">
                      <Edit2 className="w-3 h-3" />
                    </span>
                  </div>
                </th>
                <th className="p-4 font-medium w-[12%]">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-accent" />
                    RU Терм.
                  </div>
                </th>
                <th className="p-4 font-medium w-[12%]">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-green-400" />
                    EN Terms
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.map((row, index) => (
                <tr 
                  key={index} 
                  className="group hover:bg-white/[0.02] transition-colors"
                >
                  <td className="p-4 text-xs font-mono text-accent align-top pt-5">
                    {row.timecode}
                  </td>
                  <td className="p-4 text-xs text-secondary font-mono align-top pt-5">
                    {row.durationMs}
                  </td>
                  <td className="p-4 text-xs text-secondary font-mono align-top pt-5">
                    <span className={row.pauseAfterMs > 1000 ? "text-yellow-500/80" : ""}>
                      {row.pauseAfterMs}
                    </span>
                  </td>
                  <td className="p-2 align-top">
                    <textarea
                      className="w-full bg-transparent border border-transparent hover:border-white/10 focus:border-primary/50 focus:bg-white/5 focus:ring-1 focus:ring-primary/50 rounded-lg p-3 text-sm text-white/90 leading-relaxed resize-none transition-all outline-none"
                      value={row.text}
                      onChange={(e) => {
                        onTextUpdate(index, e.target.value);
                        autoResize(e.target);
                      }}
                      onFocus={(e) => autoResize(e.target)}
                      rows={Math.max(1, Math.ceil(row.text.length / 50))}
                      spellCheck={false}
                    />
                  </td>
                  <td className="p-2 align-top">
                    <textarea
                      className="w-full bg-transparent border border-transparent hover:border-white/10 focus:border-purple-500/50 focus:bg-white/5 focus:ring-1 focus:ring-purple-500/50 rounded-lg p-3 text-sm text-purple-200/90 leading-relaxed resize-none transition-all outline-none"
                      value={row.translatedText || ''}
                      placeholder={row.text ? "..." : ""}
                      onChange={(e) => {
                        onTranslationUpdate(index, e.target.value);
                        autoResize(e.target);
                      }}
                      onFocus={(e) => autoResize(e.target)}
                      rows={Math.max(1, Math.ceil((row.translatedText?.length || 0) / 50))}
                      spellCheck={false}
                    />
                  </td>
                  <td className="p-4 text-xs text-accent/90 align-top pt-5">
                    {row.termsRu || '-'}
                  </td>
                  <td className="p-4 text-xs text-green-400/90 align-top pt-5">
                    {row.termsEn || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 text-center text-xs text-secondary">
        Показано {data.length} фраз.
      </div>
    </div>
  );
};

export default TranscriptTable;