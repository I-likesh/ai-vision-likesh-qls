import { FaceColorPalette, FaceLandmark, FaceMeshResult } from '../types';
import { loadScript, runSequentialInit } from './modelLoader';
import {
  buildCanonical468Face,
  FACE_OVAL_LOOP,
  LIPS_OUTER_LOOP,
  sampleFaceColorsFromSource,
} from './faceMeshTopology';

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
let lastSampledPalette: FaceColorPalette | undefined;
let syncedFaceFrameCanvas: HTMLCanvasElement | null = null;

function captureSyncedFrame(video: HTMLVideoElement): HTMLCanvasElement | null {
  if (typeof document === 'undefined' || video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }
  const targetW = Math.min(640, video.videoWidth);
  const targetH = Math.max(1, Math.round(targetW * (video.videoHeight / video.videoWidth)));
  if (!syncedFaceFrameCanvas) {
    syncedFaceFrameCanvas = document.createElement('canvas');
  }
  if (syncedFaceFrameCanvas.width !== targetW || syncedFaceFrameCanvas.height !== targetH) {
    syncedFaceFrameCanvas.width = targetW;
    syncedFaceFrameCanvas.height = targetH;
  }
  const ctx = syncedFaceFrameCanvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, targetW, targetH);
  return syncedFaceFrameCanvas;
}

export function getSyncedFaceFrameCanvas(): HTMLCanvasElement | null {
  return syncedFaceFrameCanvas;
}

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
    } catch {
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

  const videoAspect = video.videoWidth / Math.max(1, video.videoHeight);
  const syncedCanvas = captureSyncedFrame(video);
  const inferenceSource: HTMLVideoElement | HTMLCanvasElement = syncedCanvas || video;

  if (faceMeshInstance && !mediaPipeDisabled) {
    isInferencing = true;
    try {
      await faceMeshInstance.send({ image: inferenceSource });
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

        const earRight =
          landmarks[385] && landmarks[387] && landmarks[373] && landmarks[380]
            ? calculateEAR(
                rightEyeInner,
                landmarks[385],
                landmarks[387],
                rightEyeOuter,
                landmarks[380],
                landmarks[373]
              )
            : earLeft;

        const avgEar = (earLeft + earRight) * 0.5;

        const mouthDist = Math.hypot(topLip.x - bottomLip.x, topLip.y - bottomLip.y);
        const eyeSpan = Math.hypot(
          leftEyeOuter.x - rightEyeOuter.x,
          leftEyeOuter.y - rightEyeOuter.y
        );
        const mouthOpenness = eyeSpan > 0 ? Number(Math.min(0.8, mouthDist / eyeSpan).toFixed(2)) : 0.15;

        const midEyesX = (leftEyeInner.x + rightEyeInner.x) / 2;
        const yaw = Math.round((nose.x - midEyesX) * 200);
        const roll = Math.round(
          Math.atan2(rightEyeOuter.y - leftEyeOuter.y, rightEyeOuter.x - leftEyeOuter.x) *
            (180 / Math.PI)
        );
        const pitch = Math.round(
          (nose.y - (leftEyeInner.y + rightEyeInner.y) / 2) * 120 - 15
        );

        lastSampledPalette = sampleFaceColorsFromSource(
          inferenceSource,
          landmarks,
          lastSampledPalette
        );

        const result: FaceMeshResult = {
          landmarks,
          eyeAspectRatio: Number(avgEar.toFixed(3)),
          leftEyeAspectRatio: Number(earLeft.toFixed(3)),
          rightEyeAspectRatio: Number(earRight.toFixed(3)),
          mouthOpenness,
          faceOrientation: { yaw, pitch, roll },
          keypoints: {
            noseTip: nose,
            leftEye: {
              x: (leftEyeOuter.x + leftEyeInner.x) / 2,
              y: (leftEyeOuter.y + leftEyeInner.y) / 2,
              z: ((leftEyeOuter.z || 0) + (leftEyeInner.z || 0)) / 2,
            },
            rightEye: {
              x: (rightEyeOuter.x + rightEyeInner.x) / 2,
              y: (rightEyeOuter.y + rightEyeInner.y) / 2,
              z: ((rightEyeOuter.z || 0) + (rightEyeInner.z || 0)) / 2,
            },
            mouthCenter: {
              x: (topLip.x + bottomLip.x) / 2,
              y: (topLip.y + bottomLip.y) / 2,
              z: ((topLip.z || 0) + (bottomLip.z || 0)) / 2,
            },
          },
          palette: lastSampledPalette,
          videoAspect,
        };
        lastFaceResult = result;
        isInferencing = false;
        return result;
      }
      isInferencing = false;
      return null;
    } catch {
      mediaPipeDisabled = true;
      faceMeshInstance = null;
      isInferencing = false;
    }
  }

  const fallback = runFallbackFaceMesh(inferenceSource, videoAspect);
  lastFaceResult = fallback;
  return fallback;
}

let faceTick = 0;
function runFallbackFaceMesh(
  source: HTMLVideoElement | HTMLCanvasElement,
  videoAspect: number
): FaceMeshResult {
  faceTick += 0.05;
  const yaw = Math.round(Math.sin(faceTick * 0.4) * 16);
  const pitch = Math.round(Math.cos(faceTick * 0.3) * 10);
  const roll = Math.round(Math.sin(faceTick * 0.2) * 7);

  const cx = 0.5 + Math.sin(faceTick * 0.4) * 0.03;
  const cy = 0.46 + Math.cos(faceTick * 0.3) * 0.02;

  const blinkWave = Math.sin(faceTick * 0.7) > 0.9 ? 0.14 : 0.29;
  const mouthOpen = Number((0.1 + Math.abs(Math.sin(faceTick * 0.5)) * 0.18).toFixed(2));
  const landmarks = buildCanonical468Face(cx, cy, blinkWave, blinkWave, mouthOpen);

  lastSampledPalette = sampleFaceColorsFromSource(source, landmarks, lastSampledPalette);

  return {
    landmarks,
    eyeAspectRatio: Number(blinkWave.toFixed(3)),
    leftEyeAspectRatio: Number(blinkWave.toFixed(3)),
    rightEyeAspectRatio: Number(blinkWave.toFixed(3)),
    mouthOpenness: mouthOpen,
    faceOrientation: { yaw, pitch, roll },
    keypoints: {
      noseTip: landmarks[1],
      leftEye: {
        x: (landmarks[33].x + landmarks[133].x) * 0.5,
        y: (landmarks[33].y + landmarks[133].y) * 0.5,
        z: landmarks[33].z,
      },
      rightEye: {
        x: (landmarks[362].x + landmarks[263].x) * 0.5,
        y: (landmarks[362].y + landmarks[263].y) * 0.5,
        z: landmarks[362].z,
      },
      mouthCenter: {
        x: (landmarks[13].x + landmarks[14].x) * 0.5,
        y: (landmarks[13].y + landmarks[14].y) * 0.5,
        z: landmarks[13].z,
      },
    },
    palette: lastSampledPalette,
    videoAspect,
  };
}

export const FACE_OVAL_INDICES = [...FACE_OVAL_LOOP, FACE_OVAL_LOOP[0]];
export const LIPS_INDICES = [...LIPS_OUTER_LOOP, LIPS_OUTER_LOOP[0]];
