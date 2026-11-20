import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HandDetectionResult } from '../../types';
import { Activity, Box, RotateCcw, Sparkles } from 'lucide-react';

interface Hand3DViewerProps {
  handResults: HandDetectionResult[];
  isMirrored: boolean;
  isStreaming: boolean;
}

type HandSkinMode = 'wireframe' | 'solid' | 'realistic';
type BionicFinish = 'cyber' | 'gold' | 'crimson';
type SkinTonePreset = 'fair' | 'warm' | 'deep';

const BONE_PAIRS: Array<{ a: number; b: number; radius: number; kind: 'phalanx' | 'metacarpal' | 'bridge' }> = [
  { a: 1, b: 2, radius: 0.072, kind: 'phalanx' },
  { a: 2, b: 3, radius: 0.062, kind: 'phalanx' },
  { a: 3, b: 4, radius: 0.052, kind: 'phalanx' },
  { a: 5, b: 6, radius: 0.066, kind: 'phalanx' },
  { a: 6, b: 7, radius: 0.056, kind: 'phalanx' },
  { a: 7, b: 8, radius: 0.048, kind: 'phalanx' },
  { a: 9, b: 10, radius: 0.07, kind: 'phalanx' },
  { a: 10, b: 11, radius: 0.06, kind: 'phalanx' },
  { a: 11, b: 12, radius: 0.05, kind: 'phalanx' },
  { a: 13, b: 14, radius: 0.064, kind: 'phalanx' },
  { a: 14, b: 15, radius: 0.054, kind: 'phalanx' },
  { a: 15, b: 16, radius: 0.046, kind: 'phalanx' },
  { a: 17, b: 18, radius: 0.056, kind: 'phalanx' },
  { a: 18, b: 19, radius: 0.048, kind: 'phalanx' },
  { a: 19, b: 20, radius: 0.04, kind: 'phalanx' },
  { a: 0, b: 1, radius: 0.078, kind: 'metacarpal' },
  { a: 0, b: 5, radius: 0.066, kind: 'metacarpal' },
  { a: 0, b: 9, radius: 0.068, kind: 'metacarpal' },
  { a: 0, b: 13, radius: 0.064, kind: 'metacarpal' },
  { a: 0, b: 17, radius: 0.06, kind: 'metacarpal' },
  { a: 5, b: 9, radius: 0.052, kind: 'bridge' },
  { a: 9, b: 13, radius: 0.052, kind: 'bridge' },
  { a: 13, b: 17, radius: 0.05, kind: 'bridge' },
  { a: 1, b: 5, radius: 0.052, kind: 'bridge' },
];

const REST_LANDMARKS: Array<[number, number, number]> = [
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

const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _vecMid = new THREE.Vector3();
const _vecDir = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _palmCenter = new THREE.Vector3();
const _palmRight = new THREE.Vector3();
const _palmUp = new THREE.Vector3();
const _palmFwd = new THREE.Vector3();
const _rotMat = new THREE.Matrix4();
const _palmQuat = new THREE.Quaternion();
const _wristDir = new THREE.Vector3();
const _wristQuat = new THREE.Quaternion();
const _palmAnchor = [
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
];
const _palmFront = [
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
];
const _palmMidF = [
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
];
const _palmMidB = [
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
];
const _palmBack = [
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
];
const _palmCenterF = new THREE.Vector3();
const _palmCenterB = new THREE.Vector3();
const _knuckleArch = new THREE.Vector3();
const _wristBase = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const Hand3DViewer: React.FC<Hand3DViewerProps> = ({
  handResults,
  isMirrored,
  isStreaming,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const handResultsRef = useRef<HandDetectionResult[]>(handResults);
  const isMirroredRef = useRef<boolean>(isMirrored);
  const isStreamingRef = useRef<boolean>(isStreaming);

  const [finishTheme, setFinishTheme] = useState<BionicFinish>('cyber');
  const finishThemeRef = useRef<BionicFinish>('cyber');
  const [skinMode, setSkinMode] = useState<HandSkinMode>('solid');
  const skinModeRef = useRef<HandSkinMode>('solid');
  const [skinTone, setSkinTone] = useState<SkinTonePreset>('warm');
  const skinToneRef = useRef<SkinTonePreset>('warm');
  const [smoothingEnabled, setSmoothingEnabled] = useState(true);
  const smoothingRef = useRef(true);
  const resetCamFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    handResultsRef.current = handResults;
  }, [handResults]);

  useEffect(() => {
    isMirroredRef.current = isMirrored;
  }, [isMirrored]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    finishThemeRef.current = finishTheme;
  }, [finishTheme]);

  useEffect(() => {
    skinModeRef.current = skinMode;
  }, [skinMode]);

  useEffect(() => {
    skinToneRef.current = skinTone;
  }, [skinTone]);

  useEffect(() => {
    smoothingRef.current = smoothingEnabled;
  }, [smoothingEnabled]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = container.clientWidth || 480;
    const height = container.clientHeight || 360;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b101d);
    scene.fog = new THREE.FogExp2(0x0b101d, 0.09);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 40);
    camera.position.set(0.35, 0.35, 4.45);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 2.4;
    controls.maxDistance = 6.8;
    controls.target.set(0, 0.05, 0);
    controls.update();

    resetCamFnRef.current = () => {
      camera.position.set(0.35, 0.35, 4.45);
      controls.target.set(0, 0.05, 0);
      controls.update();
    };

    const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x1e293b, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
    keyLight.position.set(3.2, 4.5, 4.2);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 16;
      keyLight.shadow.camera.left = -2.5;
      keyLight.shadow.camera.right = 2.5;
      keyLight.shadow.camera.top = 2.5;
      keyLight.shadow.camera.bottom = -2.5;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00f0ff, 1.4);
    rimLight.position.set(-3.5, 2.0, -2.5);
    scene.add(rimLight);

    const disposables: Array<{ dispose: () => void }> = [];
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    const buildSkinTextures = () => {
      const size = 256;

      const albedoCanvas = document.createElement('canvas');
      albedoCanvas.width = size;
      albedoCanvas.height = size;
      const aCtx = albedoCanvas.getContext('2d');
      if (aCtx) {
        aCtx.fillStyle = '#f6ebe3';
        aCtx.fillRect(0, 0, size, size);

        for (let i = 0; i < 160; i++) {
          const cx = ((i * 73) % size);
          const cy = ((i * 137) % size);
          const r = 12 + (i % 18);
          const grad = aCtx.createRadialGradient(cx, cy, 1, cx, cy, r);
          grad.addColorStop(0, i % 2 === 0 ? 'rgba(222, 165, 142, 0.14)' : 'rgba(255, 240, 232, 0.16)');
          grad.addColorStop(1, 'rgba(246, 235, 227, 0)');
          aCtx.fillStyle = grad;
          aCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
        }

        aCtx.strokeStyle = 'rgba(186, 128, 108, 0.12)';
        aCtx.lineWidth = 1.2;
        for (let y = 18; y < size; y += 28) {
          aCtx.beginPath();
          aCtx.moveTo(0, y);
          aCtx.bezierCurveTo(size * 0.33, y + 3, size * 0.66, y - 3, size, y);
          aCtx.stroke();
        }

        for (let i = 0; i < 2400; i++) {
          const px = (i * 97 + (i % 7) * 19) % size;
          const py = (i * 53 + (i % 11) * 13) % size;
          aCtx.fillStyle = i % 3 === 0 ? 'rgba(175, 118, 98, 0.12)' : 'rgba(255, 248, 242, 0.12)';
          aCtx.fillRect(px, py, 1.5, 1.5);
        }
      }

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = size;
      bumpCanvas.height = size;
      const bCtx = bumpCanvas.getContext('2d');
      if (bCtx) {
        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, size, size);
        for (let y = 18; y < size; y += 28) {
          bCtx.strokeStyle = 'rgba(72, 72, 72, 0.45)';
          bCtx.lineWidth = 1.6;
          bCtx.beginPath();
          bCtx.moveTo(0, y);
          bCtx.bezierCurveTo(size * 0.33, y + 3, size * 0.66, y - 3, size, y);
          bCtx.stroke();
        }
        for (let i = 0; i < 3200; i++) {
          const px = (i * 61 + (i % 13) * 11) % size;
          const py = (i * 89 + (i % 5) * 17) % size;
          const v = i % 2 === 0 ? 105 : 150;
          bCtx.fillStyle = `rgb(${v},${v},${v})`;
          bCtx.fillRect(px, py, 1.5, 1.5);
        }
      }

      const roughCanvas = document.createElement('canvas');
      roughCanvas.width = size;
      roughCanvas.height = size;
      const rCtx = roughCanvas.getContext('2d');
      if (rCtx) {
        rCtx.fillStyle = '#9e9e9e';
        rCtx.fillRect(0, 0, size, size);
        for (let i = 0; i < 180; i++) {
          const cx = (i * 83) % size;
          const cy = (i * 127) % size;
          const r = 10 + (i % 16);
          const v = i % 2 === 0 ? 128 : 176;
          const grad = rCtx.createRadialGradient(cx, cy, 1, cx, cy, r);
          grad.addColorStop(0, `rgba(${v},${v},${v},0.35)`);
          grad.addColorStop(1, 'rgba(158,158,158,0)');
          rCtx.fillStyle = grad;
          rCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
      }

      const albedoMap = new THREE.CanvasTexture(albedoCanvas);
      albedoMap.colorSpace = THREE.SRGBColorSpace;
      albedoMap.wrapS = THREE.RepeatWrapping;
      albedoMap.wrapT = THREE.RepeatWrapping;
      albedoMap.repeat.set(2, 2);
      albedoMap.anisotropy = maxAnisotropy;

      const bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.RepeatWrapping;
      bumpMap.repeat.set(2, 2);
      bumpMap.anisotropy = maxAnisotropy;

      const roughnessMap = new THREE.CanvasTexture(roughCanvas);
      roughnessMap.wrapS = THREE.RepeatWrapping;
      roughnessMap.wrapT = THREE.RepeatWrapping;
      roughnessMap.repeat.set(2, 2);
      roughnessMap.anisotropy = maxAnisotropy;

      return { albedoMap, bumpMap, roughnessMap };
    };

    const skinTextures = buildSkinTextures();
    disposables.push(skinTextures.albedoMap, skinTextures.bumpMap, skinTextures.roughnessMap);

    const shellMat = new THREE.MeshPhysicalMaterial({
      color: 0xdbeafe,
      metalness: 0.88,
      roughness: 0.22,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15,
    });
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      metalness: 0.25,
      roughness: 0.72,
    });
    const jointMat = new THREE.MeshPhysicalMaterial({
      color: 0x94a3b8,
      metalness: 0.92,
      roughness: 0.18,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.5,
      metalness: 0.2,
      roughness: 0.2,
    });
    const tipSensorMat = new THREE.MeshStandardMaterial({
      color: 0xff462b,
      emissive: 0xff462b,
      emissiveIntensity: 1.2,
      metalness: 0.3,
      roughness: 0.25,
    });
    disposables.push(shellMat, coreMat, jointMat, glowMat, tipSensorMat);

    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.set(0, -1.42, 0);

    const stageBaseGeo = new THREE.CylinderGeometry(1.55, 1.75, 0.12, 48);
    const stageBaseMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.65,
      roughness: 0.45,
    });
    const stageBase = new THREE.Mesh(stageBaseGeo, stageBaseMat);
    stageBase.receiveShadow = !isSoftwareGl;
    pedestalGroup.add(stageBase);

    const ringGeo = new THREE.TorusGeometry(1.38, 0.018, 12, 64);
    ringGeo.rotateX(Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, glowMat);
    ringMesh.position.y = 0.065;
    pedestalGroup.add(ringMesh);

    const innerRingGeo = new THREE.TorusGeometry(0.85, 0.01, 10, 48);
    innerRingGeo.rotateX(Math.PI / 2);
    const innerRingMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
      roughness: 0.3,
    });
    const innerRingMesh = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRingMesh.position.y = 0.066;
    pedestalGroup.add(innerRingMesh);

    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const contactPlaneGeo = new THREE.PlaneGeometry(2.4, 2.4);
    contactPlaneGeo.rotateX(-Math.PI / 2);
    const contactPlaneMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    });
    const contactShadow = new THREE.Mesh(contactPlaneGeo, contactPlaneMat);
    contactShadow.position.y = 0.072;
    pedestalGroup.add(contactShadow);
    scene.add(pedestalGroup);
    disposables.push(
      stageBaseGeo,
      stageBaseMat,
      ringGeo,
      innerRingGeo,
      innerRingMat,
      shadowTex,
      contactPlaneGeo,
      contactPlaneMat
    );

    const handRoot = new THREE.Group();
    scene.add(handRoot);

    const jointGeo = new THREE.SphereGeometry(1, 18, 14);
    const tipCollarGeo = new THREE.TorusGeometry(1.05, 0.22, 10, 20);
    const tipSensorGeo = new THREE.SphereGeometry(0.62, 14, 12);
    disposables.push(jointGeo, tipCollarGeo, tipSensorGeo);

    const techAccentMeshes: THREE.Object3D[] = [];

    const jointMeshes: THREE.Group[] = [];
    for (let i = 0; i < 21; i++) {
      const jGroup = new THREE.Group();
      const isTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
      const isWrist = i === 0;
      const r = isWrist ? 0.11 : isTip ? 0.048 : i % 4 === 1 ? 0.072 : 0.058;

      const sphere = new THREE.Mesh(jointGeo, jointMat);
      sphere.scale.setScalar(r);
      sphere.castShadow = !isSoftwareGl;
      jGroup.add(sphere);

      if (isTip) {
        const pad = new THREE.Mesh(tipSensorGeo, tipSensorMat);
        pad.scale.setScalar(r);
        pad.position.set(0, r * 0.45, r * 0.3);
        jGroup.add(pad);
      } else if (!isWrist) {
        const collar = new THREE.Mesh(tipCollarGeo, glowMat);
        collar.scale.setScalar(r * 0.78);
        collar.rotation.x = Math.PI / 2;
        jGroup.add(collar);
        techAccentMeshes.push(collar);
      }

      handRoot.add(jGroup);
      jointMeshes.push(jGroup);
    }

    const wristCuffGroup = new THREE.Group();
    const cuffBodyGeo = new THREE.CylinderGeometry(0.22, 0.25, 0.28, 24);
    const cuffRimGeo = new THREE.TorusGeometry(0.23, 0.022, 12, 32);
    cuffRimGeo.rotateX(Math.PI / 2);
    const cuffPlateGeo = new THREE.BoxGeometry(0.24, 0.18, 0.18);

    const cuffBody = new THREE.Mesh(cuffBodyGeo, coreMat);
    cuffBody.position.y = -0.14;
    cuffBody.castShadow = !isSoftwareGl;
    wristCuffGroup.add(cuffBody);

    const cuffRimTop = new THREE.Mesh(cuffRimGeo, glowMat);
    cuffRimTop.position.y = -0.02;
    wristCuffGroup.add(cuffRimTop);
    techAccentMeshes.push(cuffRimTop);

    const cuffRimBottom = new THREE.Mesh(cuffRimGeo, shellMat);
    cuffRimBottom.position.y = -0.26;
    wristCuffGroup.add(cuffRimBottom);
    techAccentMeshes.push(cuffRimBottom);

    const cuffPlate = new THREE.Mesh(cuffPlateGeo, shellMat);
    cuffPlate.position.set(0, -0.14, 0.14);
    wristCuffGroup.add(cuffPlate);
    techAccentMeshes.push(cuffPlate);

    handRoot.add(wristCuffGroup);
    disposables.push(cuffBodyGeo, cuffRimGeo, cuffPlateGeo);

    const palmVertCount = 48 * 3;
    const palmPositions = new Float32Array(palmVertCount * 3);
    const palmNormals = new Float32Array(palmVertCount * 3);
    const palmUvs = new Float32Array(palmVertCount * 2);
    const palmGeo = new THREE.BufferGeometry();
    const palmPosAttr = new THREE.BufferAttribute(palmPositions, 3);
    palmPosAttr.setUsage(THREE.DynamicDrawUsage);
    const palmNormAttr = new THREE.BufferAttribute(palmNormals, 3);
    palmNormAttr.setUsage(THREE.DynamicDrawUsage);
    const palmUvAttr = new THREE.BufferAttribute(palmUvs, 2);
    palmUvAttr.setUsage(THREE.DynamicDrawUsage);
    palmGeo.setAttribute('position', palmPosAttr);
    palmGeo.setAttribute('normal', palmNormAttr);
    palmGeo.setAttribute('uv', palmUvAttr);

    const palmMainMesh = new THREE.Mesh(palmGeo, coreMat);
    palmMainMesh.castShadow = !isSoftwareGl;
    palmMainMesh.frustumCulled = false;
    handRoot.add(palmMainMesh);

    const palmGroup = new THREE.Group();
    const dorsalPlateGeo = new THREE.BoxGeometry(0.46, 0.36, 0.16);
    const dorsalPlate = new THREE.Mesh(dorsalPlateGeo, shellMat);
    dorsalPlate.position.set(0, 0, 0);
    dorsalPlate.castShadow = !isSoftwareGl;
    palmGroup.add(dorsalPlate);
    techAccentMeshes.push(dorsalPlate);

    const coreEmblemGeo = new THREE.OctahedronGeometry(0.085, 0);
    const coreEmblem = new THREE.Mesh(coreEmblemGeo, glowMat);
    coreEmblem.scale.set(1, 1.3, 0.5);
    coreEmblem.position.set(0, 0, 0.09);
    palmGroup.add(coreEmblem);
    techAccentMeshes.push(coreEmblem);

    const dorsalEmblem = new THREE.Mesh(coreEmblemGeo, glowMat);
    dorsalEmblem.scale.set(1, 1.3, 0.5);
    dorsalEmblem.position.set(0, 0, -0.09);
    palmGroup.add(dorsalEmblem);
    techAccentMeshes.push(dorsalEmblem);

    handRoot.add(palmGroup);
    disposables.push(palmGeo, dorsalPlateGeo, coreEmblemGeo);

    const boneShellGeo = new THREE.CylinderGeometry(0.88, 1.0, 1, 16);
    const boneCoreGeo = new THREE.CylinderGeometry(0.58, 0.62, 1, 12);
    const boneBandGeo = new THREE.TorusGeometry(0.95, 0.12, 8, 18);
    boneBandGeo.rotateX(Math.PI / 2);
    disposables.push(boneShellGeo, boneCoreGeo, boneBandGeo);

    const boneGroups: Array<{
      group: THREE.Group;
      a: number;
      b: number;
      radius: number;
      shell: THREE.Mesh;
      core: THREE.Mesh;
    }> = [];

    BONE_PAIRS.forEach((pair) => {
      const bGroup = new THREE.Group();
      const core = new THREE.Mesh(boneCoreGeo, coreMat);
      core.scale.set(pair.radius, 1, pair.radius);
      bGroup.add(core);

      const shell = new THREE.Mesh(
        boneShellGeo,
        pair.kind === 'phalanx' ? shellMat : jointMat
      );
      shell.scale.set(pair.radius, 0.76, pair.radius);
      shell.castShadow = !isSoftwareGl;
      bGroup.add(shell);

      if (pair.kind === 'phalanx') {
        const band = new THREE.Mesh(boneBandGeo, glowMat);
        band.scale.set(pair.radius * 0.96, pair.radius * 0.96, pair.radius * 0.96);
        bGroup.add(band);
        techAccentMeshes.push(band);
      }

      handRoot.add(bGroup);
      boneGroups.push({
        group: bGroup,
        a: pair.a,
        b: pair.b,
        radius: pair.radius,
        shell,
        core,
      });
    });

    const rawPoints: THREE.Vector3[] = REST_LANDMARKS.map(
      ([x, y, z]) => new THREE.Vector3(x, y, z)
    );
    const filteredPoints: THREE.Vector3[] = REST_LANDMARKS.map(
      ([x, y, z]) => new THREE.Vector3(x, y, z)
    );
    const currentPoints: THREE.Vector3[] = REST_LANDMARKS.map(
      ([x, y, z]) => new THREE.Vector3(x, y, z)
    );
    const targetPoints: THREE.Vector3[] = REST_LANDMARKS.map(
      ([x, y, z]) => new THREE.Vector3(x, y, z)
    );

    let hasFilteredSeed = false;
    let lastSampleResult: HandDetectionResult | null = null;
    let lastSampleTime = performance.now();
    let lastSmoothingState = smoothingRef.current;
    let lastMirroredState = isMirroredRef.current;
    let filteredScale = 1.0;
    let smoothedScale = 1.0;
    let lastTime = performance.now();
    let frameId = 0;
    let disposed = false;

    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    let appliedMaterialKey = '';

    const applyFinishTheme = () => {
      const mode = skinModeRef.current;
      const theme = finishThemeRef.current;
      const tone = skinToneRef.current;
      const nextKey = `${mode}:${theme}:${tone}`;
      if (nextKey === appliedMaterialKey) return;
      appliedMaterialKey = nextKey;

      const isWire = mode === 'wireframe';
      const isSkin = mode === 'realistic';

      shellMat.wireframe = isWire;
      coreMat.wireframe = isWire;
      jointMat.wireframe = isWire;

      for (let i = 0; i < techAccentMeshes.length; i++) {
        techAccentMeshes[i].visible = !isSkin;
      }

      if (isSkin) {
        shellMat.map = skinTextures.albedoMap;
        shellMat.bumpMap = skinTextures.bumpMap;
        shellMat.bumpScale = 0.016;
        shellMat.roughnessMap = skinTextures.roughnessMap;
        shellMat.metalness = 0.0;
        shellMat.roughness = 0.82;
        shellMat.clearcoat = 0.14;
        shellMat.clearcoatRoughness = 0.52;
        shellMat.sheen = 0.45;
        shellMat.sheenRoughness = 0.65;

        coreMat.map = skinTextures.albedoMap;
        coreMat.bumpMap = skinTextures.bumpMap;
        coreMat.bumpScale = 0.015;
        coreMat.roughnessMap = skinTextures.roughnessMap;
        coreMat.metalness = 0.0;
        coreMat.roughness = 0.86;
        coreMat.clearcoat = 0.1;
        coreMat.clearcoatRoughness = 0.55;
        coreMat.sheen = 0.4;
        coreMat.sheenRoughness = 0.68;

        jointMat.map = skinTextures.albedoMap;
        jointMat.bumpMap = skinTextures.bumpMap;
        jointMat.bumpScale = 0.018;
        jointMat.roughnessMap = skinTextures.roughnessMap;
        jointMat.metalness = 0.0;
        jointMat.roughness = 0.8;
        jointMat.clearcoat = 0.14;
        jointMat.clearcoatRoughness = 0.48;
        jointMat.sheen = 0.45;
        jointMat.sheenRoughness = 0.62;

        if (tone === 'fair') {
          shellMat.color.setHex(0xf4ccb5);
          coreMat.color.setHex(0xe6b69c);
          jointMat.color.setHex(0xefc0a6);
          shellMat.sheenColor.setHex(0xffd2be);
          coreMat.sheenColor.setHex(0xffc9b2);
          jointMat.sheenColor.setHex(0xffd2be);
          tipSensorMat.color.setHex(0xf8dfd6);
        } else if (tone === 'deep') {
          shellMat.color.setHex(0x8d583d);
          coreMat.color.setHex(0x784830);
          jointMat.color.setHex(0x835036);
          shellMat.sheenColor.setHex(0xc88263);
          coreMat.sheenColor.setHex(0xb87456);
          jointMat.sheenColor.setHex(0xc88263);
          tipSensorMat.color.setHex(0xc79886);
        } else {
          shellMat.color.setHex(0xdca07f);
          coreMat.color.setHex(0xc98968);
          jointMat.color.setHex(0xd59674);
          shellMat.sheenColor.setHex(0xf6b394);
          coreMat.sheenColor.setHex(0xeaa484);
          jointMat.sheenColor.setHex(0xf6b394);
          tipSensorMat.color.setHex(0xedc9bc);
        }

        tipSensorMat.emissive.setHex(0x000000);
        tipSensorMat.emissiveIntensity = 0;
        tipSensorMat.roughness = 0.28;
        tipSensorMat.metalness = 0.05;
        glowMat.color.setHex(0x00f0ff);
        glowMat.emissive.setHex(0x00f0ff);
      } else {
        shellMat.map = null;
        shellMat.bumpMap = null;
        shellMat.roughnessMap = null;
        shellMat.metalness = 0.88;
        shellMat.roughness = 0.22;
        shellMat.clearcoat = 0.8;
        shellMat.clearcoatRoughness = 0.15;
        shellMat.sheen = 0.0;

        coreMat.map = null;
        coreMat.bumpMap = null;
        coreMat.roughnessMap = null;
        coreMat.metalness = 0.25;
        coreMat.roughness = 0.72;
        coreMat.clearcoat = 0.0;
        coreMat.sheen = 0.0;

        jointMat.map = null;
        jointMat.bumpMap = null;
        jointMat.roughnessMap = null;
        jointMat.metalness = 0.92;
        jointMat.roughness = 0.18;
        jointMat.clearcoat = 0.0;
        jointMat.sheen = 0.0;
        jointMat.color.setHex(0x94a3b8);

        tipSensorMat.roughness = 0.25;
        tipSensorMat.metalness = 0.3;

        if (theme === 'gold') {
          shellMat.color.setHex(0xfbbf24);
          coreMat.color.setHex(0x1f2937);
          glowMat.color.setHex(0xffd000);
          glowMat.emissive.setHex(0xffa000);
        } else if (theme === 'crimson') {
          shellMat.color.setHex(0xf43f5e);
          coreMat.color.setHex(0x0f172a);
          glowMat.color.setHex(0x00f0ff);
          glowMat.emissive.setHex(0x00f0ff);
        } else {
          shellMat.color.setHex(0xdbeafe);
          coreMat.color.setHex(0x1e293b);
          glowMat.color.setHex(0x00f0ff);
          glowMat.emissive.setHex(0x00f0ff);
        }
      }

      shellMat.needsUpdate = true;
      coreMat.needsUpdate = true;
      jointMat.needsUpdate = true;
      tipSensorMat.needsUpdate = true;
    };

    const updateTargets = (elapsed: number, now: number) => {
      const results = handResultsRef.current;
      const mirrored = isMirroredRef.current;
      const smoothing = smoothingRef.current;

      if (results.length > 0 && results[0].landmarks.length >= 21) {
        const res = results[0];
        const isNewSample = res !== lastSampleResult;

        if (isNewSample || smoothing !== lastSmoothingState || mirrored !== lastMirroredState) {
          const sampleDt = isNewSample
            ? Math.min(0.25, Math.max(0.012, (now - lastSampleTime) / 1000))
            : 0.055;
          if (isNewSample) {
            lastSampleTime = now;
          }

          const lms = res.landmarks;
          const wms = res.worldLandmarks;
          const videoAspect = res.videoAspect || 4 / 3;

          const imgCenterX = (lms[0].x + lms[5].x + lms[9].x + lms[17].x) * 0.25;
          const imgCenterY = (lms[0].y + lms[5].y + lms[9].y + lms[17].y) * 0.25;

          const offsetX = THREE.MathUtils.clamp(
            (mirrored ? 0.5 - imgCenterX : imgCenterX - 0.5) * 1.1,
            -0.55,
            0.55
          );
          const offsetY = THREE.MathUtils.clamp((0.52 - imgCenterY) * 0.9, -0.4, 0.45);

          let rawScale = 1.0;

          if (wms && wms.length >= 21) {
            const w0 = wms[0];
            const w5 = wms[5];
            const w9 = wms[9];
            const w17 = wms[17];

            const wcX = (w0.x + w5.x + w9.x + w17.x) * 0.25;
            const wcY = (w0.y + w5.y + w9.y + w17.y) * 0.25;
            const wcZ = ((w0.z || 0) + (w5.z || 0) + (w9.z || 0) + (w17.z || 0)) * 0.25;

            const palmMeters = Math.max(
              0.05,
              Math.hypot(w9.x - w0.x, w9.y - w0.y, (w9.z || 0) - (w0.z || 0))
            );
            const knuckleMeters = Math.hypot(
              w17.x - w5.x,
              w17.y - w5.y,
              (w17.z || 0) - (w5.z || 0)
            );
            const refMeters = Math.max(palmMeters, knuckleMeters * 1.15);
            const metricScale = THREE.MathUtils.clamp(0.76 / refMeters, 6.0, 9.2);
            rawScale = THREE.MathUtils.clamp(metricScale * 0.11, 0.72, 1.15);

            for (let i = 0; i < 21; i++) {
              const wm = wms[i];
              const lx = (mirrored ? -(wm.x - wcX) : wm.x - wcX) * metricScale;
              const ly = -(wm.y - wcY) * metricScale;
              const lz = -((wm.z || 0) - wcZ) * metricScale;
              rawPoints[i].set(lx + offsetX, ly + offsetY - 0.1, lz);
            }
          } else {
            const p0 = lms[0];
            const p5 = lms[5];
            const p9 = lms[9];
            const p17 = lms[17];

            const centerZ =
              ((p0.z || 0) + (p5.z || 0) + (p9.z || 0) + (p17.z || 0)) * 0.25;

            const palmDx = (p9.x - p0.x) * videoAspect;
            const palmDy = p9.y - p0.y;
            const palmDz = ((p9.z || 0) - (p0.z || 0)) * videoAspect;
            const palmSpan = Math.hypot(palmDx, palmDy, palmDz);

            const knuckleDx = (p17.x - p5.x) * videoAspect;
            const knuckleDy = p17.y - p5.y;
            const knuckleDz = ((p17.z || 0) - (p5.z || 0)) * videoAspect;
            const knuckleSpan = Math.hypot(knuckleDx, knuckleDy, knuckleDz);

            const refSpan = Math.max(0.08, palmSpan, knuckleSpan * 1.18);
            const normScale = 0.76 / refSpan;
            rawScale = THREE.MathUtils.clamp(normScale * 0.16, 0.72, 1.15);

            for (let i = 0; i < 21; i++) {
              const lm = lms[i];
              const lx =
                (mirrored ? -(lm.x - imgCenterX) : lm.x - imgCenterX) * videoAspect * normScale;
              const ly = -(lm.y - imgCenterY) * normScale;
              const lz = -((lm.z || 0) - centerZ) * videoAspect * normScale;
              rawPoints[i].set(lx + offsetX, ly + offsetY - 0.1, lz);
            }
          }

          if (mirrored !== lastMirroredState) {
            hasFilteredSeed = false;
          }

          if (smoothing) {
            if (!hasFilteredSeed) {
              for (let i = 0; i < 21; i++) {
                filteredPoints[i].copy(rawPoints[i]);
              }
              filteredScale = rawScale;
              hasFilteredSeed = true;
            } else {
              for (let i = 0; i < 21; i++) {
                const dx = rawPoints[i].x - filteredPoints[i].x;
                const dy = rawPoints[i].y - filteredPoints[i].y;
                const dz = rawPoints[i].z - filteredPoints[i].z;
                const speed = Math.hypot(dx, dy, dz) / sampleDt;
                const cutoffHz = 0.95 + 1.6 * speed;
                const tau = 1 / (2 * Math.PI * cutoffHz);
                const alpha = THREE.MathUtils.clamp(sampleDt / (tau + sampleDt), 0.18, 0.72);
                filteredPoints[i].x += alpha * dx;
                filteredPoints[i].y += alpha * dy;
                filteredPoints[i].z += alpha * dz;
              }
              const scaleTau = 1 / (2 * Math.PI * 1.4);
              const scaleAlpha = THREE.MathUtils.clamp(
                sampleDt / (scaleTau + sampleDt),
                0.18,
                0.55
              );
              filteredScale += scaleAlpha * (rawScale - filteredScale);
            }

            for (let i = 0; i < 21; i++) {
              targetPoints[i].copy(filteredPoints[i]);
            }
            smoothedScale = filteredScale;
          } else {
            hasFilteredSeed = false;
            for (let i = 0; i < 21; i++) {
              targetPoints[i].copy(rawPoints[i]);
            }
            smoothedScale = rawScale;
          }

          lastSampleResult = res;
          lastSmoothingState = smoothing;
          lastMirroredState = mirrored;
        }

        const isPinching = (res.pinchDistance ?? 1) < 0.085;
        if (skinModeRef.current === 'realistic') {
          const baseNailHex =
            skinToneRef.current === 'fair'
              ? 0xf8dfd6
              : skinToneRef.current === 'deep'
                ? 0xc79886
                : 0xedc9bc;
          tipSensorMat.color.setHex(isPinching ? 0xfca5a5 : baseNailHex);
          tipSensorMat.emissive.setHex(isPinching ? 0x7f1d1d : 0x000000);
          tipSensorMat.emissiveIntensity = isPinching ? 0.35 : 0;
        } else {
          tipSensorMat.color.setHex(isPinching ? 0x10b981 : 0xff462b);
          tipSensorMat.emissive.setHex(isPinching ? 0x10b981 : 0xff462b);
          tipSensorMat.emissiveIntensity = isPinching ? 2.2 : 1.1;
        }
      } else {
        hasFilteredSeed = false;
        lastSampleResult = null;
        lastSmoothingState = smoothing;
        lastMirroredState = mirrored;
        smoothedScale = 1.0;
        const swayY = Math.sin(elapsed * 1.5) * 0.05;
        const swayYaw = Math.sin(elapsed * 0.9) * 0.14;
        const cosY = Math.cos(swayYaw);
        const sinY = Math.sin(swayYaw);
        for (let i = 0; i < 21; i++) {
          const [rx, ry, rz] = REST_LANDMARKS[i];
          const rotX = rx * cosY - rz * sinY;
          const rotZ = rx * sinY + rz * cosY;
          targetPoints[i].set(rotX, ry + swayY, rotZ);
        }
        if (skinModeRef.current === 'realistic') {
          const baseNailHex =
            skinToneRef.current === 'fair'
              ? 0xf8dfd6
              : skinToneRef.current === 'deep'
                ? 0xc79886
                : 0xedc9bc;
          tipSensorMat.color.setHex(baseNailHex);
          tipSensorMat.emissive.setHex(0x000000);
          tipSensorMat.emissiveIntensity = 0;
        } else {
          tipSensorMat.color.setHex(0xff462b);
          tipSensorMat.emissive.setHex(0xff462b);
          tipSensorMat.emissiveIntensity = 0.9;
        }
      }
    };

    const poseHandMeshes = (dt: number) => {
      const hasHand = handResultsRef.current.length > 0;
      const smoothing = smoothingRef.current;

      if (hasHand && !smoothing) {
        for (let i = 0; i < 21; i++) {
          currentPoints[i].copy(targetPoints[i]);
          jointMeshes[i].position.copy(currentPoints[i]);
        }
      } else {
        const dampLambda = hasHand ? 16 : 8;

        for (let i = 0; i < 21; i++) {
          currentPoints[i].x = THREE.MathUtils.damp(
            currentPoints[i].x,
            targetPoints[i].x,
            dampLambda,
            dt
          );
          currentPoints[i].y = THREE.MathUtils.damp(
            currentPoints[i].y,
            targetPoints[i].y,
            dampLambda,
            dt
          );
          currentPoints[i].z = THREE.MathUtils.damp(
            currentPoints[i].z,
            targetPoints[i].z,
            dampLambda,
            dt
          );
          jointMeshes[i].position.copy(currentPoints[i]);
        }
      }

      const isSkinMode = skinModeRef.current === 'realistic';
      for (let i = 0; i < boneGroups.length; i++) {
        const b = boneGroups[i];
        _vecA.copy(currentPoints[b.a]);
        _vecB.copy(currentPoints[b.b]);
        _vecMid.addVectors(_vecA, _vecB).multiplyScalar(0.5);
        _vecDir.subVectors(_vecB, _vecA);
        const len = Math.max(0.001, _vecDir.length());
        _vecDir.divideScalar(len);

        b.group.position.copy(_vecMid);
        b.group.quaternion.setFromUnitVectors(_upAxis, _vecDir);
        if (isSkinMode) {
          b.core.scale.set(b.radius * 0.92, len, b.radius * 0.92);
          b.shell.scale.set(b.radius * 1.06, len * 0.96, b.radius * 1.06);
        } else {
          b.core.scale.set(b.radius * 0.75, len, b.radius * 0.75);
          b.shell.scale.set(b.radius * 1.15, len * 0.78, b.radius * 1.15);
        }
      }

      const w0 = currentPoints[0];
      const w1 = currentPoints[1];
      const w5 = currentPoints[5];
      const w9 = currentPoints[9];
      const w13 = currentPoints[13];
      const w17 = currentPoints[17];

      _wristBase.copy(w0).add(w1).multiplyScalar(0.5);
      _knuckleArch
        .copy(w5)
        .add(w9)
        .add(w13)
        .add(w17)
        .multiplyScalar(0.25);
      _palmCenter.copy(_wristBase).lerp(_knuckleArch, 0.5);

      _palmUp.subVectors(w9, w0);
      if (_palmUp.lengthSq() < 0.0001) _palmUp.set(0, 1, 0);
      _palmUp.normalize();

      _palmRight.subVectors(w17, w5);
      if (_palmRight.lengthSq() < 0.0001) _palmRight.set(1, 0, 0);
      _palmRight.normalize();

      _palmFwd.crossVectors(_palmRight, _palmUp).normalize();
      _palmRight.crossVectors(_palmUp, _palmFwd).normalize();

      _rotMat.makeBasis(_palmRight, _palmUp, _palmFwd);
      _palmQuat.setFromRotationMatrix(_rotMat);

      const palmSpanW = Math.max(0.35, w5.distanceTo(w17));
      const palmSpanH = Math.max(0.4, w0.distanceTo(w9));
      const halfThick = THREE.MathUtils.clamp((palmSpanW + palmSpanH) * 0.042, 0.052, 0.088);
      const midThick = halfThick * 0.48;

      _palmAnchor[0].copy(w17);
      _palmAnchor[1].copy(w13);
      _palmAnchor[2].copy(w9);
      _palmAnchor[3].copy(w5);
      _palmAnchor[4].copy(w1);
      _palmAnchor[5].copy(w0);

      const invSpanW = 1 / Math.max(0.25, palmSpanW);
      const invSpanH = 1 / Math.max(0.25, palmSpanH);

      for (let i = 0; i < 6; i++) {
        _vecDir.subVectors(_palmAnchor[i], _palmCenter);
        _palmFront[i]
          .copy(_palmCenter)
          .addScaledVector(_vecDir, 0.88)
          .addScaledVector(_palmFwd, halfThick);
        _palmMidF[i]
          .copy(_palmCenter)
          .addScaledVector(_vecDir, 1.0)
          .addScaledVector(_palmFwd, midThick);
        _palmMidB[i]
          .copy(_palmCenter)
          .addScaledVector(_vecDir, 1.0)
          .addScaledVector(_palmFwd, -midThick);
        _palmBack[i]
          .copy(_palmCenter)
          .addScaledVector(_vecDir, 0.88)
          .addScaledVector(_palmFwd, -halfThick);
      }

      _palmCenterF.copy(_palmCenter).addScaledVector(_palmFwd, halfThick);
      _palmCenterB.copy(_palmCenter).addScaledVector(_palmFwd, -halfThick);

      let vIdx = 0;
      const pushVertex = (v: THREE.Vector3) => {
        const p3 = vIdx * 3;
        palmPositions[p3] = v.x;
        palmPositions[p3 + 1] = v.y;
        palmPositions[p3 + 2] = v.z;

        _vecMid.subVectors(v, _palmCenter);
        const p2 = vIdx * 2;
        palmUvs[p2] = 0.5 + _vecMid.dot(_palmRight) * invSpanW;
        palmUvs[p2 + 1] = 0.5 + _vecMid.dot(_palmUp) * invSpanH;
        vIdx++;
      };

      const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
        pushVertex(a);
        pushVertex(b);
        pushVertex(c);
      };

      for (let k = 0; k < 6; k++) {
        const next = (k + 1) % 6;
        pushTri(_palmCenterF, _palmFront[k], _palmFront[next]);
        pushTri(_palmFront[k], _palmMidF[k], _palmMidF[next]);
        pushTri(_palmFront[k], _palmMidF[next], _palmFront[next]);
        pushTri(_palmMidF[k], _palmMidB[k], _palmMidB[next]);
        pushTri(_palmMidF[k], _palmMidB[next], _palmMidF[next]);
        pushTri(_palmMidB[k], _palmBack[k], _palmBack[next]);
        pushTri(_palmMidB[k], _palmBack[next], _palmMidB[next]);
        pushTri(_palmCenterB, _palmBack[next], _palmBack[k]);
      }

      palmPosAttr.needsUpdate = true;
      palmUvAttr.needsUpdate = true;
      palmGeo.computeVertexNormals();
      palmGeo.computeBoundingSphere();

      palmGroup.position.copy(_palmCenter);
      palmGroup.quaternion.copy(_palmQuat);
      palmGroup.scale.set(
        Math.max(0.35, palmSpanW * 0.72),
        Math.max(0.35, palmSpanH * 0.58),
        Math.max(0.65, (halfThick * 2) / 0.145)
      );

      _wristDir.copy(_palmUp);
      _wristQuat.setFromUnitVectors(_upAxis, _wristDir);
      wristCuffGroup.position.copy(w0);
      wristCuffGroup.quaternion.copy(_palmQuat);
    };

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (disposed) {
          gl.deleteSync(sync);
          return;
        }
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const startTime = performance.now();

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      const elapsed = (now - startTime) / 1000;
      lastTime = now;

      applyFinishTheme();
      updateTargets(elapsed, now);
      poseHandMeshes(dt);
      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const primaryHand = handResults[0];

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-[3px] border-[#121829] dark:border-[#27354f] bg-[#0b101d] shadow-[5px_5px_0px_#121829] flex flex-col select-none">
      <div ref={mountRef} className="w-full h-full flex-1" />

      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#121829]/95 border-2 border-[#00f0ff] text-[11px] font-black uppercase text-white shadow-[2px_2px_0px_#000000]">
          <Box className="h-3.5 w-3.5 text-[#00f0ff]" />
          <span>3D Hand Twin</span>
        </div>

        <div className="px-2.5 py-1 rounded-xl bg-[#ffd000] border-2 border-[#121829] text-[11px] font-black uppercase text-[#121829] shadow-[2px_2px_0px_#000000]">
          {primaryHand
            ? `LIVE: ${primaryHand.gesture.toUpperCase()}`
            : isStreaming
              ? 'SHOW HAND TO SYNC'
              : 'IDLE POSE'}
        </div>
      </div>

      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 max-w-[calc(100%-1rem)] overflow-x-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#121829]/95 border-2 border-white/20 text-[10px] font-black text-white shadow-[2.5px_2.5px_0px_#000000] whitespace-nowrap">
        <button
          onClick={() => setSkinMode('wireframe')}
          aria-pressed={skinMode === 'wireframe'}
          className={`px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors ${
            skinMode === 'wireframe'
              ? 'bg-[#ff2a85] text-white'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title="Wireframe Mesh View"
        >
          <Sparkles className="h-3 w-3" />
          <span>Wireframe</span>
        </button>
        <button
          onClick={() => setSkinMode('solid')}
          aria-pressed={skinMode === 'solid'}
          className={`px-2 py-1 rounded-lg cursor-pointer transition-colors ${
            skinMode === 'solid'
              ? 'bg-[#00f0ff] text-[#121829]'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title="Solid Bionic Mesh Material"
        >
          Solid
        </button>
        <button
          onClick={() => setSkinMode('realistic')}
          aria-pressed={skinMode === 'realistic'}
          className={`px-2 py-1 rounded-lg cursor-pointer transition-colors ${
            skinMode === 'realistic'
              ? 'bg-[#f4b898] text-[#121829]'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title="Realistic Textured Skin-Tone Material"
        >
          Skin
        </button>

        <span className="h-3.5 w-px bg-white/20 mx-0.5 shrink-0" />

        {skinMode === 'realistic' ? (
          <div className="flex items-center gap-1" title="Skin Tone Undertone">
            <button
              onClick={() => setSkinTone('fair')}
              aria-label="Fair skin tone"
              title="Fair Skin Tone"
              className={`w-4 h-4 rounded-md bg-[#f4ccb5] border-2 cursor-pointer transition-transform ${
                skinTone === 'fair' ? 'border-white scale-110' : 'border-white/30 opacity-75 hover:opacity-100'
              }`}
            />
            <button
              onClick={() => setSkinTone('warm')}
              aria-label="Warm medium skin tone"
              title="Warm Medium Skin Tone"
              className={`w-4 h-4 rounded-md bg-[#dca07f] border-2 cursor-pointer transition-transform ${
                skinTone === 'warm' ? 'border-white scale-110' : 'border-white/30 opacity-75 hover:opacity-100'
              }`}
            />
            <button
              onClick={() => setSkinTone('deep')}
              aria-label="Deep skin tone"
              title="Deep Skin Tone"
              className={`w-4 h-4 rounded-md bg-[#8d583d] border-2 cursor-pointer transition-transform ${
                skinTone === 'deep' ? 'border-white scale-110' : 'border-white/30 opacity-75 hover:opacity-100'
              }`}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1" title="Mesh Finish Color">
            <button
              onClick={() => setFinishTheme('cyber')}
              aria-label="Titanium finish"
              title="Titanium Finish"
              className={`w-4 h-4 rounded-md bg-[#00f0ff] border-2 cursor-pointer transition-transform ${
                finishTheme === 'cyber' ? 'border-white scale-110' : 'border-white/30 opacity-75 hover:opacity-100'
              }`}
            />
            <button
              onClick={() => setFinishTheme('gold')}
              aria-label="Gold finish"
              title="Gold Finish"
              className={`w-4 h-4 rounded-md bg-[#ffd000] border-2 cursor-pointer transition-transform ${
                finishTheme === 'gold' ? 'border-white scale-110' : 'border-white/30 opacity-75 hover:opacity-100'
              }`}
            />
            <button
              onClick={() => setFinishTheme('crimson')}
              aria-label="Crimson finish"
              title="Crimson Finish"
              className={`w-4 h-4 rounded-md bg-[#ff462b] border-2 cursor-pointer transition-transform ${
                finishTheme === 'crimson' ? 'border-white scale-110' : 'border-white/30 opacity-75 hover:opacity-100'
              }`}
            />
          </div>
        )}

        <span className="h-3.5 w-px bg-white/20 mx-0.5 shrink-0" />

        <button
          onClick={() => setSmoothingEnabled((s) => !s)}
          aria-pressed={smoothingEnabled}
          className={`px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors ${
            smoothingEnabled
              ? 'bg-[#10b981] text-[#121829]'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title="Toggle Low-Pass Coordinate Filter (Reduces Hand Jitter)"
        >
          <Activity className="h-3 w-3" />
          <span>{smoothingEnabled ? 'Smooth: ON' : 'Smooth: OFF'}</span>
        </button>

        <button
          onClick={() => resetCamFnRef.current?.()}
          className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/25 text-white flex items-center gap-1 cursor-pointer transition-colors"
          title="Reset 3D Camera Angle"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};
