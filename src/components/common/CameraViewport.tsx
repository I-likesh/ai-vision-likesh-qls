import React, { useRef, useEffect, useState } from 'react';
import { Camera, CameraOff, Maximize2 } from 'lucide-react';
import { useCamera } from '../../context/CameraContext';

interface CameraViewportProps {
  onDrawOverlay?: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  onClickViewport?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  overlayBadge?: string;
  crosshair?: boolean;
  children?: React.ReactNode;
}

export const CameraViewport: React.FC<CameraViewportProps> = ({
  onDrawOverlay,
  onClickViewport,
  overlayBadge,
  crosshair = true,
  children,
}) => {
  const {
    videoRef,
    isStreaming,
    isLoading,
    error,
    isMirrored,
    fps,
    startCamera,
    stopCamera,
    resolution,
    setIsMirrored,
  } = useCamera();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [streamDuration, setStreamDuration] = useState(0);

  useEffect(() => {
    if (!isStreaming) {
      setStreamDuration(0);
      return;
    }
    const timer = setInterval(() => {
      setStreamDuration((prev: number) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isStreaming]);

  const formatStreamTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let animId: number;

    const render = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (canvas && video && isStreaming && video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          ctx.save();
          if (isMirrored) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          if (crosshair) {
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 2;
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            ctx.beginPath();
            ctx.moveTo(cx - 24, cy);
            ctx.lineTo(cx + 24, cy);
            ctx.moveTo(cx, cy - 24);
            ctx.lineTo(cx, cy + 24);
            ctx.stroke();
          }

          if (onDrawOverlay) {
            onDrawOverlay(ctx, canvas.width, canvas.height);
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isStreaming, isMirrored, onDrawOverlay, crosshair, videoRef]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.warn(err));
    } else {
      document.exitFullscreen().catch((err) => console.warn(err));
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video rounded-2xl overflow-hidden border-[3px] border-[#121829] bg-[#121829] shadow-[5px_5px_0px_#121829] flex items-center justify-center select-none"
    >
      <canvas
        ref={canvasRef}
        onClick={onClickViewport}
        className={`w-full h-full object-contain ${onClickViewport ? 'cursor-crosshair' : 'cursor-default'}`}
      />

      <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-[#00f0ff] pointer-events-none" />
      <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-[#00f0ff] pointer-events-none" />
      <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-[#00f0ff] pointer-events-none" />
      <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-[#00f0ff] pointer-events-none" />

      <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-[#121828] border-2 border-[#121829] dark:border-white/20 text-xs font-black uppercase text-[#121829] dark:text-white shadow-[2.5px_2.5px_0px_#121829]">
            <span
              className={`h-3 w-3 rounded-full border border-[#121829] ${
                isStreaming ? 'bg-[#00f0ff] animate-ping' : 'bg-[#ff462b]'
              }`}
            />
            <span>{isStreaming ? 'Live Camera' : 'Offline'}</span>
          </div>

          {overlayBadge && (
            <div className="px-3 py-1.5 rounded-xl bg-[#ffd000] border-2 border-[#121829] text-xs font-black uppercase text-[#121829] shadow-[2.5px_2.5px_0px_#121829]">
              {overlayBadge}
            </div>
          )}

          {isStreaming && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-600 border-2 border-[#121829] text-[11px] font-mono font-black text-white shadow-[2.5px_2.5px_0px_#121829]">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              <span>REC {formatStreamTime(streamDuration)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#121828] border-2 border-[#121829] dark:border-white/20 text-xs font-black text-[#121829] dark:text-white shadow-[2.5px_2.5px_0px_#121829]">
            <span className="text-[#ff462b] font-mono">{fps}</span> FPS · {resolution.toUpperCase()}
          </div>
          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen View"
            className="p-1.5 rounded-xl bg-white dark:bg-[#121828] border-2 border-[#121829] dark:border-white/20 text-[#121829] dark:text-white hover:bg-[#ffd000] dark:hover:bg-[#ff462b] transition-colors shadow-[2.5px_2.5px_0px_#121829] cursor-pointer"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="absolute bottom-3.5 left-3.5 right-3.5 flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMirrored(!isMirrored)}
            className={`px-3 py-2 rounded-xl text-xs font-black border-2 border-[#121829] shadow-[2.5px_2.5px_0px_#121829] transition-colors cursor-pointer ${
              isMirrored ? 'bg-[#ffd000] text-[#121829]' : 'bg-white text-[#121829]'
            }`}
          >
            Mirror: {isMirrored ? 'ON' : 'OFF'}
          </button>
        </div>

        <div>
          {isStreaming ? (
            <button
              onClick={stopCamera}
              className="comic-btn comic-btn-pink px-4 py-2 rounded-xl text-xs uppercase cursor-pointer"
            >
              <CameraOff className="h-4 w-4" />
              <span>Stop Stream</span>
            </button>
          ) : (
            <button
              onClick={startCamera}
              disabled={isLoading}
              className="comic-btn comic-btn-primary px-5 py-2 rounded-xl text-xs uppercase cursor-pointer"
            >
              <Camera className="h-4 w-4" />
              <span>{isLoading ? 'Starting...' : 'Start Camera'}</span>
            </button>
          )}
        </div>
      </div>

      {!isStreaming && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#faf6ee]/95 dark:bg-[#0c111e]/95 backdrop-blur-sm z-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ffd000] border-[2.5px] border-[#121829] text-[#121829] mb-3 shadow-[3px_3px_0px_#121829]">
            <Camera className="h-8 w-8" />
          </div>
          <h4
            className="text-xl text-[#121829] dark:text-white mb-1"
            style={{ fontFamily: "'Bagel Fat One', cursive" }}
          >
            Camera Stream Standby
          </h4>
          <p className="text-sm font-bold text-[#121829]/75 dark:text-white/75 max-w-md mb-5 leading-relaxed">
            Click &quot;Start Local Camera&quot; to begin live real-time computer vision inference directly on your webcam.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={startCamera}
              disabled={isLoading}
              className="comic-btn comic-btn-primary px-6 py-3 rounded-xl text-sm uppercase cursor-pointer"
            >
              {isLoading ? 'Requesting Access...' : 'Start Local Camera'}
            </button>
          </div>
          {error && (
            <div className="mt-4 px-4 py-2 rounded-xl border-2 border-[#121829] bg-[#ff2a85]/20 text-[#121829] dark:text-white text-xs max-w-md font-bold shadow-[2px_2px_0px_#121829]">
              {error}
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
};
