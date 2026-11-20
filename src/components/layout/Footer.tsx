import React from 'react';
import { AIModuleId } from '../../types';
import { Monitor } from 'lucide-react';

interface FooterProps {
  onSelectModule: (id: AIModuleId) => void;
  onOpenWindowsModal: () => void;
  onOpenExhibition: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onSelectModule,
  onOpenWindowsModal,
  onOpenExhibition,
}) => {
  return (
    <footer className="mt-16 border-t-[3px] border-[#121829] dark:border-[#24314b] bg-white dark:bg-[#0e1422] py-8 text-xs font-black text-[#121829] dark:text-[#f1f5f9] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span
            className="text-base text-[#121829] dark:text-[#f1f5f9]"
            style={{ fontFamily: "'Bagel Fat One', cursive" }}
          >
            AI VISION
          </span>
          <span>·</span>
          <span>Science Exhibition Computer Vision Suite</span>
          <span>·</span>
          <span>5 Local AI Engines · 100% Free Client-Side</span>
        </div>

        <div className="flex items-center gap-5 text-[#121829] dark:text-[#f1f5f9] font-black uppercase tracking-wider">
          <button
            onClick={() => onSelectModule('dashboard')}
            className="hover:text-[#ff462b] dark:hover:text-[#ff462b] transition-colors cursor-pointer"
          >
            Dashboard
          </button>
          <button
            onClick={onOpenExhibition}
            className="hover:text-[#ff462b] dark:hover:text-[#ff462b] transition-colors cursor-pointer"
          >
            Exhibition Tour
          </button>
          <button
            onClick={onOpenWindowsModal}
            className="hover:text-[#ff462b] dark:hover:text-[#ff462b] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Monitor className="h-4 w-4 text-[#ff462b]" />
            <span>Offline Windows App</span>
          </button>
        </div>
      </div>
    </footer>
  );
};
