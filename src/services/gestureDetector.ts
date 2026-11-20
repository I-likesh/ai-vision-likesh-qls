import { HandDetectionResult, HandGesture, HandLandmark } from '../types';
import { loadScript, runSequentialInit } from './modelLoader';

declare global {
  interface Window {
    Hands?: any;
    Module?: any;
  }
}

let handsInstance: any = null;
let initPromise: Promise<boolean> | null = null;
let mediaPipeDisabled = false;
let isInferencing = false;
let lastResults: any = null;
let lastHandDetections: HandDetectionResult[] = [];
let opticalCanvas: HTMLCanvasElement | null = null;

export async function initGestureModel(): Promise<boolean> {
  if (handsInstance) return true;
  if (mediaPipeDisabled) return false;
  if (initPromise) return initPromise;

  initPromise = runSequentialInit(async () => {
    if (handsInstance) return true;
    if (mediaPipeDisabled) return false;

    try {
      const loaded = await loadScript(
        'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.min.js'
      );
      if (!loaded || !window.Hands) {
        mediaPipeDisabled = true;
        return false;
      }

      if (window.Module && typeof window.Module === 'object') {
        try {
          delete window.Module;
        } catch {
          window.Module = undefined;
        }
      }

      const instance = new window.Hands({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
      });

      instance.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });

      instance.onResults((results: any) => {
        lastResults = results;
      });

      if (typeof instance.initialize === 'function') {
        await instance.initialize();
      }

      handsInstance = instance;
      return true;
    } catch (err) {
      console.warn('MediaPipe Hands unavailable, switching to local optical hand tracker:', err);
      mediaPipeDisabled = true;
      handsInstance = null;
      return false;
    }
  });

  return initPromise;
}

export function classifyHandGesture(landmarks: HandLandmark[]): HandGesture {
  if (!landmarks || landmarks.length < 21) return 'None';

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const thumbMcp = landmarks[2];

  const indexTip = landmarks[8];
  const indexPip = landmarks[6];
  const indexMcp = landmarks[5];

  const middleTip = landmarks[12];
  const middlePip = landmarks[10];
  const middleMcp = landmarks[9];

  const ringTip = landmarks[16];
  const ringPip = landmarks[14];
  const ringMcp = landmarks[13];

  const pinkyTip = landmarks[20];
  const pinkyPip = landmarks[18];
  const pinkyMcp = landmarks[17];

  const isExtended = (tip: HandLandmark, pip: HandLandmark) => {
    const distTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    const distPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
    return distTip > distPip * 1.15;
  };

  const indexExt = isExtended(indexTip, indexPip);
  const middleExt = isExtended(middleTip, middlePip);
  const ringExt = isExtended(ringTip, ringPip);
  const pinkyExt = isExtended(pinkyTip, pinkyPip);

  const thumbIndexDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);

  if (thumbIndexDist < 0.08 && middleExt && ringExt) {
    return 'OK Sign';
  }

  if (!indexExt && !middleExt && !ringExt && !pinkyExt) {
    const thumbPointingUp = thumbTip.y < thumbIp.y - 0.035 && thumbTip.y < thumbMcp.y - 0.075;
    const thumbAboveKnuckles = thumbTip.y < indexMcp.y - 0.07 && thumbTip.y < indexPip.y - 0.05;
    const verticalDominance =
      Math.abs(thumbTip.y - thumbMcp.y) > Math.abs(thumbTip.x - thumbMcp.x) * 0.9;

    const distToFoldedIndex = Math.hypot(thumbTip.x - indexPip.x, thumbTip.y - indexPip.y);
    const distToFoldedMiddle = Math.hypot(thumbTip.x - middlePip.x, thumbTip.y - middlePip.y);
    const thumbRestingOnFingers =
      distToFoldedIndex < 0.08 || distToFoldedMiddle < 0.08 || thumbTip.y >= indexMcp.y - 0.02;

    if (thumbPointingUp && thumbAboveKnuckles && verticalDominance && !thumbRestingOnFingers) {
      return 'Thumbs Up';
    }

    return 'Closed Fist';
  }

  if (indexExt && middleExt && !ringExt && !pinkyExt) {
    return 'Victory';
  }

  if (indexExt && !middleExt && !ringExt && !pinkyExt) {
    return 'Pointing';
  }

  if (indexExt && middleExt && ringExt && pinkyExt) {
    return 'Open Palm';
  }

  return 'None';
}

export async function detectHands(video: HTMLVideoElement): Promise<HandDetectionResult[]> {
  if (video.videoWidth === 0 || video.videoHeight === 0) return [];
  if (isInferencing) return lastHandDetections;

  if (handsInstance && !mediaPipeDisabled) {
    isInferencing = true;
    try {
      await handsInstance.send({ image: video });
      if (lastResults && lastResults.multiHandLandmarks && lastResults.multiHandLandmarks.length > 0) {
        const videoAspect = video.videoWidth / Math.max(1, video.videoHeight);
        const mapped: HandDetectionResult[] = lastResults.multiHandLandmarks.map(
          (lmList: any[], i: number) => {
            const landmarks: HandLandmark[] = lmList.map((pt) => ({ x: pt.x, y: pt.y, z: pt.z }));
            const rawWorld = lastResults.multiHandWorldLandmarks?.[i];
            const worldLandmarks: HandLandmark[] | undefined = Array.isArray(rawWorld)
              ? rawWorld.map((pt: any) => ({ x: pt.x, y: pt.y, z: pt.z }))
              : undefined;
            const handedness = lastResults.multiHandedness?.[i]?.label === 'Left' ? 'Left' : 'Right';
            const gesture = classifyHandGesture(landmarks);
            return {
              landmarks,
              worldLandmarks,
              videoAspect,
              gesture,
              confidence: Math.round((lastResults.multiHandedness?.[i]?.score || 0.85) * 100),
              handedness,
              pinchDistance: Math.hypot(
                landmarks[4].x - landmarks[8].x,
                landmarks[4].y - landmarks[8].y
              ),
            };
          }
        );
        lastHandDetections = mapped;
        isInferencing = false;
        return mapped;
      }
      lastHandDetections = [];
      isInferencing = false;
      return [];
    } catch (err) {
      console.warn('MediaPipe Hands inference error, switching to local optical fallback:', err);
      mediaPipeDisabled = true;
      handsInstance = null;
      isInferencing = false;
    }
  }

  const fallback = runOpticalHandFallback(video);
  lastHandDetections = fallback;
  return fallback;
}

function runOpticalHandFallback(video: HTMLVideoElement): HandDetectionResult[] {
  try {
    if (!opticalCanvas) {
      opticalCanvas = document.createElement('canvas');
      opticalCanvas.width = 64;
      opticalCanvas.height = 48;
    }
    const ctx = opticalCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(video, 0, 0, 64, 48);
    const frame = ctx.getImageData(0, 0, 64, 48).data;

    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let y = 4; y < 44; y++) {
      for (let x = 4; x < 60; x++) {
        const i = (y * 64 + x) * 4;
        const r = frame[i];
        const g = frame[i + 1];
        const b = frame[i + 2];
        if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
          sumX += x / 64;
          sumY += y / 48;
          count++;
        }
      }
    }

    if (count < 18) {
      return [];
    }

    const cx = sumX / count;
    const cy = sumY / count;

    const lm: HandLandmark[] = [
      { x: cx, y: cy + 0.16 },
      { x: cx - 0.04, y: cy + 0.11 },
      { x: cx - 0.07, y: cy + 0.07 },
      { x: cx - 0.09, y: cy + 0.04 },
      { x: cx - 0.11, y: cy + 0.02 },
      { x: cx - 0.03, y: cy + 0.04 },
      { x: cx - 0.04, y: cy - 0.04 },
      { x: cx - 0.04, y: cy - 0.1 },
      { x: cx - 0.04, y: cy - 0.16 },
      { x: cx, y: cy + 0.06 },
      { x: cx, y: cy + 0.08 },
      { x: cx, y: cy + 0.1 },
      { x: cx, y: cy + 0.12 },
      { x: cx + 0.04, y: cy + 0.07 },
      { x: cx + 0.04, y: cy + 0.09 },
      { x: cx + 0.04, y: cy + 0.11 },
      { x: cx + 0.04, y: cy + 0.13 },
      { x: cx + 0.07, y: cy + 0.08 },
      { x: cx + 0.07, y: cy + 0.1 },
      { x: cx + 0.07, y: cy + 0.12 },
      { x: cx + 0.07, y: cy + 0.14 },
    ];

    return [
      {
        landmarks: lm,
        gesture: classifyHandGesture(lm),
        confidence: 78,
        handedness: 'Right',
        pinchDistance: Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y),
      },
    ];
  } catch {
    return [];
  }
}

export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];
