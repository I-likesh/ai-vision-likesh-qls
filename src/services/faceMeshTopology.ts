import { FaceColorPalette, FaceLandmark } from '../types';

export const FACE_OVAL_LOOP = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109,
];

export const LEFT_EYE_LOOP = [
  33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7,
];

export const RIGHT_EYE_LOOP = [
  362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382,
];

export const LIPS_OUTER_LOOP = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
];

export const LIPS_INNER_LOOP = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
];

export const LEFT_BROW_INDICES = [70, 63, 105, 66, 107];
export const RIGHT_BROW_INDICES = [300, 293, 334, 296, 336];

const SKIN_SAMPLE_INDICES = [50, 280, 151, 195, 205, 425, 118, 347];
const LIP_SAMPLE_INDICES = [0, 17, 37, 267, 84, 314];
const BROW_SAMPLE_INDICES = [105, 66, 334, 296];

export const PORTRAIT_VERTEX_COUNT = 541;

export const DEFAULT_FACE_PALETTE: FaceColorPalette = {
  skin: '#e5b293',
  skinShadow: '#c78b6b',
  lips: '#c45b68',
  eyebrows: '#3a2b24',
  hair: '#2b201b',
  iris: '#4a6b82',
};

let samplerCanvas: HTMLCanvasElement | null = null;

function getSamplerCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (!samplerCanvas) {
    samplerCanvas = document.createElement('canvas');
    samplerCanvas.width = 160;
    samplerCanvas.height = 120;
  }
  return samplerCanvas;
}

function rgbToHex(r: number, g: number, b: number): string {
  const cr = Math.max(0, Math.min(255, Math.round(r)));
  const cg = Math.max(0, Math.min(255, Math.round(g)));
  const cb = Math.max(0, Math.min(255, Math.round(b)));
  return (
    '#' +
    cr.toString(16).padStart(2, '0') +
    cg.toString(16).padStart(2, '0') +
    cb.toString(16).padStart(2, '0')
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 6 ? clean : 'e5b293', 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function blendHex(prevHex: string, nextRgb: [number, number, number], alpha = 0.28): string {
  const [pr, pg, pb] = hexToRgb(prevHex);
  return rgbToHex(
    pr + (nextRgb[0] - pr) * alpha,
    pg + (nextRgb[1] - pg) * alpha,
    pb + (nextRgb[2] - pb) * alpha
  );
}

function readRegionRgb(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  nx: number,
  ny: number,
  radius = 2
): [number, number, number] | null {
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
  const px = Math.round(Math.max(0, Math.min(1, nx)) * (w - 1));
  const py = Math.round(Math.max(0, Math.min(1, ny)) * (h - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    const yy = py + dy;
    if (yy < 0 || yy >= h) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      const xx = px + dx;
      if (xx < 0 || xx >= w) continue;
      const idx = (yy * w + xx) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      count++;
    }
  }
  if (count === 0) return null;
  return [r / count, g / count, b / count];
}

function averageIndicesRgb(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  landmarks: FaceLandmark[],
  indices: number[],
  radius = 2
): [number, number, number] | null {
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let count = 0;
  for (const idx of indices) {
    const lm = landmarks[idx];
    if (!lm) continue;
    const col = readRegionRgb(data, w, h, lm.x, lm.y, radius);
    if (col) {
      sr += col[0];
      sg += col[1];
      sb += col[2];
      count++;
    }
  }
  if (count === 0) return null;
  return [sr / count, sg / count, sb / count];
}

export function sampleFaceColorsFromSource(
  source: HTMLVideoElement | HTMLCanvasElement,
  landmarks: FaceLandmark[],
  prevPalette?: FaceColorPalette
): FaceColorPalette {
  const base = prevPalette || DEFAULT_FACE_PALETTE;
  const canvas = getSamplerCanvas();
  const srcW = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  if (!canvas || srcW === 0 || landmarks.length < 468) return base;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return base;

  const w = canvas.width;
  const h = canvas.height;
  ctx.drawImage(source, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const skinRgb = averageIndicesRgb(data, w, h, landmarks, SKIN_SAMPLE_INDICES, 2);
  const nextSkin = skinRgb ? blendHex(base.skin, skinRgb, 0.28) : base.skin;
  const [sr, sg, sb] = hexToRgb(nextSkin);
  const skinShadow = rgbToHex(sr * 0.82, sg * 0.77, sb * 0.74);

  const lipRgb = averageIndicesRgb(data, w, h, landmarks, LIP_SAMPLE_INDICES, 1);
  let nextLips = base.lips;
  if (lipRgb) {
    const tintedLip: [number, number, number] = [
      Math.min(255, lipRgb[0] * 0.86 + Math.max(lipRgb[0] * 1.08, 165) * 0.14),
      lipRgb[1] * 0.9,
      lipRgb[2] * 0.92,
    ];
    nextLips = blendHex(base.lips, tintedLip, 0.28);
  }

  const browRgb = averageIndicesRgb(data, w, h, landmarks, BROW_SAMPLE_INDICES, 1);
  const nextBrows = browRgb ? blendHex(base.eyebrows, browRgb, 0.26) : base.eyebrows;

  const topForehead = landmarks[10];
  const chin = landmarks[152];
  const faceHeight =
    topForehead && chin ? Math.max(0.18, Math.abs(chin.y - topForehead.y)) : 0.42;

  let hairR = 0;
  let hairG = 0;
  let hairB = 0;
  let hairCount = 0;
  for (const hx of [landmarks[109]?.x, landmarks[10]?.x, landmarks[338]?.x]) {
    if (hx === undefined) continue;
    const hy = Math.max(0.02, (topForehead?.y ?? 0.25) - faceHeight * 0.14);
    const col = readRegionRgb(data, w, h, hx, hy, 2);
    if (col) {
      hairR += col[0];
      hairG += col[1];
      hairB += col[2];
      hairCount++;
    }
  }
  const nextHair =
    hairCount > 0
      ? blendHex(base.hair, [hairR / hairCount, hairG / hairCount, hairB / hairCount], 0.24)
      : base.hair;

  const leftIrisPos =
    landmarks[468] ||
    (landmarks[33] && landmarks[133]
      ? { x: (landmarks[33].x + landmarks[133].x) * 0.5, y: (landmarks[33].y + landmarks[133].y) * 0.5, z: 0 }
      : null);
  const rightIrisPos =
    landmarks[473] ||
    (landmarks[362] && landmarks[263]
      ? { x: (landmarks[362].x + landmarks[263].x) * 0.5, y: (landmarks[362].y + landmarks[263].y) * 0.5, z: 0 }
      : null);

  let irisR = 0;
  let irisG = 0;
  let irisB = 0;
  let irisCount = 0;
  for (const ip of [leftIrisPos, rightIrisPos]) {
    if (!ip) continue;
    const px = Math.round(Math.max(0, Math.min(1, ip.x)) * (w - 1));
    const py = Math.round(Math.max(0, Math.min(1, ip.y)) * (h - 1));
    for (let dy = -1; dy <= 1; dy++) {
      const yy = py + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = px + dx;
        if (xx < 0 || xx >= w) continue;
        const idx = (yy * w + xx) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (lum > 24 && lum < 175) {
          irisR += data[idx];
          irisG += data[idx + 1];
          irisB += data[idx + 2];
          irisCount++;
        }
      }
    }
  }
  const nextIris =
    irisCount > 0
      ? blendHex(base.iris, [irisR / irisCount, irisG / irisCount, irisB / irisCount], 0.25)
      : base.iris;

  return {
    skin: nextSkin,
    skinShadow,
    lips: nextLips,
    eyebrows: nextBrows,
    hair: nextHair,
    iris: nextIris,
  };
}

export function buildCanonical468Face(
  cx = 0.5,
  cy = 0.48,
  earLeft = 0.29,
  earRight = 0.29,
  mouthOpen = 0.08
): FaceLandmark[] {
  const landmarks: FaceLandmark[] = new Array(468);
  const wScale = 0.165;
  const hScale = 0.235;

  const cols = 21;
  const rows = 22;
  for (let i = 0; i < 468; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const u = (col / (cols - 1)) * 2 - 1;
    const v = (row / rows) * 2 - 1;
    const r = Math.min(0.95, Math.hypot(u, v) * 0.72);
    const theta = Math.atan2(v, u);
    const rx = Math.cos(theta) * r * wScale * 0.94;
    const ry = Math.sin(theta) * r * hScale * 0.94;
    const depth = Math.sqrt(Math.max(0, 1 - r * r)) * 0.075 - 0.02;
    landmarks[i] = {
      x: cx + rx,
      y: cy + ry,
      z: -depth,
    };
  }

  for (let i = 0; i < FACE_OVAL_LOOP.length; i++) {
    const angle = (i / FACE_OVAL_LOOP.length) * Math.PI * 2 - Math.PI / 2;
    const jawTaper = Math.sin(angle) > 0 ? 1 - 0.16 * Math.sin(angle) : 1;
    const rx = Math.cos(angle) * wScale * jawTaper;
    const ry = Math.sin(angle) * hScale;
    landmarks[FACE_OVAL_LOOP[i]] = {
      x: cx + rx,
      y: cy + ry,
      z: Math.abs(Math.cos(angle)) * 0.055 - 0.01,
    };
  }

  const eyeLeftH = Math.max(0.004, earLeft * 0.048);
  const eyeRightH = Math.max(0.004, earRight * 0.048);
  const eyeSpecs = [
    { loop: LEFT_EYE_LOOP, ex: cx - 0.062, ey: cy - 0.042, rx: 0.028, ry: eyeLeftH },
    { loop: RIGHT_EYE_LOOP, ex: cx + 0.062, ey: cy - 0.042, rx: 0.028, ry: eyeRightH },
  ];

  for (const spec of eyeSpecs) {
    const len = spec.loop.length;
    for (let i = 0; i < len; i++) {
      const a = Math.PI - (i / len) * Math.PI * 2;
      landmarks[spec.loop[i]] = {
        x: spec.ex + Math.cos(a) * spec.rx,
        y: spec.ey - Math.sin(a) * spec.ry,
        z: -0.042,
      };
    }
  }

  for (let i = 0; i < LEFT_BROW_INDICES.length; i++) {
    const t = i / (LEFT_BROW_INDICES.length - 1);
    const arch = Math.sin(t * Math.PI) * 0.012;
    landmarks[LEFT_BROW_INDICES[i]] = {
      x: cx - 0.095 + t * 0.062,
      y: cy - 0.072 - arch,
      z: -0.052,
    };
  }
  for (let i = 0; i < RIGHT_BROW_INDICES.length; i++) {
    const t = i / (RIGHT_BROW_INDICES.length - 1);
    const arch = Math.sin(t * Math.PI) * 0.012;
    landmarks[RIGHT_BROW_INDICES[i]] = {
      x: cx + 0.095 - t * 0.062,
      y: cy - 0.072 - arch,
      z: -0.052,
    };
  }

  landmarks[168] = { x: cx, y: cy - 0.045, z: -0.055 };
  landmarks[6] = { x: cx, y: cy - 0.02, z: -0.068 };
  landmarks[197] = { x: cx, y: cy + 0.005, z: -0.078 };
  landmarks[195] = { x: cx, y: cy + 0.022, z: -0.088 };
  landmarks[5] = { x: cx, y: cy + 0.035, z: -0.096 };
  landmarks[4] = { x: cx, y: cy + 0.045, z: -0.105 };
  landmarks[1] = { x: cx, y: cy + 0.048, z: -0.108 };
  landmarks[2] = { x: cx, y: cy + 0.06, z: -0.082 };
  landmarks[98] = { x: cx - 0.024, y: cy + 0.052, z: -0.07 };
  landmarks[327] = { x: cx + 0.024, y: cy + 0.052, z: -0.07 };

  landmarks[50] = { x: cx - 0.085, y: cy + 0.035, z: -0.055 };
  landmarks[280] = { x: cx + 0.085, y: cy + 0.035, z: -0.055 };
  landmarks[205] = { x: cx - 0.065, y: cy + 0.055, z: -0.065 };
  landmarks[425] = { x: cx + 0.065, y: cy + 0.055, z: -0.065 };
  landmarks[151] = { x: cx, y: cy - 0.125, z: -0.055 };
  landmarks[118] = { x: cx - 0.058, y: cy - 0.005, z: -0.062 };
  landmarks[347] = { x: cx + 0.058, y: cy - 0.005, z: -0.062 };

  const mouthCy = cy + 0.122;
  const clampedMouth = Math.max(0.02, Math.min(0.45, mouthOpen));
  for (let i = 0; i < LIPS_OUTER_LOOP.length; i++) {
    const a = Math.PI - (i / LIPS_OUTER_LOOP.length) * Math.PI * 2;
    const upperBoost = Math.sin(a) > 0 ? 0.016 : 0.018 + clampedMouth * 0.075;
    landmarks[LIPS_OUTER_LOOP[i]] = {
      x: cx + Math.cos(a) * 0.054,
      y: mouthCy - Math.sin(a) * upperBoost,
      z: -0.068,
    };
  }
  for (let i = 0; i < LIPS_INNER_LOOP.length; i++) {
    const a = Math.PI - (i / LIPS_INNER_LOOP.length) * Math.PI * 2;
    const innerH = clampedMouth * 0.065 + 0.002;
    landmarks[LIPS_INNER_LOOP[i]] = {
      x: cx + Math.cos(a) * 0.04,
      y: mouthCy - Math.sin(a) * innerH,
      z: -0.064,
    };
  }

  landmarks[13] = { x: cx, y: mouthCy - clampedMouth * 0.055, z: -0.066 };
  landmarks[14] = { x: cx, y: mouthCy + clampedMouth * 0.065, z: -0.066 };
  landmarks[0] = { x: cx, y: mouthCy - 0.018, z: -0.072 };
  landmarks[17] = { x: cx, y: mouthCy + 0.02 + clampedMouth * 0.075, z: -0.068 };

  return landmarks;
}

interface Tri2D {
  a: number;
  b: number;
  c: number;
  cx: number;
  cy: number;
  rSq: number;
}

function pointInPolygon(px: number, py: number, pts: Array<[number, number]>, polyIndices: number[]): boolean {
  let inside = false;
  for (let i = 0, j = polyIndices.length - 1; i < polyIndices.length; j = i++) {
    const xi = pts[polyIndices[i]][0];
    const yi = pts[polyIndices[i]][1];
    const xj = pts[polyIndices[j]][0];
    const yj = pts[polyIndices[j]][1];
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function makeCircumcircle(
  pts: Array<[number, number]>,
  a: number,
  b: number,
  c: number
): Tri2D | null {
  const [ax, ay] = pts[a];
  const [bx, by] = pts[b];
  const [cx, cy] = pts[c];
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-10) return null;

  const aSq = ax * ax + ay * ay;
  const bSq = bx * bx + by * by;
  const cSq = cx * cx + cy * cy;

  const ux = (aSq * (by - cy) + bSq * (cy - ay) + cSq * (ay - by)) / d;
  const uy = (aSq * (cx - bx) + bSq * (ax - cx) + cSq * (bx - ax)) / d;
  const dx = ax - ux;
  const dy = ay - uy;
  return { a, b, c, cx: ux, cy: uy, rSq: dx * dx + dy * dy + 1e-10 };
}

export interface PortraitIndexBuffers {
  solidIndices: Uint16Array;
  sculptIndices: Uint16Array;
  frontGroupCountSolid: number;
  frontGroupCountSculpt: number;
  backGroupCount: number;
}

export function buildExtendedPortraitIndices(landmarks: FaceLandmark[]): PortraitIndexBuffers {
  const count = Math.min(468, landmarks.length);
  if (count < 40) {
    return {
      solidIndices: new Uint16Array(0),
      sculptIndices: new Uint16Array(0),
      frontGroupCountSolid: 0,
      frontGroupCountSculpt: 0,
      backGroupCount: 0,
    };
  }

  const l10 = landmarks[10] || landmarks[0];
  const l152 = landmarks[152] || landmarks[0];
  const l234 = landmarks[234] || landmarks[0];
  const l454 = landmarks[454] || landmarks[0];
  const l33 = landmarks[33] || landmarks[0];
  const l263 = landmarks[263] || landmarks[0];

  const centerX = (l234.x + l454.x + l10.x + l152.x) * 0.25;
  const centerY = (l234.y + l454.y + l10.y + l152.y) * 0.25;
  const rollAngle = Math.atan2(l263.y - l33.y, l263.x - l33.x);
  const cosR = Math.cos(-rollAngle);
  const sinR = Math.sin(-rollAngle);
  const span = Math.max(0.08, Math.hypot(l454.x - l234.x, l454.y - l234.y));
  const invSpan = 1 / span;

  const pts: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    const dx = (landmarks[i].x - centerX) * invSpan;
    const dy = -(landmarks[i].y - centerY) * invSpan;
    const rx = dx * cosR - dy * sinR;
    const ry = dx * sinR + dy * cosR;
    pts.push([rx, ry]);
  }

  pts.push([-12, -12]);
  pts.push([12, -12]);
  pts.push([0, 14]);

  const superTri = makeCircumcircle(pts, count, count + 1, count + 2);
  if (!superTri) {
    return {
      solidIndices: new Uint16Array(0),
      sculptIndices: new Uint16Array(0),
      frontGroupCountSolid: 0,
      frontGroupCountSculpt: 0,
      backGroupCount: 0,
    };
  }

  let triangles: Tri2D[] = [superTri];

  for (let p = 0; p < count; p++) {
    const [px, py] = pts[p];
    const bad: Tri2D[] = [];
    const good: Tri2D[] = [];

    for (let t = 0; t < triangles.length; t++) {
      const tri = triangles[t];
      const dx = px - tri.cx;
      const dy = py - tri.cy;
      if (dx * dx + dy * dy <= tri.rSq) {
        bad.push(tri);
      } else {
        good.push(tri);
      }
    }

    const edgeCounts = new Map<string, { u: number; v: number; count: number }>();
    const addEdge = (u: number, v: number) => {
      const a = u < v ? u : v;
      const b = u < v ? v : u;
      const key = `${a}_${b}`;
      const existing = edgeCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        edgeCounts.set(key, { u, v, count: 1 });
      }
    };

    for (const bt of bad) {
      addEdge(bt.a, bt.b);
      addEdge(bt.b, bt.c);
      addEdge(bt.c, bt.a);
    }

    triangles = good;
    for (const edge of edgeCounts.values()) {
      if (edge.count === 1) {
        const nt = makeCircumcircle(pts, edge.u, edge.v, p);
        if (nt) triangles.push(nt);
      }
    }
  }

  const leftEyeSet = new Set(LEFT_EYE_LOOP);
  const rightEyeSet = new Set(RIGHT_EYE_LOOP);
  const innerMouthSet = new Set(LIPS_INNER_LOOP);

  const solidFront: number[] = [];
  const sculptFront: number[] = [];

  for (const tri of triangles) {
    if (tri.a >= count || tri.b >= count || tri.c >= count) continue;

    const midX = (pts[tri.a][0] + pts[tri.b][0] + pts[tri.c][0]) / 3;
    const midY = (pts[tri.a][1] + pts[tri.b][1] + pts[tri.c][1]) / 3;

    if (!pointInPolygon(midX, midY, pts, FACE_OVAL_LOOP)) continue;

    const [ax, ay] = pts[tri.a];
    const [bx, by] = pts[tri.b];
    const [cxp, cyp] = pts[tri.c];
    const cross = (bx - ax) * (cyp - ay) - (by - ay) * (cxp - ax);
    const ordered: [number, number, number] =
      cross >= 0 ? [tri.a, tri.b, tri.c] : [tri.a, tri.c, tri.b];

    solidFront.push(ordered[0], ordered[1], ordered[2]);

    const inAperture =
      pointInPolygon(midX, midY, pts, LEFT_EYE_LOOP) ||
      pointInPolygon(midX, midY, pts, RIGHT_EYE_LOOP) ||
      pointInPolygon(midX, midY, pts, LIPS_INNER_LOOP) ||
      (leftEyeSet.has(tri.a) && leftEyeSet.has(tri.b) && leftEyeSet.has(tri.c)) ||
      (rightEyeSet.has(tri.a) && rightEyeSet.has(tri.b) && rightEyeSet.has(tri.c)) ||
      (innerMouthSet.has(tri.a) && innerMouthSet.has(tri.b) && innerMouthSet.has(tri.c));

    if (!inAperture) {
      sculptFront.push(ordered[0], ordered[1], ordered[2]);
    }
  }

  const ovalLen = FACE_OVAL_LOOP.length;
  const ring1Offset = 468;
  const ring2Offset = 468 + ovalLen;
  const backPoleIdx = 468 + ovalLen * 2;

  for (let i = 0; i < ovalLen; i++) {
    const next = (i + 1) % ovalLen;
    const oA = FACE_OVAL_LOOP[i];
    const oB = FACE_OVAL_LOOP[next];
    const r1A = ring1Offset + i;
    const r1B = ring1Offset + next;

    solidFront.push(oA, oB, r1B, oA, r1B, r1A);
    sculptFront.push(oA, oB, r1B, oA, r1B, r1A);
  }

  const backTris: number[] = [];
  for (let i = 0; i < ovalLen; i++) {
    const next = (i + 1) % ovalLen;
    const r1A = ring1Offset + i;
    const r1B = ring1Offset + next;
    const r2A = ring2Offset + i;
    const r2B = ring2Offset + next;

    backTris.push(r1A, r1B, r2B, r1A, r2B, r2A);
    backTris.push(r2A, r2B, backPoleIdx);
  }

  const frontGroupCountSolid = solidFront.length;
  const frontGroupCountSculpt = sculptFront.length;
  const backGroupCount = backTris.length;

  return {
    solidIndices: new Uint16Array([...solidFront, ...backTris]),
    sculptIndices: new Uint16Array([...sculptFront, ...backTris]),
    frontGroupCountSolid,
    frontGroupCountSculpt,
    backGroupCount,
  };
}
