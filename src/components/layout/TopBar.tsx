import React, { useEffect, useState } from 'react';
import { AIModuleId } from '../../types';
import { PWAInstallButton } from '../../pwa/PWAInstallButton';
import { useTheme } from '../../context/ThemeContext';
import { soundFx } from '../../services/soundFx';
import { Sparkles, Moon, Sun, Volume2, VolumeX } from 'lucide-react';

interface TopBarProps {
  activeModule: AIModuleId;
  onSelectModule: (id: AIModuleId) => void;
  onOpenExhibition: () => void;
  onOpenWindowsModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeModule,
  onSelectModule,
  onOpenExhibition,
}) => {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [isMuted, setIsMuted] = useState(soundFx.getIsMuted());

  useEffect(() => {
    return soundFx.subscribe(setIsMuted);
  }, []);

  const handleToggleSound = () => {
    soundFx.toggleMute();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b-[3px] border-[#121829] dark:border-[#24314b] bg-white/95 dark:bg-[#0e1422]/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-3">
        <button
          onClick={() => onSelectModule('dashboard')}
          className="text-2xl tracking-normal text-[#121829] dark:text-[#f1f5f9] hover:text-[#ff462b] dark:hover:text-[#ff462b] transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
          style={{ fontFamily: "'Bagel Fat One', cursive" }}
        >
          <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-[#ffd000] border-2 border-[#121829] shadow-[2px_2px_0px_#121829] dark:shadow-[2px_2px_0px_#040711] text-base text-[#121829]">
            👁
          </span>
          <span>AI VISION</span>
        </button>

        <nav className="hidden lg:flex items-center gap-5 text-sm font-extrabold text-[#121829] dark:text-[#f8fafc]">
          <button
            onClick={() => onSelectModule('dashboard')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              activeModule === 'dashboard'
                ? 'text-[#ff462b] border-b-[3px] border-[#ff462b]'
                : 'text-[#121829] dark:text-[#f8fafc] hover:text-[#ff462b] dark:hover:text-[#ff462b]'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onSelectModule('argus')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              activeModule === 'argus'
                ? 'text-[#ff462b] border-b-[3px] border-[#ff462b]'
                : 'text-[#121829] dark:text-[#f8fafc] hover:text-[#ff462b] dark:hover:text-[#ff462b]'
            }`}
          >
            ARGUS Objects
          </button>
          <button
            onClick={() => onSelectModule('gesture')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              activeModule === 'gesture'
                ? 'text-[#ff462b] border-b-[3px] border-[#ff462b]'
                : 'text-[#121829] dark:text-[#f8fafc] hover:text-[#ff462b] dark:hover:text-[#ff462b]'
            }`}
          >
            GestureOS
          </button>
          <button
            onClick={() => onSelectModule('motion')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              activeModule === 'motion'
                ? 'text-[#ff462b] border-b-[3px] border-[#ff462b]'
                : 'text-[#121829] dark:text-[#f8fafc] hover:text-[#ff462b] dark:hover:text-[#ff462b]'
            }`}
          >
            Pose &amp; Motion
          </button>
          <button
            onClick={() => onSelectModule('facemesh')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              activeModule === 'facemesh'
                ? 'text-[#ff462b] border-b-[3px] border-[#ff462b]'
                : 'text-[#121829] dark:text-[#f8fafc] hover:text-[#ff462b] dark:hover:text-[#ff462b]'
            }`}
          >
            FaceMesh Lab
          </button>
          <button
            onClick={() => onSelectModule('plantdoc')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer flex items-center gap-1 ${
              activeModule === 'plantdoc'
                ? 'text-[#059669] border-b-[3px] border-[#059669]'
                : 'text-[#121829] dark:text-[#f8fafc] hover:text-[#059669] dark:hover:text-[#10b981]'
            }`}
          >
            <span>PlantDoc AI</span>
            <span className="text-[9px] bg-[#ffd000] text-[#121829] px-1.5 py-0.2 rounded font-black border border-[#121829]">
              NEW
            </span>
          </button>
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleToggleSound}
            className="comic-btn comic-btn-white p-2 rounded-xl text-xs uppercase cursor-pointer"
            title={isMuted ? 'Unmute Sound FX' : 'Mute Sound FX'}
            aria-label="Toggle Sound Effects"
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-[#ff462b]" /> : <Volume2 className="h-4 w-4 text-[#059669]" />}
          </button>

          <button
            onClick={toggleDarkMode}
            className="comic-btn comic-btn-white p-2 sm:px-3 sm:py-2 rounded-xl text-xs uppercase cursor-pointer flex items-center gap-1.5"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode (Default)'}
            aria-label="Toggle Dark Mode"
          >
            {isDarkMode ? (
              <>
                <Sun className="h-4 w-4 text-[#ffd000]" />
                <span className="hidden md:inline font-black text-xs text-[#ffd000]">Light</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 text-[#121829]" />
                <span className="hidden md:inline font-black text-xs text-[#121829]">Dark</span>
              </>
            )}
          </button>

          <PWAInstallButton />

          <button
            onClick={onOpenExhibition}
            className="comic-btn comic-btn-primary px-3 sm:px-4 py-2 rounded-xl text-xs uppercase tracking-wide cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Exhibition Tour</span>
            <span className="sm:hidden">Tour</span>
          </button>
        </div>
      </div>
    </header>
  );
};
