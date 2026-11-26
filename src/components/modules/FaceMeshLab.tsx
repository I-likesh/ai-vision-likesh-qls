import React, { useEffect, useState, useRef } from 'react';
import { CameraViewport } from '../common/CameraViewport';
import { useCamera } from '../../context/CameraContext';
import { FaceMeshResult, VisionEvent } from '../../types';
import { initFaceMeshModel, detectFaceMesh, FACE_OVAL_INDICES, LIPS_INDICES } from '../../services/faceMeshDetector';
import { DEFAULT_FACE_PALETTE } from '../../services/faceMeshTopology';
import { Face3DViewer } from './Face3DViewer';
import { Palette, ShieldCheck } from 'lucide-react';

interface FaceMeshProps {
  onLogEvent: (event: Omit<VisionEvent, 'id' | 'timestamp'>) => void;
}

export const FaceMeshLab: React.FC<FaceMeshProps> = ({ onLogEvent }) => {
  const { videoRef, isStreaming, isMirrored } = useCamera();
  const [modelReady, setModelReady] = useState(false);
  const [faceResult, setFaceResult] = useState<FaceMeshResult | null>(null);
  const [renderMode, setRenderMode] = useState<'mesh' | 'contours' | 'points'>('mesh');

  const [blinkCount, setBlinkCount] = useState(0);
  const wasBlinkingRef = useRef(false);
  const onLogEventRef = useRef(onLogEvent);

  useEffect(() => {
    onLogEventRef.current = onLogEvent;
  }, [onLogEvent]);

  useEffect(() => {
    let mounted = true;
    initFaceMeshModel().then((success) => {
      if (mounted) {
        setModelReady(success);
        onLogEventRef.current({
          module: 'facemesh',
          title: 'FaceMesh Lab Initialized',
          description: success
            ? 'MediaPipe FaceMesh 468-point 3D geometric mesh + live 3D Face Twin loaded.'
            : 'Running local 3D facial topology pipeline + 3D Face Twin.',
          type: 'success',
        });
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let animId = 0;
    let lastTime = 0;
    let busy = false;

    const runDetection = async (time: number) => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && isStreaming && video.readyState >= 2 && !busy && time - lastTime > 55) {
        lastTime = time;
        busy = true;
        try {
          const res = await detectFaceMesh(video);
          if (cancelled) return;
          if (res) {
            setFaceResult(res);
            if (res.eyeAspectRatio < 0.21) {
              if (!wasBlinkingRef.current) {
                setBlinkCount((prev) => prev + 1);
                wasBlinkingRef.current = true;
              }
            } else if (res.eyeAspectRatio > 0.25) {
              wasBlinkingRef.current = false;
            }
          }
        } finally {
          busy = false;
        }
      }

      if (!cancelled) {
        animId = requestAnimationFrame(runDetection);
      }
    };

    animId = requestAnimationFrame(runDetection);
    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
    };
  }, [videoRef, isStreaming]);

  const handleDrawOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!faceResult || !faceResult.landmarks) return;

    const { landmarks } = faceResult;
    const mapX = (x: number) => (isMirrored ? 1 - x : x) * width;

    if (renderMode === 'mesh' || renderMode === 'contours') {
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      FACE_OVAL_INDICES.forEach((idx, i) => {
        const pt = landmarks[idx];
        if (pt) {
          const x = mapX(pt.x);
          const y = pt.y * height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      ctx.strokeStyle = '#ff2a85';
      ctx.lineWidth = 3;
      ctx.beginPath();
      LIPS_INDICES.forEach((idx, i) => {
        const pt = landmarks[idx];
        if (pt) {
          const x = mapX(pt.x);
          const y = pt.y * height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }

    landmarks.forEach((pt, index) => {
      const px = mapX(pt.x);
      const py = pt.y * height;
      const isKeypoint = index === 1 || index === 33 || index === 263 || index === 13;

      if (renderMode === 'mesh' && index % 4 !== 0 && !isKeypoint) return;

      ctx.fillStyle = isKeypoint ? '#ffd000' : 'rgba(0, 240, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(px, py, isKeypoint ? 5.5 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    const nose = faceResult.keypoints.noseTip;
    if (nose) {
      const nx = mapX(nose.x);
      const ny = nose.y * height;
      ctx.strokeStyle = '#ffd000';
      ctx.lineWidth = 3;
      ctx.strokeRect(nx - 10, ny - 10, 20, 20);
    }
  };

  const earValue = faceResult?.eyeAspectRatio ?? 0.28;
  const leftEar = faceResult?.leftEyeAspectRatio ?? earValue;
  const rightEar = faceResult?.rightEyeAspectRatio ?? earValue;
  const mouthOpenness = faceResult?.mouthOpenness ?? 0.12;
  const isBlinking = earValue < 0.21;
  const palette = faceResult?.palette || DEFAULT_FACE_PALETTE;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-[#121829] dark:border-white/20">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2
              className="text-2xl sm:text-3xl text-[#121829] dark:text-white"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              FaceMesh Lab · 3D Face Twin
            </h2>
            <span className="text-xs font-black px-2.5 py-1 rounded-lg border-2 border-[#121829] bg-[#ff2a85] text-white shadow-[1.5px_1.5px_0px_#121829]">
              468 VERTICES
            </span>
          </div>
          <p className="text-sm font-bold text-[#121829]/75 dark:text-white/75 mt-1">
            Copies live 468-point facial geometry, sampled colors, blink ratio, and mouth ratio onto an interactive 3D digital twin.
          </p>
        </div>

        <div className="comic-panel p-1 flex items-center gap-1 text-xs font-black bg-white">
          <button
            onClick={() => setRenderMode('mesh')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              renderMode === 'mesh' ? 'bg-[#ffd000] text-[#121829] border-2 border-[#121829]' : 'text-[#121829] dark:text-white hover:bg-[#faf6ee] dark:hover:bg-[#1e293b]'
            }`}
          >
            Tessellation Mesh
          </button>
          <button
            onClick={() => setRenderMode('contours')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              renderMode === 'contours' ? 'bg-[#ffd000] text-[#121829] border-2 border-[#121829]' : 'text-[#121829] dark:text-white hover:bg-[#faf6ee] dark:hover:bg-[#1e293b]'
            }`}
          >
            Contours
          </button>
          <button
            onClick={() => setRenderMode('points')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              renderMode === 'points' ? 'bg-[#ffd000] text-[#121829] border-2 border-[#121829]' : 'text-[#121829] dark:text-white hover:bg-[#faf6ee] dark:hover:bg-[#1e293b]'
            }`}
          >
            All 468 Points
          </button>
        </div>
      </div>

      <div className="comic-panel p-4 flex items-center gap-3 bg-[#faf6ee] text-xs font-bold text-[#121829]">
        <ShieldCheck className="h-5 w-5 text-[#059669] shrink-0" />
        <span>
          <strong className="text-[#121829]">Ethical AI Architecture:</strong> Measures geometric topology and real-time color sampling locally in your browser without facial recognition or external storage.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7">
          <CameraViewport
            onDrawOverlay={handleDrawOverlay}
            overlayBadge={
              faceResult
                ? '468 FACIAL VERTICES'
                : modelReady
                  ? 'FACE MESH READY'
                  : 'OPTICAL TOPOLOGY READY'
            }
          />
        </div>

        <div className="lg:col-span-5">
          <Face3DViewer
            faceResult={faceResult}
            videoRef={videoRef}
            isMirrored={isMirrored}
            isStreaming={isStreaming}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        <div className="comic-panel p-5 bg-white">
          <span className="text-xs font-black uppercase tracking-wider text-[#121829]/60">
            EYE ASPECT RATIO (EAR)
          </span>
          <div className="flex items-baseline gap-3 mt-1">
            <div
              className="text-3xl text-[#121829] tabular-nums"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              {earValue.toFixed(3)}
            </div>
            <span
              className={`text-xs font-black px-2.5 py-1 rounded-lg border-2 border-[#121829] ${
                isBlinking ? 'bg-[#ff2a85] text-white' : 'bg-[#00f0ff] text-[#121829]'
              }`}
            >
              {isBlinking ? 'Blink Detected' : 'Eyes Open'}
            </span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-black/10 dark:border-white/10 space-y-1 text-xs font-extrabold">
            <div className="flex items-center justify-between">
              <span className="text-[#121829]/75">Left / Right EAR:</span>
              <span className="font-mono text-[#0284c7] dark:text-[#00f0ff] font-black tabular-nums">
                {leftEar.toFixed(2)} / {rightEar.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#121829]/75">Total Blinks Counted:</span>
              <span className="font-mono text-[#ff462b] font-black tabular-nums">{blinkCount}</span>
            </div>
          </div>
        </div>

        <div className="comic-panel p-5 bg-white">
          <span className="text-xs font-black uppercase tracking-wider text-[#121829]/60">
            MOUTH OPENNESS RATIO
          </span>
          <div
            className="text-3xl text-[#121829] mt-1 tabular-nums"
            style={{ fontFamily: "'Bagel Fat One', cursive" }}
          >
            {mouthOpenness.toFixed(2)}
          </div>
          <div className="w-full bg-[#faf6ee] border-2 border-[#121829] h-3 rounded-full mt-3 overflow-hidden shadow-[1px_1px_0px_#121829]">
            <div
              className="bg-[#ff462b] h-full transition-all duration-100"
              style={{ width: `${Math.min(100, (mouthOpenness / 0.4) * 100)}%` }}
            />
          </div>
          <p className="text-xs font-bold text-[#121829]/70 mt-2.5">
            Synced directly to the 3D twin jaw articulation &amp; dental aperture.
          </p>
        </div>

        <div className="comic-panel p-5 bg-white space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-[#121829]/60">
              LIVE SAMPLED COLORS
            </span>
            <Palette className="h-4 w-4 text-[#ff462b]" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            {[
              { label: 'Skin', hex: palette.skin },
              { label: 'Lips', hex: palette.lips },
              { label: 'Iris', hex: palette.iris },
              { label: 'Hair', hex: palette.hair },
            ].map((swatch) => (
              <div
                key={swatch.label}
                className="flex items-center gap-2 p-1.5 rounded-lg border-2 border-[#121829] bg-[#faf6ee]"
              >
                <span
                  className="h-4 w-4 rounded border border-[#121829] shrink-0"
                  style={{ backgroundColor: swatch.hex }}
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-black text-[#121829] leading-none">{swatch.label}</div>
                  <div className="text-[10px] font-mono text-[#121829]/70 truncate">{swatch.hex}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="comic-panel p-5 bg-white space-y-2.5">
          <span className="text-xs font-black uppercase tracking-wider text-[#121829]/60 block">
            HEAD ORIENTATION &amp; NODES
          </span>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Yaw', val: `${faceResult?.faceOrientation.yaw ?? 0}°` },
              { label: 'Pitch', val: `${faceResult?.faceOrientation.pitch ?? 0}°` },
              { label: 'Roll', val: `${faceResult?.faceOrientation.roll ?? 0}°` },
            ].map((o) => (
              <div key={o.label} className="p-2 rounded-lg border-2 border-[#121829] bg-[#faf6ee]">
                <span className="text-[10px] font-black uppercase text-[#121829]/65 block">{o.label}</span>
                <span className="font-mono text-sm font-black text-[#ff462b] tabular-nums">{o.val}</span>
              </div>
            ))}
          </div>
          <div className="pt-1 space-y-1 text-[11px] font-mono">
            <div className="flex justify-between text-[#121829]/80">
              <span>Nose Tip:</span>
              <span className="font-black text-[#ff462b] tabular-nums">
                {faceResult?.keypoints.noseTip
                  ? `${faceResult.keypoints.noseTip.x.toFixed(3)}, ${faceResult.keypoints.noseTip.y.toFixed(3)}`
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between text-[#121829]/80">
              <span>Mouth Center:</span>
              <span className="font-black text-[#ff2a85] tabular-nums">
                {faceResult?.keypoints.mouthCenter
                  ? `${faceResult.keypoints.mouthCenter.x.toFixed(3)}, ${faceResult.keypoints.mouthCenter.y.toFixed(3)}`
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
