import React, { useState } from 'react';
import { Download, Monitor, CheckCircle, ShieldCheck, X, Archive, Terminal, Loader2 } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';
import JSZip from 'jszip';
import confetti from 'canvas-confetti';
import { soundFx } from '../services/soundFx';

import { OFFLINE_PROJECT_LOADERS } from './offlineProjectFiles';
import offlineProjectFilesRaw from './offlineProjectFiles.ts?raw';

interface WindowsDesktopModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

      const npmrcContent = `legacy-peer-deps=true
audit=false
fund=false
`;

      const batchContent = [
        '@echo off',
        'if /i "%~1"=="--keep-open" goto :init_env',
        'cmd /k call "%~f0" --keep-open',
        'exit /b',
        '',
        ':init_env',
        'setlocal DisableDelayedExpansion',
        'set "NODE_ENV="',
        'pushd "%~dp0"',
        'if errorlevel 1 goto :bad_dir',
        'title AI VISION - Complete Offline Computer Vision Platform',
        'color 0b',
        '',
        'echo ============================================================',
        'echo AI VISION - 100%% Local Offline Computer Vision Platform',
        'echo Zero paid APIs, Zero cloud latency, Complete On-Device Privacy',
        'echo Modules: ARGUS, GestureOS + 3D Hand Twin, Pose, FaceMesh, PlantDoc AI',
        'echo ============================================================',
        'echo.',
        '',
        'if not exist "package.json" goto :not_extracted',
        '',
        'echo Checking Node.js environment...',
        'call node -v >nul 2>nul',
        'if errorlevel 1 goto :no_node',
        'call npm -v >nul 2>nul',
        'if errorlevel 1 goto :no_npm',
        'echo Detected Node.js:',
        'call node -v',
        'echo.',
        '',
        'if not exist "node_modules\\vite\\bin\\vite.js" goto :install_deps',
        'if not exist "node_modules\\vite-plugin-pwa\\package.json" goto :install_deps',
        'if not exist "node_modules\\@tailwindcss\\vite\\package.json" goto :install_deps',
        'if not exist "node_modules\\@vitejs\\plugin-react\\package.json" goto :install_deps',
        'call node -e "const v=require(\'./node_modules/vite/package.json\').version; if(!v.startsWith(\'6.\')) process.exit(1)" >nul 2>nul',
        'if errorlevel 1 goto :repair_deps',
        'call node "node_modules\\vite\\bin\\vite.js" --version >nul 2>nul',
        'if errorlevel 1 goto :repair_deps',
        'goto :deps_ok',
        '',
        ':repair_deps',
        'echo [INFO] Existing node_modules is outdated or incomplete. Repairing dependencies...',
        'if exist "package-lock.json" del /f /q "package-lock.json" >nul 2>nul',
        '',
        ':install_deps',
        'echo [1/2] Installing local dependencies with offline cache support...',
        'call npm install --include=dev --legacy-peer-deps --prefer-offline --no-audit --no-fund',
        'if errorlevel 1 goto :retry_online_install',
        'goto :verify_install',
        '',
        ':retry_online_install',
        'echo [INFO] Offline cache incomplete. Retrying standard npm install...',
        'call npm install --include=dev --legacy-peer-deps --no-audit --no-fund',
        '',
        ':verify_install',
        'if not exist "node_modules\\vite\\bin\\vite.js" goto :install_failed',
        'if not exist "node_modules\\vite-plugin-pwa\\package.json" goto :install_failed',
        'call node "node_modules\\vite\\bin\\vite.js" --version >nul 2>nul',
        'if errorlevel 1 goto :install_failed',
        'goto :launch_server',
        '',
        ':deps_ok',
        'echo [1/2] Local dependencies verified. Running 100%% offline...',
        '',
        ':launch_server',
        'echo [2/2] Launching AI VISION local server on http://localhost:3000 ...',
        'echo Press Ctrl+C in this window to stop the server.',
        'echo.',
        'if not exist "node_modules\\.bin\\vite.cmd" goto :launch_vite_direct',
        'call npm run dev -- --open',
        'if errorlevel 1 goto :server_failed',
        'goto :server_stopped',
        '',
        ':launch_vite_direct',
        'call node "node_modules\\vite\\bin\\vite.js" --port=3000 --host=0.0.0.0 --open',
        'if errorlevel 1 goto :server_failed',
        '',
        ':server_stopped',
        'echo.',
        'echo [INFO] AI VISION local server stopped.',
        'pause',
        'popd',
        'exit /b 0',
        '',
        ':bad_dir',
        'echo [ERROR] Unable to access the folder containing start_ai_vision_windows.bat.',
        'echo Extract the ZIP into a local drive folder such as C:\\AI-VISION and try again.',
        'echo.',
        'pause',
        'exit /b 1',
        '',
        ':not_extracted',
        'echo [ERROR] package.json was not found in the current folder!',
        'echo Right-click the ZIP archive, choose "Extract All...", and run',
        'echo start_ai_vision_windows.bat from the extracted folder.',
        'echo.',
        'pause',
        'popd',
        'exit /b 1',
        '',
        ':no_node',
        'echo [ERROR] Node.js v18+ is required but was not found in PATH!',
        'echo Install Node.js LTS from https://nodejs.org, reopen CMD, and try again.',
        'echo.',
        'pause',
        'popd',
        'exit /b 1',
        '',
        ':no_npm',
        'echo [ERROR] npm was not found in PATH alongside Node.js!',
        'echo Reinstall Node.js LTS from https://nodejs.org and try again.',
        'echo.',
        'pause',
        'popd',
        'exit /b 1',
        '',
        ':install_failed',
        'echo.',
        'echo [ERROR] Dependency installation failed or Vite runtime check failed.',
        'echo Ensure first-time setup has internet access, or delete the node_modules',
        'echo folder and run start_ai_vision_windows.bat again.',
        'echo.',
        'pause',
        'popd',
        'exit /b 1',
        '',
        ':server_failed',
        'echo.',
        'echo [ERROR] AI VISION local server exited with an error.',
        'echo Check the Vite output above. If dependencies look corrupted,',
        'echo delete the node_modules folder and re-run start_ai_vision_windows.bat.',
        'echo.',
        'pause',
        'popd',
        'exit /b 1',
        '',
      ].join('\r\n');

      const readmeContent = `# AI VISION – 100% Offline Standalone Windows Edition

AI VISION is a browser-based computer vision platform uniting 5 local AI modules:
1. ARGUS – Deep Object Detection & Academy Custom Trainer
2. GestureOS – Hand Landmark Tracking & 3D Bionic Hand Twin (Wireframe / Solid / Skin-Tone + Low-Pass Smoothing)
3. Motion Intelligence – Skeletal Posture & Squat Rep Counter
4. FaceMesh Lab – 468-Point Facial Geometry & Blink Analysis
5. PlantDoc AI – Botanical Diagnosis, Excess Green Index & Weed Identifier

## Complete Offline Instructions (Windows 10 / 11)

1. Right-click the ZIP file and select "Extract All..." to unzip into a fresh folder (e.g., C:\\AI-VISION). Do not run scripts directly from inside the compressed ZIP preview.
2. Ensure Node.js (v18 or higher) is installed on your PC.
3. Double-click "start_ai_vision_windows.bat" (first run caches npm packages with legacy-peer-deps compatibility; afterwards runs 100% offline).
4. Your browser opens automatically at http://localhost:3000 with complete hardware-accelerated WebGL inference.

If upgrading an older extracted folder where an earlier install failed, delete its "node_modules" folder first or re-run "start_ai_vision_windows.bat".

Zero paid APIs. Zero credit cards. Camera feeds never leave your PC.
`.replace(/\r?\n/g, '\r\n');

      zip.file('.npmrc', npmrcContent.replace(/\r?\n/g, '\r\n'));
      zip.file('start_ai_vision_windows.bat', batchContent);
      zip.file('README-OFFLINE.md', readmeContent);
      zip.file('src/pwa/offlineProjectFiles.ts', offlineProjectFilesRaw);

      const entries = Object.entries(OFFLINE_PROJECT_LOADERS);
      const totalItems = entries.length + PUBLIC_ASSETS.length + 1;
      let loadedCount = 1;

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
    const safeUrl = window.location.href.replace(/%/g, '%%');
    const batchContent = [
      '@echo off',
      'if /i "%~1"=="--keep-open" goto :init_launcher',
      'cmd /k call "%~f0" --keep-open',
      'exit /b',
      '',
      ':init_launcher',
      'setlocal DisableDelayedExpansion',
      'title Launching AI VISION...',
      'set "TARGET_URL=' + safeUrl + '"',
      'if exist "%~dp0start_ai_vision_windows.bat" goto :run_local_server',
      '',
      'echo Starting AI VISION Computer Vision Platform...',
      'echo Target URL: %TARGET_URL%',
      'echo.',
      '',
      'if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" goto :launch_edge_x86',
      'if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" goto :launch_edge_x64',
      'if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" goto :launch_chrome_x64',
      'if exist "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" goto :launch_chrome_x86',
      'if exist "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" goto :launch_chrome_local',
      'goto :launch_default',
      '',
      ':run_local_server',
      'echo Detected local offline installation. Starting AI VISION server...',
      'call "%~dp0start_ai_vision_windows.bat" --keep-open',
      'exit /b %ERRORLEVEL%',
      '',
      ':launch_edge_x86',
      'start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%TARGET_URL%" --enable-features=WebAssembly,CanvasOopRasterization',
      'if errorlevel 1 goto :launch_default',
      'goto :launch_done',
      '',
      ':launch_edge_x64',
      'start "" "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%TARGET_URL%" --enable-features=WebAssembly,CanvasOopRasterization',
      'if errorlevel 1 goto :launch_default',
      'goto :launch_done',
      '',
      ':launch_chrome_x64',
      'start "" "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" --app="%TARGET_URL%" --enable-features=WebAssembly,CanvasOopRasterization',
      'if errorlevel 1 goto :launch_default',
      'goto :launch_done',
      '',
      ':launch_chrome_x86',
      'start "" "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" --app="%TARGET_URL%" --enable-features=WebAssembly,CanvasOopRasterization',
      'if errorlevel 1 goto :launch_default',
      'goto :launch_done',
      '',
      ':launch_chrome_local',
      'start "" "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" --app="%TARGET_URL%" --enable-features=WebAssembly,CanvasOopRasterization',
      'if errorlevel 1 goto :launch_default',
      'goto :launch_done',
      '',
      ':launch_default',
      'start "" "%TARGET_URL%"',
      'if errorlevel 1 goto :launch_failed',
      '',
      ':launch_done',
      'echo [OK] AI VISION window launched.',
      'echo Note: If launching localhost offline, start the local server first',
      'echo via start_ai_vision_windows.bat inside the extracted ZIP folder.',
      'echo.',
      'pause',
      'exit 0',
      '',
      ':launch_failed',
      'echo [ERROR] Could not launch browser automatically.',
      'echo Please open: %TARGET_URL%',
      'pause',
      'exit /b 1',
      '',
    ].join('\r\n');

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
