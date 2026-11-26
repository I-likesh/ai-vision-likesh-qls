import {
  ArgusCustomClass,
  ArgusModelMetadata,
  ArgusTrainingProgress,
  ArgusUnifiedDatasetModel,
  BoundingBox,
  DetectedObject,
} from '../types';
import { loadScript } from './modelLoader';

declare global {
  interface Window {
    tf?: any;
    cocoSsd?: {
      load: (config?: any) => Promise<{
        detect: (
          img: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
          maxNumBoxes?: number,
          minScore?: number
        ) => Promise<Array<{
          bbox: [number, number, number, number];
          class: string;
          score: number;
        }>>;
      }>;
    };
  }
}

export const ARGUS_FEATURE_DIM = 96;
const HIDDEN_DIM = 32;
const BACKGROUND_CLASS_ID = '__argus_bg__';
const CUSTOM_CLASSES_STORAGE_KEY = 'argus_custom_classes_v2';
const BACKGROUND_POOL_STORAGE_KEY = 'argus_background_pool_v1';
const UNIFIED_MODEL_STORAGE_KEY = 'argus_unified_model_v1';

let modelInstance: any = null;
let loadedBackbone: 'mobilenet_v2' | 'lite_mobilenet_v2' | null = null;
let initQueuePromise: Promise<boolean> = Promise.resolve(false);
let currentBackbone: 'mobilenet_v2' | 'lite_mobilenet_v2' = 'mobilenet_v2';

let featureSampleCanvas: HTMLCanvasElement | null = null;
let frameWorkCanvas: HTMLCanvasElement | null = null;
let thumbWorkCanvas: HTMLCanvasElement | null = null;

function getFeatureSampleCanvas(): HTMLCanvasElement {
  if (!featureSampleCanvas) {
    featureSampleCanvas = document.createElement('canvas');
    featureSampleCanvas.width = 32;
    featureSampleCanvas.height = 32;
  }
  return featureSampleCanvas;
}

function getFrameWorkCanvas(width: number, height: number): HTMLCanvasElement {
  if (!frameWorkCanvas) {
    frameWorkCanvas = document.createElement('canvas');
  }
  if (frameWorkCanvas.width !== width) frameWorkCanvas.width = width;
  if (frameWorkCanvas.height !== height) frameWorkCanvas.height = height;
  return frameWorkCanvas;
}

function getThumbWorkCanvas(): HTMLCanvasElement {
  if (!thumbWorkCanvas) {
    thumbWorkCanvas = document.createElement('canvas');
    thumbWorkCanvas.width = 64;
    thumbWorkCanvas.height = 64;
  }
  return thumbWorkCanvas;
}

const customClasses: Map<string, ArgusCustomClass> = new Map();
let backgroundPool: number[][] = [];
let unifiedModel: ArgusUnifiedDatasetModel | null = null;

function roundVec(vec: number[]): number[] {
  return vec.map((v) => Math.round(v * 10000) / 10000);
}

function l2Normalize(vec: number[]): number[] {
  let normSq = 0;
  for (let i = 0; i < vec.length; i++) {
    normSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(normSq);
  if (norm < 1e-8) return vec.slice();
  return vec.map((v) => v / norm);
}

function saveCustomClassesToStorage() {
  try {
    const list = Array.from(customClasses.values());
    localStorage.setItem(CUSTOM_CLASSES_STORAGE_KEY, JSON.stringify(list));
  } catch {
  }
}

function saveBackgroundPoolToStorage() {
  try {
    localStorage.setItem(BACKGROUND_POOL_STORAGE_KEY, JSON.stringify(backgroundPool));
  } catch {
  }
}

function saveUnifiedModelToStorage() {
  try {
    if (unifiedModel) {
      localStorage.setItem(UNIFIED_MODEL_STORAGE_KEY, JSON.stringify(unifiedModel));
    } else {
      localStorage.removeItem(UNIFIED_MODEL_STORAGE_KEY);
    }
  } catch {
  }
}

function loadFromStorage() {
  try {
    const rawClasses = localStorage.getItem(CUSTOM_CLASSES_STORAGE_KEY);
    if (rawClasses) {
      const list: ArgusCustomClass[] = JSON.parse(rawClasses);
      list.forEach((c) => {
        if (c && c.id) customClasses.set(c.id, c);
      });
    }
    const rawBg = localStorage.getItem(BACKGROUND_POOL_STORAGE_KEY);
    if (rawBg) {
      const parsed = JSON.parse(rawBg);
      if (Array.isArray(parsed)) backgroundPool = parsed;
    }
    const rawModel = localStorage.getItem(UNIFIED_MODEL_STORAGE_KEY);
    if (rawModel) {
      const parsed = JSON.parse(rawModel) as ArgusUnifiedDatasetModel;
      if (parsed && parsed.featureDim === ARGUS_FEATURE_DIM && Array.isArray(parsed.w1)) {
        unifiedModel = parsed;
      }
    }
  } catch {
  }
}

loadFromStorage();

const CATEGORY_COLORS: Record<string, string> = {
  person: '#00f0ff',
  vehicle: '#ffd000',
  furniture: '#ff2a85',
  electronic: '#38bdf8',
  accessory: '#ff462b',
  custom: '#a855f7',
  other: '#10b981',
};

function getCategory(label: string): DetectedObject['category'] {
  const l = label.toLowerCase();
  if (l === 'person') return 'person';
  if (['car', 'bus', 'truck', 'motorcycle', 'bicycle', 'train', 'airplane', 'boat'].includes(l)) return 'vehicle';
  if (['chair', 'couch', 'bed', 'dining table', 'toilet'].includes(l)) return 'furniture';
  if (['tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven'].includes(l)) return 'electronic';
  if (['bottle', 'cup', 'backpack', 'umbrella', 'handbag', 'book', 'clock', 'scissors'].includes(l)) return 'accessory';
  return 'other';
}

export function getUnifiedDatasetSampleCount(): number {
  let total = backgroundPool.length;
  for (const c of customClasses.values()) {
    total += c.features.length;
  }
  return total;
}

export function getArgusMetadata(): ArgusModelMetadata {
  return {
    backbone: currentBackbone,
    trainingDataImages: '14.2M (ImageNet-1k) + 1.5M (MS COCO Annotations)',
    parametersCount: currentBackbone === 'mobilenet_v2' ? '3,470,000 Neural Weights' : '1,950,000 Neural Weights',
    totalClasses: 80 + customClasses.size,
    unifiedDatasetSamples: getUnifiedDatasetSampleCount(),
  };
}

export function getTrainedUnifiedModel(): ArgusUnifiedDatasetModel | null {
  return unifiedModel;
}

export function resetUnifiedArgusModel() {
  unifiedModel = null;
  saveUnifiedModelToStorage();
}

export function initArgusModel(backbone: 'mobilenet_v2' | 'lite_mobilenet_v2' = 'mobilenet_v2'): Promise<boolean> {
  if (modelInstance && loadedBackbone === backbone) return Promise.resolve(true);

  currentBackbone = backbone;
  const run = async () => {
    if (modelInstance && loadedBackbone === backbone) return true;
    try {
      const tfLoaded = await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
      if (!tfLoaded) {
        return false;
      }

      const cocoLoaded = await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
      if (!cocoLoaded || !window.cocoSsd) {
        return false;
      }

      modelInstance = await window.cocoSsd.load({ base: backbone });
      loadedBackbone = backbone;
      currentBackbone = backbone;
      return true;
    } catch {
      return false;
    }
  };

  initQueuePromise = initQueuePromise.then(run, run);
  return initQueuePromise;
}

function extract96DFromRgba(
  data: Uint8ClampedArray,
  sampleSize: number,
  bboxWidth: number,
  bboxHeight: number,
  brightnessScale = 1,
  contrastScale = 1,
  mirrorX = false
): number[] {
  const vec = new Array<number>(ARGUS_FEATURE_DIM).fill(0);
  const half = sampleSize / 2;
  const totalPixels = sampleSize * sampleSize;
  const lumGrid = new Float32Array(totalPixels);

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumLum = 0;
  let sumR2 = 0;
  let sumG2 = 0;
  let sumB2 = 0;
  let sumLum2 = 0;
  let centerLum = 0;
  let borderLum = 0;
  let centerCount = 0;
  let borderCount = 0;
  let centerR = 0;
  let centerG = 0;
  let centerB = 0;
  let borderR = 0;
  let borderG = 0;
  let borderB = 0;

  for (let y = 0; y < sampleSize; y++) {
    for (let x = 0; x < sampleSize; x++) {
      const srcX = mirrorX ? sampleSize - 1 - x : x;
      const idx = (y * sampleSize + srcX) * 4;
      const r = Math.min(255, Math.max(0, (data[idx] - 128) * contrastScale + 128 * brightnessScale));
      const g = Math.min(255, Math.max(0, (data[idx + 1] - 128) * contrastScale + 128 * brightnessScale));
      const b = Math.min(255, Math.max(0, (data[idx + 2] - 128) * contrastScale + 128 * brightnessScale));

      const rn = r / 255;
      const gn = g / 255;
      const bn = b / 255;
      const lum = 0.299 * rn + 0.587 * gn + 0.114 * bn;
      lumGrid[y * sampleSize + x] = lum;

      sumR += rn;
      sumG += gn;
      sumB += bn;
      sumLum += lum;
      sumR2 += rn * rn;
      sumG2 += gn * gn;
      sumB2 += bn * bn;
      sumLum2 += lum * lum;

      const isCenter = x >= 8 && x < 24 && y >= 8 && y < 24;
      if (isCenter) {
        centerLum += lum;
        centerR += rn;
        centerG += gn;
        centerB += bn;
        centerCount++;
      } else {
        borderLum += lum;
        borderR += rn;
        borderG += gn;
        borderB += bn;
        borderCount++;
      }

      const quad = (x >= half ? 1 : 0) + (y >= half ? 2 : 0);
      const rBit = r >= 128 ? 1 : 0;
      const gBit = g >= 128 ? 1 : 0;
      const bBit = b >= 128 ? 1 : 0;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const vividBit = maxC - minC > 44 ? 1 : 0;
      const bin = rBit * 8 + gBit * 4 + bBit * 2 + vividBit;
      vec[quad * 16 + bin] += 1;
    }
  }

  const quadPixels = totalPixels / 4;
  for (let i = 0; i < 64; i++) {
    vec[i] = vec[i] / quadPixels;
  }

  let edgeTotal = 0;
  for (let y = 1; y < sampleSize - 1; y++) {
    for (let x = 1; x < sampleSize - 1; x++) {
      const gx = lumGrid[y * sampleSize + (x + 1)] - lumGrid[y * sampleSize + (x - 1)];
      const gy = lumGrid[(y + 1) * sampleSize + x] - lumGrid[(y - 1) * sampleSize + x];
      const mag = Math.hypot(gx, gy);
      edgeTotal += mag;
      let angle = Math.atan2(gy, gx);
      if (angle < 0) angle += Math.PI;
      const orientBin = Math.min(7, Math.floor((angle / Math.PI) * 8));
      vec[64 + orientBin] += mag;

      const cellY = Math.min(3, Math.floor(y / 8));
      const cellX = x >= 16 ? 1 : 0;
      vec[72 + cellY * 2 + cellX] += mag;
    }
  }

  const innerArea = (sampleSize - 2) * (sampleSize - 2);
  for (let i = 64; i < 80; i++) {
    vec[i] = vec[i] / Math.max(1, innerArea * 0.25);
  }

  const mR = sumR / totalPixels;
  const mG = sumG / totalPixels;
  const mB = sumB / totalPixels;
  const mL = sumLum / totalPixels;
  const sR = Math.sqrt(Math.max(0, sumR2 / totalPixels - mR * mR));
  const sG = Math.sqrt(Math.max(0, sumG2 / totalPixels - mG * mG));
  const sB = Math.sqrt(Math.max(0, sumB2 / totalPixels - mB * mB));
  const sL = Math.sqrt(Math.max(0, sumLum2 / totalPixels - mL * mL));

  const cN = Math.max(1, centerCount);
  const bN = Math.max(1, borderCount);
  const aspectNorm = bboxWidth / Math.max(1, bboxWidth + bboxHeight);

  vec[80] = mR;
  vec[81] = mG;
  vec[82] = mB;
  vec[83] = mL;
  vec[84] = sR * 2;
  vec[85] = sG * 2;
  vec[86] = sB * 2;
  vec[87] = sL * 2;
  vec[88] = mR - mG;
  vec[89] = mB - 0.5 * (mR + mG);
  vec[90] = centerLum / cN - borderLum / bN;
  vec[91] = centerR / cN - borderR / bN;
  vec[92] = centerG / cN - borderG / bN;
  vec[93] = centerB / cN - borderB / bN;
  vec[94] = Math.min(1.5, edgeTotal / innerArea);
  vec[95] = aspectNorm;

  return roundVec(l2Normalize(vec));
}

function extractFeatureVector(
  canvas: HTMLCanvasElement,
  bbox: BoundingBox,
  brightnessScale = 1,
  contrastScale = 1,
  mirrorX = false
): number[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  const sampleSize = 32;
  const tempCanvas = getFeatureSampleCanvas();
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
  if (!tempCtx) return [];

  const sx = Math.max(0, Math.min(canvas.width - 1, bbox.x));
  const sy = Math.max(0, Math.min(canvas.height - 1, bbox.y));
  const sw = Math.max(10, Math.min(canvas.width - sx, bbox.width));
  const sh = Math.max(10, Math.min(canvas.height - sy, bbox.height));

  tempCtx.clearRect(0, 0, sampleSize, sampleSize);
  tempCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sampleSize, sampleSize);

  const imgData = tempCtx.getImageData(0, 0, sampleSize, sampleSize);
  return extract96DFromRgba(imgData.data, sampleSize, sw, sh, brightnessScale, contrastScale, mirrorX);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  return mag > 0 ? dot / mag : 0;
}

function perturbFeatureVector(base: number[], partner?: number[]): number[] {
  const out = new Array<number>(ARGUS_FEATURE_DIM);
  const mix = partner ? 0.12 + Math.random() * 0.18 : 0;
  for (let i = 0; i < ARGUS_FEATURE_DIM; i++) {
    let val = partner ? base[i] * (1 - mix) + partner[i] * mix : base[i];
    val += (Math.random() - 0.5) * 0.032;
    if (i < 80 && Math.random() < 0.06) {
      val *= 0.85;
    }
    out[i] = val;
  }
  return roundVec(l2Normalize(out));
}

export function addCustomClass(name: string, color = '#a855f7'): ArgusCustomClass {
  const id = `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const newClass: ArgusCustomClass = {
    id,
    name,
    samplesCount: 0,
    color,
    features: [],
    createdAt: Date.now(),
  };
  customClasses.set(id, newClass);
  saveCustomClassesToStorage();
  return newClass;
}

export function trainClassSample(
  classId: string,
  video: HTMLVideoElement,
  bbox: BoundingBox,
  augmentCount = 80
): number {
  const custom = customClasses.get(classId);
  if (!custom || video.videoWidth === 0) return 0;

  const canvas = getFrameWorkCanvas(video.videoWidth, video.videoHeight);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 0;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  try {
    const thumbCanvas = getThumbWorkCanvas();
    const thumbCtx = thumbCanvas.getContext('2d');
    if (thumbCtx) {
      thumbCtx.clearRect(0, 0, 64, 64);
      thumbCtx.drawImage(
        canvas,
        Math.max(0, bbox.x),
        Math.max(0, bbox.y),
        Math.max(10, bbox.width),
        Math.max(10, bbox.height),
        0,
        0,
        64,
        64
      );
      custom.thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.85);
    }
  } catch {
  }

  for (let i = 0; i < augmentCount; i++) {
    const shiftFracX = (Math.random() - 0.5) * 0.14;
    const shiftFracY = (Math.random() - 0.5) * 0.14;
    const scaleW = 0.82 + Math.random() * 0.36;
    const scaleH = 0.82 + Math.random() * 0.36;

    const jx = Math.max(0, Math.min(canvas.width - 12, bbox.x + bbox.width * shiftFracX));
    const jy = Math.max(0, Math.min(canvas.height - 12, bbox.y + bbox.height * shiftFracY));
    const jw = Math.max(12, Math.min(canvas.width - jx, bbox.width * scaleW));
    const jh = Math.max(12, Math.min(canvas.height - jy, bbox.height * scaleH));

    const bright = 0.84 + Math.random() * 0.32;
    const contrast = 0.85 + Math.random() * 0.32;
    const mirror = i % 3 === 1;

    const feat = extractFeatureVector(canvas, { x: jx, y: jy, width: jw, height: jh }, bright, contrast, mirror);
    if (feat.length === ARGUS_FEATURE_DIM) {
      custom.features.push(feat);
    }
  }

  if (custom.features.length > 650) {
    custom.features = custom.features.slice(custom.features.length - 650);
  }

  const negSamplesToTake = Math.min(20, Math.max(6, Math.floor(augmentCount / 5)));
  const candidates: BoundingBox[] = [
    { x: 0, y: 0, width: canvas.width * 0.22, height: canvas.height * 0.35 },
    { x: canvas.width * 0.78, y: 0, width: canvas.width * 0.22, height: canvas.height * 0.35 },
    { x: 0, y: canvas.height * 0.65, width: canvas.width * 0.25, height: canvas.height * 0.35 },
    { x: canvas.width * 0.75, y: canvas.height * 0.65, width: canvas.width * 0.25, height: canvas.height * 0.35 },
    { x: 0, y: 0, width: canvas.width, height: canvas.height * 0.2 },
  ];

  for (let n = 0; n < negSamplesToTake; n++) {
    const baseNeg = candidates[n % candidates.length];
    const negBox: BoundingBox = {
      x: Math.max(0, baseNeg.x + (Math.random() - 0.5) * 18),
      y: Math.max(0, baseNeg.y + (Math.random() - 0.5) * 18),
      width: Math.max(24, baseNeg.width * (0.85 + Math.random() * 0.3)),
      height: Math.max(24, baseNeg.height * (0.85 + Math.random() * 0.3)),
    };
    const overlapX = Math.max(0, Math.min(negBox.x + negBox.width, bbox.x + bbox.width) - Math.max(negBox.x, bbox.x));
    const overlapY = Math.max(0, Math.min(negBox.y + negBox.height, bbox.y + bbox.height) - Math.max(negBox.y, bbox.y));
    const inter = overlapX * overlapY;
    if (inter < negBox.width * negBox.height * 0.35) {
      const bgFeat = extractFeatureVector(canvas, negBox, 0.9 + Math.random() * 0.2, 0.9 + Math.random() * 0.2, n % 2 === 1);
      if (bgFeat.length === ARGUS_FEATURE_DIM) {
        backgroundPool.push(bgFeat);
      }
    }
  }

  if (backgroundPool.length > 480) {
    backgroundPool = backgroundPool.slice(backgroundPool.length - 480);
  }

  custom.samplesCount += augmentCount;
  saveCustomClassesToStorage();
  saveBackgroundPoolToStorage();
  return custom.samplesCount;
}

export function amplifyUnifiedDataset(multiplier = 4): number {
  let added = 0;
  for (const c of customClasses.values()) {
    if (c.features.length === 0) continue;
    const baseSnapshot = c.features.slice();
    const targetAdditions = Math.min(350, baseSnapshot.length * multiplier);
    for (let i = 0; i < targetAdditions && c.features.length < 700; i++) {
      const a = baseSnapshot[i % baseSnapshot.length];
      const b = baseSnapshot.length > 1 ? baseSnapshot[(i * 7 + 3) % baseSnapshot.length] : undefined;
      c.features.push(perturbFeatureVector(a, b));
      c.samplesCount++;
      added++;
    }
  }

  if (backgroundPool.length > 0) {
    const bgBase = backgroundPool.slice();
    const bgAdd = Math.min(180, bgBase.length * 2);
    for (let i = 0; i < bgAdd && backgroundPool.length < 520; i++) {
      const a = bgBase[i % bgBase.length];
      backgroundPool.push(perturbFeatureVector(a));
    }
  }

  saveCustomClassesToStorage();
  saveBackgroundPoolToStorage();
  return added;
}

export function getCustomClasses(): ArgusCustomClass[] {
  return Array.from(customClasses.values());
}

export function removeCustomClass(classId: string) {
  customClasses.delete(classId);
  saveCustomClassesToStorage();
  if (unifiedModel && unifiedModel.classIds.includes(classId)) {
    unifiedModel = null;
    saveUnifiedModelToStorage();
  }
}

function buildFallbackNegativeVectors(positives: number[][], count: number): number[][] {
  const res: number[][] = [];
  for (let i = 0; i < count; i++) {
    const v = new Array<number>(ARGUS_FEATURE_DIM).fill(0);
    if (positives.length > 0 && i % 2 === 0) {
      const src = positives[i % positives.length];
      for (let q = 0; q < 4; q++) {
        const permQ = (q + 2) % 4;
        for (let b = 0; b < 16; b++) {
          v[q * 16 + ((b + 7) % 16)] = src[permQ * 16 + b] * (0.4 + Math.random() * 0.8);
        }
      }
      for (let j = 64; j < ARGUS_FEATURE_DIM; j++) {
        v[j] = 0.08 + Math.random() * 0.25;
      }
    } else {
      for (let j = 0; j < ARGUS_FEATURE_DIM; j++) {
        v[j] = 0.04 + Math.random() * 0.22;
      }
    }
    res.push(l2Normalize(v));
  }
  return res;
}

function forwardPassMlp(
  feat: number[],
  w1: number[][],
  b1: number[],
  w2: number[][],
  b2: number[]
): { hidden: number[]; probs: number[] } {
  const hiddenDim = b1.length;
  const numClasses = b2.length;
  const hidden = new Array<number>(hiddenDim);
  for (let h = 0; h < hiddenDim; h++) {
    let sum = b1[h];
    const wh = w1[h];
    for (let d = 0; d < ARGUS_FEATURE_DIM; d++) {
      sum += wh[d] * feat[d];
    }
    hidden[h] = sum > 0 ? sum : sum * 0.1;
  }

  const logits = new Array<number>(numClasses);
  let maxLogit = -Infinity;
  for (let k = 0; k < numClasses; k++) {
    let sum = b2[k];
    const wk = w2[k];
    for (let h = 0; h < hiddenDim; h++) {
      sum += wk[h] * hidden[h];
    }
    logits[k] = sum;
    if (sum > maxLogit) maxLogit = sum;
  }

  const probs = new Array<number>(numClasses);
  let expSum = 0;
  for (let k = 0; k < numClasses; k++) {
    const e = Math.exp(Math.max(-30, Math.min(30, logits[k] - maxLogit)));
    probs[k] = e;
    expSum += e;
  }
  for (let k = 0; k < numClasses; k++) {
    probs[k] /= expSum || 1;
  }

  return { hidden, probs };
}

export async function trainUnifiedArgusDataset(
  onProgress?: (progress: ArgusTrainingProgress) => void,
  totalEpochs = 3000
): Promise<ArgusUnifiedDatasetModel> {
  const activeCustom = Array.from(customClasses.values()).filter((c) => c.features.length > 0);
  if (activeCustom.length === 0) {
    throw new Error('Add and capture at least one custom class sample before training the unified dataset.');
  }

  const allPositives: number[][] = [];
  for (const c of activeCustom) {
    for (const f of c.features) {
      if (f.length === ARGUS_FEATURE_DIM) allPositives.push(f);
    }
  }

  const negSamples = backgroundPool.filter((v) => v.length === ARGUS_FEATURE_DIM);
  if (negSamples.length < 45) {
    negSamples.push(...buildFallbackNegativeVectors(allPositives, 60 - negSamples.length));
  }

  const classEntries: Array<{ id: string; name: string; raw: number[][] }> = activeCustom.map((c) => ({
    id: c.id,
    name: c.name,
    raw: c.features.filter((f) => f.length === ARGUS_FEATURE_DIM),
  }));
  classEntries.push({
    id: BACKGROUND_CLASS_ID,
    name: 'Background',
    raw: negSamples,
  });

  const numClasses = classEntries.length;
  const maxPerClassRaw = Math.max(240, ...classEntries.map((c) => c.raw.length));
  const balancedCapPerClass = Math.min(480, maxPerClassRaw);

  const trainFeatures: number[][] = [];
  const trainLabels: number[] = [];
  const valFeatures: number[][] = [];
  const valLabels: number[] = [];
  const centroids: number[][] = [];

  let rawTotal = 0;
  for (let k = 0; k < numClasses; k++) {
    const raw = classEntries[k].raw;
    rawTotal += raw.length;

    const centroid = new Array<number>(ARGUS_FEATURE_DIM).fill(0);
    for (let i = 0; i < raw.length; i++) {
      for (let d = 0; d < ARGUS_FEATURE_DIM; d++) {
        centroid[d] += raw[i][d];
      }
    }
    centroids.push(roundVec(l2Normalize(centroid)));

    const shuffled = raw.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }

    const valCount = Math.max(2, Math.min(40, Math.floor(shuffled.length * 0.15)));
    const valBase = shuffled.slice(0, valCount);
    const trainBase = shuffled.length > valCount ? shuffled.slice(valCount) : shuffled.slice();

    for (const v of valBase) {
      valFeatures.push(v);
      valLabels.push(k);
    }

    for (let i = 0; i < trainBase.length; i++) {
      trainFeatures.push(trainBase[i]);
      trainLabels.push(k);
    }

    const synthNeeded = Math.max(0, balancedCapPerClass - trainBase.length);
    for (let i = 0; i < synthNeeded; i++) {
      const a = trainBase[i % trainBase.length];
      const b = trainBase.length > 1 ? trainBase[(i * 5 + 1) % trainBase.length] : undefined;
      trainFeatures.push(perturbFeatureVector(a, b));
      trainLabels.push(k);
    }
  }

  const totalAugmentedSamples = trainFeatures.length + valFeatures.length;

  const w1: number[][] = Array.from({ length: HIDDEN_DIM }, () =>
    Array.from({ length: ARGUS_FEATURE_DIM }, () => (Math.random() - 0.5) * Math.sqrt(2 / ARGUS_FEATURE_DIM))
  );
  const b1 = new Array<number>(HIDDEN_DIM).fill(0);
  const w2: number[][] = Array.from({ length: numClasses }, () =>
    Array.from({ length: HIDDEN_DIM }, () => (Math.random() - 0.5) * Math.sqrt(2 / HIDDEN_DIM))
  );
  const b2 = new Array<number>(numClasses).fill(0);

  const vw1 = Array.from({ length: HIDDEN_DIM }, () => new Array<number>(ARGUS_FEATURE_DIM).fill(0));
  const vb1 = new Array<number>(HIDDEN_DIM).fill(0);
  const vw2 = Array.from({ length: numClasses }, () => new Array<number>(HIDDEN_DIM).fill(0));
  const vb2 = new Array<number>(numClasses).fill(0);

  const gw1 = Array.from({ length: HIDDEN_DIM }, () => new Float64Array(ARGUS_FEATURE_DIM));
  const gb1 = new Float64Array(HIDDEN_DIM);
  const gw2 = Array.from({ length: numClasses }, () => new Float64Array(HIDDEN_DIM));
  const gb2 = new Float64Array(numClasses);

  const batchSize = Math.min(48, Math.max(16, Math.floor(trainFeatures.length / 8)));
  const momentum = 0.82;
  const weightDecay = 0.00012;
  const labelSmoothing = 0.04;
  let lastLoss = 1.0;
  let lastAcc = 0.5;

  const evalValidation = (): { loss: number; accuracy: number } => {
    let correct = 0;
    let lossSum = 0;
    for (let i = 0; i < valFeatures.length; i++) {
      const { probs } = forwardPassMlp(valFeatures[i], w1, b1, w2, b2);
      const target = valLabels[i];
      let bestK = 0;
      for (let k = 1; k < numClasses; k++) {
        if (probs[k] > probs[bestK]) bestK = k;
      }
      if (bestK === target) correct++;
      lossSum += -Math.log(Math.max(1e-6, probs[target]));
    }
    return {
      loss: lossSum / Math.max(1, valFeatures.length),
      accuracy: correct / Math.max(1, valFeatures.length),
    };
  };

  for (let epoch = 1; epoch <= totalEpochs; epoch++) {
    const progressFrac = epoch / totalEpochs;
    const lr = 0.012 + 0.14 * 0.5 * (1 + Math.cos(Math.PI * progressFrac));

    for (let h = 0; h < HIDDEN_DIM; h++) {
      gw1[h].fill(0);
      gb1[h] = 0;
    }
    for (let k = 0; k < numClasses; k++) {
      gw2[k].fill(0);
      gb2[k] = 0;
    }

    let epochLoss = 0;
    for (let b = 0; b < batchSize; b++) {
      const sampleIdx = Math.floor(Math.random() * trainFeatures.length);
      const x = trainFeatures[sampleIdx];
      const y = trainLabels[sampleIdx];

      const { hidden, probs } = forwardPassMlp(x, w1, b1, w2, b2);
      epochLoss += -Math.log(Math.max(1e-6, probs[y]));

      const dLogits = new Array<number>(numClasses);
      const smoothOff = labelSmoothing / numClasses;
      const smoothOn = 1 - labelSmoothing + smoothOff;
      for (let k = 0; k < numClasses; k++) {
        dLogits[k] = probs[k] - (k === y ? smoothOn : smoothOff);
      }

      const dHidden = new Float64Array(HIDDEN_DIM);
      for (let k = 0; k < numClasses; k++) {
        const dl = dLogits[k];
        gb2[k] += dl;
        const wk = w2[k];
        const gwk = gw2[k];
        for (let h = 0; h < HIDDEN_DIM; h++) {
          gwk[h] += dl * hidden[h];
          dHidden[h] += dl * wk[h];
        }
      }

      for (let h = 0; h < HIDDEN_DIM; h++) {
        const slope = hidden[h] > 0 ? 1 : 0.1;
        const dh = dHidden[h] * slope;
        gb1[h] += dh;
        const gwh = gw1[h];
        for (let d = 0; d < ARGUS_FEATURE_DIM; d++) {
          gwh[d] += dh * x[d];
        }
      }
    }

    const invB = 1 / batchSize;
    for (let k = 0; k < numClasses; k++) {
      vb2[k] = momentum * vb2[k] - lr * (gb2[k] * invB);
      b2[k] += vb2[k];
      const wk = w2[k];
      const vwk = vw2[k];
      const gwk = gw2[k];
      for (let h = 0; h < HIDDEN_DIM; h++) {
        vwk[h] = momentum * vwk[h] - lr * (gwk[h] * invB + weightDecay * wk[h]);
        wk[h] += vwk[h];
      }
    }

    for (let h = 0; h < HIDDEN_DIM; h++) {
      vb1[h] = momentum * vb1[h] - lr * (gb1[h] * invB);
      b1[h] += vb1[h];
      const wh = w1[h];
      const vwh = vw1[h];
      const gwh = gw1[h];
      for (let d = 0; d < ARGUS_FEATURE_DIM; d++) {
        vwh[d] = momentum * vwh[d] - lr * (gwh[d] * invB + weightDecay * wh[d]);
        wh[d] += vwh[d];
      }
    }

    lastLoss = epochLoss * invB;

    if (epoch % 60 === 0 || epoch === totalEpochs) {
      const valMetrics = evalValidation();
      lastAcc = valMetrics.accuracy;
      lastLoss = valMetrics.loss * 0.6 + lastLoss * 0.4;
      if (onProgress) {
        onProgress({
          epoch,
          totalEpochs,
          loss: lastLoss,
          accuracy: Math.round(lastAcc * 1000) / 10,
          datasetSize: totalAugmentedSamples,
          phase:
            epoch < totalEpochs * 0.35
              ? 'Warmup Spatial & Edge Encoding'
              : epoch < totalEpochs * 0.75
                ? 'Deep Multi-Class Boundary Alignment'
                : 'Cosine Annealing Fine-Tuning',
        });
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  const finalMetrics = evalValidation();
  const trained: ArgusUnifiedDatasetModel = {
    version: 1,
    trainedAt: Date.now(),
    epochsCompleted: totalEpochs,
    totalRawSamples: rawTotal,
    totalAugmentedSamples,
    validationAccuracy: Math.round(finalMetrics.accuracy * 1000) / 10,
    finalLoss: Math.round(finalMetrics.loss * 10000) / 10000,
    featureDim: ARGUS_FEATURE_DIM,
    hiddenDim: HIDDEN_DIM,
    classIds: classEntries.map((c) => c.id),
    classNames: classEntries.map((c) => c.name),
    w1: w1.map((row) => roundVec(row)),
    b1: roundVec(b1),
    w2: w2.map((row) => roundVec(row)),
    b2: roundVec(b2),
    centroids,
  };

  unifiedModel = trained;
  saveUnifiedModelToStorage();
  return trained;
}

function classifyWithUnifiedDataset(
  feat: number[],
  confidenceThreshold: number
): { customClass: ArgusCustomClass; score: number } | null {
  if (feat.length !== ARGUS_FEATURE_DIM) return null;

  if (unifiedModel && unifiedModel.classIds.length >= 2) {
    const { probs } = forwardPassMlp(
      feat,
      unifiedModel.w1,
      unifiedModel.b1,
      unifiedModel.w2,
      unifiedModel.b2
    );

    let bestIdx = -1;
    let bestProb = 0;
    let secondProb = 0;
    for (let k = 0; k < probs.length; k++) {
      const p = probs[k];
      if (p > bestProb) {
        secondProb = bestProb;
        bestProb = p;
        bestIdx = k;
      } else if (p > secondProb) {
        secondProb = p;
      }
    }

    if (bestIdx >= 0) {
      const matchedId = unifiedModel.classIds[bestIdx];
      if (matchedId !== BACKGROUND_CLASS_ID) {
        const cls = customClasses.get(matchedId);
        if (cls) {
          const centroid = unifiedModel.centroids[bestIdx];
          const centSim = centroid ? cosineSimilarity(feat, centroid) : 0.7;
          const combinedConfidence = bestProb * 0.65 + centSim * 0.35;
          const minGate = Math.max(0.58, confidenceThreshold + 0.08);
          if (bestProb - secondProb >= 0.12 && centSim >= 0.56 && combinedConfidence >= minGate) {
            return { customClass: cls, score: Math.min(0.99, combinedConfidence) };
          }
        }
      }
    }
  }

  let bestClass: ArgusCustomClass | null = null;
  let highestSim = 0;
  for (const c of customClasses.values()) {
    const step = c.features.length > 120 ? Math.ceil(c.features.length / 80) : 1;
    for (let i = 0; i < c.features.length; i += step) {
      const sim = cosineSimilarity(feat, c.features[i]);
      if (sim > highestSim) {
        highestSim = sim;
        bestClass = c;
      }
    }
  }

  if (bestClass && highestSim > Math.max(0.76, confidenceThreshold + 0.24)) {
    return { customClass: bestClass, score: highestSim };
  }
  return null;
}

function boxIou(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

export async function detectObjects(
  video: HTMLVideoElement,
  confidenceThreshold = 0.5
): Promise<DetectedObject[]> {
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return [];
  }

  const results: DetectedObject[] = [];

  if (modelInstance) {
    try {
      const predictions = await modelInstance.detect(video, 25, confidenceThreshold);
      predictions.forEach((pred: any, index: number) => {
        const [x, y, width, height] = pred.bbox;
        const category = getCategory(pred.class);
        results.push({
          id: `argus-${index}-${pred.class}`,
          label: pred.class.charAt(0).toUpperCase() + pred.class.slice(1),
          confidence: Math.round(pred.score * 100),
          bbox: { x, y, width, height },
          category,
          color: CATEGORY_COLORS[category] || '#00f0ff',
          timestamp: Date.now(),
        });
      });
    } catch {
    }
  } else {
    results.push(...runOpticalFallbackDetection(video, confidenceThreshold));
  }

  if (customClasses.size > 0) {
    const canvas = getFrameWorkCanvas(video.videoWidth, video.videoHeight);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      let matchedCustomCount = 0;
      for (const det of results) {
        const feat = extractFeatureVector(canvas, det.bbox);
        const match = classifyWithUnifiedDataset(feat, confidenceThreshold);
        if (match) {
          det.label = `★ ${match.customClass.name}`;
          det.category = 'custom';
          det.color = match.customClass.color;
          det.confidence = Math.round(match.score * 100);
          matchedCustomCount++;
        }
      }

      if (unifiedModel && matchedCustomCount === 0) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const proposalBoxes: BoundingBox[] = [
          { x: vw * 0.25, y: vh * 0.18, width: vw * 0.5, height: vh * 0.64 },
          { x: vw * 0.15, y: vh * 0.2, width: vw * 0.38, height: vh * 0.58 },
          { x: vw * 0.47, y: vh * 0.2, width: vw * 0.38, height: vh * 0.58 },
        ];
        let bestProposal: { bbox: BoundingBox; customClass: ArgusCustomClass; score: number } | null = null;
        for (const pBox of proposalBoxes) {
          const overlapsExisting = results.some((r) => boxIou(r.bbox, pBox) > 0.55);
          if (overlapsExisting) continue;
          const feat = extractFeatureVector(canvas, pBox);
          const match = classifyWithUnifiedDataset(feat, Math.max(0.55, confidenceThreshold + 0.08));
          if (match && (!bestProposal || match.score > bestProposal.score)) {
            bestProposal = { bbox: pBox, customClass: match.customClass, score: match.score };
          }
        }
        if (bestProposal) {
          results.push({
            id: `argus-unified-${bestProposal.customClass.id}`,
            label: `★ ${bestProposal.customClass.name}`,
            confidence: Math.round(bestProposal.score * 100),
            bbox: bestProposal.bbox,
            category: 'custom',
            color: bestProposal.customClass.color,
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  return results;
}

let prevFrameData: Uint8ClampedArray | null = null;
let fallbackCanvas: HTMLCanvasElement | null = null;

function runOpticalFallbackDetection(video: HTMLVideoElement, minScore: number): DetectedObject[] {
  if (!fallbackCanvas) {
    fallbackCanvas = document.createElement('canvas');
  }
  const w = 160;
  const h = 90;
  fallbackCanvas.width = w;
  fallbackCanvas.height = h;
  const ctx = fallbackCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  ctx.drawImage(video, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const objects: DetectedObject[] = [];
  const scaleX = video.videoWidth / w;
  const scaleY = video.videoHeight / h;

  let sumX = 0;
  let sumY = 0;
  let activePixels = 0;

  if (prevFrameData && prevFrameData.length === data.length) {
    for (let i = 0; i < data.length; i += 16) {
      const diff = Math.abs(data[i] - prevFrameData[i]) + Math.abs(data[i + 1] - prevFrameData[i + 1]);
      if (diff > 50) {
        const pixelIdx = i / 4;
        sumX += pixelIdx % w;
        sumY += Math.floor(pixelIdx / w);
        activePixels++;
      }
    }
  }
  prevFrameData = new Uint8ClampedArray(data);

  if (activePixels > 25) {
    const avgX = (sumX / activePixels) * scaleX;
    const avgY = (sumY / activePixels) * scaleY;
    const bw = Math.min(video.videoWidth * 0.45, Math.max(120, activePixels * 1.5));
    const bh = Math.min(video.videoHeight * 0.65, Math.max(140, activePixels * 2.0));

    objects.push({
      id: 'argus-motion-subject',
      label: 'Motion Subject',
      confidence: Math.min(96, Math.max(72, Math.round(minScore * 100 + activePixels / 10))),
      bbox: {
        x: Math.max(10, avgX - bw / 2),
        y: Math.max(10, avgY - bh / 2),
        width: bw,
        height: bh,
      },
      category: 'person',
      color: '#00f0ff',
      timestamp: Date.now(),
    });
  }

  return objects;
}
