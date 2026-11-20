import React, { useEffect, useState, useRef } from 'react';
import { CameraViewport } from '../common/CameraViewport';
import { useCamera } from '../../context/CameraContext';
import { FaceMeshResult, VisionEvent } from '../../types';
import { initFaceMeshModel, detectFaceMesh, FACE_OVAL_INDICES, LIPS_INDICES } from '../../services/faceMeshDetector';
import { ShieldCheck } from 'lucide-react';

interface FaceMeshProps {
  onLogEvent: (event: Omit<VisionEvent, 'id' | 'timestamp'>) => void;
}

export const FaceMeshLab: React.FC<FaceMeshProps> = ({ onLogEvent }) => {
  const { videoRef, isStreaming } = useCamera();
  const [modelReady, setModelReady] = useState(false);
  const [faceResult, setFaceResult] = useState<FaceMeshResult | null>(null);
  const [renderMode, setRenderMode] = useState<'mesh' | 'contours' | 'points'>('mesh');

  const [blinkCount, setBlinkCount] = useState(0);
  const wasBlinkingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    initFaceMeshModel().then((success) => {
      if (mounted) {
        setModelReady(success);
        onLogEvent({
          module: 'facemesh',
          title: 'FaceMesh Lab Initialized',
          description: success
            ? 'MediaPipe FaceMesh 468-point 3D geometric mesh loaded.'
            : 'Running local 3D facial topology pipeline.',
          type: 'success',
        });
      }
    });
    return () => {
      mounted = false;
    };
  }, [onLogEvent]);

  useEffect(() => {
    let cancelled = false;
    let animId = 0;
    let lastTime = 0;
    let busy = false;

    const runDetection = async (time: number) => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && isStreaming && video.readyState >= 2 && !busy && time - lastTime > 65) {
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

    if (renderMode === 'mesh' || renderMode === 'contours') {
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      FACE_OVAL_INDICES.forEach((idx, i) => {
        const pt = landmarks[idx];
        if (pt) {
          const x = pt.x * width;
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
          const x = pt.x * width;
          const y = pt.y * height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }

    landmarks.forEach((pt, index) => {
      const px = pt.x * width;
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
      const nx = nose.x * width;
      const ny = nose.y * height;
      ctx.strokeStyle = '#ffd000';
      ctx.lineWidth = 3;
      ctx.strokeRect(nx - 10, ny - 10, 20, 20);
    }
  };

  const isBlinking = (faceResult?.eyeAspectRatio ?? 0.3) < 0.20;

  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-[#121829]">
        <div>
          <div className="flex items-center gap-3">
            <h2
              className="text-2xl sm:text-3xl text-[#121829]"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              FaceMesh Lab · 3D Facial Landmarks
            </h2>
            <span className="text-xs font-black px-2.5 py-1 rounded-full border-2 border-[#121829] bg-[#ff2a85] text-white shadow-[1.5px_1.5px_0px_#121829]">
              468 VERTICES
            </span>
          </div>
          <p className="text-sm font-bold text-[#121829]/75 mt-1">
            Detects dense 3D facial topology, head rotation vectors, and ocular metrics without facial identity recognition.
          </p>
        </div>

        <div className="comic-panel p-1 flex items-center gap-1 text-xs font-black bg-white">
          <button
            onClick={() => setRenderMode('mesh')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              renderMode === 'mesh' ? 'bg-[#ffd000] text-[#121829] border-2 border-[#121829]' : 'text-[#121829] hover:bg-[#faf6ee]'
            }`}
          >
            Tessellation Mesh
          </button>
          <button
            onClick={() => setRenderMode('contours')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              renderMode === 'contours' ? 'bg-[#ffd000] text-[#121829] border-2 border-[#121829]' : 'text-[#121829] hover:bg-[#faf6ee]'
            }`}
          >
            Contours
          </button>
          <button
            onClick={() => setRenderMode('points')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              renderMode === 'points' ? 'bg-[#ffd000] text-[#121829] border-2 border-[#121829]' : 'text-[#121829] hover:bg-[#faf6ee]'
            }`}
          >
            All 468 Points
          </button>
        </div>
      </div>

      <div className="comic-panel p-4 flex items-center gap-3 bg-[#faf6ee] text-xs font-bold text-[#121829]">
        <ShieldCheck className="h-5 w-5 text-[#059669] shrink-0" />
        <span>
          <strong className="text-[#121829]">Ethical AI Architecture:</strong> This system measures strictly mathematical geometry. It does NOT perform facial identity recognition, store photographic data, or infer emotional states or satisfaction.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        <div className="lg:col-span-8 space-y-4">
          <CameraViewport
            onDrawOverlay={handleDrawOverlay}
            overlayBadge={faceResult ? '468 FACIAL VERTICES' : 'ALIGN FACE'}
          />

          <div className="comic-panel p-5 grid grid-cols-3 gap-3 bg-white">
            <div className="p-3 rounded-xl border-2 border-[#121829] bg-[#faf6ee] shadow-[2px_2px_0px_#121829]">
              <span className="text-xs font-black text-[#121829]/70 uppercase block">
                Head Yaw (Turn)
              </span>
              <span
                className="text-2xl text-[#ff462b] tabular-nums"
                style={{ fontFamily: "'Bagel Fat One', cursive" }}
              >
                {faceResult?.faceOrientation.yaw ? `${faceResult.faceOrientation.yaw}°` : '0°'}
              </span>
            </div>
            <div className="p-3 rounded-xl border-2 border-[#121829] bg-[#faf6ee] shadow-[2px_2px_0px_#121829]">
              <span className="text-xs font-black text-[#121829]/70 uppercase block">
                Head Pitch (Nod)
              </span>
              <span
                className="text-2xl text-[#ff462b] tabular-nums"
                style={{ fontFamily: "'Bagel Fat One', cursive" }}
              >
                {faceResult?.faceOrientation.pitch ? `${faceResult.faceOrientation.pitch}°` : '0°'}
              </span>
            </div>
            <div className="p-3 rounded-xl border-2 border-[#121829] bg-[#faf6ee] shadow-[2px_2px_0px_#121829]">
              <span className="text-xs font-black text-[#121829]/70 uppercase block">
                Head Roll (Tilt)
              </span>
              <span
                className="text-2xl text-[#ff462b] tabular-nums"
                style={{ fontFamily: "'Bagel Fat One', cursive" }}
              >
                {faceResult?.faceOrientation.roll ? `${faceResult.faceOrientation.roll}°` : '0°'}
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">

          <div className="comic-panel p-5 bg-white">
            <span className="text-xs font-black uppercase tracking-wider text-[#121829]/60">
              EYE ASPECT RATIO (EAR)
            </span>
            <div className="flex items-baseline gap-3 mt-1">
              <div
                className="text-4xl text-[#121829] tabular-nums"
                style={{ fontFamily: "'Bagel Fat One', cursive" }}
              >
                {faceResult?.eyeAspectRatio || 0.28}
              </div>
              <span className={`text-xs font-black px-2.5 py-1 rounded-full border-2 border-[#121829] ${isBlinking ? 'bg-[#ff2a85] text-white animate-pulse' : 'bg-[#00f0ff] text-[#121829]'}`}>
                {isBlinking ? '● Blink Detected' : '● Eyes Open'}
              </span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-black/10 flex items-center justify-between text-xs font-extrabold">
              <span className="text-[#121829]/75">Total Blinks Counted:</span>
              <span className="font-mono text-sm text-[#ff462b] font-black">{blinkCount}</span>
            </div>
            <p className="text-xs font-bold text-[#121829]/70 mt-1.5">
              Ratio of eyelid separation. Drops below 0.21 during natural eye blinks.
            </p>
          </div>

          <div className="comic-panel p-5 bg-white">
            <span className="text-xs font-black uppercase tracking-wider text-[#121829]/60">
              MOUTH OPENNESS RATIO
            </span>
            <div
              className="text-3xl text-[#121829] mt-1 tabular-nums"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              {faceResult?.mouthOpenness || 0.12}
            </div>
            <div className="w-full bg-[#faf6ee] border-2 border-[#121829] h-3 rounded-full mt-3 overflow-hidden shadow-[1px_1px_0px_#121829]">
              <div
                className="bg-[#ff462b] h-full transition-all duration-150"
                style={{ width: `${Math.min(100, ((faceResult?.mouthOpenness || 0.1) / 0.4) * 100)}%` }}
              />
            </div>
          </div>

          <div className="comic-panel p-5 bg-white space-y-2">
            <h4
              className="text-lg text-[#121829]"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              Key Coordinates
            </h4>
            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl border-2 border-[#121829] bg-[#faf6ee] flex justify-between shadow-[1.5px_1.5px_0px_#121829]">
                <span className="text-[#121829]/75 font-bold">Nose Tip (ID 1):</span>
                <span className="text-[#ff462b] font-black">
                  {faceResult?.keypoints.noseTip
                    ? `${faceResult.keypoints.noseTip.x.toFixed(3)}, ${faceResult.keypoints.noseTip.y.toFixed(3)}`
                    : '—'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border-2 border-[#121829] bg-[#faf6ee] flex justify-between shadow-[1.5px_1.5px_0px_#121829]">
                <span className="text-[#121829]/75 font-bold">Left Eye Center:</span>
                <span className="text-[#0284c7] dark:text-[#00f0ff] font-black">
                  {faceResult?.keypoints.leftEye
                    ? `${faceResult.keypoints.leftEye.x.toFixed(3)}, ${faceResult.keypoints.leftEye.y.toFixed(3)}`
                    : '—'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border-2 border-[#121829] bg-[#faf6ee] flex justify-between shadow-[1.5px_1.5px_0px_#121829]">
                <span className="text-[#121829]/75 font-bold">Mouth Center:</span>
                <span className="text-[#ff2a85] font-black">
                  {faceResult?.keypoints.mouthCenter
                    ? `${faceResult.keypoints.mouthCenter.x.toFixed(3)}, ${faceResult.keypoints.mouthCenter.y.toFixed(3)}`
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
