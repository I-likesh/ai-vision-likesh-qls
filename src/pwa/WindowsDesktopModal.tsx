import React, { useState } from 'react';
import { Download, Monitor, CheckCircle, ShieldCheck, X, Archive, Terminal, Loader2 } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';
import JSZip from 'jszip';
import confetti from 'canvas-confetti';
import { soundFx } from '../services/soundFx';

interface WindowsDesktopModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROJECT_FILE_LOADERS = import.meta.glob(
  [
    '/src/**/*.ts',
    '/src/**/*.tsx',
    '/src/**/*.css',
    '/index.html',
    '/package.json',
    '/tsconfig.json',
    '/vite.config.ts',
    '/metadata.json',
    '/.env.example',
  ],
  { query: '?raw', import: 'default' }
) as Record<string, () => Promise<string>>;

const PUBLIC_ASSETS = [
  'icon.svg',
  'favicon.ico',
  'apple-touch-icon.png',
  'pwa-192x192.png',
  'pwa-512x512.png',
  'pwa-maskable-512x512.png',
];

export const WindowsDesktopModal: React.FC<WindowsDesktopModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState('');
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  if (!isOpen) return null;

  const handleDownloadCompleteOfflineZip = async () => {
    setIsZipping(true);
    setZipProgress('Collecting complete offline source bundle...');
    soundFx.playTargetLock();

    try {
      const zip = new JSZip();

      const batchContent = `@echo off
title AI VISION - Complete Offline Computer Vision Platform
color 0b
echo ============================================================
echo AI VISION - 100%% Local Offline Computer Vision Platform
echo Zero paid APIs, Zero cloud latency, Complete On-Device Privacy
echo Modules: ARGUS, GestureOS + 3D Hand Twin, Pose, FaceMesh, PlantDoc AI
echo ============================================================
echo.
echo Checking Node.js environment...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Node.js is required! Please install Node.js v18+
  pause
  exit /b
)

echo [1/2] Installing local dependencies (offline cache supported)...
if not exist node_modules (
  call npm install --prefer-offline
)

echo [2/2] Launching AI VISION local server on port 3000...
start "" http://localhost:3000
call npm run dev
pause
`;

      const readmeContent = `# AI VISION – 100% Offline Standalone Windows Edition

AI VISION is a browser-based computer vision platform uniting 5 local AI modules:
1. ARGUS – Deep Object Detection & Academy Custom Trainer
2. GestureOS – Hand Landmark Tracking & 3D Bionic Hand Twin (Wireframe / Solid / Skin-Tone + Low-Pass Smoothing)
3. Motion Intelligence – Skeletal Posture & Squat Rep Counter
4. FaceMesh Lab – 468-Point Facial Geometry & Blink Analysis
5. PlantDoc AI – Botanical Diagnosis, Excess Green Index & Weed Identifier

## Complete Offline Instructions (Windows 10 / 11)

1. Unzip this folder to any directory (e.g., C:\\AI-VISION).
2. Ensure Node.js (v18 or higher) is installed on your PC.
3. Double-click "start_ai_vision_windows.bat" (first run caches npm packages; afterwards runs 100% offline).
4. Open http://localhost:3000 with complete hardware-accelerated WebGL inference.

Zero paid APIs. Zero credit cards. Camera feeds never leave your PC.
`;

      zip.file('start_ai_vision_windows.bat', batchContent);
      zip.file('README-OFFLINE.md', readmeContent);

      const entries = Object.entries(PROJECT_FILE_LOADERS);
      const totalItems = entries.length + PUBLIC_ASSETS.length;
      let loadedCount = 0;

      for (const [rawPath, loader] of entries) {
        try {
          const content = await loader();
          const cleanPath = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
          zip.file(cleanPath, content);
          loadedCount++;
          setZipProgress(`Bundling files (${loadedCount}/${totalItems})...`);
        } catch {
          continue;
        }
      }

      for (const assetName of PUBLIC_ASSETS) {
        try {
          const response = await fetch(`/${assetName}`);
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            zip.file(`public/${assetName}`, buffer);
            if (assetName === 'favicon.ico') {
              zip.file('favicon.ico', buffer);
            }
            loadedCount++;
            setZipProgress(`Bundling assets (${loadedCount}/${totalItems})...`);
          }
        } catch {
          continue;
        }
      }

      setZipProgress('Compressing standalone Windows offline archive...');
      const blob = await zip.generateAsync({ type: 'blob' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'AI-VISION-Windows-Complete-Offline-Package.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.5 },
      });
      soundFx.playSuccessChime();
      setZipProgress(`✓ Bundled ${loadedCount} Files & Icons!`);
      setTimeout(() => {
        setIsZipping(false);
        setZipProgress('');
      }, 3000);
    } catch {
      setIsZipping(false);
      setZipProgress('Failed to bundle. Please retry.');
    }
  };

  const handleDownloadWindowsLauncher = () => {
    const currentUrl = window.location.href;
    const batchContent = `@echo off
title Launching AI VISION...
echo Starting AI VISION Computer Vision Platform...

start "" "msedge.exe" --app="${currentUrl}" --enable-features=WebAssembly,CanvasOopRasterization
if %ERRORLEVEL% EQU 0 exit

start "" "chrome.exe" --app="${currentUrl}" --enable-features=WebAssembly,CanvasOopRasterization
if %ERRORLEVEL% EQU 0 exit

start "" "${currentUrl}"
exit
`;

    const blob = new Blob([batchContent], { type: 'application/x-bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Launch-AI-VISION-Windows.cmd';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl border-[3px] border-[#121829] dark:border-[#27354f] bg-white dark:bg-[#121828] p-6 sm:p-8 shadow-[6px_6px_0px_#121829] dark:shadow-[6px_6px_0px_#040711] text-[#121829] dark:text-[#f1f5f9] max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between pb-4 border-b-2 border-[#121829] dark:border-[#27354f]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ffd000] border-2 border-[#121829] shadow-[2.5px_2.5px_0px_#121829] text-[#121829]">
              <Monitor className="h-6 w-6" />
            </div>
            <div>
              <h3
                className="text-xl text-[#121829] dark:text-white"
                style={{ fontFamily: "'Bagel Fat One', cursive" }}
              >
                Windows Offline Download &amp; Install
              </h3>
              <p className="text-xs font-bold text-[#121829]/75 dark:text-white/75">
                Download the entire codebase &amp; PWA assets for 100% standalone offline execution
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 border-2 border-[#121829] bg-[#faf6ee] dark:bg-[#1a2337] hover:bg-[#ff462b] hover:text-white transition-colors cursor-pointer shadow-[2px_2px_0px_#121829]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="my-5 space-y-4 text-xs font-bold">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border-2 border-[#121829] dark:border-[#27354f] bg-[#faf6ee] dark:bg-[#1a2337] p-3.5 shadow-[2px_2px_0px_#121829]">
              <div className="flex items-center gap-2 font-black text-[#121829] dark:text-white mb-1 text-sm">
                <CheckCircle className="h-4 w-4 text-[#ff462b]" />
                <span>100% Free &amp; Offline</span>
              </div>
              <p className="text-[#121829]/75 dark:text-white/75 text-xs font-bold">
                Complete TypeScript, React, 3D Hand Twin &amp; PWA icon assets packed inside the ZIP archive. Zero cloud APIs.
              </p>
            </div>

            <div className="rounded-xl border-2 border-[#121829] dark:border-[#27354f] bg-[#faf6ee] dark:bg-[#1a2337] p-3.5 shadow-[2px_2px_0px_#121829]">
              <div className="flex items-center gap-2 font-black text-[#121829] dark:text-white mb-1 text-sm">
                <ShieldCheck className="h-4 w-4 text-[#059669]" />
                <span>Complete Local Privacy</span>
              </div>
              <p className="text-[#121829]/75 dark:text-white/75 text-xs font-bold">
                Camera feeds never leave your computer. WebGL, Three.js, and WASM run directly on local GPU.
              </p>
            </div>
          </div>

          <div className="rounded-xl border-2 border-[#121829] bg-[#ffd000] p-5 shadow-[3px_3px_0px_#121829] text-[#121829]">
            <div className="flex items-center justify-between">
              <h4
                className="text-base text-[#121829] flex items-center gap-2"
                style={{ fontFamily: "'Bagel Fat One', cursive" }}
              >
                <Archive className="h-5 w-5 text-[#ff462b]" />
                <span>Download Entire Offline Code Package (.ZIP)</span>
              </h4>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-white border border-[#121829] text-[#121829]">
                Full Source + Icons
              </span>
            </div>
            <p className="text-xs font-bold text-[#121829]/85 leading-relaxed my-2">
              Downloads a complete offline project bundle containing all 5 AI modules (ARGUS, GestureOS with 3D Hand Twin, Pose Analysis, FaceMesh Lab, PlantDoc AI), PWA icons, batch runner, and build configuration. Double-click <code className="bg-white/80 px-1 py-0.5 rounded text-[#121829] font-mono">start_ai_vision_windows.bat</code> to launch locally!
            </p>

            <button
              onClick={handleDownloadCompleteOfflineZip}
              disabled={isZipping}
              className="comic-btn comic-btn-primary px-5 py-3 rounded-xl text-xs uppercase cursor-pointer w-full flex items-center justify-center gap-2 mt-2"
            >
              {isZipping ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{zipProgress || 'Bundling Entire Codebase...'}</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Download Complete Offline Windows Package (.zip)</span>
                </>
              )}
            </button>
          </div>

          <div className="rounded-xl border-2 border-[#121829] dark:border-[#27354f] bg-[#00f0ff]/15 dark:bg-[#00f0ff]/10 p-4 shadow-[2px_2px_0px_#121829]">
            <h4
              className="text-sm text-[#121829] dark:text-white mb-1 flex items-center gap-2"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              <Monitor className="h-4 w-4 text-[#ff462b]" />
              <span>Native Windows PWA Install</span>
            </h4>
            <p className="text-[#121829]/80 dark:text-white/80 font-bold leading-relaxed mb-3">
              Pin AI VISION to your Windows Start Menu and Taskbar for full-screen hardware-accelerated access.
            </p>
            {isInstalled ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#00f0ff] border-2 border-[#121829] text-[#121829] text-xs font-black shadow-[1.5px_1.5px_0px_#121829]">
                <CheckCircle className="h-4 w-4" /> App installed on this system
              </div>
            ) : (
              <div className="space-y-2.5">
                <button
                  onClick={async () => {
                    if (isInstallable) {
                      await install();
                      onClose();
                    } else {
                      setShowInstallGuide((prev) => !prev);
                    }
                  }}
                  className="comic-btn comic-btn-cyan px-4 py-2 rounded-xl text-xs uppercase cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Install Windows Desktop PWA
                </button>

                {showInstallGuide && (
                  <div className="rounded-xl border-2 border-[#121829] bg-white dark:bg-[#1a2337] p-3 text-xs font-bold text-[#121829] dark:text-white shadow-[2px_2px_0px_#121829] flex items-start justify-between gap-3">
                    <div>
                      <span className="font-black block mb-0.5 text-[#ff462b]">Manual Browser Install Steps</span>
                      Click the Install icon in your Chrome or Edge address bar (or open Browser Menu &rarr; Apps &rarr; Install AI VISION).
                    </div>
                    <button
                      onClick={() => setShowInstallGuide(false)}
                      className="text-[10px] font-black uppercase px-2 py-1 rounded border border-[#121829] bg-[#faf6ee] dark:bg-[#121828] cursor-pointer shrink-0"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border-2 border-[#121829] dark:border-[#27354f] bg-[#faf6ee] dark:bg-[#1a2337] p-4 shadow-[2px_2px_0px_#121829]">
            <h4
              className="text-sm text-[#121829] dark:text-white mb-1 flex items-center gap-2"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              <Terminal className="h-4 w-4 text-[#121829] dark:text-white" />
              <span>Desktop Launcher Shortcut (.cmd)</span>
            </h4>
            <p className="text-[#121829]/80 dark:text-white/80 font-bold leading-relaxed mb-2.5">
              Generates a one-click desktop launcher script that launches AI VISION in an isolated, borderless window.
            </p>
            <button
              onClick={handleDownloadWindowsLauncher}
              className="comic-btn comic-btn-white px-4 py-2 rounded-xl text-xs uppercase cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Download Launch-AI-VISION-Windows.cmd
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t-2 border-[#121829] dark:border-[#27354f] text-xs font-bold text-[#121829]/75 dark:text-white/75">
          <span>Compatible with Windows 10, Windows 11 &amp; all offline browsers</span>
          <button
            onClick={onClose}
            className="comic-btn comic-btn-white px-4 py-2 rounded-xl text-xs uppercase cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
