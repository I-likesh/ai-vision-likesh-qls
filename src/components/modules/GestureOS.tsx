import React, { useEffect, useState, useRef } from 'react';
import { CameraViewport } from '../common/CameraViewport';
import { useCamera } from '../../context/CameraContext';
import { HandDetectionResult, HandGesture, AIModuleId, VisionEvent } from '../../types';
import { initGestureModel, detectHands, HAND_CONNECTIONS } from '../../services/gestureDetector';
import { Hand3DViewer } from './Hand3DViewer';
import { ToggleLeft, ToggleRight, Sparkles, CheckCircle } from 'lucide-react';

interface GestureOSProps {
  onSelectModule: (id: AIModuleId) => void;
  onLogEvent: (event: Omit<VisionEvent, 'id' | 'timestamp'>) => void;
}

export const GestureOS: React.FC<GestureOSProps> = ({ onSelectModule, onLogEvent }) => {
  const { videoRef, isStreaming, isMirrored, captureSnapshot } = useCamera();
  const [modelReady, setModelReady] = useState(false);
  const [handResults, setHandResults] = useState<HandDetectionResult[]>([]);

  const [gestureControlEnabled, setGestureControlEnabled] = useState(false);
  const [lastExecutedGesture, setLastExecutedGesture] = useState<string | null>(null);
  const [gestureHistory, setGestureHistory] = useState<Array<{ gesture: HandGesture; time: string }>>(
    []
  );

  const gestureCooldownRef = useRef<number>(0);
  const lastHistoryGestureRef = useRef<{ gesture: HandGesture; timeMs: number }>({
    gesture: 'None',
    timeMs: 0,
  });
  const onLogEventRef = useRef(onLogEvent);
  const onSelectModuleRef = useRef(onSelectModule);
  const captureSnapshotRef = useRef(captureSnapshot);
  const gestureControlRef = useRef(gestureControlEnabled);

  useEffect(() => {
    onLogEventRef.current = onLogEvent;
  }, [onLogEvent]);

  useEffect(() => {
    onSelectModuleRef.current = onSelectModule;
  }, [onSelectModule]);

  useEffect(() => {
    captureSnapshotRef.current = captureSnapshot;
  }, [captureSnapshot]);

  useEffect(() => {
    gestureControlRef.current = gestureControlEnabled;
  }, [gestureControlEnabled]);

  useEffect(() => {
    let mounted = true;
    initGestureModel().then((success) => {
      if (mounted) {
        setModelReady(success);
        onLogEventRef.current({
          module: 'gesture',
          title: 'GestureOS Ready',
          description: success
            ? 'MediaPipe Hands 21-landmark neural pipeline loaded with 3D hand twin.'
            : 'Running local optical hand tracking analyzer with 3D hand twin.',
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
          const results = await detectHands(video);
          if (cancelled) return;
          setHandResults(results);

          if (results.length > 0) {
            const mainGesture = results[0].gesture;
            if (mainGesture !== 'None') {
              const now = Date.now();
              if (gestureControlRef.current && now - gestureCooldownRef.current > 2000) {
                if (mainGesture === 'Thumbs Up') {
                  gestureCooldownRef.current = now;
                  setLastExecutedGesture('Snapshot Triggered (Thumbs Up)');
                  captureSnapshotRef.current();
                  onLogEventRef.current({
                    module: 'gesture',
                    title: 'Gesture Action: Snapshot',
                    description: 'Thumbs Up gesture detected · Snapshot captured.',
                    type: 'info',
                  });
                } else if (mainGesture === 'Victory') {
                  gestureCooldownRef.current = now;
                  setLastExecutedGesture('Switch Module (Victory)');
                  onSelectModuleRef.current('motion');
                  onLogEventRef.current({
                    module: 'gesture',
                    title: 'Gesture Action: Navigation',
                    description: 'Victory gesture detected · Switched to Pose & Motion.',
                    type: 'info',
                  });
                }
              }

              if (
                mainGesture !== lastHistoryGestureRef.current.gesture ||
                now - lastHistoryGestureRef.current.timeMs > 1200
              ) {
                lastHistoryGestureRef.current = { gesture: mainGesture, timeMs: now };
                const timeStr = new Date().toLocaleTimeString();
                setGestureHistory((prev) => [{ gesture: mainGesture, time: timeStr }, ...prev.slice(0, 7)]);
              }
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
    handResults.forEach((hand) => {
      const { landmarks, gesture } = hand;
      const mapX = (x: number) => (isMirrored ? 1 - x : x) * width;

      ctx.strokeStyle = '#121829';
      ctx.lineWidth = 6;
      HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const start = landmarks[startIdx];
        const end = landmarks[endIdx];
        if (start && end) {
          ctx.beginPath();
          ctx.moveTo(mapX(start.x), start.y * height);
          ctx.lineTo(mapX(end.x), end.y * height);
          ctx.stroke();
        }
      });

      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 3.5;
      HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const start = landmarks[startIdx];
        const end = landmarks[endIdx];
        if (start && end) {
          ctx.beginPath();
          ctx.moveTo(mapX(start.x), start.y * height);
          ctx.lineTo(mapX(end.x), end.y * height);
          ctx.stroke();
        }
      });

      landmarks.forEach((pt, index) => {
        const px = mapX(pt.x);
        const py = pt.y * height;
        const isTip = [4, 8, 12, 16, 20].includes(index);

        ctx.fillStyle = isTip ? '#ff462b' : '#ffd000';
        ctx.beginPath();
        ctx.arc(px, py, isTip ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#121829';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      });

      const wrist = landmarks[0];
      if (wrist && gesture !== 'None') {
        const gx = mapX(wrist.x);
        const gy = Math.max(35, wrist.y * height - 40);

        ctx.font = 'bold 16px Nunito, sans-serif';
        const txt = `✋ ${gesture.toUpperCase()} (${hand.confidence}%)`;
        const textW = ctx.measureText(txt).width;

        ctx.fillStyle = '#121829';
        ctx.fillRect(gx - textW / 2 - 10, gy - 22, textW + 24, 32);

        ctx.fillStyle = '#ffd000';
        ctx.fillRect(gx - textW / 2 - 12, gy - 24, textW + 24, 32);
        ctx.strokeStyle = '#121829';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(gx - textW / 2 - 12, gy - 24, textW + 24, 32);

        ctx.fillStyle = '#121829';
        ctx.fillText(txt, gx - textW / 2, gy - 2);
      }
    });
  };

  const primaryHand = handResults[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-[#121829] dark:border-white/20">
        <div>
          <div className="flex items-center gap-3">
            <h2
              className="text-2xl sm:text-3xl text-[#121829] dark:text-white"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              GestureOS · Hand Tracking &amp; 3D Twin
            </h2>
            <span className="text-xs font-black px-2.5 py-1 rounded-full border-2 border-[#121829] bg-[#00f0ff] text-[#121829] shadow-[1.5px_1.5px_0px_#121829]">
              21 3D LANDMARKS
            </span>
          </div>
          <p className="text-sm font-bold text-[#121829]/75 dark:text-white/75 mt-1">
            Tracks 21 3D finger keypoints in real-time alongside a live articulated 3D bionic hand model mirroring every movement.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setGestureControlEnabled(!gestureControlEnabled)}
            className={`comic-btn px-4 py-2 rounded-xl text-xs uppercase cursor-pointer ${
              gestureControlEnabled ? 'comic-btn-yellow' : 'comic-btn-white'
            }`}
          >
            {gestureControlEnabled ? (
              <ToggleRight className="h-5 w-5 text-[#121829]" />
            ) : (
              <ToggleLeft className="h-5 w-5" />
            )}
            <span>Gesture Control: {gestureControlEnabled ? 'ACTIVE' : 'OFF'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7">
          <CameraViewport
            onDrawOverlay={handleDrawOverlay}
            overlayBadge={
              primaryHand
                ? `GESTURE: ${primaryHand.gesture.toUpperCase()}`
                : modelReady
                  ? 'HAND TRACKING READY'
                  : 'OPTICAL HAND READY'
            }
          />
        </div>

        <div className="lg:col-span-5">
          <Hand3DViewer
            handResults={handResults}
            isMirrored={isMirrored}
            isStreaming={isStreaming}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          <div className="comic-panel p-5 bg-white">
            <h4
              className="text-lg text-[#121829] dark:text-white mb-3 flex items-center gap-2"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              <Sparkles className="h-5 w-5 text-amber-500 dark:text-[#ffd000]" /> Supported Gesture Actions
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl border-2 border-[#121829] bg-[#faf6ee] dark:bg-[#182238] shadow-[2px_2px_0px_#121829]">
                <span className="font-black text-[#121829] dark:text-white block text-sm">
                  👍 Thumbs Up
                </span>
                <span className="text-[#121829]/75 dark:text-white/75 font-bold">
                  Takes a photo snapshot
                </span>
              </div>
              <div className="p-3 rounded-xl border-2 border-[#121829] bg-[#faf6ee] dark:bg-[#182238] shadow-[2px_2px_0px_#121829]">
                <span className="font-black text-[#121829] dark:text-white block text-sm">
                  ✌ Victory
                </span>
                <span className="text-[#121829]/75 dark:text-white/75 font-bold">
                  Switches to Pose Module
                </span>
              </div>
              <div className="p-3 rounded-xl border-2 border-[#121829] bg-[#faf6ee] dark:bg-[#182238] shadow-[2px_2px_0px_#121829]">
                <span className="font-black text-[#121829] dark:text-white block text-sm">
                  ☝ Pointing
                </span>
                <span className="text-[#121829]/75 dark:text-white/75 font-bold">
                  Precision index vector track
                </span>
              </div>
              <div className="p-3 rounded-xl border-2 border-[#121829] bg-[#faf6ee] dark:bg-[#182238] shadow-[2px_2px_0px_#121829]">
                <span className="font-black text-[#121829] dark:text-white block text-sm">
                  🖐 Open Palm
                </span>
                <span className="text-[#121829]/75 dark:text-white/75 font-bold">
                  Neutral ready state
                </span>
              </div>
            </div>

            {lastExecutedGesture && (
              <div className="mt-3.5 px-4 py-2 rounded-xl border-2 border-[#121829] bg-[#00f0ff] text-[#121829] text-xs font-black flex items-center gap-2 shadow-[2px_2px_0px_#121829]">
                <CheckCircle className="h-4 w-4" />
                <span>Last Action Triggered: {lastExecutedGesture}</span>
              </div>
            )}
          </div>

          <div className="comic-panel p-5 bg-white">
            <h4
              className="text-lg text-[#121829] dark:text-white mb-2"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              Recent Kinetic Events
            </h4>
            {gestureHistory.length === 0 ? (
              <p className="text-xs text-[#121829]/60 dark:text-white/60 py-3 text-center font-bold">
                Hold your hand up to the camera to sync the 3D hand twin.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {gestureHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl border-2 border-[#121829] bg-[#faf6ee] dark:bg-[#182238] text-xs font-bold shadow-[2px_2px_0px_#121829]"
                  >
                    <span className="font-black text-[#121829] dark:text-white">{item.gesture}</span>
                    <span className="font-mono text-[#121829]/60 dark:text-white/60 text-xs">
                      {item.time}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="comic-panel p-5 text-center bg-white">
            <span className="text-xs font-black uppercase tracking-wider text-[#121829]/60 dark:text-white/60">
              RECOGNIZED GESTURE
            </span>
            <div
              className="text-3xl text-[#ff462b] mt-2"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              {primaryHand ? primaryHand.gesture : 'No Hand in View'}
            </div>
            <div className="flex items-center justify-center gap-3 text-xs font-black text-[#121829] dark:text-white mt-2 font-mono">
              <span>Hand: {primaryHand?.handedness || 'None'}</span>
              <span>·</span>
              <span>Confidence: {primaryHand?.confidence || 0}%</span>
            </div>
          </div>

          <div className="comic-panel p-5 bg-white space-y-3">
            <h4
              className="text-lg text-[#121829] dark:text-white"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              Kinematic Data
            </h4>
            <div className="space-y-2.5 text-xs font-extrabold">
              <div className="flex items-center justify-between p-2 rounded-lg border-2 border-[#121829] bg-[#faf6ee] dark:bg-[#182238] shadow-[1.5px_1.5px_0px_#121829]">
                <span className="text-[#121829]/70 dark:text-white/70">Active Hands:</span>
                <span className="font-mono text-[#121829] dark:text-white font-black text-sm">
                  {handResults.length}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg border-2 border-[#121829] bg-[#faf6ee] dark:bg-[#182238] shadow-[1.5px_1.5px_0px_#121829]">
                <span className="text-[#121829]/70 dark:text-white/70">Pinch Distance:</span>
                <span className="font-mono text-[#121829] dark:text-white font-black text-sm">
                  {primaryHand?.pinchDistance ? `${(primaryHand.pinchDistance * 100).toFixed(1)} px` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg border-2 border-[#121829] bg-[#faf6ee] dark:bg-[#182238] shadow-[1.5px_1.5px_0px_#121829]">
                <span className="text-[#121829]/70 dark:text-white/70">Landmark Points:</span>
                <span className="font-mono text-[#ff462b] font-black">21 Points / Hand</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
