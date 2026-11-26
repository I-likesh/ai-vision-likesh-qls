import {
  HandBoundsTelemetry,
  HandDetectionResult,
  HandGesture,
  HandLandmark,
  HandTwinTrainingProfile,
} from '../types';

export const TRAINABLE_GESTURES: Array<Exclude<HandGesture, 'None'>> = [
  'Closed Fist',
  'Open Palm',
  'Pointing',
  'Victory',
  'Thumbs Up',
  'OK Sign',
];

export const BONE_SEGMENT_PAIRS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
];

const FEATURE_DIM = 78;
const STORAGE_KEY = 'ai_vision_hand_twin_profile_v1';

const CANONICAL_BASE: Array<[number, number, number]> = [
  [0, -0.92, 0],
  [-0.36, -0.66, 0.14],
  [-0.64, -0.34, 0.22],
  [-0.84, -0.05, 0.26],
  [-1.0, 0.22, 0.28],
  [-0.4, 0.02, 0.04],
  [-0.46, 0.44, 0.08],
  [-0.48, 0.72, 0.1],
  [-0.5, 0.96, 0.12],
  [-0.12, 0.08, 0],
  [-0.13, 0.54, 0.04],
  [-0.13, 0.86, 0.06],
  [-0.13, 1.12, 0.08],
  [0.16, 0.04, -0.02],
  [0.2, 0.46, 0.02],
  [0.22, 0.76, 0.04],
  [0.23, 1.0, 0.06],
  [0.42, -0.08, -0.06],
  [0.5, 0.26, -0.02],
  [0.55, 0.5, 0.01],
  [0.59, 0.72, 0.03],
];

export interface CapturedTwinSample {
  gesture: Exclude<HandGesture, 'None'>;
  landmarks: HandLandmark[];
  worldLandmarks?: HandLandmark[];
}

export interface TwinTrainingProgress {
  epoch: number;
  totalEpochs: number;
  loss: number;
  accuracy: number;
  phase: string;
}

export function softClamp(value: number, limit: number): number {
  if (!Number.isFinite(value) || limit <= 0) return 0;
  return limit * Math.tanh(value / limit);
}

export function softClampScreenCoord(value: number): { value: number; clamped: boolean } {
  if (!Number.isFinite(value)) return { value: 0.5, clamped: true };
  if (value >= 0.04 && value <= 0.96) return { value, clamped: false };
  if (value < 0.04) {
    const excess = 0.04 - value;
    return { value: 0.04 - 0.035 * Math.tanh(excess / 0.12), clamped: true };
  }
  const excess = value - 0.96;
  return { value: 0.96 + 0.035 * Math.tanh(excess / 0.12), clamped: true };
}

export function sanitizeHandResult(
  result: HandDetectionResult,
  prevWrist?: HandLandmark | null
): { sanitized: HandDetectionResult; telemetry: HandBoundsTelemetry } {
  let outOfBoundsCount = 0;
  let softClamped = false;

  const cleanLandmarks: HandLandmark[] = result.landmarks.slice(0, 21).map((pt) => {
    const rawX = Number.isFinite(pt.x) ? pt.x : 0.5;
    const rawY = Number.isFinite(pt.y) ? pt.y : 0.5;
    const rawZ = Number.isFinite(pt.z) ? pt.z || 0 : 0;

    if (rawX < 0 || rawX > 1 || rawY < 0 || rawY > 1) {
      outOfBoundsCount++;
    }

    const cx = softClampScreenCoord(rawX);
    const cy = softClampScreenCoord(rawY);
    const cz = softClamp(rawZ, 0.24);
    if (cx.clamped || cy.clamped || Math.abs(rawZ) > 0.24) {
      softClamped = true;
    }

    return {
      x: cx.value,
      y: cy.value,
      z: cz,
    };
  });

  while (cleanLandmarks.length < 21) {
    cleanLandmarks.push({ x: 0.5, y: 0.5, z: 0 });
  }

  let cleanWorld: HandLandmark[] | undefined;
  if (result.worldLandmarks && result.worldLandmarks.length >= 21) {
    const w0 = result.worldLandmarks[0];
    const baseZ = Number.isFinite(w0.z) ? w0.z || 0 : 0;
    cleanWorld = result.worldLandmarks.slice(0, 21).map((pt) => {
      const wx = Number.isFinite(pt.x) ? softClamp(pt.x, 0.22) : 0;
      const wy = Number.isFinite(pt.y) ? softClamp(pt.y, 0.22) : 0;
      const dz = Number.isFinite(pt.z) ? softClamp((pt.z || 0) - baseZ, 0.14) : 0;
      return { x: wx, y: wy, z: baseZ + dz };
    });
  }

  const pts = cleanWorld || cleanLandmarks;
  let overlapPairsResolved = 0;
  const checkThreshold = cleanWorld ? 0.011 : 0.018;
  for (let i = 1; i < 21; i++) {
    for (let j = i + 1; j < 21; j++) {
      if (j === i + 1 && i % 4 !== 0) continue;
      const dx = pts[i].x - pts[j].x;
      const dy = pts[i].y - pts[j].y;
      const dz = (pts[i].z || 0) - (pts[j].z || 0);
      if (Math.hypot(dx, dy, dz) < checkThreshold) {
        overlapPairsResolved++;
      }
    }
  }

  let punchVelocity = 0;
  if (prevWrist && Number.isFinite(prevWrist.x) && Number.isFinite(prevWrist.y)) {
    const w = cleanLandmarks[0];
    punchVelocity = Math.min(
      100,
      Math.round(
        Math.hypot(w.x - prevWrist.x, w.y - prevWrist.y, ((w.z || 0) - (prevWrist.z || 0)) * 2.5) *
          420
      )
    );
  }

  return {
    sanitized: {
      ...result,
      landmarks: cleanLandmarks,
      worldLandmarks: cleanWorld,
    },
    telemetry: {
      outOfBoundsCount,
      overlapPairsResolved,
      softClamped,
      punchVelocity,
    },
  };
}

export function extractHandFeatureVector(
  landmarks: HandLandmark[],
  worldLandmarks?: HandLandmark[]
): number[] {
  const src = worldLandmarks && worldLandmarks.length >= 21 ? worldLandmarks : landmarks;
  if (!src || src.length < 21) return new Array(FEATURE_DIM).fill(0);

  const p0 = src[0];
  const p5 = src[5];
  const p9 = src[9];
  const p17 = src[17];

  const ox = p0.x;
  const oy = p0.y;
  const oz = p0.z || 0;

  let ux = p9.x - ox;
  let uy = p9.y - oy;
  let uz = (p9.z || 0) - oz;
  const palmLen = Math.hypot(ux, uy, uz) || 0.08;
  ux /= palmLen;
  uy /= palmLen;
  uz /= palmLen;

  let rx = p17.x - p5.x;
  let ry = p17.y - p5.y;
  let rz = (p17.z || 0) - (p5.z || 0);
  const knuckleLen = Math.hypot(rx, ry, rz) || 0.06;
  rx /= knuckleLen;
  ry /= knuckleLen;
  rz /= knuckleLen;

  let fx = ry * uz - rz * uy;
  let fy = rz * ux - rx * uz;
  let fz = rx * uy - ry * ux;
  const fLen = Math.hypot(fx, fy, fz) || 1;
  fx /= fLen;
  fy /= fLen;
  fz /= fLen;

  rx = uy * fz - uz * fy;
  ry = uz * fx - ux * fz;
  rz = ux * fy - uy * fx;

  const invScale = 1 / Math.max(0.05, palmLen, knuckleLen * 1.28);
  const feats: number[] = [];

  for (let i = 0; i < 21; i++) {
    const dx = (src[i].x - ox) * invScale;
    const dy = (src[i].y - oy) * invScale;
    const dz = ((src[i].z || 0) - oz) * invScale;
    const cx = dx * rx + dy * ry + dz * rz;
    const cy = dx * ux + dy * uy + dz * uz;
    const cz = dx * fx + dy * fy + dz * fz;
    feats.push(softClamp(cx, 2.5), softClamp(cy, 2.5), softClamp(cz, 2.5));
  }

  const chains = [
    [0, 1, 2, 3, 4],
    [0, 5, 6, 7, 8],
    [0, 9, 10, 11, 12],
    [0, 13, 14, 15, 16],
    [0, 17, 18, 19, 20],
  ];
  for (let c = 0; c < chains.length; c++) {
    const ch = chains[c];
    for (let s = 0; s < 3; s++) {
      const a = src[ch[s]];
      const b = src[ch[s + 1]];
      const d = src[ch[s + 2]];
      const v1x = b.x - a.x;
      const v1y = b.y - a.y;
      const v1z = (b.z || 0) - (a.z || 0);
      const l1 = Math.hypot(v1x, v1y, v1z) || 1;
      const v2x = d.x - b.x;
      const v2y = d.y - b.y;
      const v2z = (d.z || 0) - (b.z || 0);
      const l2 = Math.hypot(v2x, v2y, v2z) || 1;
      const cosAngle = (v1x * v2x + v1y * v2y + v1z * v2z) / (l1 * l2);
      feats.push(Math.max(-1, Math.min(1, cosAngle)));
    }
  }

  return feats;
}

export function extractNormalizedBoneLengths(
  landmarks: HandLandmark[],
  worldLandmarks?: HandLandmark[]
): number[] {
  const src = worldLandmarks && worldLandmarks.length >= 21 ? worldLandmarks : landmarks;
  const p0 = src[0];
  const p9 = src[9];
  const p5 = src[5];
  const p17 = src[17];
  const palmRef = Math.max(
    0.05,
    Math.hypot(p9.x - p0.x, p9.y - p0.y, (p9.z || 0) - (p0.z || 0)),
    Math.hypot(p17.x - p5.x, p17.y - p5.y, (p17.z || 0) - (p5.z || 0)) * 1.28
  );

  return BONE_SEGMENT_PAIRS.map(([a, b]) => {
    const dist = Math.hypot(
      src[b].x - src[a].x,
      src[b].y - src[a].y,
      (src[b].z || 0) - (src[a].z || 0)
    );
    return Math.max(0.14, Math.min(0.62, dist / palmRef));
  });
}

function defaultCanonicalRatios(): number[] {
  const p0 = CANONICAL_BASE[0];
  const p9 = CANONICAL_BASE[9];
  const palmRef = Math.hypot(p9[0] - p0[0], p9[1] - p0[1], p9[2] - p0[2]);
  return BONE_SEGMENT_PAIRS.map(([a, b]) => {
    const pa = CANONICAL_BASE[a];
    const pb = CANONICAL_BASE[b];
    return Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]) / palmRef;
  });
}

function buildCanonicalPose(
  gesture: Exclude<HandGesture, 'None'>,
  seed: number
): HandLandmark[] {
  const pseudoRand = (offset: number) => {
    const x = Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  const curlProfile: Record<Exclude<HandGesture, 'None'>, [number, number, number, number, number]> = {
    'Open Palm': [0.05, 0.05, 0.04, 0.05, 0.06],
    'Closed Fist': [0.75, 0.96, 0.98, 0.98, 0.96],
    'Pointing': [0.68, 0.06, 0.94, 0.95, 0.94],
    'Victory': [0.68, 0.06, 0.06, 0.94, 0.94],
    'Thumbs Up': [0.04, 0.94, 0.95, 0.95, 0.95],
    'OK Sign': [0.58, 0.62, 0.08, 0.08, 0.08],
  };

  const curls = curlProfile[gesture];
  const pts: Array<[number, number, number]> = CANONICAL_BASE.map(([x, y, z]) => [x, y, z]);

  const fingerChains = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
  ];

  for (let f = 0; f < 5; f++) {
    const c = Math.max(0, Math.min(1, curls[f] + (pseudoRand(f + 1) - 0.5) * 0.14));
    const chain = fingerChains[f];
    const base = pts[chain[0]];
    for (let s = 1; s < chain.length; s++) {
      const idx = chain[s];
      const prev = pts[chain[s - 1]];
      const origPrev = CANONICAL_BASE[chain[s - 1]];
      const origCurr = CANONICAL_BASE[idx];
      const segLen = Math.hypot(
        origCurr[0] - origPrev[0],
        origCurr[1] - origPrev[1],
        origCurr[2] - origPrev[2]
      );
      if (f === 0) {
        const inward = gesture === 'Thumbs Up' ? -0.15 : c * 1.15;
        const upLift = gesture === 'Thumbs Up' ? 0.95 : 0.72 - c * 0.62;
        const fwd = c * 0.55;
        const norm = Math.hypot(inward, upLift, fwd) || 1;
        pts[idx] = [
          prev[0] + (inward / norm) * segLen,
          prev[1] + (upLift / norm) * segLen,
          prev[2] + (fwd / norm) * segLen,
        ];
      } else {
        const theta = c * (Math.PI * 0.52) * s;
        const dx = (origCurr[0] - origPrev[0]) * (1 - c * 0.45);
        const dy = Math.cos(theta) * segLen;
        const dz = Math.sin(theta) * segLen;
        pts[idx] = [
          prev[0] + dx,
          prev[1] + dy,
          prev[2] + dz,
        ];
      }
      if (s === 1 && gesture === 'OK Sign' && f === 1) {
        pts[idx][0] = base[0] - 0.08;
      }
    }
  }

  const yaw = (pseudoRand(11) - 0.5) * (gesture === 'Closed Fist' ? 1.5 : 1.1);
  const pitch = (pseudoRand(12) - 0.5) * (gesture === 'Closed Fist' ? 1.65 : 1.0);
  const zCompress = gesture === 'Closed Fist' ? 0.45 + pseudoRand(13) * 0.55 : 0.75 + pseudoRand(13) * 0.25;
  const scale = (0.075 + pseudoRand(14) * 0.03) * 1.0;

  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);

  return pts.map(([x, y, z], jIdx) => {
    const jitter = (pseudoRand(20 + jIdx) - 0.5) * 0.025;
    const rx = x * cy - z * sy;
    const rz1 = x * sy + z * cy;
    const ry = y * cp - rz1 * sp;
    const rz2 = (y * sp + rz1 * cp) * zCompress;
    return {
      x: (rx + jitter) * scale,
      y: -(ry + jitter) * scale,
      z: -rz2 * scale,
    };
  });
}

export function loadSavedTwinProfile(): HandTwinTrainingProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HandTwinTrainingProfile;
    if (
      parsed &&
      Array.isArray(parsed.weights) &&
      parsed.weights.length === TRAINABLE_GESTURES.length &&
      Array.isArray(parsed.biases) &&
      parsed.biases.length === TRAINABLE_GESTURES.length &&
      Array.isArray(parsed.calibratedBoneRatios) &&
      parsed.calibratedBoneRatios.length === 20
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearSavedTwinProfile(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

function softmax(logits: number[]): number[] {
  const maxL = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(Math.max(-30, Math.min(30, v - maxL))));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}

export function predictWithTrainedTwin(
  landmarks: HandLandmark[],
  worldLandmarks: HandLandmark[] | undefined,
  profile: HandTwinTrainingProfile
): { gesture: Exclude<HandGesture, 'None'>; confidence: number } | null {
  if (!profile || profile.weights.length !== TRAINABLE_GESTURES.length) return null;
  const feat = extractHandFeatureVector(landmarks, worldLandmarks);
  const logits = profile.weights.map((row, cIdx) => {
    let dot = profile.biases[cIdx] || 0;
    for (let f = 0; f < FEATURE_DIM; f++) {
      dot += row[f] * feat[f];
    }
    return dot;
  });
  const probs = softmax(logits);
  let bestIdx = 0;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[bestIdx]) bestIdx = i;
  }
  return {
    gesture: TRAINABLE_GESTURES[bestIdx],
    confidence: Math.round(probs[bestIdx] * 100),
  };
}

export async function runImmenseTwinTraining(
  capturedSamples: CapturedTwinSample[],
  onProgress?: (progress: TwinTrainingProgress) => void
): Promise<HandTwinTrainingProfile> {
  const numClasses = TRAINABLE_GESTURES.length;
  const totalEpochs = 2400;
  const dataset: Array<{ x: number[]; y: number }> = [];
  const counts: Record<Exclude<HandGesture, 'None'>, number> = {
    'Closed Fist': 0,
    'Open Palm': 0,
    Pointing: 0,
    Victory: 0,
    'Thumbs Up': 0,
    'OK Sign': 0,
  };

  for (let i = 0; i < capturedSamples.length; i++) {
    const sample = capturedSamples[i];
    const classIdx = TRAINABLE_GESTURES.indexOf(sample.gesture);
    if (classIdx >= 0) {
      counts[sample.gesture]++;
      const feat = extractHandFeatureVector(sample.landmarks, sample.worldLandmarks);
      dataset.push({ x: feat, y: classIdx });
      for (let aug = 0; aug < 3; aug++) {
        const augFeat = feat.map((v, fi) => {
          const jitter = Math.sin((i + 1) * 31.7 + (aug + 1) * 19.3 + fi) * 0.035;
          return v + jitter;
        });
        dataset.push({ x: augFeat, y: classIdx });
      }
    }
  }

  for (let c = 0; c < numClasses; c++) {
    const gesture = TRAINABLE_GESTURES[c];
    const perClassSynth = gesture === 'Closed Fist' ? 320 : 220;
    for (let s = 0; s < perClassSynth; s++) {
      const worldPose = buildCanonicalPose(gesture, c * 1000 + s + 1);
      const feat = extractHandFeatureVector(worldPose, worldPose);
      dataset.push({ x: feat, y: c });
    }
  }

  const split = Math.floor(dataset.length * 0.85);
  const shuffled = [...dataset].sort((a, b) => {
    const ka = a.x[0] * 17.13 + a.y * 3.71;
    const kb = b.x[0] * 17.13 + b.y * 3.71;
    return ka - kb;
  });
  const trainSet = shuffled.slice(0, split);
  const valSet = shuffled.slice(split);

  const weights: number[][] = Array.from({ length: numClasses }, () =>
    new Array(FEATURE_DIM).fill(0)
  );
  const biases: number[] = new Array(numClasses).fill(0);

  const evalMetrics = () => {
    let totalLoss = 0;
    let correct = 0;
    for (let i = 0; i < valSet.length; i++) {
      const { x, y } = valSet[i];
      const logits = weights.map((row, c) => {
        let dot = biases[c];
        for (let f = 0; f < FEATURE_DIM; f++) dot += row[f] * x[f];
        return dot;
      });
      const probs = softmax(logits);
      totalLoss -= Math.log(Math.max(1e-6, probs[y]));
      let best = 0;
      for (let c = 1; c < numClasses; c++) {
        if (probs[c] > probs[best]) best = c;
      }
      if (best === y) correct++;
    }
    return {
      loss: totalLoss / Math.max(1, valSet.length),
      accuracy: (correct / Math.max(1, valSet.length)) * 100,
    };
  };

  let cursor = 0;
  const batchSize = 48;
  const chunkSteps = 120;

  for (let epoch = 1; epoch <= totalEpochs; epoch++) {
    const lr = 0.085 * (0.2 + 0.8 * 0.5 * (1 + Math.cos((Math.PI * epoch) / totalEpochs)));
    const reg = 0.0004;

    for (let b = 0; b < batchSize; b++) {
      const item = trainSet[cursor % trainSet.length];
      cursor++;
      const { x, y } = item;
      const logits = weights.map((row, c) => {
        let dot = biases[c];
        for (let f = 0; f < FEATURE_DIM; f++) dot += row[f] * x[f];
        return dot;
      });
      const probs = softmax(logits);
      for (let c = 0; c < numClasses; c++) {
        const grad = probs[c] - (c === y ? 1 : 0);
        biases[c] -= lr * grad;
        const wRow = weights[c];
        for (let f = 0; f < FEATURE_DIM; f++) {
          wRow[f] -= lr * (grad * x[f] + reg * wRow[f]);
        }
      }
    }

    if (epoch % chunkSteps === 0 || epoch === totalEpochs) {
      const m = evalMetrics();
      onProgress?.({
        epoch,
        totalEpochs,
        loss: m.loss,
        accuracy: m.accuracy,
        phase:
          epoch < 700
            ? 'Augmenting punch foreshortening & edge bounds...'
            : epoch < 1600
              ? 'Optimizing 78D pose hyperplane & bone ratios...'
              : 'Hard-negative punch stabilization & convergence...',
      });
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
  }

  const finalMetrics = evalMetrics();
  const baseRatios = defaultCanonicalRatios();
  const ratioSums = new Array(20).fill(0);
  let ratioCount = 0;
  for (let i = 0; i < capturedSamples.length; i++) {
    if (
      capturedSamples[i].gesture === 'Open Palm' ||
      capturedSamples[i].gesture === 'Pointing' ||
      capturedSamples[i].gesture === 'Victory'
    ) {
      const r = extractNormalizedBoneLengths(
        capturedSamples[i].landmarks,
        capturedSamples[i].worldLandmarks
      );
      for (let b = 0; b < 20; b++) ratioSums[b] += r[b];
      ratioCount++;
    }
  }

  const calibratedBoneRatios = baseRatios.map((defR, bIdx) => {
    if (ratioCount === 0) return defR;
    const avgUser = ratioSums[bIdx] / ratioCount;
    return Number((defR * 0.55 + avgUser * 0.45).toFixed(4));
  });

  const fistSamples = counts['Closed Fist'];
  const punchZGain = Math.min(1.38, 1.12 + Math.min(0.26, fistSamples * 0.008));
  const knuckleSpreadGain = Math.min(1.18, 1.04 + Math.min(0.14, capturedSamples.length * 0.002));

  const profile: HandTwinTrainingProfile = {
    trainedAt: Date.now(),
    epochsCompleted: totalEpochs,
    totalSamples: dataset.length,
    validationAccuracy: Number(finalMetrics.accuracy.toFixed(1)),
    finalLoss: Number(finalMetrics.loss.toFixed(4)),
    punchZGain: Number(punchZGain.toFixed(3)),
    knuckleSpreadGain: Number(knuckleSpreadGain.toFixed(3)),
    calibratedBoneRatios,
    gestureSampleCounts: counts,
    weights,
    biases,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    return profile;
  }

  return profile;
}
