import React from 'react';
import { Sparkles, Video } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="w-full py-6 border-b border-white/10 bg-background/50 backdrop-blur-md sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Video className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Видео Транскрибатор
              <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium uppercase tracking-wider">
                Beta
              </span>
            </h1>
            <p className="text-sm text-secondary">Работает на базе Gemini 2.5 Flash</p>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-2 text-xs text-secondary bg-surface px-3 py-1.5 rounded-full border border-white/5">
          <Sparkles className="w-3 h-3 text-yellow-500" />
          <span>Мультимодальный анализ</span>
        </div>
      </div>
    </header>
  );
};

export default Header;