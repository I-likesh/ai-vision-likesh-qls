import React, { useEffect, useState, useRef } from 'react';
import { CameraViewport } from '../common/CameraViewport';
import { useCamera } from '../../context/CameraContext';
import { PoseDetectionResult, VisionEvent } from '../../types';
import { initPoseModel, detectPose, POSE_CONNECTIONS, resetPoseReps } from '../../services/poseDetector';
import confetti from 'canvas-confetti';
import { RotateCcw, Trophy } from 'lucide-react';

interface MotionProps {
  onLogEvent: (event: Omit<VisionEvent, 'id' | 'timestamp'>) => void;
}

export const MotionIntelligence: React.FC<MotionProps> = ({ onLogEvent }) => {
  const { videoRef, isStreaming } = useCamera();
  const [modelReady, setModelReady] = useState(false);
  const [poseResult, setPoseResult] = useState<PoseDetectionResult | null>(null);
  const [repCount, setRepCount] = useState(0);

  const prevPoseRef = useRef<string>('');
  const repCountRef = useRef<number>(0);
  const onLogEventRef = useRef(onLogEvent);

  useEffect(() => {
    onLogEventRef.current = onLogEvent;
  }, [onLogEvent]);

  useEffect(() => {
    let mounted = true;
    initPoseModel().then((success) => {
      if (mounted) {
        setModelReady(success);
        onLogEventRef.current({
          module: 'motion',
          title: 'Motion Intelligence Initialized',
          description: success
            ? 'MediaPipe Pose 33-keypoint biomechanics engine loaded.'
            : 'Running local kinematic pose analyzer.',
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
      if (video && isStreaming && video.readyState >= 2 && !busy && time - lastTime > 65) {
        lastTime = time;
        busy = true;
        try {
          const res = await detectPose(video);
          if (cancelled) return;
          if (res) {
            setPoseResult(res);

            if (res.reps > repCountRef.current) {
              repCountRef.current = res.reps;
              setRepCount(res.reps);
              confetti({
                particleCount: 60,
                spread: 80,
                origin: { y: 0.65 },
                colors: ['#ff462b', '#00f0ff', '#ffd000', '#ff2a85'],
              });
              onLogEventRef.current({
                module: 'motion',
                title: 'Repetition Achieved!',
                description: `Completed squat repetition #${res.reps}!`,
                type: 'success',
              });
            }

            if (res.recognizedPose !== prevPoseRef.current && res.recognizedPose !== 'Neutral Standing') {
              prevPoseRef.current = res.recognizedPose;
              onLogEventRef.current({
                module: 'motion',
                title: `Pose Recognized: ${res.recognizedPose}`,
                description: `Kinematic angles verified (${res.angles.leftKnee}° knee, ${res.angles.spineTilt}° spine).`,
                type: 'info',
              });
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

  const handleResetReps = () => {
    resetPoseReps();
    setRepCount(0);
  };

  const handleDrawOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!poseResult || !poseResult.landmarks) return;

    const { landmarks, angles } = poseResult;

    ctx.strokeStyle = '#121829';
    ctx.lineWidth = 7;
    POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const start = landmarks[startIdx];
      const end = landmarks[endIdx];
      if (start && end && (start.visibility ?? 1) > 0.4 && (end.visibility ?? 1) > 0.4) {
        ctx.beginPath();
        ctx.moveTo(start.x * width, start.y * height);
        ctx.lineTo(end.x * width, end.y * height);
        ctx.stroke();
      }
    });

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 4;
    POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const start = landmarks[startIdx];
      const end = landmarks[endIdx];
      if (start && end && (start.visibility ?? 1) > 0.4 && (end.visibility ?? 1) > 0.4) {
        ctx.beginPath();
        ctx.moveTo(start.x * width, start.y * height);
        ctx.lineTo(end.x * width, end.y * height);
        ctx.stroke();
      }
    });

    landmarks.forEach((pt, idx) => {
      if ((pt.visibility ?? 1) > 0.4) {
        const px = pt.x * width;
        const py = pt.y * height;

        const isKnee = idx === 25 || idx === 26;
        ctx.fillStyle = isKnee ? (angles.leftKnee < 115 ? '#ffd000' : '#ff462b') : '#00f0ff';

        ctx.beginPath();
        ctx.arc(px, py, isKnee ? 9 : 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#121829';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });

    const leftElbow = landmarks[13];
    const leftKnee = landmarks[25];

    if (leftElbow && (leftElbow.visibility ?? 1) > 0.5) {
      const ex = leftElbow.x * width + 14;
      const ey = leftElbow.y * height;
      ctx.fillStyle = '#ffd000';
      ctx.fillRect(ex, ey - 14, 52, 22);
      ctx.strokeStyle = '#121829';
      ctx.lineWidth = 2;
      ctx.strokeRect(ex, ey - 14, 52, 22);
      ctx.fillStyle = '#121829';
      ctx.font = 'bold 14px Nunito, sans-serif';
      ctx.fillText(`${angles.leftElbow}°`, ex + 6, ey + 2);
    }

    if (leftKnee && (leftKnee.visibility ?? 1) > 0.5) {
      const kx = leftKnee.x * width + 14;
      const ky = leftKnee.y * height;
      ctx.fillStyle = '#ff462b';
      ctx.fillRect(kx, ky - 14, 52, 22);
      ctx.strokeStyle = '#121829';
      ctx.lineWidth = 2;
      ctx.strokeRect(kx, ky - 14, 52, 22);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Nunito, sans-serif';
      ctx.fillText(`${angles.leftKnee}°`, kx + 6, ky + 2);
    }
  };

  const angles = poseResult?.angles;

  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-[#121829]">
        <div>
          <div className="flex items-center gap-3">
            <h2
              className="text-2xl sm:text-3xl text-[#121829]"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              Motion Intelligence · Pose Biomechanics
            </h2>
            <span className="text-xs font-black px-2.5 py-1 rounded-full border-2 border-[#121829] bg-[#ffd000] text-[#121829] shadow-[1.5px_1.5px_0px_#121829]">
              33 JOINTS
            </span>
          </div>
          <p className="text-sm font-bold text-[#121829]/75 mt-1">
            Real-time skeletal tracking, joint angle trigonometry, posture scoring, and repetition detection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetReps}
            className="comic-btn comic-btn-white px-4 py-2 rounded-xl text-xs uppercase cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset Reps</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        <div className="lg:col-span-8 space-y-4">
          <CameraViewport
            onDrawOverlay={handleDrawOverlay}
            overlayBadge={poseResult ? `POSE: ${poseResult.recognizedPose.toUpperCase()}` : 'STAND IN FRAME'}
          />

          <div className="comic-panel p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white">
            <div className="p-3 rounded-xl border-2 border-[#121829] bg-[#faf6ee] shadow-[2px_2px_0px_#121829]">
              <span className="text-xs font-black text-[#121829]/70 uppercase block">
                Left Knee
              </span>
              <span
                className="text-2xl text-[#ff462b] tabular-nums"
                style={{ fontFamily: "'Bagel Fat One', cursive" }}
              >
                {angles ? `${angles.leftKnee}°` : '—'}
              </span>
            </div>
            <div className="p-3 rounded-xl border-2 border-[#121829] bg-[#faf6ee] shadow-[2px_2px_0px_#121829]">
              <span className="text-xs font-black text-[#121829]/70 uppercase block">
                Right Knee
              </span>
              <span
                className="text-2xl text-[#ff462b] tabular-nums"
                style={{ fontFamily: "'Bagel Fat One', cursive" }}
              >
                {angles ? `${angles.rightKnee}°` : '—'}
              </span>
            </div>
            <div className="p-3 rounded-xl border-2 border-[#121829] bg-[#faf6ee] shadow-[2px_2px_0px_#121829]">
              <span className="text-xs font-black text-[#121829]/70 uppercase block">
                Left Elbow
              </span>
              <span
                className="text-2xl text-[#0284c7] dark:text-[#00f0ff] tabular-nums"
                style={{ fontFamily: "'Bagel Fat One', cursive" }}
              >
                {angles ? `${angles.leftElbow}°` : '—'}
              </span>
            </div>
            <div className="p-3 rounded-xl border-2 border-[#121829] bg-[#faf6ee] shadow-[2px_2px_0px_#121829]">
              <span className="text-xs font-black text-[#121829]/70 uppercase block">
                Spine Tilt
              </span>
              <span
                className="text-2xl text-[#b45309] dark:text-[#ffd000] tabular-nums"
                style={{ fontFamily: "'Bagel Fat One', cursive" }}
              >
                {angles ? `${angles.spineTilt}°` : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">

          <div className="comic-panel p-5 bg-white">
            <span className="text-xs font-black uppercase tracking-wider text-[#121829]/60">
              POSTURE QUALITY SCORE
            </span>
            <div className="flex items-baseline gap-3 mt-1">
              <div
                className="text-4xl text-[#059669] tabular-nums"
                style={{ fontFamily: "'Bagel Fat One', cursive" }}
              >
                {angles ? `${angles.postureScore}%` : '92%'}
              </div>
              <span className="text-xs font-black px-2 py-0.5 rounded-full border-2 border-[#121829] bg-[#ffd000] text-[#121829]">
                Nominal
              </span>
            </div>
            <div className="w-full bg-[#faf6ee] border-2 border-[#121829] h-3 rounded-full mt-3 overflow-hidden shadow-[1px_1px_0px_#121829]">
              <div
                className="bg-[#059669] h-full transition-all duration-300"
                style={{ width: `${angles?.postureScore || 92}%` }}
              />
            </div>
          </div>

          <div className="comic-panel p-5 bg-[#ffd000]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-[#121829]">
                EXERCISE REPETITIONS
              </span>
              <Trophy className="h-6 w-6 text-[#ff462b]" />
            </div>
            <div
              className="text-4xl text-[#121829] mt-2 tabular-nums"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              {repCount} <span className="text-base font-sans font-bold">Squats</span>
            </div>
            <p className="text-xs font-bold text-[#121829]/80 mt-2 leading-relaxed">
              Drop below knee level (&lt;115°) and return upright to log a completed repetition with celebratory confetti!
            </p>
          </div>

          <div className="comic-panel p-5 bg-white space-y-2">
            <h4
              className="text-lg text-[#121829]"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              Demonstration Poses
            </h4>
            <div className="space-y-2 text-xs">
              {[
                { name: 'Neutral Standing', desc: 'Upright spine, straight knees' },
                { name: 'T-Pose', desc: 'Arms horizontal 90° to torso' },
                { name: 'Arms Raised', desc: 'Wrists extended overhead' },
                { name: 'Squat', desc: 'Deep knee bend under 115°' },
                { name: 'Warrior / Lunge', desc: 'Asymmetric lunge stance' },
              ].map((p) => {
                const isActive = poseResult?.recognizedPose === p.name;
                return (
                  <div
                    key={p.name}
                    className={`p-2.5 rounded-xl border-2 border-[#121829] transition-colors ${
                      isActive
                        ? 'bg-[#00f0ff] shadow-[2.5px_2.5px_0px_#121829]'
                        : 'bg-[#faf6ee] shadow-[1.5px_1.5px_0px_#121829]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-black">
                      <span className="text-[#121829]">{p.name}</span>
                      {isActive && <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded-full border border-[#121829] bg-[#ff462b] text-white">Active</span>}
                    </div>
                    <span className="text-xs text-[#121829]/75 font-bold">{p.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
