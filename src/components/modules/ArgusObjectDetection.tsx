import React, { useEffect, useState, useRef, useCallback } from 'react';
import { CameraViewport } from '../common/CameraViewport';
import { useCamera } from '../../context/CameraContext';
import {
  DetectedObject,
  VisionEvent,
  ArgusCustomClass,
  ArgusTrainingProgress,
  ArgusUnifiedDatasetModel,
} from '../../types';
import {
  initArgusModel,
  detectObjects,
  getArgusMetadata,
  addCustomClass,
  trainClassSample,
  getCustomClasses,
  removeCustomClass,
  amplifyUnifiedDataset,
  trainUnifiedArgusDataset,
  getTrainedUnifiedModel,
  resetUnifiedArgusModel,
  getUnifiedDatasetSampleCount,
} from '../../services/argusDetector';
import { soundFx } from '../../services/soundFx';
import {
  Sliders,
  Volume2,
  VolumeX,
  Camera,
  Database,
  Cpu,
  Plus,
  Trash2,
  Sparkles,
  Award,
  Layers,
  CheckCircle,
  Brain,
  Zap,
  RotateCcw,
  Radio,
} from 'lucide-react';

interface ArgusProps {
  onLogEvent: (event: Omit<VisionEvent, 'id' | 'timestamp'>) => void;
}

export const ArgusObjectDetection: React.FC<ArgusProps> = ({ onLogEvent }) => {
  const { videoRef, isStreaming, isMirrored, captureSnapshot } = useCamera();
  const [modelReady, setModelReady] = useState(false);
  const [backbone, setBackbone] = useState<'mobilenet_v2' | 'lite_mobilenet_v2'>('mobilenet_v2');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.45);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [totalDetectedCount, setTotalDetectedCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [snapshotSuccess, setSnapshotSuccess] = useState(false);

  const [customClassesList, setCustomClassesList] = useState<ArgusCustomClass[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [newClassColor, setNewClassColor] = useState('#a855f7');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [trainingNotice, setTrainingNotice] = useState<string>('');
  const [autoCollecting, setAutoCollecting] = useState(false);
  const [isDeepTraining, setIsDeepTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState<ArgusTrainingProgress | null>(null);
  const [unifiedModel, setUnifiedModel] = useState<ArgusUnifiedDatasetModel | null>(() =>
    getTrainedUnifiedModel()
  );
  const [datasetSampleCount, setDatasetSampleCount] = useState<number>(() =>
    getUnifiedDatasetSampleCount()
  );

  const trainingTimerRef = useRef<number | null>(null);
  const snapshotTimerRef = useRef<number | null>(null);
  const autoCollectTimerRef = useRef<number | null>(null);
  const detectedObjectsRef = useRef<DetectedObject[]>([]);

  useEffect(() => {
    detectedObjectsRef.current = detectedObjects;
  }, [detectedObjects]);

  useEffect(() => {
    return () => {
      if (trainingTimerRef.current !== null) window.clearTimeout(trainingTimerRef.current);
      if (snapshotTimerRef.current !== null) window.clearTimeout(snapshotTimerRef.current);
      if (autoCollectTimerRef.current !== null) window.clearInterval(autoCollectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setModelReady(false);
    initArgusModel(backbone).then((success) => {
      if (mounted) {
        setModelReady(success);
        setCustomClassesList(getCustomClasses());
        onLogEvent({
          module: 'argus',
          title: `ARGUS Engine Loaded (${backbone})`,
          description: success
            ? 'MobileNetV2 pre-trained on 14.2M ImageNet + 1.5M COCO instances active.'
            : 'Running high-speed local optical fallback detector.',
          type: 'success',
        });
      }
    });

    return () => {
      mounted = false;
    };
  }, [backbone, onLogEvent]);

  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    soundFx.playTargetLock();
  }, [soundEnabled]);

  useEffect(() => {
    let cancelled = false;
    let animId = 0;
    let lastInferenceTime = 0;
    let busy = false;

    const runDetection = async (time: number) => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && isStreaming && video.readyState >= 2 && !busy && time - lastInferenceTime > 65) {
        lastInferenceTime = time;
        busy = true;
        try {
          const objects = await detectObjects(video, confidenceThreshold);
          if (cancelled) return;
          setDetectedObjects(objects);

          if (objects.length > 0) {
            setTotalDetectedCount((prev) => prev + objects.length);
            const counts: Record<string, number> = {};
            objects.forEach((obj) => {
              counts[obj.category] = (counts[obj.category] || 0) + 1;
            });
            setCategoryCounts(counts);

            if (soundEnabled && Math.random() < 0.1) {
              playBeep();
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
  }, [videoRef, isStreaming, confidenceThreshold, soundEnabled, playBeep]);

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    const created = addCustomClass(newClassName.trim(), newClassColor);
    setCustomClassesList(getCustomClasses());
    setSelectedClassId(created.id);
    setNewClassName('');
    onLogEvent({
      module: 'argus',
      title: 'Custom Class Created',
      description: `Added "${created.name}" to ARGUS on-device classifier memory.`,
      type: 'info',
    });
  };

  const showTrainingNotice = useCallback((msg: string, ms = 3500) => {
    setTrainingNotice(msg);
    if (trainingTimerRef.current !== null) window.clearTimeout(trainingTimerRef.current);
    trainingTimerRef.current = window.setTimeout(() => setTrainingNotice(''), ms);
  }, []);

  const captureBurstForSelected = useCallback(
    (augmentCount: number, silentLog = false) => {
      const video = videoRef.current;
      if (!video || !isStreaming || video.videoWidth === 0) {
        showTrainingNotice('Please start webcam before collecting dataset samples.', 3000);
        return false;
      }
      if (!selectedClassId) {
        showTrainingNotice('Select a target class to add samples into the unified dataset.', 3000);
        return false;
      }

      let trainBbox = {
        x: video.videoWidth * 0.25,
        y: video.videoHeight * 0.2,
        width: video.videoWidth * 0.5,
        height: video.videoHeight * 0.6,
      };
      const liveDet = detectedObjectsRef.current;
      if (liveDet.length > 0) {
        trainBbox = liveDet[0].bbox;
      }

      const totalSamples = trainClassSample(selectedClassId, video, trainBbox, augmentCount);
      const updatedClasses = getCustomClasses();
      setCustomClassesList(updatedClasses);
      setDatasetSampleCount(getUnifiedDatasetSampleCount());
      const targetClass = updatedClasses.find((c) => c.id === selectedClassId);
      showTrainingNotice(
        `+${augmentCount} multi-transform vectors added to "${targetClass?.name}" (Class Total: ${totalSamples})`,
        3500
      );

      if (!silentLog) {
        onLogEvent({
          module: 'argus',
          title: 'Unified Dataset Expanded',
          description: `Captured +${augmentCount} augmented 96D samples & background negatives for ${targetClass?.name}.`,
          type: 'success',
        });
      }
      return true;
    },
    [videoRef, isStreaming, selectedClassId, showTrainingNotice, onLogEvent]
  );

  useEffect(() => {
    if (!autoCollecting) {
      if (autoCollectTimerRef.current !== null) {
        window.clearInterval(autoCollectTimerRef.current);
        autoCollectTimerRef.current = null;
      }
      return;
    }

    if (!isStreaming || !selectedClassId) {
      setAutoCollecting(false);
      return;
    }

    let ticks = 0;
    autoCollectTimerRef.current = window.setInterval(() => {
      ticks++;
      const ok = captureBurstForSelected(45, true);
      if (!ok || ticks >= 10) {
        setAutoCollecting(false);
        if (ticks >= 10) {
          showTrainingNotice('Continuous burst finished (+450 multi-angle samples collected in dataset).', 4000);
        }
      }
    }, 240);

    return () => {
      if (autoCollectTimerRef.current !== null) {
        window.clearInterval(autoCollectTimerRef.current);
        autoCollectTimerRef.current = null;
      }
    };
  }, [autoCollecting, isStreaming, selectedClassId, captureBurstForSelected, showTrainingNotice]);

  const handleTrainLiveSample = () => {
    captureBurstForSelected(80, false);
  };

  const handleAmplifyDataset = () => {
    const added = amplifyUnifiedDataset(4);
    setCustomClassesList(getCustomClasses());
    setDatasetSampleCount(getUnifiedDatasetSampleCount());
    if (added > 0) {
      showTrainingNotice(`Amplified single dataset by +${added} mixup & lighting perturbations.`, 4000);
      onLogEvent({
        module: 'argus',
        title: 'Dataset Augmentation Boost',
        description: `Generated +${added} augmented vectors across all classes in the single dataset.`,
        type: 'info',
      });
    } else {
      showTrainingNotice('Capture at least one frame first before amplifying the dataset.', 3000);
    }
  };

  const handleRunUnifiedTraining = async () => {
    if (isDeepTraining) return;
    setAutoCollecting(false);
    setIsDeepTraining(true);
    setTrainingProgress({
      epoch: 0,
      totalEpochs: 3000,
      loss: 1,
      accuracy: 0,
      datasetSize: getUnifiedDatasetSampleCount(),
      phase: 'Consolidating Unified Single Dataset...',
    });

    try {
      const trained = await trainUnifiedArgusDataset((prog) => {
        setTrainingProgress(prog);
      }, 3000);
      setUnifiedModel(trained);
      setDatasetSampleCount(getUnifiedDatasetSampleCount());
      showTrainingNotice(
        `Unified dataset trained (${trained.epochsCompleted.toLocaleString()} epochs, ${trained.totalAugmentedSamples.toLocaleString()} dataset samples, ${trained.validationAccuracy}% val accuracy).`,
        5000
      );
      onLogEvent({
        module: 'argus',
        title: 'ARGUS Single-Dataset Training Complete',
        description: `Trained 96->32->K neural head across ${trained.epochsCompleted.toLocaleString()} epochs (${trained.validationAccuracy}% validation accuracy).`,
        type: 'success',
      });
    } catch (err) {
      showTrainingNotice(err instanceof Error ? err.message : 'Unable to train unified dataset.', 4000);
    } finally {
      setIsDeepTraining(false);
    }
  };

  const handleResetUnifiedModel = () => {
    resetUnifiedArgusModel();
    setUnifiedModel(null);
    setTrainingProgress(null);
    showTrainingNotice('Reset trained unified classifier weights.', 3000);
  };

  const handleRemoveClass = (id: string, name: string) => {
    removeCustomClass(id);
    setCustomClassesList(getCustomClasses());
    setDatasetSampleCount(getUnifiedDatasetSampleCount());
    setUnifiedModel(getTrainedUnifiedModel());
    if (selectedClassId === id) setSelectedClassId('');
    onLogEvent({
      module: 'argus',
      title: 'Custom Class Removed',
      description: `Removed "${name}" from ARGUS active classifier memory.`,
      type: 'alert',
    });
  };

  const handleDrawOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const scaleX = width / video.videoWidth;
    const scaleY = height / video.videoHeight;

    detectedObjects.forEach((obj) => {
      const w = obj.bbox.width * scaleX;
      const h = obj.bbox.height * scaleY;
      const x = isMirrored ? width - (obj.bbox.x * scaleX + w) : obj.bbox.x * scaleX;
      const y = obj.bbox.y * scaleY;

      ctx.strokeStyle = '#121829';
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, w, h);

      ctx.strokeStyle = obj.category === 'custom' ? '#a855f7' : obj.category === 'person' ? '#00f0ff' : '#ffd000';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

      const isCustom = obj.category === 'custom';
      const labelText = `${obj.label.toUpperCase()} · ${obj.confidence}%`;
      ctx.font = 'bold 14px Nunito, sans-serif';
      const textWidth = ctx.measureText(labelText).width;
      const labelX = Math.max(0, Math.min(width - (textWidth + 18), x));
      const labelY = Math.max(0, y - 28);

      ctx.fillStyle = '#121829';
      ctx.fillRect(labelX + 2, labelY + 2, textWidth + 18, 26);

      ctx.fillStyle = isCustom ? '#a855f7' : obj.category === 'person' ? '#00f0ff' : '#ffd000';
      ctx.fillRect(labelX, labelY, textWidth + 18, 26);
      ctx.lineWidth = 2;
      ctx.strokeRect(labelX, labelY, textWidth + 18, 26);

      ctx.fillStyle = isCustom ? '#ffffff' : '#121829';
      ctx.fillText(labelText, labelX + 9, labelY + 18);
    });
  };

  const handleTakeSnapshot = () => {
    const dataUrl = captureSnapshot();
    if (dataUrl) {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `argus-frame-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSnapshotSuccess(true);
      if (snapshotTimerRef.current !== null) window.clearTimeout(snapshotTimerRef.current);
      snapshotTimerRef.current = window.setTimeout(() => setSnapshotSuccess(false), 2000);
      onLogEvent({
        module: 'argus',
        title: 'Snapshot Captured',
        description: `Exported visual frame with ${detectedObjects.length} active detections.`,
        type: 'info',
      });
    }
  };

  const metadata = getArgusMetadata();

  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-[#121829]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2
              className="text-2xl sm:text-3xl text-[#121829]"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              ARGUS · Deep Object Detection &amp; Training
            </h2>
            <span className="text-xs font-black px-2.5 py-1 rounded-full border-2 border-[#121829] bg-[#ffd000] text-[#121829] shadow-[1.5px_1.5px_0px_#121829]">
              15M+ DATASETS
            </span>
          </div>
          <p className="text-sm font-bold text-[#121829]/75 mt-1">
            Pre-trained on massive benchmark datasets with real-time on-device transfer learning.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`comic-btn px-4 py-2 rounded-xl text-xs uppercase cursor-pointer ${
              soundEnabled ? 'comic-btn-yellow' : 'comic-btn-white'
            }`}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span>Audio Ping: {soundEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={handleTakeSnapshot}
            className="comic-btn comic-btn-primary px-4 py-2 rounded-xl text-xs uppercase cursor-pointer"
          >
            <Camera className="h-4 w-4" />
            <span>{snapshotSuccess ? 'Saved Frame!' : 'Capture'}</span>
          </button>
        </div>
      </div>

      <div className="comic-panel p-5 bg-white space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b-2 border-[#121829]">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00f0ff] border-2 border-[#121829] shadow-[1.5px_1.5px_0px_#121829]">
              <Database className="h-4 w-4 text-[#121829]" />
            </div>
            <div>
              <span
                className="text-base text-[#121829] block"
                style={{ fontFamily: "'Bagel Fat One', cursive" }}
              >
                Deep Neural Lineage · Trained on Millions of Data Points
              </span>
              <span className="text-xs font-black text-[#ff462b] uppercase">
                {metadata.parametersCount} · Local WebGL Hardware Acceleration
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-[#121829] uppercase">Backbone:</span>
            <div className="inline-flex rounded-xl border-2 border-[#121829] bg-[#faf6ee] p-1 shadow-[2px_2px_0px_#121829]">
              <button
                onClick={() => setBackbone('mobilenet_v2')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                  backbone === 'mobilenet_v2'
                    ? 'bg-[#ff462b] text-white border-2 border-[#121829] shadow-[1px_1px_0px_#121829]'
                    : 'text-[#121829] dark:text-[#f8fafc] hover:bg-white dark:hover:bg-[#182238]'
                }`}
              >
                MobileNetV2 (Full)
              </button>
              <button
                onClick={() => setBackbone('lite_mobilenet_v2')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                  backbone === 'lite_mobilenet_v2'
                    ? 'bg-[#ff462b] text-white border-2 border-[#121829] shadow-[1px_1px_0px_#121829]'
                    : 'text-[#121829] dark:text-[#f8fafc] hover:bg-white dark:hover:bg-[#182238]'
                }`}
              >
                MobileNetV2 (Lite)
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-extrabold text-[#121829] dark:text-[#f8fafc]">
          <div className="p-3 rounded-xl border-2 border-[#121829] dark:border-[#27354f] bg-[#faf6ee] dark:bg-[#182238] shadow-[1.5px_1.5px_0px_#121829]">
            <span className="text-xs font-black text-[#121829]/60 dark:text-[#94a3b8] uppercase block">Training Dataset 1</span>
            <span className="font-mono text-sm text-[#ff462b] font-black block mt-0.5">14,197,122 Images</span>
            <span className="text-xs font-bold text-[#121829]/75 dark:text-[#cbd5e1]">ImageNet-1k multi-scale visual features</span>
          </div>

          <div className="p-3 rounded-xl border-2 border-[#121829] dark:border-[#27354f] bg-[#faf6ee] dark:bg-[#182238] shadow-[1.5px_1.5px_0px_#121829]">
            <span className="text-xs font-black text-[#121829]/60 dark:text-[#94a3b8] uppercase block">Training Dataset 2</span>
            <span className="font-mono text-sm text-[#0284c7] dark:text-[#00f0ff] font-black block mt-0.5">1,500,000+ Annotations</span>
            <span className="text-xs font-bold text-[#121829]/75 dark:text-[#cbd5e1]">MS COCO object segmentations across 80 classes</span>
          </div>

          <div className="p-3 rounded-xl border-2 border-[#121829] dark:border-[#27354f] bg-[#faf6ee] dark:bg-[#182238] shadow-[1.5px_1.5px_0px_#121829]">
            <span className="text-xs font-black text-[#121829]/60 dark:text-[#94a3b8] uppercase block">Active Recognition Index</span>
            <span className="font-mono text-sm text-[#ff2a85] font-black block mt-0.5">{metadata.totalClasses} Total Classes</span>
            <span className="text-xs font-bold text-[#121829]/75 dark:text-[#cbd5e1]">
              80 Core + {customClassesList.length} Custom ({datasetSampleCount.toLocaleString()} unified vectors)
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        <div className="lg:col-span-8 space-y-6">
          <CameraViewport
            onDrawOverlay={handleDrawOverlay}
            overlayBadge={`ACTIVE: ${detectedObjects.length}`}
          />

          <div className="comic-panel p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-bold bg-white">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Sliders className="h-4 w-4 text-[#ff462b] shrink-0" />
              <span className="text-[#121829] font-black uppercase">
                Detection Sensitivity:
              </span>
              <input
                type="range"
                min="0.3"
                max="0.85"
                step="0.05"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                className="w-36 accent-[#ff462b] cursor-pointer"
              />
              <span className="font-mono text-[#ff462b] font-black text-sm">
                {Math.round(confidenceThreshold * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-2 text-[#121829] font-black text-xs uppercase">
              <Cpu className="h-4 w-4 text-[#00f0ff]" />
              <span>STATUS:</span>
              <span className="px-2 py-0.5 rounded-full border-2 border-[#121829] bg-[#00f0ff] shadow-[1px_1px_0px_#121829]">
                {modelReady ? 'GPU ACCELERATED (ONLINE)' : 'INITIALIZING...'}
              </span>
            </div>
          </div>

          <div className="comic-panel p-5 bg-white space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b-2 border-[#121829] dark:border-[#27354f]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#a855f7] border-2 border-[#121829] text-white shadow-[1.5px_1.5px_0px_#121829]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3
                    className="text-lg text-[#121829]"
                    style={{ fontFamily: "'Bagel Fat One', cursive" }}
                  >
                    ARGUS Studio · Unified Single-Dataset Deep Training
                  </h3>
                  <p className="text-xs font-bold text-[#121829]/75">
                    Pool all classes + hard-negative crops into one 96D dataset and train a 3,000-epoch classifier head.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black px-2.5 py-1 rounded-full border-2 border-[#121829] bg-[#faf6ee] shadow-[1px_1px_0px_#121829]">
                  {datasetSampleCount.toLocaleString()} Unified Vectors
                </span>
                {unifiedModel && (
                  <span className="text-xs font-black px-2.5 py-1 rounded-full border-2 border-[#121829] bg-[#00f0ff] text-[#121829] shadow-[1px_1px_0px_#121829]">
                    TRAINED · {unifiedModel.validationAccuracy}% ACC
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleAddClass} className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder='E.g. "My Water Bottle", "Science Trophy", "Badge"'
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border-2 border-[#121829] dark:border-[#27354f] bg-[#faf6ee] dark:bg-[#1a2337] text-xs font-bold text-[#121829] dark:text-[#f8fafc] placeholder-[#64748b] shadow-[2px_2px_0px_#121829] dark:shadow-[2px_2px_0px_#030712] focus:outline-none focus:ring-2 focus:ring-[#ff462b]"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-[#121829] dark:text-[#f8fafc] uppercase">Color:</span>
                <input
                  type="color"
                  value={newClassColor}
                  onChange={(e) => setNewClassColor(e.target.value)}
                  className="h-8 w-8 rounded-lg border-2 border-[#121829] dark:border-[#27354f] cursor-pointer"
                />
              </div>
              <button
                type="submit"
                className="comic-btn comic-btn-primary px-4 py-2 rounded-xl text-xs uppercase cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Class</span>
              </button>
            </form>

            {customClassesList.length > 0 && (
              <div className="p-4 rounded-xl border-2 border-[#121829] dark:border-[#27354f] bg-[#faf6ee] dark:bg-[#1a2337] space-y-3 shadow-[2px_2px_0px_#121829]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#121829] dark:text-[#f8fafc] uppercase">Target Class:</span>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border-2 border-[#121829] dark:border-[#27354f] bg-white dark:bg-[#111827] text-xs font-black text-[#121829] dark:text-[#f8fafc] shadow-[1px_1px_0px_#121829] cursor-pointer"
                    >
                      <option value="">-- Choose Class to Train --</option>
                      {customClassesList.map((c) => (
                        <option key={c.id} value={c.id} className="bg-white dark:bg-[#111827] text-[#121829] dark:text-[#f8fafc]">
                          {c.name} ({c.features.length} vectors)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleTrainLiveSample}
                      disabled={!selectedClassId || isDeepTraining}
                      className="comic-btn comic-btn-yellow px-3.5 py-2 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-50"
                    >
                      <Award className="h-4 w-4 text-[#121829]" />
                      <span>Capture Burst (+80)</span>
                    </button>

                    <button
                      onClick={() => setAutoCollecting((prev) => !prev)}
                      disabled={!selectedClassId || !isStreaming || isDeepTraining}
                      className={`comic-btn px-3.5 py-2 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-50 ${
                        autoCollecting ? 'comic-btn-pink' : 'comic-btn-white'
                      }`}
                    >
                      <Radio className="h-4 w-4" />
                      <span>{autoCollecting ? 'Stop Auto-Collect' : 'Auto-Collect (+450)'}</span>
                    </button>

                    <button
                      onClick={handleAmplifyDataset}
                      disabled={isDeepTraining || datasetSampleCount === 0}
                      className="comic-btn comic-btn-white px-3.5 py-2 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-50"
                    >
                      <Zap className="h-4 w-4 text-[#ff462b]" />
                      <span>Augment x4</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl border-2 border-[#121829] dark:border-[#27354f] bg-white dark:bg-[#111827] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-extrabold text-[#121829] dark:text-[#f8fafc]">
                      <span className="font-black uppercase text-[#ff462b]">Single-Dataset Neural Trainer</span>
                      <span className="block text-[11px] font-bold text-[#121829]/70 dark:text-[#94a3b8]">
                        {unifiedModel
                          ? `Last run: ${unifiedModel.epochsCompleted.toLocaleString()} epochs · ${unifiedModel.totalAugmentedSamples.toLocaleString()} balanced vectors · Loss ${unifiedModel.finalLoss}`
                          : 'Trains 96D -> 32 -> K Softmax neural head over all classes in one unified dataset.'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {unifiedModel && (
                        <button
                          onClick={handleResetUnifiedModel}
                          disabled={isDeepTraining}
                          className="comic-btn comic-btn-white px-3 py-1.5 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-50"
                          title="Reset Trained Classifier"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Reset</span>
                        </button>
                      )}
                      <button
                        onClick={handleRunUnifiedTraining}
                        disabled={isDeepTraining || customClassesList.every((c) => c.features.length === 0)}
                        className="comic-btn comic-btn-cyan px-4 py-2 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-50"
                      >
                        <Brain className="h-4 w-4" />
                        <span>{isDeepTraining ? 'Training 3,000 Epochs...' : 'Train Single Dataset (3,000 Epochs)'}</span>
                      </button>
                    </div>
                  </div>

                  {trainingProgress && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-black text-[#121829] dark:text-[#f8fafc]">
                        <span>{trainingProgress.phase}</span>
                        <span className="font-mono">
                          Epoch {trainingProgress.epoch.toLocaleString()}/{trainingProgress.totalEpochs.toLocaleString()} · Acc {trainingProgress.accuracy}% · Loss {trainingProgress.loss.toFixed(4)}
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full border-2 border-[#121829] bg-[#faf6ee] dark:bg-[#1a2337] overflow-hidden">
                        <div
                          className="h-full bg-[#00f0ff] transition-all duration-150"
                          style={{
                            width: `${Math.min(100, Math.round((trainingProgress.epoch / Math.max(1, trainingProgress.totalEpochs)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {trainingNotice && (
                  <div className="flex items-center gap-2 text-xs font-black text-[#059669] dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-lg border border-[#059669]">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    <span>{trainingNotice}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#121829]/20 dark:border-[#27354f]">
                  {customClassesList.map((cls) => (
                    <div
                      key={cls.id}
                      className="flex items-center justify-between p-2 rounded-lg border-2 border-[#121829] dark:border-[#27354f] bg-white dark:bg-[#111827] text-xs shadow-[1.5px_1.5px_0px_#121829]"
                    >
                      <div className="flex items-center gap-2.5">
                        {cls.thumbnail ? (
                          <img
                            src={cls.thumbnail}
                            alt={cls.name}
                            className="h-9 w-9 rounded-lg border-2 border-[#121829] object-cover shadow-[1px_1px_0px_#121829]"
                          />
                        ) : (
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-[#121829]"
                            style={{ backgroundColor: cls.color }}
                          />
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-[#121829] dark:text-[#f8fafc]">{cls.name}</span>
                            <span
                              className="h-2 w-2 rounded-full border border-[#121829]"
                              style={{ backgroundColor: cls.color }}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-[#121829]/70 dark:text-[#94a3b8] block">
                            {cls.features.length} pooled vectors ({cls.samplesCount} captured)
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveClass(cls.id, cls.name)}
                        className="text-[#ff462b] hover:text-[#121829] dark:hover:text-white p-1 cursor-pointer"
                        title="Delete Class"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">

          <div className="comic-panel p-5 bg-white">
            <span className="text-xs font-black uppercase tracking-wider text-[#121829]/60">
              TARGETS IN VIEW
            </span>
            <div
              className="text-4xl text-[#ff462b] mt-1 tabular-nums"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              {detectedObjects.length}
            </div>
            <div className="text-xs font-extrabold text-[#121829]/75 mt-1">
              Total inferences processed: <span className="font-mono font-black text-[#121829]">{totalDetectedCount}</span>
            </div>
          </div>

          <div className="comic-panel p-5 bg-white space-y-3">
            <h4
              className="text-lg text-[#121829]"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              Category Counts
            </h4>
            <div className="space-y-2 text-xs font-extrabold">
              {[
                { label: 'Person', key: 'person', color: '#00f0ff' },
                { label: 'Custom Trained', key: 'custom', color: '#a855f7' },
                { label: 'Vehicle', key: 'vehicle', color: '#ffd000' },
                { label: 'Electronic', key: 'electronic', color: '#38bdf8' },
                { label: 'Furniture', key: 'furniture', color: '#ff2a85' },
                { label: 'Accessory', key: 'accessory', color: '#ff462b' },
              ].map(({ label, key, color }) => {
                const count = categoryCounts[key] || 0;
                return (
                  <div key={key} className="flex items-center justify-between p-2 rounded-lg border-2 border-[#121829] bg-[#faf6ee] shadow-[1.5px_1.5px_0px_#121829]">
                    <div className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border border-[#121829]" style={{ backgroundColor: color }} />
                      <span className="text-[#121829]">{label}</span>
                    </div>
                    <span className="font-mono text-[#121829] font-black text-sm">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="comic-panel p-5 bg-white">
            <h4
              className="text-lg text-[#121829] mb-2 flex items-center justify-between"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              <span>Detected Objects</span>
              <Layers className="h-4 w-4 text-[#ff462b]" />
            </h4>
            {detectedObjects.length === 0 ? (
              <p className="text-xs text-[#121829]/60 py-3 text-center font-bold">
                No objects above {Math.round(confidenceThreshold * 100)}% threshold in view.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {detectedObjects.map((obj) => (
                  <div
                    key={obj.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border-2 border-[#121829] bg-[#faf6ee] text-xs font-bold shadow-[2px_2px_0px_#121829]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full border border-[#121829]" style={{ backgroundColor: obj.color }} />
                      <span className="font-black text-[#121829]">{obj.label}</span>
                    </div>
                    <span className="font-mono text-[#ff462b] font-black text-sm">{obj.confidence}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
