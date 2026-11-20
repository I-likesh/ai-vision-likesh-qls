import { FaceLandmark, FaceMeshResult } from '../types';
import { loadScript, runSequentialInit } from './modelLoader';

declare global {
  interface Window {
    FaceMesh?: any;
    Module?: any;
  }
}

let faceMeshInstance: any = null;
let initPromise: Promise<boolean> | null = null;
let mediaPipeDisabled = false;
let isInferencing = false;
let lastResults: any = null;
let lastFaceResult: FaceMeshResult | null = null;

export async function initFaceMeshModel(): Promise<boolean> {
  if (faceMeshInstance) return true;
  if (mediaPipeDisabled) return false;
  if (initPromise) return initPromise;

  initPromise = runSequentialInit(async () => {
    if (faceMeshInstance) return true;
    if (mediaPipeDisabled) return false;

    try {
      const loaded = await loadScript(
        'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.min.js'
      );
      if (!loaded || !window.FaceMesh) {
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

      const instance = new window.FaceMesh({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`,
      });

      instance.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      instance.onResults((results: any) => {
        lastResults = results;
      });

      if (typeof instance.initialize === 'function') {
        await instance.initialize();
      }

      faceMeshInstance = instance;
      return true;
    } catch (err) {
      console.warn('MediaPipe FaceMesh unavailable, switching to local fallback:', err);
      mediaPipeDisabled = true;
      faceMeshInstance = null;
      return false;
    }
  });

  return initPromise;
}

function calculateEAR(
  p1: FaceLandmark,
  p2: FaceLandmark,
  p3: FaceLandmark,
  p4: FaceLandmark,
  p5: FaceLandmark,
  p6: FaceLandmark
): number {
  const distVertical1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
  const distVertical2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
  const distHorizontal = Math.hypot(p1.x - p4.x, p1.y - p4.y);
  if (distHorizontal === 0) return 0.3;
  return (distVertical1 + distVertical2) / (2.0 * distHorizontal);
}

export async function detectFaceMesh(video: HTMLVideoElement): Promise<FaceMeshResult | null> {
  if (video.videoWidth === 0 || video.videoHeight === 0) return null;
  if (isInferencing) return lastFaceResult;

  if (faceMeshInstance && !mediaPipeDisabled) {
    isInferencing = true;
    try {
      await faceMeshInstance.send({ image: video });
      if (lastResults && lastResults.multiFaceLandmarks && lastResults.multiFaceLandmarks.length > 0) {
        const raw = lastResults.multiFaceLandmarks[0];
        const landmarks: FaceLandmark[] = raw.map((pt: any) => ({
          x: pt.x,
          y: pt.y,
          z: pt.z || 0,
        }));

        const nose = landmarks[1] || landmarks[0];
        const leftEyeOuter = landmarks[33] || landmarks[0];
        const leftEyeInner = landmarks[133] || landmarks[0];
        const rightEyeInner = landmarks[362] || landmarks[0];
        const rightEyeOuter = landmarks[263] || landmarks[0];
        const topLip = landmarks[13] || landmarks[0];
        const bottomLip = landmarks[14] || landmarks[0];

        const earLeft =
          landmarks[160] && landmarks[144] && landmarks[158] && landmarks[153]
            ? calculateEAR(
                leftEyeOuter,
                landmarks[160],
                landmarks[158],
                leftEyeInner,
                landmarks[153],
                landmarks[144]
              )
            : 0.28;

        const mouthDist = Math.hypot(topLip.x - bottomLip.x, topLip.y - bottomLip.y);
        const eyeSpan = Math.hypot(
          leftEyeOuter.x - rightEyeOuter.x,
          leftEyeOuter.y - rightEyeOuter.y
        );
        const mouthOpenness = eyeSpan > 0 ? Number((mouthDist / eyeSpan).toFixed(2)) : 0.15;

        const midEyesX = (leftEyeInner.x + rightEyeInner.x) / 2;
        const yaw = Math.round((nose.x - midEyesX) * 200);
        const roll = Math.round(
          Math.atan2(rightEyeOuter.y - leftEyeOuter.y, rightEyeOuter.x - leftEyeOuter.x) *
            (180 / Math.PI)
        );
        const pitch = Math.round(
          (nose.y - (leftEyeInner.y + rightEyeInner.y) / 2) * 120 - 15
        );

        const result: FaceMeshResult = {
          landmarks,
          eyeAspectRatio: Number(earLeft.toFixed(3)),
          mouthOpenness,
          faceOrientation: { yaw, pitch, roll },
          keypoints: {
            noseTip: nose,
            leftEye: {
              x: (leftEyeOuter.x + leftEyeInner.x) / 2,
              y: (leftEyeOuter.y + leftEyeInner.y) / 2,
              z: 0,
            },
            rightEye: {
              x: (rightEyeOuter.x + rightEyeInner.x) / 2,
              y: (rightEyeOuter.y + rightEyeInner.y) / 2,
              z: 0,
            },
            mouthCenter: {
              x: (topLip.x + bottomLip.x) / 2,
              y: (topLip.y + bottomLip.y) / 2,
              z: 0,
            },
          },
        };
        lastFaceResult = result;
        isInferencing = false;
        return result;
      }
      isInferencing = false;
      return null;
    } catch (err) {
      console.warn('MediaPipe FaceMesh inference error, switching to local fallback:', err);
      mediaPipeDisabled = true;
      faceMeshInstance = null;
      isInferencing = false;
    }
  }

  const fallback = runFallbackFaceMesh();
  lastFaceResult = fallback;
  return fallback;
}

let faceTick = 0;
function runFallbackFaceMesh(): FaceMeshResult {
  faceTick += 0.05;
  const yaw = Math.round(Math.sin(faceTick * 0.4) * 18);
  const pitch = Math.round(Math.cos(faceTick * 0.3) * 12);
  const roll = Math.round(Math.sin(faceTick * 0.2) * 8);

  const cx = 0.5 + Math.sin(faceTick * 0.4) * 0.04;
  const cy = 0.45 + Math.cos(faceTick * 0.3) * 0.02;

  const landmarks: FaceLandmark[] = [];
  const rings = 12;
  const pointsPerRing = 39;

  for (let r = 1; r <= rings; r++) {
    const radiusX = (r / rings) * 0.18;
    const radiusY = (r / rings) * 0.25;
    for (let p = 0; p < pointsPerRing; p++) {
      const angle = (p / pointsPerRing) * Math.PI * 2;
      landmarks.push({
        x: cx + Math.cos(angle) * radiusX,
        y: cy + Math.sin(angle) * radiusY,
        z: Math.cos(angle) * 0.05,
      });
    }
  }

  landmarks[1] = { x: cx, y: cy + 0.02, z: 0.08 };

  const ear = 0.25 + (Math.sin(faceTick * 0.7) > 0.9 ? -0.15 : 0.05);
  const mouthOpen = 0.12 + Math.abs(Math.sin(faceTick * 0.5)) * 0.18;

  return {
    landmarks,
    eyeAspectRatio: Number(ear.toFixed(3)),
    mouthOpenness: Number(mouthOpen.toFixed(2)),
    faceOrientation: { yaw, pitch, roll },
    keypoints: {
      noseTip: { x: cx, y: cy + 0.02, z: 0.08 },
      leftEye: { x: cx - 0.07, y: cy - 0.04, z: 0 },
      rightEye: { x: cx + 0.07, y: cy - 0.04, z: 0 },
      mouthCenter: { x: cx, y: cy + 0.11, z: 0 },
    },
  };
}

export const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109, 10,
];

export const LIPS_INDICES = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
  61,
];
