import React, { useState, useCallback } from 'react';
import { CameraProvider } from './context/CameraContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AIModuleId, VisionEvent } from './types';
import { TopBar } from './components/layout/TopBar';
import { Footer } from './components/layout/Footer';
import { MainDashboard } from './components/dashboard/MainDashboard';
import { ArgusObjectDetection } from './components/modules/ArgusObjectDetection';
import { GestureOS } from './components/modules/GestureOS';
import { MotionIntelligence } from './components/modules/MotionIntelligence';
import { FaceMeshLab } from './components/modules/FaceMeshLab';
import { PlantDocAI } from './components/modules/PlantDocAI';
import { ExhibitionModal } from './components/exhibition/ExhibitionModal';
import { WindowsDesktopModal } from './pwa/WindowsDesktopModal';
import { ArrowLeft } from 'lucide-react';

export function AppContent() {
  const [activeModule, setActiveModule] = useState<AIModuleId>('dashboard');
  const [isExhibitionOpen, setIsExhibitionOpen] = useState(false);
  const [isWindowsModalOpen, setIsWindowsModalOpen] = useState(false);
  const { isDarkMode } = useTheme();

  const [recentEvents, setRecentEvents] = useState<VisionEvent[]>([
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString(),
      module: 'dashboard',
      title: 'AI VISION Initialized',
      description: 'System loaded with 5 local browser-based computer vision engines (ARGUS, GestureOS, Pose, FaceMesh, PlantDoc AI).',
      type: 'info',
    },
  ]);

  const handleLogEvent = useCallback((event: Omit<VisionEvent, 'id' | 'timestamp'>) => {
    const newEvent: VisionEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toLocaleTimeString(),
    };
    setRecentEvents((prev) => [newEvent, ...prev.slice(0, 19)]);
  }, []);

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${isDarkMode ? 'dark text-[#f1f5f9]' : 'text-[#121829]'}`}>
      <TopBar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        onOpenExhibition={() => setIsExhibitionOpen(true)}
        onOpenWindowsModal={() => setIsWindowsModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeModule !== 'dashboard' && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setActiveModule('dashboard')}
              className="comic-btn comic-btn-white px-4 py-2 rounded-xl text-xs uppercase cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Command Station</span>
            </button>

            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl border-2 border-[#121829] dark:border-[#27354f] bg-white dark:bg-[#121828] shadow-[3px_3px_0px_#121829] dark:shadow-[3px_3px_0px_#040711] text-xs font-black">
              {[
                { id: 'argus' as AIModuleId, label: 'ARGUS' },
                { id: 'gesture' as AIModuleId, label: 'GestureOS' },
                { id: 'motion' as AIModuleId, label: 'Pose' },
                { id: 'facemesh' as AIModuleId, label: 'FaceMesh' },
                { id: 'plantdoc' as AIModuleId, label: 'PlantDoc AI' },
              ].map(({ id, label }) => {
                const isActive = activeModule === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveModule(id)}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      isActive
                        ? id === 'plantdoc'
                          ? 'bg-[#059669] text-white border-2 border-[#121829] dark:border-[#040711] shadow-[1.5px_1.5px_0px_#121829]'
                          : 'bg-[#ff462b] text-white border-2 border-[#121829] dark:border-[#040711] shadow-[1.5px_1.5px_0px_#121829]'
                        : 'text-[#121829] dark:text-[#f1f5f9] hover:bg-[#faf6ee] dark:hover:bg-[#1e293b]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeModule === 'dashboard' && (
          <MainDashboard
            onSelectModule={setActiveModule}
            recentEvents={recentEvents}
            onOpenExhibition={() => setIsExhibitionOpen(true)}
          />
        )}
        {activeModule === 'argus' && <ArgusObjectDetection onLogEvent={handleLogEvent} />}
        {activeModule === 'gesture' && (
          <GestureOS onSelectModule={setActiveModule} onLogEvent={handleLogEvent} />
        )}
        {activeModule === 'motion' && <MotionIntelligence onLogEvent={handleLogEvent} />}
        {activeModule === 'facemesh' && <FaceMeshLab onLogEvent={handleLogEvent} />}
        {activeModule === 'plantdoc' && <PlantDocAI onLogEvent={handleLogEvent} />}
      </main>

      <Footer
        onSelectModule={setActiveModule}
        onOpenWindowsModal={() => setIsWindowsModalOpen(true)}
        onOpenExhibition={() => setIsExhibitionOpen(true)}
      />

      <ExhibitionModal
        isOpen={isExhibitionOpen}
        onClose={() => setIsExhibitionOpen(false)}
        onSelectModule={setActiveModule}
      />

      <WindowsDesktopModal
        isOpen={isWindowsModalOpen}
        onClose={() => setIsWindowsModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <CameraProvider>
        <AppContent />
      </CameraProvider>
    </ThemeProvider>
  );
}
