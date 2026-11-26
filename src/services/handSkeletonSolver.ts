import * as THREE from 'three';
import { HandTwinTrainingProfile } from '../types';

export const HAND_REST_LANDMARKS: Array<[number, number, number]> = [
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

const PALM_ANCHORS = [1, 5, 9, 13, 17];

const PALM_FAN_PAIRS: Array<{ a: number; b: number; minRatio: number; wristAnchor?: boolean }> = [
  { a: 5, b: 9, minRatio: 0.86 },
  { a: 9, b: 13, minRatio: 0.86 },
  { a: 13, b: 17, minRatio: 0.86 },
  { a: 1, b: 5, minRatio: 0.82 },
  { a: 5, b: 13, minRatio: 0.8 },
  { a: 9, b: 17, minRatio: 0.8 },
  { a: 5, b: 17, minRatio: 0.78 },
  { a: 1, b: 9, minRatio: 0.78 },
  { a: 1, b: 13, minRatio: 0.76 },
  { a: 1, b: 17, minRatio: 0.76 },
  { a: 0, b: 1, minRatio: 0.84, wristAnchor: true },
  { a: 0, b: 5, minRatio: 0.84, wristAnchor: true },
  { a: 0, b: 9, minRatio: 0.84, wristAnchor: true },
  { a: 0, b: 13, minRatio: 0.84, wristAnchor: true },
  { a: 0, b: 17, minRatio: 0.84, wristAnchor: true },
];

const FINGER_CHAINS: number[][] = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
];

const PHALANX_SEGMENTS: Array<{
  a: number;
  b: number;
  finger: number;
  seg: number;
  radius: number;
}> = [
  { a: 1, b: 2, finger: 0, seg: 0, radius: 0.072 },
  { a: 2, b: 3, finger: 0, seg: 1, radius: 0.066 },
  { a: 3, b: 4, finger: 0, seg: 2, radius: 0.06 },
  { a: 5, b: 6, finger: 1, seg: 0, radius: 0.068 },
  { a: 6, b: 7, finger: 1, seg: 1, radius: 0.062 },
  { a: 7, b: 8, finger: 1, seg: 2, radius: 0.056 },
  { a: 9, b: 10, finger: 2, seg: 0, radius: 0.069 },
  { a: 10, b: 11, finger: 2, seg: 1, radius: 0.063 },
  { a: 11, b: 12, finger: 2, seg: 2, radius: 0.056 },
  { a: 13, b: 14, finger: 3, seg: 0, radius: 0.067 },
  { a: 14, b: 15, finger: 3, seg: 1, radius: 0.061 },
  { a: 15, b: 16, finger: 3, seg: 2, radius: 0.055 },
  { a: 17, b: 18, finger: 4, seg: 0, radius: 0.063 },
  { a: 18, b: 19, finger: 4, seg: 1, radius: 0.057 },
  { a: 19, b: 20, finger: 4, seg: 2, radius: 0.052 },
];

const METACARPAL_SEGMENTS: Array<{ a: number; b: number; finger: number; radius: number }> = [
  { a: 0, b: 5, finger: 1, radius: 0.078 },
  { a: 0, b: 9, finger: 2, radius: 0.08 },
  { a: 0, b: 13, finger: 3, radius: 0.076 },
  { a: 0, b: 17, finger: 4, radius: 0.072 },
];

function restDist(a: number, b: number): number {
  const ra = HAND_REST_LANDMARKS[a];
  const rb = HAND_REST_LANDMARKS[b];
  return Math.hypot(rb[0] - ra[0], rb[1] - ra[1], rb[2] - ra[2]);
}

const REST_PALM_DIST = PALM_ANCHORS.map((k) => restDist(0, k));
const REST_PALM_FAN_DIST = PALM_FAN_PAIRS.map((p) => restDist(p.a, p.b));
const REST_CHAIN_DIST = FINGER_CHAINS.map((chain) =>
  chain.slice(0, -1).map((a, idx) => restDist(a, chain[idx + 1]))
);

const _u = new THREE.Vector3();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _c1 = new THREE.Vector3();
const _c2 = new THREE.Vector3();
const _diff = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _prevDir = new THREE.Vector3();
const _pCenter = new THREE.Vector3();
const _pUp = new THREE.Vector3();
const _pRight = new THREE.Vector3();
const _pFwd = new THREE.Vector3();

function closestSegmentParams(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  q0: THREE.Vector3,
  q1: THREE.Vector3
): [number, number] {
  _u.subVectors(p1, p0);
  _v.subVectors(q1, q0);
  _w.subVectors(p0, q0);
  const a = _u.dot(_u);
  const b = _u.dot(_v);
  const c = _v.dot(_v);
  const d = _u.dot(_w);
  const e = _v.dot(_w);
  const D = a * c - b * b;
  const EPS = 1e-6;
  let sN = 0;
  let sD = D;
  let tN = 0;
  let tD = D;

  if (D < EPS) {
    sN = 0;
    sD = 1;
    tN = e;
    tD = c;
  } else {
    sN = b * e - c * d;
    tN = a * e - b * d;
    if (sN < 0) {
      sN = 0;
      tN = e;
      tD = c;
    } else if (sN > sD) {
      sN = sD;
      tN = e + b;
      tD = c;
    }
  }

  if (tN < 0) {
    tN = 0;
    if (-d < 0) {
      sN = 0;
    } else if (-d > a) {
      sN = sD;
    } else {
      sN = -d;
      sD = a;
    }
  } else if (tN > tD) {
    tN = tD;
    if (-d + b < 0) {
      sN = 0;
    } else if (-d + b > a) {
      sN = sD;
    } else {
      sN = -d + b;
      sD = a;
    }
  }

  const sc = Math.abs(sN) < EPS ? 0 : sN / (sD || 1);
  const tc = Math.abs(tN) < EPS ? 0 : tN / (tD || 1);
  return [THREE.MathUtils.clamp(sc, 0, 1), THREE.MathUtils.clamp(tc, 0, 1)];
}

export function segmentDistance(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  q0: THREE.Vector3,
  q1: THREE.Vector3
): number {
  const [s, t] = closestSegmentParams(p0, p1, q0, q1);
  _c1.copy(p0).lerp(p1, s);
  _c2.copy(q0).lerp(q1, t);
  return _c1.distanceTo(_c2);
}

function resolveSegmentPair(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  q0: THREE.Vector3,
  q1: THREE.Vector3,
  minDist: number,
  wA: number,
  wB: number,
  fingerA: number,
  fingerB: number
) {
  const [s, t] = closestSegmentParams(p0, p1, q0, q1);
  _c1.copy(p0).lerp(p1, s);
  _c2.copy(q0).lerp(q1, t);
  _diff.subVectors(_c1, _c2);
  const dist = _diff.length();

  if (dist >= minDist) return;

  if (dist > 0.004) {
    _diff.divideScalar(dist);
  } else {
    const sideSign = fingerA < fingerB ? -1 : fingerA > fingerB ? 1 : 0;
    const fwdSign = fingerA === 0 || fingerB === 0 ? 0.65 : ((fingerA + fingerB) % 2 === 0 ? 0.3 : -0.3);
    _diff.copy(_pRight).multiplyScalar(sideSign).addScaledVector(_pFwd, fwdSign);
    if (_diff.lengthSq() < 0.001) {
      _diff.set(1, 0.2, 0.3);
    }
    _diff.normalize();
  }

  const pen = minDist - dist;
  const totalW = wA + wB || 1;
  const shareA = pen * (wA / totalW);
  const shareB = pen * (wB / totalW);

  const a0 = 1 - s;
  const a1 = s;
  const normA = a0 * a0 + a1 * a1 || 1;
  const stepA = shareA / normA;
  p0.addScaledVector(_diff, a0 * stepA);
  p1.addScaledVector(_diff, a1 * stepA);

  const b0 = 1 - t;
  const b1 = t;
  const normB = b0 * b0 + b1 * b1 || 1;
  const stepB = shareB / normB;
  q0.addScaledVector(_diff, -b0 * stepB);
  q1.addScaledVector(_diff, -b1 * stepB);
}

function projectBoneLengths(
  pts: THREE.Vector3[],
  source: THREE.Vector3[],
  scaleRef: number,
  fallbackPts: THREE.Vector3[] | undefined,
  ratios: number[] | undefined,
  palmMin: number,
  palmMax: number,
  phalanxMin: number,
  phalanxMax: number
) {
  for (let p = 0; p < PALM_ANCHORS.length; p++) {
    const k = PALM_ANCHORS[p];
    const ratioIdx = p * 4;
    const trainedDist = ratios && ratios[ratioIdx] ? ratios[ratioIdx] : REST_PALM_DIST[p];
    const targetRest = (REST_PALM_DIST[p] * 0.6 + trainedDist * 0.4) * scaleRef;
    _dir.subVectors(source[k], source[0]);
    let len = _dir.length();
    if (len < 0.03 && fallbackPts) {
      _dir.subVectors(fallbackPts[k], fallbackPts[0]);
      len = _dir.length();
    }
    if (len < 0.002) {
      const ra = HAND_REST_LANDMARKS[0];
      const rk = HAND_REST_LANDMARKS[k];
      _dir.set(rk[0] - ra[0], rk[1] - ra[1], rk[2] - ra[2]).normalize();
      len = targetRest;
    } else {
      _dir.divideScalar(len);
    }
    const clampedLen = THREE.MathUtils.clamp(len, targetRest * palmMin, targetRest * palmMax);
    pts[k].copy(pts[0]).addScaledVector(_dir, clampedLen);
  }

  for (let c = 0; c < FINGER_CHAINS.length; c++) {
    const chain = FINGER_CHAINS[c];
    const chainDists = REST_CHAIN_DIST[c];
    _prevDir.subVectors(pts[chain[0]], pts[0]);
    if (_prevDir.lengthSq() < 0.0001) {
      _prevDir.set(0, 1, 0);
    } else {
      _prevDir.normalize();
    }

    for (let s = 0; s < chain.length - 1; s++) {
      const a = chain[s];
      const b = chain[s + 1];
      const ratioIdx = c * 4 + (s + 1);
      const trainedLen = ratios && ratios[ratioIdx] ? ratios[ratioIdx] : chainDists[s];
      const restLen = (chainDists[s] * 0.6 + trainedLen * 0.4) * scaleRef;
      _dir.subVectors(source[b], source[a]);
      let len = _dir.length();
      if (len < 0.03 && fallbackPts) {
        _dir.subVectors(fallbackPts[b], fallbackPts[a]);
        len = _dir.length();
      }
      if (len < 0.02) {
        _dir.copy(_prevDir);
        len = restLen;
      } else {
        _dir.divideScalar(len);
      }
      const clampedLen = THREE.MathUtils.clamp(len, restLen * phalanxMin, restLen * phalanxMax);
      pts[b].copy(pts[a]).addScaledVector(_dir, clampedLen);
      _prevDir.copy(_dir);
    }
  }
}

export function enforceUnclumpableHandSkeleton(
  pts: THREE.Vector3[],
  scratch: THREE.Vector3[],
  scaleRef: number,
  fallbackPts?: THREE.Vector3[],
  profile?: HandTwinTrainingProfile | null
) {
  for (let i = 0; i < 21; i++) {
    if (!Number.isFinite(pts[i].x) || !Number.isFinite(pts[i].y) || !Number.isFinite(pts[i].z)) {
      pts[i].set(HAND_REST_LANDMARKS[i][0], HAND_REST_LANDMARKS[i][1], HAND_REST_LANDMARKS[i][2]);
    }
    scratch[i].copy(pts[i]);
  }

  const ratios = profile?.calibratedBoneRatios;
  const knuckleBoost = profile ? THREE.MathUtils.clamp(profile.knuckleSpreadGain, 0.96, 1.2) : 1.02;

  projectBoneLengths(pts, scratch, scaleRef, fallbackPts, ratios, 0.84, 1.2, 0.88, 1.18);

  const SOLVER_ITERATIONS = 6;
  const minPalmCoreRadius = 0.215 * scaleRef;
  const minJointGap = 0.134 * scaleRef;

  for (let iter = 0; iter < SOLVER_ITERATIONS; iter++) {
    _pCenter
      .copy(pts[0])
      .add(pts[5])
      .add(pts[9])
      .add(pts[13])
      .add(pts[17])
      .multiplyScalar(0.2);

    _pUp.subVectors(pts[9], pts[0]);
    if (_pUp.lengthSq() < 0.0002) _pUp.set(0, 1, 0);
    _pUp.normalize();

    _pRight.subVectors(pts[17], pts[5]);
    if (_pRight.lengthSq() < 0.0002) _pRight.set(1, 0, 0);
    _pRight.normalize();

    _pFwd.crossVectors(_pRight, _pUp);
    if (_pFwd.lengthSq() < 0.0004) _pFwd.set(0, 0, 1);
    _pFwd.normalize();
    _pRight.crossVectors(_pUp, _pFwd).normalize();

    for (let b = 0; b < PALM_FAN_PAIRS.length; b++) {
      const pair = PALM_FAN_PAIRS[b];
      const minGap = REST_PALM_FAN_DIST[b] * scaleRef * pair.minRatio * knuckleBoost;
      _diff.subVectors(pts[pair.b], pts[pair.a]);
      const gap = _diff.length();
      if (gap < minGap) {
        if (gap > 0.004) {
          _diff.divideScalar(gap);
        } else {
          const rA = HAND_REST_LANDMARKS[pair.a];
          const rB = HAND_REST_LANDMARKS[pair.b];
          _diff
            .copy(_pRight)
            .multiplyScalar(rB[0] - rA[0])
            .addScaledVector(_pUp, rB[1] - rA[1])
            .addScaledVector(_pFwd, rB[2] - rA[2]);
          if (_diff.lengthSq() < 0.0004) _diff.copy(_pRight);
          _diff.normalize();
        }
        const deficit = minGap - gap;
        if (pair.wristAnchor) {
          pts[pair.a].addScaledVector(_diff, -deficit * 0.1);
          pts[pair.b].addScaledVector(_diff, deficit * 0.9);
        } else {
          pts[pair.a].addScaledVector(_diff, -deficit * 0.5);
          pts[pair.b].addScaledVector(_diff, deficit * 0.5);
        }
      }
    }

    for (let c = 0; c < FINGER_CHAINS.length; c++) {
      const chain = FINGER_CHAINS[c];
      for (let s = 1; s < chain.length; s++) {
        const jIdx = chain[s];
        _diff.subVectors(pts[jIdx], _pCenter);
        const coreDist = _diff.length();
        if (coreDist < minPalmCoreRadius) {
          if (coreDist > 0.004) {
            _diff.divideScalar(coreDist);
          } else {
            _diff.copy(_pFwd);
          }
          pts[jIdx].copy(_pCenter).addScaledVector(_diff, minPalmCoreRadius);
        }
      }
    }

    for (let i = 0; i < PHALANX_SEGMENTS.length; i++) {
      const segP = PHALANX_SEGMENTS[i];
      if (segP.seg === 0 && segP.finger !== 0) continue;
      for (let m = 0; m < METACARPAL_SEGMENTS.length; m++) {
        const meta = METACARPAL_SEGMENTS[m];
        if (segP.seg === 0 && segP.finger === meta.finger) continue;
        const minMetaGap = (segP.radius + meta.radius) * scaleRef * 1.04;
        resolveSegmentPair(
          pts[segP.a],
          pts[segP.b],
          pts[meta.a],
          pts[meta.b],
          minMetaGap,
          0.92,
          0.08,
          segP.finger,
          meta.finger
        );
      }
    }

    for (let i = 0; i < PHALANX_SEGMENTS.length; i++) {
      const segA = PHALANX_SEGMENTS[i];
      for (let j = i + 1; j < PHALANX_SEGMENTS.length; j++) {
        const segB = PHALANX_SEGMENTS[j];
        if (segA.finger === segB.finger && Math.abs(segA.seg - segB.seg) <= 1) {
          continue;
        }
        const sameFingerNonAdj = segA.finger === segB.finger;
        const mult = sameFingerNonAdj ? 1.02 : 1.15;
        const minSegGap = (segA.radius + segB.radius) * scaleRef * mult;
        const wA = segA.seg === 0 ? 0.65 : 1.0;
        const wB = segB.seg === 0 ? 0.65 : 1.0;
        resolveSegmentPair(
          pts[segA.a],
          pts[segA.b],
          pts[segB.a],
          pts[segB.b],
          minSegGap,
          wA,
          wB,
          segA.finger,
          segB.finger
        );
      }
    }

    for (let ca = 0; ca < FINGER_CHAINS.length; ca++) {
      for (let cb = ca + 1; cb < FINGER_CHAINS.length; cb++) {
        const chainA = FINGER_CHAINS[ca];
        const chainB = FINGER_CHAINS[cb];
        for (let sa = 1; sa < chainA.length; sa++) {
          for (let sb = 1; sb < chainB.length; sb++) {
            const ja = chainA[sa];
            const jb = chainB[sb];
            _diff.subVectors(pts[jb], pts[ja]);
            const dist = _diff.length();
            if (dist < minJointGap) {
              if (dist > 0.004) {
                _diff.divideScalar(dist);
              } else {
                const fwdOffset = ca === 0 ? -0.5 : 0;
                _diff.copy(_pRight).addScaledVector(_pFwd, fwdOffset).normalize();
              }
              const push = (minJointGap - dist) * 0.5;
              pts[ja].addScaledVector(_diff, -push);
              pts[jb].addScaledVector(_diff, push);
            }
          }
        }
      }
    }

    projectBoneLengths(pts, pts, scaleRef, fallbackPts, ratios, 0.86, 1.18, 0.88, 1.16);
  }
}

export function measureMinimumInterFingerClearance(pts: THREE.Vector3[]): {
  minJointDistance: number;
  minSegmentDistance: number;
} {
  let minJointDistance = Infinity;
  let minSegmentDistance = Infinity;

  for (let ca = 0; ca < FINGER_CHAINS.length; ca++) {
    for (let cb = ca + 1; cb < FINGER_CHAINS.length; cb++) {
      for (let sa = 1; sa < FINGER_CHAINS[ca].length; sa++) {
        for (let sb = 1; sb < FINGER_CHAINS[cb].length; sb++) {
          const d = pts[FINGER_CHAINS[ca][sa]].distanceTo(pts[FINGER_CHAINS[cb][sb]]);
          if (d < minJointDistance) minJointDistance = d;
        }
      }
    }
  }

  for (let i = 0; i < PHALANX_SEGMENTS.length; i++) {
    const a = PHALANX_SEGMENTS[i];
    for (let j = i + 1; j < PHALANX_SEGMENTS.length; j++) {
      const b = PHALANX_SEGMENTS[j];
      if (a.finger === b.finger) continue;
      const d = segmentDistance(pts[a.a], pts[a.b], pts[b.a], pts[b.b]);
      if (d < minSegmentDistance) minSegmentDistance = d;
    }
  }

  return { minJointDistance, minSegmentDistance };
}
