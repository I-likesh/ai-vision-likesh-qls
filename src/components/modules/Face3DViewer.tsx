import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FaceColorPalette, FaceLandmark, FaceMeshResult } from '../../types';
import {
  buildCanonical468Face,
  buildExtendedPortraitIndices,
  DEFAULT_FACE_PALETTE,
  FACE_OVAL_LOOP,
  LEFT_BROW_INDICES,
  LIPS_INNER_LOOP,
  LIPS_OUTER_LOOP,
  PORTRAIT_VERTEX_COUNT,
  PortraitIndexBuffers,
  RIGHT_BROW_INDICES,
} from '../../services/faceMeshTopology';
import { getSyncedFaceFrameCanvas } from '../../services/faceMeshDetector';
import { Eye, Palette, RotateCcw, SlidersHorizontal, Sparkles } from 'lucide-react';

interface Face3DViewerProps {
  faceResult: FaceMeshResult | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isMirrored: boolean;
  isStreaming: boolean;
}

type FaceTwinMode = 'live' | 'sculpt' | 'wireframe';

const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _vecC = new THREE.Vector3();
const _vecDir = new THREE.Vector3();
const _vecMid = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _rotMat = new THREE.Matrix4();
const _headQuat = new THREE.Quaternion();
const _headRight = new THREE.Vector3();
const _headUp = new THREE.Vector3();
const _headFwd = new THREE.Vector3();
const _colorTarget = new THREE.Color();
const _hairColor = new THREE.Color();
const _shadowColor = new THREE.Color();
const _blendedBackColor = new THREE.Color();

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

export const Face3DViewer: React.FC<Face3DViewerProps> = ({
  faceResult,
  videoRef,
  isMirrored,
  isStreaming,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const faceResultRef = useRef<FaceMeshResult | null>(faceResult);
  const isMirroredRef = useRef<boolean>(isMirrored);
  const isStreamingRef = useRef<boolean>(isStreaming);

  const [twinMode, setTwinMode] = useState<FaceTwinMode>('live');
  const twinModeRef = useRef<FaceTwinMode>('live');
  const [smoothingEnabled, setSmoothingEnabled] = useState(true);
  const smoothingRef = useRef(true);
  const [hudOpen, setHudOpen] = useState(true);
  const resetCamRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    faceResultRef.current = faceResult;
  }, [faceResult]);

  useEffect(() => {
    isMirroredRef.current = isMirrored;
  }, [isMirrored]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    twinModeRef.current = twinMode;
  }, [twinMode]);

  useEffect(() => {
    smoothingRef.current = smoothingEnabled;
  }, [smoothingEnabled]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const disposables: Array<{ dispose: () => void }> = [];
    const isSoftwareGl = detectSoftwareGl();

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 360);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1120);
    scene.fog = new THREE.FogExp2(0x0b1120, 0.045);

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 45);
    camera.position.set(0, 0.1, 4.35);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();
    disposables.push(envTarget);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 2.4;
    controls.maxDistance = 6.8;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.maxPolarAngle = Math.PI * 0.8;
    controls.target.set(0, 0.02, 0);

    resetCamRef.current = () => {
      camera.position.set(0, 0.1, 4.35);
      controls.target.set(0, 0.02, 0);
      controls.update();
    };

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.35);
    keyLight.position.set(2.2, 3.0, 4.2);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 12;
      keyLight.shadow.camera.left = -2.2;
      keyLight.shadow.camera.right = 2.2;
      keyLight.shadow.camera.top = 2.2;
      keyLight.shadow.camera.bottom = -2.2;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.78);
    fillLight.position.set(-2.6, 0.8, 2.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.95);
    rimLight.position.set(0.2, 2.4, -3.5);
    scene.add(rimLight);

    const gridFloor = new THREE.GridHelper(9, 18, 0x1e293b, 0x172033);
    gridFloor.position.y = -1.68;
    scene.add(gridFloor);
    disposables.push(gridFloor);

    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.set(0, -1.6, 0);

    const baseGeo = new THREE.CylinderGeometry(1.18, 1.38, 0.11, 48);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.65,
      roughness: 0.4,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    pedestalGroup.add(baseMesh);

    const glowRingGeo = new THREE.TorusGeometry(1.06, 0.015, 12, 64);
    glowRingGeo.rotateX(Math.PI / 2);
    const glowRingMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.35,
      roughness: 0.25,
    });
    const glowRing = new THREE.Mesh(glowRingGeo, glowRingMat);
    glowRing.position.y = 0.06;
    pedestalGroup.add(glowRing);

    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(1.9, 1.9);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.position.y = 0.065;
    pedestalGroup.add(shadowPlane);
    scene.add(pedestalGroup);
    disposables.push(baseGeo, baseMat, glowRingGeo, glowRingMat, shadowTex, shadowGeo, shadowMat);

    const videoTexCanvas = document.createElement('canvas');
    videoTexCanvas.width = 640;
    videoTexCanvas.height = 480;
    const videoTexCtx = videoTexCanvas.getContext('2d');
    if (videoTexCtx) {
      videoTexCtx.fillStyle = DEFAULT_FACE_PALETTE.skin;
      videoTexCtx.fillRect(0, 0, videoTexCanvas.width, videoTexCanvas.height);
    }
    const videoTex = new THREE.CanvasTexture(videoTexCanvas);
    videoTex.colorSpace = THREE.SRGBColorSpace;
    videoTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    videoTex.minFilter = THREE.LinearFilter;
    videoTex.magFilter = THREE.LinearFilter;
    disposables.push(videoTex);

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = 128;
    bumpCanvas.height = 128;
    const bCtx = bumpCanvas.getContext('2d');
    if (bCtx) {
      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 900; i++) {
        const px = (i * 73) % 128;
        const py = (i * 41) % 128;
        const v = i % 2 === 0 ? 114 : 142;
        bCtx.fillStyle = `rgb(${v},${v},${v})`;
        bCtx.fillRect(px, py, 1.5, 1.5);
      }
    }
    const microBumpTex = new THREE.CanvasTexture(bumpCanvas);
    microBumpTex.wrapS = THREE.RepeatWrapping;
    microBumpTex.wrapT = THREE.RepeatWrapping;
    microBumpTex.repeat.set(3, 3);
    disposables.push(microBumpTex);

    const faceSkinLiveMat = new THREE.MeshStandardMaterial({
      map: videoTex,
      emissiveMap: videoTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.48,
      roughness: 0.88,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    const faceSkinSculptMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(DEFAULT_FACE_PALETTE.skin),
      roughness: 0.56,
      metalness: 0.02,
      clearcoat: 0.1,
      clearcoatRoughness: 0.52,
      sheen: 0.24,
      sheenColor: new THREE.Color(0xffe4d6),
      bumpMap: microBumpTex,
      bumpScale: 0.005,
      side: THREE.DoubleSide,
    });
    const backCraniumMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.78,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const faceWireMat = new THREE.MeshStandardMaterial({
      color: 0x0f2942,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.38,
      wireframe: true,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
    const wireBackMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x1e3a5f,
      emissiveIntensity: 0.22,
      wireframe: true,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });
    const neckMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(DEFAULT_FACE_PALETTE.skinShadow),
      roughness: 0.74,
      metalness: 0.02,
    });
    const eyelidMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(DEFAULT_FACE_PALETTE.skin),
      roughness: 0.58,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const lashMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(DEFAULT_FACE_PALETTE.eyebrows),
      roughness: 0.6,
      metalness: 0.05,
    });
    const lipMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(DEFAULT_FACE_PALETTE.lips),
      roughness: 0.34,
      metalness: 0.02,
      clearcoat: 0.45,
      clearcoatRoughness: 0.32,
    });
    const browMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(DEFAULT_FACE_PALETTE.eyebrows),
      roughness: 0.78,
      metalness: 0.02,
    });
    const irisMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(DEFAULT_FACE_PALETTE.iris),
      roughness: 0.16,
      metalness: 0.05,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
    });
    const scleraMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4f5f7,
      roughness: 0.18,
      metalness: 0.0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
    });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x090c12 });
    const oralCavityMat = new THREE.MeshStandardMaterial({
      color: 0x24070d,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const teethMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4f0e8,
      roughness: 0.24,
      metalness: 0.0,
      clearcoat: 0.7,
    });
    disposables.push(
      faceSkinLiveMat,
      faceSkinSculptMat,
      backCraniumMat,
      faceWireMat,
      wireBackMat,
      neckMat,
      eyelidMat,
      lashMat,
      lipMat,
      browMat,
      irisMat,
      scleraMat,
      pupilMat,
      oralCavityMat,
      teethMat
    );

    const restLandmarks = buildCanonical468Face(0.5, 0.48, 0.29, 0.29, 0.08);
    let portraitBuffers: PortraitIndexBuffers = buildExtendedPortraitIndices(restLandmarks);
    let currentIndexTopology: 'solid' | 'sculpt' = 'solid';

    const faceGeometry = new THREE.BufferGeometry();
    const posBuffer = new Float32Array(PORTRAIT_VERTEX_COUNT * 3);
    const uvBuffer = new Float32Array(PORTRAIT_VERTEX_COUNT * 2);
    const colorBuffer = new Float32Array(PORTRAIT_VERTEX_COUNT * 3);
    for (let i = 0; i < PORTRAIT_VERTEX_COUNT; i++) {
      colorBuffer[i * 3] = 1;
      colorBuffer[i * 3 + 1] = 1;
      colorBuffer[i * 3 + 2] = 1;
    }

    faceGeometry.setAttribute('position', new THREE.BufferAttribute(posBuffer, 3));
    faceGeometry.setAttribute('uv', new THREE.BufferAttribute(uvBuffer, 2));
    faceGeometry.setAttribute('color', new THREE.BufferAttribute(colorBuffer, 3));

    const applyGeometryTopology = (buffers: PortraitIndexBuffers, useSculpt: boolean) => {
      const idx = useSculpt ? buffers.sculptIndices : buffers.solidIndices;
      const frontCount = useSculpt ? buffers.frontGroupCountSculpt : buffers.frontGroupCountSolid;
      faceGeometry.setIndex(new THREE.BufferAttribute(idx, 1));
      faceGeometry.clearGroups();
      faceGeometry.addGroup(0, frontCount, 0);
      faceGeometry.addGroup(frontCount, buffers.backGroupCount, 1);
      currentIndexTopology = useSculpt ? 'sculpt' : 'solid';
    };
    applyGeometryTopology(portraitBuffers, false);
    disposables.push(faceGeometry);

    const faceRoot = new THREE.Group();
    scene.add(faceRoot);

    const liveMatPair = [faceSkinLiveMat, backCraniumMat];
    const sculptMatPair = [faceSkinSculptMat, backCraniumMat];
    const wireMatPair = [faceWireMat, wireBackMat];

    const faceSurfaceMesh = new THREE.Mesh(faceGeometry, liveMatPair);
    faceSurfaceMesh.frustumCulled = false;
    faceSurfaceMesh.castShadow = !isSoftwareGl;
    faceSurfaceMesh.receiveShadow = !isSoftwareGl;
    faceRoot.add(faceSurfaceMesh);

    const pointGeo = new THREE.BufferGeometry();
    const landmarkPointView = new THREE.BufferAttribute(posBuffer, 3);
    pointGeo.setAttribute('position', landmarkPointView);
    pointGeo.setDrawRange(0, 468);
    const pointMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.022,
      transparent: true,
      opacity: 0.85,
    });
    const facePointsOverlay = new THREE.Points(pointGeo, pointMat);
    facePointsOverlay.visible = false;
    faceRoot.add(facePointsOverlay);
    disposables.push(pointGeo, pointMat);

    const headRig = new THREE.Group();
    faceRoot.add(headRig);

    const neckGeo = new THREE.CylinderGeometry(0.27, 0.34, 0.72, 24);
    const neckMesh = new THREE.Mesh(neckGeo, neckMat);
    neckMesh.position.set(0, -1.16, -0.46);
    neckMesh.rotation.x = 0.08;
    headRig.add(neckMesh);
    disposables.push(neckGeo);

    const createEyeAssembly = () => {
      const eyeGroup = new THREE.Group();
      const globeGroup = new THREE.Group();

      const scleraGeo = new THREE.SphereGeometry(1, 24, 20);
      const sclera = new THREE.Mesh(scleraGeo, scleraMat);
      globeGroup.add(sclera);

      const irisGeo = new THREE.CircleGeometry(0.46, 24);
      const iris = new THREE.Mesh(irisGeo, irisMat);
      iris.position.z = 0.91;
      globeGroup.add(iris);

      const pupilGeo = new THREE.CircleGeometry(0.22, 20);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.z = 0.92;
      globeGroup.add(pupil);

      const glintGeo = new THREE.CircleGeometry(0.08, 12);
      const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const glint = new THREE.Mesh(glintGeo, glintMat);
      glint.position.set(0.16, 0.16, 0.93);
      globeGroup.add(glint);

      eyeGroup.add(globeGroup);

      const upperLidPivot = new THREE.Group();
      const upperLidGeo = new THREE.SphereGeometry(1.09, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52);
      const upperLidMesh = new THREE.Mesh(upperLidGeo, eyelidMat);
      upperLidPivot.add(upperLidMesh);

      const lashGeo = new THREE.TorusGeometry(1.09, 0.045, 8, 24, Math.PI);
      const lashMesh = new THREE.Mesh(lashGeo, lashMat);
      lashMesh.rotation.x = Math.PI / 2;
      upperLidPivot.add(lashMesh);
      eyeGroup.add(upperLidPivot);

      const lowerLidPivot = new THREE.Group();
      const lowerLidGeo = new THREE.SphereGeometry(
        1.07,
        24,
        12,
        0,
        Math.PI * 2,
        Math.PI * 0.5,
        Math.PI * 0.5
      );
      const lowerLidMesh = new THREE.Mesh(lowerLidGeo, eyelidMat);
      lowerLidPivot.add(lowerLidMesh);
      eyeGroup.add(lowerLidPivot);

      disposables.push(scleraGeo, irisGeo, pupilGeo, glintGeo, glintMat, upperLidGeo, lashGeo, lowerLidGeo);
      return { eyeGroup, globeGroup, upperLidPivot, lowerLidPivot };
    };

    const leftEyeRig = createEyeAssembly();
    const rightEyeRig = createEyeAssembly();
    faceRoot.add(leftEyeRig.eyeGroup, rightEyeRig.eyeGroup);

    const mouthRig = new THREE.Group();
    const cavityGeo = new THREE.SphereGeometry(0.14, 20, 14);
    cavityGeo.scale(1.15, 0.72, 0.65);
    const cavityMesh = new THREE.Mesh(cavityGeo, oralCavityMat);
    cavityMesh.position.z = -0.04;
    mouthRig.add(cavityMesh);

    const upperTeethGeo = new THREE.CylinderGeometry(
      0.125,
      0.12,
      0.055,
      18,
      1,
      true,
      -Math.PI * 0.38,
      Math.PI * 0.76
    );
    const upperTeeth = new THREE.Mesh(upperTeethGeo, teethMat);
    upperTeeth.position.set(0, 0.032, -0.055);
    mouthRig.add(upperTeeth);

    const lowerTeethGeo = new THREE.CylinderGeometry(
      0.115,
      0.11,
      0.05,
      18,
      1,
      true,
      -Math.PI * 0.36,
      Math.PI * 0.72
    );
    const lowerTeeth = new THREE.Mesh(lowerTeethGeo, teethMat);
    lowerTeeth.position.set(0, -0.032, -0.06);
    mouthRig.add(lowerTeeth);
    faceRoot.add(mouthRig);
    disposables.push(cavityGeo, upperTeethGeo, lowerTeethGeo);

    const lipSegments: THREE.Mesh[] = [];
    const lipSegGeo = new THREE.CapsuleGeometry(0.017, 1, 6, 10);
    for (let i = 0; i < LIPS_OUTER_LOOP.length; i++) {
      const m = new THREE.Mesh(lipSegGeo, lipMat);
      faceRoot.add(m);
      lipSegments.push(m);
    }
    disposables.push(lipSegGeo);

    const browSegments: Array<{ mesh: THREE.Mesh; a: number; b: number }> = [];
    const browSegGeo = new THREE.CapsuleGeometry(0.015, 1, 6, 8);
    for (let i = 0; i < LEFT_BROW_INDICES.length - 1; i++) {
      const m = new THREE.Mesh(browSegGeo, browMat);
      faceRoot.add(m);
      browSegments.push({ mesh: m, a: LEFT_BROW_INDICES[i], b: LEFT_BROW_INDICES[i + 1] });
    }
    for (let i = 0; i < RIGHT_BROW_INDICES.length - 1; i++) {
      const m = new THREE.Mesh(browSegGeo, browMat);
      faceRoot.add(m);
      browSegments.push({ mesh: m, a: RIGHT_BROW_INDICES[i], b: RIGHT_BROW_INDICES[i + 1] });
    }
    disposables.push(browSegGeo);

    const currentPts: THREE.Vector3[] = Array.from(
      { length: PORTRAIT_VERTEX_COUNT },
      () => new THREE.Vector3()
    );
    const targetPts: THREE.Vector3[] = Array.from(
      { length: PORTRAIT_VERTEX_COUNT },
      () => new THREE.Vector3()
    );
    const targetUvs: Array<[number, number]> = Array.from(
      { length: PORTRAIT_VERTEX_COUNT },
      () => [0.5, 0.5]
    );

    const computeExtendedPortraitVertices = (
      pts: THREE.Vector3[],
      uvs: Array<[number, number]>
    ) => {
      const top = pts[10];
      const chin = pts[152];
      const leftSide = pts[234];
      const rightSide = pts[454];

      const cx = (top.x + chin.x + leftSide.x + rightSide.x) * 0.25;
      const cy = (top.y + chin.y + leftSide.y + rightSide.y) * 0.25;
      const cz = (top.z + chin.z + leftSide.z + rightSide.z) * 0.25;

      let cu = 0;
      let cv = 0;
      const ovalLen = FACE_OVAL_LOOP.length;
      for (let i = 0; i < ovalLen; i++) {
        const idx = FACE_OVAL_LOOP[i];
        cu += uvs[idx][0];
        cv += uvs[idx][1];
      }
      cu /= ovalLen;
      cv /= ovalLen;

      const faceW = Math.max(0.5, leftSide.distanceTo(rightSide));
      const faceH = Math.max(0.7, top.distanceTo(chin));
      const ring1Offset = 468;
      const ring2Offset = 468 + ovalLen;
      const backPoleIdx = 468 + ovalLen * 2;

      for (let i = 0; i < ovalLen; i++) {
        const ovalIdx = FACE_OVAL_LOOP[i];
        const op = pts[ovalIdx];
        const dx = op.x - cx;
        const dy = op.y - cy;
        const len = Math.max(0.08, Math.hypot(dx, dy));
        const nx = dx / len;
        const ny = dy / len;

        const isTop = ny > 0 ? ny : 0;
        const isBottom = ny < 0 ? -ny : 0;
        const outDist = faceW * 0.13 + isTop * faceH * 0.18 + isBottom * faceH * 0.08;
        const wrapZ = -0.22 - isTop * 0.04;

        pts[ring1Offset + i].set(op.x + nx * outDist, op.y + ny * outDist, op.z + wrapZ);

        const du = uvs[ovalIdx][0] - cu;
        const dv = uvs[ovalIdx][1] - cv;
        const uvBoost = 0.22 + isTop * 0.2 + isBottom * 0.08;
        uvs[ring1Offset + i][0] = THREE.MathUtils.clamp(uvs[ovalIdx][0] + du * uvBoost, 0.01, 0.99);
        uvs[ring1Offset + i][1] = THREE.MathUtils.clamp(uvs[ovalIdx][1] + dv * uvBoost, 0.01, 0.99);

        const r1 = pts[ring1Offset + i];
        pts[ring2Offset + i].set(
          cx + (r1.x - cx) * 0.88,
          cy + (r1.y - cy) * 0.92 + isTop * 0.06,
          cz - 0.62
        );
        uvs[ring2Offset + i][0] = uvs[ring1Offset + i][0];
        uvs[ring2Offset + i][1] = uvs[ring1Offset + i][1];
      }

      pts[backPoleIdx].set(cx, cy + faceH * 0.04, cz - 0.96);
      uvs[backPoleIdx][0] = cu;
      uvs[backPoleIdx][1] = cv;
    };

    const seedFromLandmarks = (lms: FaceLandmark[]) => {
      for (let i = 0; i < 468; i++) {
        const pt = lms[i] || lms[0];
        const x = (pt.x - 0.5) * 4.2;
        const y = -(pt.y - 0.48) * 4.2;
        const z = -(pt.z || 0) * 4.2 + 0.18;
        currentPts[i].set(x, y, z);
        targetPts[i].set(x, y, z);
        targetUvs[i][0] = pt.x;
        targetUvs[i][1] = 1 - pt.y;
      }
      computeExtendedPortraitVertices(targetPts, targetUvs);
      for (let i = 468; i < PORTRAIT_VERTEX_COUNT; i++) {
        currentPts[i].copy(targetPts[i]);
      }
    };
    seedFromLandmarks(restLandmarks);

    let hasMeshSeeded = false;
    let hasTriangulatedLive = false;
    let lastTexUploadMs = 0;
    let smoothLeftEar = 0.29;
    let smoothRightEar = 0.29;
    let smoothMouth = 0.08;
    let currentPalette: FaceColorPalette = { ...DEFAULT_FACE_PALETTE };
    let lastPaletteUpdateKey = '';
    let lastSampleResult: FaceMeshResult | null = null;
    let isIdlePhase = true;

    const drawSyncedTexture = (source: HTMLVideoElement | HTMLCanvasElement) => {
      if (!videoTexCtx) return;
      const srcW = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
      const srcH = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
      if (srcW <= 0 || srcH <= 0) return;
      if (videoTexCanvas.width !== srcW || videoTexCanvas.height !== srcH) {
        videoTexCanvas.width = srcW;
        videoTexCanvas.height = srcH;
      }
      videoTexCtx.drawImage(source, 0, 0, videoTexCanvas.width, videoTexCanvas.height);
      videoTex.needsUpdate = true;
    };

    const updateBackVertexColors = (palette: FaceColorPalette) => {
      const key = `${palette.hair}_${palette.skinShadow}`;
      if (key === lastPaletteUpdateKey) return;
      lastPaletteUpdateKey = key;

      _hairColor.set(palette.hair);
      _shadowColor.set(palette.skinShadow);

      const colAttr = faceGeometry.attributes.color as THREE.BufferAttribute;
      const ovalLen = FACE_OVAL_LOOP.length;
      const ring2Offset = 468 + ovalLen;
      const backPoleIdx = 468 + ovalLen * 2;

      for (let i = 0; i < ovalLen; i++) {
        const angle = (i / ovalLen) * Math.PI * 2;
        const lowerMix = THREE.MathUtils.clamp((-Math.cos(angle) - 0.15) * 0.72, 0, 0.55);
        _blendedBackColor.copy(_hairColor).lerp(_shadowColor, lowerMix);
        colAttr.setXYZ(
          ring2Offset + i,
          _blendedBackColor.r,
          _blendedBackColor.g,
          _blendedBackColor.b
        );
      }
      colAttr.setXYZ(backPoleIdx, _hairColor.r, _hairColor.g, _hairColor.b);
      colAttr.needsUpdate = true;
    };
    updateBackVertexColors(DEFAULT_FACE_PALETTE);

    const mapLandmarksToTarget = (res: FaceMeshResult) => {
      const lms = res.landmarks;
      if (!lms || lms.length < 468) return;

      const mirrored = isMirroredRef.current;
      const videoAspect = res.videoAspect || 4 / 3;

      const l10 = lms[10] || lms[0];
      const l152 = lms[152] || lms[0];
      const l234 = lms[234] || lms[0];
      const l454 = lms[454] || lms[0];

      const cx = (l10.x + l152.x + l234.x + l454.x) * 0.25;
      const cy = (l10.y + l152.y + l234.y + l454.y) * 0.25;
      const cz = ((l10.z || 0) + (l152.z || 0) + (l234.z || 0) + (l454.z || 0)) * 0.25;

      const widthSpan = Math.hypot((l454.x - l234.x) * videoAspect, l454.y - l234.y);
      const heightSpan = Math.hypot((l152.x - l10.x) * videoAspect, l152.y - l10.y);
      const refSpan = Math.max(0.12, widthSpan, heightSpan * 0.78);
      const normScale = THREE.MathUtils.clamp(1.28 / refSpan, 1.8, 7.6);

      for (let i = 0; i < 468; i++) {
        const pt = lms[i] || lms[0];
        const tx = (mirrored ? -(pt.x - cx) : pt.x - cx) * videoAspect * normScale;
        const ty = -(pt.y - cy) * normScale;
        const tz = -((pt.z || 0) - cz) * videoAspect * normScale * 1.15 + 0.18;
        targetPts[i].set(tx, ty, tz);
        targetUvs[i][0] = THREE.MathUtils.clamp(pt.x, 0.002, 0.998);
        targetUvs[i][1] = THREE.MathUtils.clamp(1 - pt.y, 0.002, 0.998);
      }

      const lEar = res.leftEyeAspectRatio ?? res.eyeAspectRatio ?? 0.28;
      const rEar = res.rightEyeAspectRatio ?? res.eyeAspectRatio ?? 0.28;
      if (lEar < 0.19) {
        const pinch = THREE.MathUtils.clamp((0.19 - lEar) / 0.07, 0, 0.28);
        const upperL = [160, 159, 158];
        const lowerL = [144, 145, 153];
        for (let k = 0; k < 3; k++) {
          const midY = (targetPts[upperL[k]].y + targetPts[lowerL[k]].y) * 0.5;
          targetPts[upperL[k]].y = THREE.MathUtils.lerp(targetPts[upperL[k]].y, midY, pinch);
          targetPts[lowerL[k]].y = THREE.MathUtils.lerp(targetPts[lowerL[k]].y, midY, pinch);
        }
      }
      if (rEar < 0.19) {
        const pinch = THREE.MathUtils.clamp((0.19 - rEar) / 0.07, 0, 0.28);
        const upperR = [385, 386, 387];
        const lowerR = [380, 374, 373];
        for (let k = 0; k < 3; k++) {
          const midY = (targetPts[upperR[k]].y + targetPts[lowerR[k]].y) * 0.5;
          targetPts[upperR[k]].y = THREE.MathUtils.lerp(targetPts[upperR[k]].y, midY, pinch);
          targetPts[lowerR[k]].y = THREE.MathUtils.lerp(targetPts[lowerR[k]].y, midY, pinch);
        }
      }

      const mouthDepthBoost = THREE.MathUtils.clamp((res.mouthOpenness - 0.14) * 0.12, 0, 0.055);
      if (mouthDepthBoost > 0) {
        for (let i = 0; i < LIPS_INNER_LOOP.length; i++) {
          targetPts[LIPS_INNER_LOOP[i]].z -= mouthDepthBoost;
        }
      }

      computeExtendedPortraitVertices(targetPts, targetUvs);

      if (
        !hasTriangulatedLive &&
        isStreamingRef.current &&
        Math.abs(res.faceOrientation.yaw) < 20 &&
        Math.abs(res.faceOrientation.pitch) < 20
      ) {
        const nextBuffers = buildExtendedPortraitIndices(lms);
        if (nextBuffers.solidIndices.length > 300) {
          portraitBuffers = nextBuffers;
          applyGeometryTopology(
            portraitBuffers,
            currentIndexTopology === 'sculpt'
          );
          hasTriangulatedLive = true;
        }
      }

      if (!hasMeshSeeded) {
        for (let i = 0; i < PORTRAIT_VERTEX_COUNT; i++) {
          currentPts[i].copy(targetPts[i]);
        }
        hasMeshSeeded = true;
      }
    };

    const applyMaterialState = (
      mode: FaceTwinMode,
      palette: FaceColorPalette,
      idleStandby: boolean
    ) => {
      _colorTarget.set(palette.skin);
      faceSkinSculptMat.color.lerp(_colorTarget, 0.25);
      eyelidMat.color.lerp(_colorTarget, 0.28);

      _colorTarget.set(palette.skinShadow);
      neckMat.color.lerp(_colorTarget, 0.24);

      _colorTarget.set(palette.lips);
      lipMat.color.lerp(_colorTarget, 0.28);

      _colorTarget.set(palette.eyebrows);
      browMat.color.lerp(_colorTarget, 0.25);
      lashMat.color.lerp(_colorTarget, 0.25);

      _colorTarget.set(palette.iris);
      irisMat.color.lerp(_colorTarget, 0.28);

      updateBackVertexColors(palette);

      const effectiveMode: FaceTwinMode =
        idleStandby && mode === 'live' ? 'sculpt' : mode;
      const wantSculptTopology = effectiveMode === 'sculpt';
      if (wantSculptTopology !== (currentIndexTopology === 'sculpt')) {
        applyGeometryTopology(portraitBuffers, wantSculptTopology);
      }

      if (effectiveMode === 'live') {
        faceSurfaceMesh.material = liveMatPair;
        facePointsOverlay.visible = false;
        lipSegments.forEach((m) => {
          m.visible = false;
        });
        browSegments.forEach((b) => {
          b.mesh.visible = false;
        });
        headRig.visible = true;
        leftEyeRig.eyeGroup.visible = false;
        rightEyeRig.eyeGroup.visible = false;
        mouthRig.visible = false;
      } else if (effectiveMode === 'sculpt') {
        faceSurfaceMesh.material = sculptMatPair;
        facePointsOverlay.visible = false;
        lipSegments.forEach((m) => {
          m.visible = true;
        });
        browSegments.forEach((b) => {
          b.mesh.visible = true;
        });
        headRig.visible = true;
        leftEyeRig.eyeGroup.visible = true;
        rightEyeRig.eyeGroup.visible = true;
        mouthRig.visible = true;
      } else {
        faceSurfaceMesh.material = wireMatPair;
        facePointsOverlay.visible = true;
        lipSegments.forEach((m) => {
          m.visible = false;
        });
        browSegments.forEach((b) => {
          b.mesh.visible = false;
        });
        headRig.visible = false;
        leftEyeRig.eyeGroup.visible = false;
        rightEyeRig.eyeGroup.visible = false;
        mouthRig.visible = false;
      }
    };

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    const afterDraw = (cb: () => void) => {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;

      const dt = Math.min(0.05, Math.max(0.004, clock.getDelta()));
      const elapsed = clock.elapsedTime;
      const now = performance.now();

      const res = faceResultRef.current;
      const streaming = isStreamingRef.current;
      const videoEl = videoRef.current;
      const syncedCanvas = getSyncedFaceFrameCanvas();

      if (streaming && res && res.landmarks.length >= 468) {
        isIdlePhase = false;
        if (res !== lastSampleResult) {
          lastSampleResult = res;
          const texSource =
            syncedCanvas && syncedCanvas.width > 0
              ? syncedCanvas
              : videoEl && videoEl.readyState >= 2
                ? videoEl
                : null;
          if (texSource) {
            drawSyncedTexture(texSource);
            lastTexUploadMs = now;
          }
          mapLandmarksToTarget(res);
          if (res.palette) {
            currentPalette = res.palette;
          }
        } else if (videoEl && videoEl.readyState >= 2 && !syncedCanvas && now - lastTexUploadMs > 48) {
          lastTexUploadMs = now;
          drawSyncedTexture(videoEl);
        }

        const targetLEar = res.leftEyeAspectRatio ?? res.eyeAspectRatio ?? 0.28;
        const targetREar = res.rightEyeAspectRatio ?? res.eyeAspectRatio ?? 0.28;
        const targetMouth = res.mouthOpenness ?? 0.1;

        smoothLeftEar = THREE.MathUtils.damp(smoothLeftEar, targetLEar, 28, dt);
        smoothRightEar = THREE.MathUtils.damp(smoothRightEar, targetREar, 28, dt);
        smoothMouth = THREE.MathUtils.damp(smoothMouth, targetMouth, 26, dt);
      } else {
        isIdlePhase = true;
        hasTriangulatedLive = false;
        const idleYaw = Math.sin(elapsed * 0.75) * 0.028;
        const idleMouth = 0.06 + Math.max(0, Math.sin(elapsed * 1.1)) * 0.09;
        const blinkPulse = elapsed % 3.8 > 3.64 ? 0.14 : 0.29;
        const idleLms = buildCanonical468Face(0.5 + idleYaw, 0.48, blinkPulse, blinkPulse, idleMouth);
        for (let i = 0; i < 468; i++) {
          const pt = idleLms[i];
          const tx = (pt.x - 0.5) * 4.4;
          const ty = -(pt.y - 0.48) * 4.4;
          const tz = -(pt.z || 0) * 4.4 + 0.16;
          targetPts[i].set(tx, ty, tz);
          targetUvs[i][0] = pt.x;
          targetUvs[i][1] = 1 - pt.y;
        }
        computeExtendedPortraitVertices(targetPts, targetUvs);
        smoothLeftEar = THREE.MathUtils.damp(smoothLeftEar, blinkPulse, 20, dt);
        smoothRightEar = THREE.MathUtils.damp(smoothRightEar, blinkPulse, 20, dt);
        smoothMouth = THREE.MathUtils.damp(smoothMouth, idleMouth, 18, dt);
        currentPalette = DEFAULT_FACE_PALETTE;
      }

      const smoothing = smoothingRef.current;
      const dampRate = smoothing && !isIdlePhase ? 34 : isIdlePhase ? 12 : 120;
      const posAttr = faceGeometry.attributes.position as THREE.BufferAttribute;
      const uvAttr = faceGeometry.attributes.uv as THREE.BufferAttribute;

      for (let i = 0; i < PORTRAIT_VERTEX_COUNT; i++) {
        if (!smoothing && !isIdlePhase) {
          currentPts[i].copy(targetPts[i]);
        } else {
          currentPts[i].x = THREE.MathUtils.damp(currentPts[i].x, targetPts[i].x, dampRate, dt);
          currentPts[i].y = THREE.MathUtils.damp(currentPts[i].y, targetPts[i].y, dampRate, dt);
          currentPts[i].z = THREE.MathUtils.damp(currentPts[i].z, targetPts[i].z, dampRate, dt);
        }
        posAttr.setXYZ(i, currentPts[i].x, currentPts[i].y, currentPts[i].z);
        uvAttr.setXY(i, targetUvs[i][0], targetUvs[i][1]);
      }
      posAttr.needsUpdate = true;
      uvAttr.needsUpdate = true;
      faceGeometry.computeVertexNormals();

      _headUp.subVectors(currentPts[10], currentPts[152]);
      if (_headUp.lengthSq() < 0.001) _headUp.set(0, 1, 0);
      _headUp.normalize();

      _headRight.subVectors(currentPts[454], currentPts[234]);
      if (_headRight.lengthSq() < 0.001) _headRight.set(1, 0, 0);
      _headRight.normalize();
      if (isMirroredRef.current && !isIdlePhase && _headRight.x < 0) {
        _headRight.negate();
      }

      _headFwd.crossVectors(_headRight, _headUp);
      if (_headFwd.lengthSq() < 0.001) _headFwd.set(0, 0, 1);
      _headFwd.normalize();
      _headRight.crossVectors(_headUp, _headFwd).normalize();

      _rotMat.makeBasis(_headRight, _headUp, _headFwd);
      _headQuat.setFromRotationMatrix(_rotMat);

      _vecMid
        .copy(currentPts[10])
        .add(currentPts[152])
        .add(currentPts[234])
        .add(currentPts[454])
        .multiplyScalar(0.25);
      const faceW = Math.max(0.65, currentPts[454].distanceTo(currentPts[234]));
      const faceH = Math.max(0.85, currentPts[10].distanceTo(currentPts[152]));

      headRig.position.copy(_vecMid);
      headRig.quaternion.copy(_headQuat);
      headRig.scale.set(faceW / 1.32, faceH / 1.72, faceW / 1.32);

      const effectiveSculpt =
        twinModeRef.current === 'sculpt' || (isIdlePhase && twinModeRef.current === 'live');

      if (effectiveSculpt) {
        const updateEyeRig = (
          rig: ReturnType<typeof createEyeAssembly>,
          outerIdx: number,
          innerIdx: number,
          earVal: number
        ) => {
          _vecA.copy(currentPts[outerIdx]);
          _vecB.copy(currentPts[innerIdx]);
          _vecMid.addVectors(_vecA, _vecB).multiplyScalar(0.5);
          const eyeWidth = Math.max(0.08, _vecA.distanceTo(_vecB));
          const eyeRadius = eyeWidth * 0.46;

          rig.eyeGroup.position.copy(_vecMid).addScaledVector(_headFwd, -eyeRadius * 0.56);
          rig.eyeGroup.quaternion.copy(_headQuat);
          rig.eyeGroup.scale.setScalar(eyeRadius);

          const openRatio = THREE.MathUtils.clamp((earVal - 0.165) / 0.145, 0, 1);
          const closeRatio = 1 - openRatio;

          rig.upperLidPivot.rotation.x = THREE.MathUtils.lerp(-0.92, 0.14, closeRatio);
          rig.lowerLidPivot.rotation.x = THREE.MathUtils.lerp(0.88, 0.22, closeRatio);
        };

        const leftOuter = isMirroredRef.current && !isIdlePhase ? 133 : 33;
        const leftInner = isMirroredRef.current && !isIdlePhase ? 33 : 133;
        const rightOuter = isMirroredRef.current && !isIdlePhase ? 362 : 263;
        const rightInner = isMirroredRef.current && !isIdlePhase ? 263 : 362;

        updateEyeRig(leftEyeRig, leftOuter, leftInner, smoothLeftEar);
        updateEyeRig(rightEyeRig, rightOuter, rightInner, smoothRightEar);

        _vecA.copy(currentPts[61]);
        _vecB.copy(currentPts[291]);
        _vecC.addVectors(currentPts[13], currentPts[14]).multiplyScalar(0.5);
        const mouthW = Math.max(0.14, _vecA.distanceTo(_vecB));
        const mouthNormScale = mouthW / 0.34;
        const mouthOpenRatio = THREE.MathUtils.clamp((smoothMouth - 0.04) / 0.36, 0, 1);

        mouthRig.position.copy(_vecC).addScaledVector(_headFwd, -0.045);
        mouthRig.quaternion.copy(_headQuat);
        mouthRig.scale.setScalar(mouthNormScale);
        cavityMesh.scale.set(1.15, 0.45 + mouthOpenRatio * 1.15, 0.65);
        upperTeeth.visible = mouthOpenRatio > 0.08;
        lowerTeeth.visible = mouthOpenRatio > 0.14;
        lowerTeeth.position.y = -0.025 - mouthOpenRatio * 0.068;

        for (let i = 0; i < LIPS_OUTER_LOOP.length; i++) {
          const ia = LIPS_OUTER_LOOP[i];
          const ib = LIPS_OUTER_LOOP[(i + 1) % LIPS_OUTER_LOOP.length];
          _vecA.copy(currentPts[ia]);
          _vecB.copy(currentPts[ib]);
          _vecMid.addVectors(_vecA, _vecB).multiplyScalar(0.5);
          _vecDir.subVectors(_vecB, _vecA);
          const segLen = Math.max(0.004, _vecDir.length());
          _vecDir.divideScalar(segLen);
          const seg = lipSegments[i];
          seg.position.copy(_vecMid);
          seg.quaternion.setFromUnitVectors(_upAxis, _vecDir);
          seg.scale.set(1, segLen * 0.96, 1);
        }

        for (let i = 0; i < browSegments.length; i++) {
          const br = browSegments[i];
          _vecA.copy(currentPts[br.a]);
          _vecB.copy(currentPts[br.b]);
          _vecMid.addVectors(_vecA, _vecB).multiplyScalar(0.5);
          _vecDir.subVectors(_vecB, _vecA);
          const segLen = Math.max(0.004, _vecDir.length());
          _vecDir.divideScalar(segLen);
          br.mesh.position.copy(_vecMid);
          br.mesh.quaternion.setFromUnitVectors(_upAxis, _vecDir);
          br.mesh.scale.set(1, segLen * 0.96, 1);
        }
      }

      applyMaterialState(twinModeRef.current, currentPalette, isIdlePhase);

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

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(entry.contentRect.width, 280);
        const h = Math.max(entry.contentRect.height, 280);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      controls.dispose();
      for (const item of disposables) {
        item.dispose();
      }
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [videoRef]);

  const palette = faceResult?.palette || DEFAULT_FACE_PALETTE;
  const earValue = faceResult?.eyeAspectRatio ?? 0.28;
  const leftEar = faceResult?.leftEyeAspectRatio ?? earValue;
  const rightEar = faceResult?.rightEyeAspectRatio ?? earValue;
  const mouthRatio = faceResult?.mouthOpenness ?? 0.12;
  const yaw = faceResult?.faceOrientation.yaw ?? 0;
  const pitch = faceResult?.faceOrientation.pitch ?? 0;
  const roll = faceResult?.faceOrientation.roll ?? 0;

  return (
    <div className="comic-panel overflow-hidden bg-[#0b1120] border-2 border-[#121829] flex flex-col">
      <div className="relative w-full h-[410px] sm:h-[460px]">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-col gap-1.5">
          <div className="px-3 py-1.5 rounded-xl bg-[#0f172a]/90 border border-[#334155] text-white text-xs font-black tracking-wide">
            <span className="text-[#00f0ff]">3D Face Twin</span>
            <span className="mx-1.5 text-[#64748b]">·</span>
            <span>{isStreaming && faceResult ? 'Exact Live Mirror' : 'Standby Sculpt'}</span>
          </div>
          <div className="px-3 py-1 rounded-lg bg-[#0f172a]/85 border border-[#334155] text-[11px] font-mono text-[#e2e8f0] tabular-nums">
            <span>L-EAR {leftEar.toFixed(2)}</span>
            <span className="mx-1.5 text-[#64748b]">/</span>
            <span>R-EAR {rightEar.toFixed(2)}</span>
            <span className="mx-1.5 text-[#64748b]">·</span>
            <span>Mouth {mouthRatio.toFixed(2)}</span>
          </div>
        </div>

        <div className="pointer-events-none absolute top-3 right-3 z-10 hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#0f172a]/85 border border-[#334155] text-[11px] font-mono text-[#cbd5e1] tabular-nums">
          <span>Y {yaw}°</span>
          <span className="text-[#64748b]">·</span>
          <span>P {pitch}°</span>
          <span className="text-[#64748b]">·</span>
          <span>R {roll}°</span>
        </div>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center w-[94%] max-w-[640px]">
          <button
            type="button"
            onClick={() => setHudOpen((v) => !v)}
            className="mb-1.5 px-3 py-1 rounded-t-lg bg-[#0f172a] border border-[#334155] text-[11px] font-extrabold text-[#cbd5e1] hover:text-white cursor-pointer flex items-center gap-1.5"
          >
            <SlidersHorizontal className="h-3 w-3 text-[#00f0ff]" />
            <span>{hudOpen ? 'Hide Controls' : 'Show Controls'}</span>
          </button>

          {hudOpen && (
            <div className="w-full rounded-xl bg-[#0f172a]/95 border border-[#334155] p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-lg">
              <div className="flex items-center gap-1 bg-[#1e293b] p-1 rounded-lg">
                {(
                  [
                    { id: 'live', label: 'Exact Live' },
                    { id: 'sculpt', label: 'True-Tone 3D' },
                    { id: 'wireframe', label: '468 Mesh' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setTwinMode(m.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-extrabold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      twinMode === m.id
                        ? 'bg-[#00f0ff] text-[#0f172a]'
                        : 'text-[#cbd5e1] hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-[#1e293b]/80 border border-[#334155]">
                <Palette className="h-3.5 w-3.5 text-[#00f0ff]" />
                {[
                  { name: 'Skin', hex: palette.skin },
                  { name: 'Lips', hex: palette.lips },
                  { name: 'Iris', hex: palette.iris },
                  { name: 'Hair', hex: palette.hair },
                ].map((sw) => (
                  <div key={sw.name} className="flex items-center gap-1" title={`${sw.name}: ${sw.hex}`}>
                    <span
                      className="h-3.5 w-3.5 rounded-sm border border-white/40 shrink-0"
                      style={{ backgroundColor: sw.hex }}
                    />
                    <span className="text-[10px] font-bold text-[#cbd5e1] hidden sm:inline">{sw.name}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSmoothingEnabled((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1 ${
                    smoothingEnabled
                      ? 'bg-[#1e293b] border-[#00f0ff] text-[#00f0ff]'
                      : 'bg-[#1e293b] border-[#334155] text-[#94a3b8]'
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  <span>{smoothingEnabled ? 'Smooth' : 'Raw'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => resetCamRef.current?.()}
                  className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-[#1e293b] border border-[#334155] text-[#e2e8f0] hover:text-white cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
                  title="Reset 3D Camera"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-2.5 bg-[#0f172a] border-t border-[#1e293b] flex flex-wrap items-center justify-between gap-2 text-xs text-[#94a3b8]">
        <div className="flex items-center gap-2 font-bold">
          <Eye className="h-3.5 w-3.5 text-[#00f0ff]" />
          <span>Drag to orbit 360°</span>
          <span aria-hidden="true">·</span>
          <span>Pixel-synced portrait texture + hairline wrap + blink &amp; mouth motion</span>
        </div>
        <span className="font-mono text-[11px] text-[#cbd5e1] tabular-nums">
          EAR {earValue.toFixed(3)} · Mouth {mouthRatio.toFixed(2)}
        </span>
      </div>
    </div>
  );
};
