import React, { useEffect, useState, useRef } from 'react';
import { CameraViewport } from '../common/CameraViewport';
import { useCamera } from '../../context/CameraContext';
import {
  HandDetectionResult,
  HandGesture,
  HandLandmark,
  HandBoundsTelemetry,
  HandTwinTrainingProfile,
  AIModuleId,
  VisionEvent,
} from '../../types';
import { initGestureModel, detectHands, HAND_CONNECTIONS } from '../../services/gestureDetector';
import {
  CapturedTwinSample,
  TRAINABLE_GESTURES,
  TwinTrainingProgress,
  clearSavedTwinProfile,
  loadSavedTwinProfile,
  predictWithTrainedTwin,
  runImmenseTwinTraining,
  sanitizeHandResult,
} from '../../services/handTwinTrainer';
import { Hand3DViewer } from './Hand3DViewer';
import { soundFx } from '../../services/soundFx';
import {
  ToggleLeft,
  ToggleRight,
  Sparkles,
  CheckCircle,
  Brain,
  Camera,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react';

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

  const [boundsTelemetry, setBoundsTelemetry] = useState<HandBoundsTelemetry>({
    outOfBoundsCount: 0,
    overlapPairsResolved: 0,
    softClamped: false,
    punchVelocity: 0,
  });

  const [trainedProfile, setTrainedProfile] = useState<HandTwinTrainingProfile | null>(() =>
    loadSavedTwinProfile()
  );
  const [selectedTrainGesture, setSelectedTrainGesture] =
    useState<Exclude<HandGesture, 'None'>>('Closed Fist');
  const [capturedSamples, setCapturedSamples] = useState<CapturedTwinSample[]>([]);
  const [captureRemaining, setCaptureRemaining] = useState(0);
  const [isTrainingTwin, setIsTrainingTwin] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState<TwinTrainingProgress | null>(null);

  const gestureCooldownRef = useRef<number>(0);
  const lastHistoryGestureRef = useRef<{ gesture: HandGesture; timeMs: number }>({
    gesture: 'None',
    timeMs: 0,
  });
  const prevWristRef = useRef<HandLandmark | null>(null);
  const onLogEventRef = useRef(onLogEvent);
  const onSelectModuleRef = useRef(onSelectModule);
  const captureSnapshotRef = useRef(captureSnapshot);
  const gestureControlRef = useRef(gestureControlEnabled);
  const trainedProfileRef = useRef<HandTwinTrainingProfile | null>(trainedProfile);
  const captureRemainingRef = useRef(captureRemaining);
  const selectedTrainGestureRef = useRef(selectedTrainGesture);

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
    trainedProfileRef.current = trainedProfile;
  }, [trainedProfile]);

  useEffect(() => {
    captureRemainingRef.current = captureRemaining;
  }, [captureRemaining]);

  useEffect(() => {
    selectedTrainGestureRef.current = selectedTrainGesture;
  }, [selectedTrainGesture]);

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
          const rawResults = await detectHands(video);
          if (cancelled) return;

          if (rawResults.length > 0) {
            let aggregateOob = 0;
            let aggregateOverlap = 0;
            let anyClamped = false;
            let maxPunchVel = 0;

            const results: HandDetectionResult[] = rawResults.map((hand, idx) => {
              const { sanitized, telemetry } = sanitizeHandResult(
                hand,
                idx === 0 ? prevWristRef.current : null
              );
              if (idx === 0) {
                prevWristRef.current = sanitized.landmarks[0] || null;
              }
              aggregateOob += telemetry.outOfBoundsCount;
              aggregateOverlap += telemetry.overlapPairsResolved;
              if (telemetry.softClamped) anyClamped = true;
              if (telemetry.punchVelocity > maxPunchVel) maxPunchVel = telemetry.punchVelocity;

              const activeProfile = trainedProfileRef.current;
              if (activeProfile) {
                const pred = predictWithTrainedTwin(
                  sanitized.landmarks,
                  sanitized.worldLandmarks,
                  activeProfile
                );
                if (pred && (pred.confidence >= 64 || sanitized.gesture === 'None')) {
                  return {
                    ...sanitized,
                    gesture: pred.gesture,
                    confidence: Math.max(sanitized.confidence, pred.confidence),
                  };
                }
              }

              return sanitized;
            });

            setBoundsTelemetry({
              outOfBoundsCount: aggregateOob,
              overlapPairsResolved: aggregateOverlap,
              softClamped: anyClamped,
              punchVelocity: maxPunchVel,
            });
            setHandResults(results);

            const primary = results[0];
            if (captureRemainingRef.current > 0 && primary.landmarks.length >= 21) {
              const targetGesture = selectedTrainGestureRef.current;
              setCapturedSamples((prev) => [
                ...prev.slice(-299),
                {
                  gesture: targetGesture,
                  landmarks: primary.landmarks,
                  worldLandmarks: primary.worldLandmarks,
                },
              ]);
              setCaptureRemaining((prev) => Math.max(0, prev - 1));
            }

            const mainGesture = primary.gesture;
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
          } else {
            prevWristRef.current = null;
            setHandResults([]);
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

  const handleStartCaptureBurst = () => {
    soundFx.playTargetLock();
    setCaptureRemaining(25);
  };

  const handleRunImmenseTraining = async () => {
    if (isTrainingTwin) return;
    setIsTrainingTwin(true);
    setTrainingProgress({
      epoch: 0,
      totalEpochs: 2400,
      loss: 1.8,
      accuracy: 0,
      phase: 'Synthesizing multi-angle punch & edge-bounds corpus...',
    });
    soundFx.playTargetLock();

    try {
      const profile = await runImmenseTwinTraining(capturedSamples, (prog) => {
        setTrainingProgress(prog);
      });
      setTrainedProfile(profile);
      soundFx.playSuccessChime();
      onLogEvent({
        module: 'gesture',
        title: '3D Hand Twin Trained (2,400 Epochs)',
        description: `Validated at ${profile.validationAccuracy}% accuracy across ${profile.totalSamples} samples (Z-Gain ${profile.punchZGain}x).`,
        type: 'success',
      });
    } finally {
      setIsTrainingTwin(false);
    }
  };

  const handleResetTraining = () => {
    clearSavedTwinProfile();
    setTrainedProfile(null);
    setCapturedSamples([]);
    setTrainingProgress(null);
  };

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
          <div className="flex items-center gap-3 flex-wrap">
            <h2
              className="text-2xl sm:text-3xl text-[#121829] dark:text-white"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              GestureOS · Hand Tracking &amp; 3D Twin
            </h2>
            <span className="text-xs font-black px-2.5 py-1 rounded-full border-2 border-[#121829] bg-[#00f0ff] text-[#121829] shadow-[1.5px_1.5px_0px_#121829]">
              21 3D LANDMARKS
            </span>
            {trainedProfile && (
              <span className="text-xs font-black px-2.5 py-1 rounded-full border-2 border-[#121829] bg-[#10b981] text-[#121829] shadow-[1.5px_1.5px_0px_#121829]">
                TWIN TRAINED · {trainedProfile.validationAccuracy}%
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-[#121829]/75 dark:text-white/75 mt-1">
            Tracks 21 3D finger keypoints with non-linear bounds clamping, overlap separation, and trainable pose calibration.
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
            trainedProfile={trainedProfile}
          />
        </div>
      </div>

      <div className="comic-panel p-5 bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b-2 border-[#121829]/15 dark:border-white/15">
          <div>
            <h4
              className="text-lg text-[#121829] dark:text-white flex items-center gap-2"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              <Brain className="h-5 w-5 text-[#ff462b]" />
              <span>3D Hand Twin Neural Training Studio</span>
            </h4>
            <p className="text-xs font-bold text-[#121829]/75 dark:text-white/75 mt-0.5">
              Captures your real hand bone proportions and trains a 78D pose neural head across 2,400 punch-foreshortening &amp; edge-clamped epochs.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleRunImmenseTraining}
              disabled={isTrainingTwin}
              className="comic-btn comic-btn-primary px-4 py-2 rounded-xl text-xs uppercase cursor-pointer"
            >
              <Zap className="h-4 w-4" />
              <span>
                {isTrainingTwin
                  ? `Training Epoch ${trainingProgress?.epoch || 0}/${trainingProgress?.totalEpochs || 2400}`
                  : 'Train Twin (2,400 Epochs)'}
              </span>
            </button>

            {trainedProfile && (
              <button
                onClick={handleResetTraining}
                disabled={isTrainingTwin}
                className="comic-btn comic-btn-white px-3 py-2 rounded-xl text-xs uppercase cursor-pointer"
                title="Reset Trained Hand Twin Calibration"
              >
                <Trash2 className="h-3.5 w-3.5 text-[#ff462b]" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-7 space-y-2.5">
            <div className="text-xs font-black uppercase text-[#121829]/70 dark:text-white/70">
              1. Select Pose &amp; Capture Live Webcam Bursts ({capturedSamples.length} User Frames)
            </div>
            <div className="flex flex-wrap gap-2">
              {TRAINABLE_GESTURES.map((g) => {
                const count = capturedSamples.filter((s) => s.gesture === g).length;
                const active = selectedTrainGesture === g;
                return (
                  <button
                    key={g}
                    onClick={() => setSelectedTrainGesture(g)}
                    className={`px-3 py-1.5 rounded-xl border-2 border-[#121829] text-xs font-black cursor-pointer transition-colors shadow-[2px_2px_0px_#121829] ${
                      active
                        ? 'bg-[#ffd000] text-[#121829]'
                        : 'bg-[#faf6ee] dark:bg-[#182238] text-[#121829] dark:text-white hover:bg-[#00f0ff]/20'
                    }`}
                  >
                    {g} {count > 0 ? `(${count})` : ''}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 pt-1 flex-wrap">
              <button
                onClick={handleStartCaptureBurst}
                disabled={!isStreaming || captureRemaining > 0 || isTrainingTwin}
                className="comic-btn comic-btn-cyan px-3.5 py-2 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>
                  {captureRemaining > 0
                    ? `Recording ${selectedTrainGesture} (${captureRemaining})...`
                    : `Capture 25 Frames: ${selectedTrainGesture}`}
                </span>
              </button>
              <span className="text-[11px] font-bold text-[#121829]/65 dark:text-white/65">
                Tip: Capture Closed Fist while punching toward lens + Open Palm for personal bone fit.
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl border-2 border-[#121829] bg-[#faf6ee] dark:bg-[#182238] p-3.5 space-y-2 shadow-[2px_2px_0px_#121829]">
            <div className="flex items-center justify-between text-xs font-black text-[#121829] dark:text-white">
              <span>Training Telemetry</span>
              <span className="font-mono text-[#059669] dark:text-[#10b981]">
                {trainingProgress
                  ? `${trainingProgress.accuracy.toFixed(1)}% VAL ACC`
                  : trainedProfile
                    ? `${trainedProfile.validationAccuracy}% VAL ACC`
                    : 'READY TO TRAIN'}
              </span>
            </div>

            {trainingProgress ? (
              <>
                <div className="w-full h-2.5 rounded-full bg-[#121829]/15 dark:bg-white/15 overflow-hidden border border-[#121829]">
                  <div
                    className="h-full bg-[#00f0ff] transition-all duration-150"
                    style={{
                      width: `${Math.min(100, Math.round((trainingProgress.epoch / trainingProgress.totalEpochs) * 100))}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold text-[#121829]/75 dark:text-white/75 font-mono">
                  <span>{trainingProgress.phase}</span>
                  <span>Loss: {trainingProgress.loss.toFixed(3)}</span>
                </div>
              </>
            ) : trainedProfile ? (
              <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
                <div className="p-2 rounded-lg bg-white dark:bg-[#121828] border border-[#121829]">
                  <span className="block text-[10px] font-black text-[#121829]/60 dark:text-white/60">EPOCHS</span>
                  <span className="font-mono text-xs font-black text-[#121829] dark:text-white">
                    {trainedProfile.epochsCompleted}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-[#121828] border border-[#121829]">
                  <span className="block text-[10px] font-black text-[#121829]/60 dark:text-white/60">SAMPLES</span>
                  <span className="font-mono text-xs font-black text-[#ff462b]">
                    {trainedProfile.totalSamples}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-[#121828] border border-[#121829]">
                  <span className="block text-[10px] font-black text-[#121829]/60 dark:text-white/60">Z-GAIN</span>
                  <span className="font-mono text-xs font-black text-[#059669] dark:text-[#10b981]">
                    {trainedProfile.punchZGain}x
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] font-bold text-[#121829]/70 dark:text-white/70">
                Click Train Twin to run 2,400 SGD optimization epochs with synthetic punch-foreshortening + edge-clipping augmentation.
              </p>
            )}
          </div>
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
              className="text-lg text-[#121829] dark:text-white flex items-center gap-2"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              <ShieldCheck className="h-5 w-5 text-[#10b981]" />
              <span>Kinematic &amp; Bounds Guard</span>
            </h4>
            <div className="space-y-2.5 text-xs font-extrabold">
              <div className="flex items-center justify-between p-2 rounded-lg border-2 border-[#121829] bg-[#faf6ee] dark:bg-[#182238] shadow-[1.5px_1.5px_0px_#121829]">
                <span className="text-[#121829]/70 dark:text-white/70">Active Hands:</span>
                <span className="font-mono text-[#121829] dark:text-white font-black text-sm">
                  {handResults.length}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg border-2 border-[#121829] bg-[#faf6ee] dark:bg-[#182238] shadow-[1.5px_1.5px_0px_#121829]">
                <span className="text-[#121829]/70 dark:text-white/70">Screen Bounds:</span>
                <span
                  className={`font-mono font-black text-xs ${
                    boundsTelemetry.softClamped
                      ? 'text-[#ff462b]'
                      : 'text-[#059669] dark:text-[#10b981]'
                  }`}
                >
                  {boundsTelemetry.softClamped ? 'TANH SOFT-CLAMPED' : 'IN BOUNDS'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg border-2 border-[#121829] bg-[#faf6ee] dark:bg-[#182238] shadow-[1.5px_1.5px_0px_#121829]">
                <span className="text-[#121829]/70 dark:text-white/70">Overlap Guard:</span>
                <span className="font-mono text-[#121829] dark:text-white font-black text-xs">
                  {boundsTelemetry.overlapPairsResolved > 0
                    ? `${boundsTelemetry.overlapPairsResolved} PAIRS GUARDED`
                    : 'CLEAR'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg border-2 border-[#121829] bg-[#faf6ee] dark:bg-[#182238] shadow-[1.5px_1.5px_0px_#121829]">
                <span className="text-[#121829]/70 dark:text-white/70">Pinch / Punch Vel:</span>
                <span className="font-mono text-[#121829] dark:text-white font-black text-xs">
                  {primaryHand?.pinchDistance !== undefined
                    ? `${(primaryHand.pinchDistance * 100).toFixed(1)}% · v${boundsTelemetry.punchVelocity}`
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
