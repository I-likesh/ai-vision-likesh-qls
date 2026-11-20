import React from 'react';
import { motion } from 'motion/react';
import { useCamera } from '../../context/CameraContext';
import { AIModuleId, VisionEvent } from '../../types';
import { LiveHardwareTelemetry } from './LiveHardwareTelemetry';
import { ModuleLivePreview } from './ModuleLivePreview';
import { soundFx } from '../../services/soundFx';
import {
  Eye,
  Hand,
  Activity,
  Compass,
  Sprout,
  Camera,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Radio,
} from 'lucide-react';

interface DashboardProps {
  onSelectModule: (id: AIModuleId) => void;
  recentEvents: VisionEvent[];
  onOpenExhibition: () => void;
}

export const MainDashboard: React.FC<DashboardProps> = ({
  onSelectModule,
  recentEvents,
  onOpenExhibition,
}) => {
  const { isStreaming, fps, resolution, startCamera, stopCamera } = useCamera();

  const MODULE_CARDS = [
    {
      id: 'argus' as AIModuleId,
      name: 'ARGUS',
      subtitle: 'Object Detection & Training',
      desc: 'Pre-trained on 15M+ ImageNet/COCO images. Live on-device transfer learning to train custom items.',
      icon: Eye,
      tagColor: 'bg-[#38bdf8] text-[#121829]',
      stats: '15M+ Data',
    },
    {
      id: 'gesture' as AIModuleId,
      name: 'GestureOS',
      subtitle: 'Hand Gesture Control',
      desc: 'Detects 21 3D finger landmarks with a live side-by-side 3D bionic hand model mirroring every gesture.',
      icon: Hand,
      tagColor: 'bg-[#00f0ff] text-[#121829]',
      stats: '21 Landmarks',
    },
    {
      id: 'motion' as AIModuleId,
      name: 'Motion Intelligence',
      subtitle: 'Pose Biomechanics',
      desc: '33 human body landmarks calculating joint angles, evaluating posture quality, and rep tracking.',
      icon: Activity,
      tagColor: 'bg-[#ffd000] text-[#121829]',
      stats: 'Posture & Reps',
    },
    {
      id: 'facemesh' as AIModuleId,
      name: 'FaceMesh Lab',
      subtitle: '3D Facial Landmarks',
      desc: '468 geometric facial vertices measuring eye aspect ratio and head tilt without facial profiling.',
      icon: Compass,
      tagColor: 'bg-[#ff2a85] text-white',
      stats: '468 Vertices',
    },
    {
      id: 'plantdoc' as AIModuleId,
      name: 'PlantDoc AI',
      subtitle: 'Weed & Flora Diagnostician',
      desc: 'Botanical vision classifying agricultural weeds, live chlorophyll ratio (ExG = 2G - R - B), and organic science treatments.',
      icon: Sprout,
      tagColor: 'bg-[#059669] text-white',
      stats: 'Flora & Weeds',
    },
  ];

  const handleDeployModule = (id: AIModuleId) => {
    soundFx.playTargetLock();
    onSelectModule(id);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border-2 border-black/80 dark:border-white/20 bg-[#ffd000] dark:bg-[#182238] p-2 text-xs font-black shadow-[2px_2px_0px_#000000] overflow-hidden whitespace-nowrap">
        <div className="wow-marquee gap-8 text-[#121829] dark:text-[#f8fafc]">
          {[0, 1].map((loopIdx) => (
            <div key={loopIdx} className="flex items-center gap-6 shrink-0">
              <span className="flex items-center gap-1.5 shrink-0 text-[#ff462b] dark:text-[#00f0ff]">
                <Radio className="h-3.5 w-3.5 animate-spin" />
                <span>LIVE SYSTEM TELEMETRY:</span>
              </span>
              <span className="shrink-0">● ZERO CLOUD DELAY: 100% Client-Side WebGL</span>
              <span className="shrink-0">● DEEP LINEAGE: 15.7M Instances Pre-Trained</span>
              <span className="shrink-0">● SCIENCE LAB: PlantDoc AI Weed &amp; Chlorophyll Analyzer</span>
              <span className="shrink-0">● PRIVACY: Camera Feeds Never Leave Device</span>
              <span className="shrink-0">● STANDALONE: Full Offline Windows Code Export</span>
              <span className="shrink-0">● STREAM: {isStreaming ? `ONLINE (${fps} FPS)` : 'STANDBY READY'}</span>
            </div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="comic-panel p-6 sm:p-8 bg-white relative overflow-hidden"
      >
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-[#ffd000]/25 dark:bg-[#00f0ff]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-36 h-36 bg-[#ffd000]/20 rounded-bl-full pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border-2 border-[#121829] dark:border-white/20 bg-[#ffd000] text-[#121829] text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#121829]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>SCHOOL SCIENCE EXHIBITION EDITION</span>
            </div>
            <h1
              className="text-3xl sm:text-4xl text-[#121829] dark:text-white"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              AI VISION Command Station
            </h1>
            <p className="text-sm font-bold text-[#121829]/80 dark:text-white/80 leading-relaxed">
              Five local computer vision models running directly in your browser. Real-time inference with zero cloud latency, zero paid APIs, complete on-device privacy, and full offline standalone packaging.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => {
                soundFx.playComicPop();
                onOpenExhibition();
              }}
              className="comic-btn comic-btn-primary px-5 py-3 rounded-xl text-sm uppercase tracking-wide cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>Exhibition Tour</span>
            </button>
            <button
              onClick={() => {
                soundFx.playLaserScan();
                if (isStreaming) stopCamera();
                else startCamera();
              }}
              className={`comic-btn px-5 py-3 rounded-xl text-sm uppercase tracking-wide cursor-pointer ${
                isStreaming ? 'comic-btn-pink' : 'comic-btn-yellow'
              }`}
            >
              <Camera className="h-4 w-4" />
              <span>{isStreaming ? 'Stop Camera' : 'Start Camera'}</span>
            </button>
          </div>
        </div>
      </motion.div>

      <LiveHardwareTelemetry />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="comic-panel p-4 bg-white">
          <span className="text-xs font-black uppercase tracking-wider text-[#121829]/60 dark:text-white/60 block">
            LOCAL AI ENGINES
          </span>
          <div
            className="text-3xl text-[#ff462b] mt-1 tabular-nums"
            style={{ fontFamily: "'Bagel Fat One', cursive" }}
          >
            5 <span className="text-sm font-sans font-bold text-[#121829]/70 dark:text-white/70">Modules</span>
          </div>
          <span className="text-xs font-extrabold text-[#121829] dark:text-white/90 mt-1 block">100% Free · On-Device</span>
        </div>

        <div className="comic-panel p-4 bg-white">
          <span className="text-xs font-black uppercase tracking-wider text-[#121829]/60 dark:text-white/60 block">
            CAMERA FEED
          </span>
          <div
            className="flex items-center gap-2 text-2xl text-[#121829] dark:text-white mt-1"
            style={{ fontFamily: "'Bagel Fat One', cursive" }}
          >
            <span className={`h-4 w-4 rounded-full border-2 border-[#121829] ${isStreaming ? 'bg-[#00f0ff] animate-ping' : 'bg-[#ff462b]'}`} />
            <span>{isStreaming ? 'ONLINE' : 'STANDBY'}</span>
          </div>
          <span className="text-xs font-extrabold text-[#121829] dark:text-white/90 mt-1 block">
            Live Webcam · {resolution.toUpperCase()}
          </span>
        </div>

        <div className="comic-panel p-4 bg-white">
          <span className="text-xs font-black uppercase tracking-wider text-[#121829]/60 dark:text-white/60 block">
            SPEED THROUGHPUT
          </span>
          <div
            className="text-3xl text-[#121829] dark:text-white mt-1 tabular-nums"
            style={{ fontFamily: "'Bagel Fat One', cursive" }}
          >
            {fps} <span className="text-sm font-sans font-bold text-[#121829]/70 dark:text-white/70">FPS</span>
          </div>
          <span className="text-xs font-extrabold text-[#121829] dark:text-white/90 mt-1 block">Hardware Accelerated</span>
        </div>

        <div className="comic-panel p-4 bg-white">
          <span className="text-xs font-black uppercase tracking-wider text-[#121829]/60 dark:text-white/60 block">
            PRIVACY GUARANTEE
          </span>
          <div
            className="text-2xl text-[#059669] mt-1 flex items-center gap-1.5"
            style={{ fontFamily: "'Bagel Fat One', cursive" }}
          >
            <ShieldCheck className="h-6 w-6 text-[#059669]" />
            <span>ON-DEVICE</span>
          </div>
          <span className="text-xs font-extrabold text-[#121829] dark:text-white/90 mt-1 block">Zero Video Uploads</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            className="text-2xl text-[#121829] dark:text-white"
            style={{ fontFamily: "'Bagel Fat One', cursive" }}
          >
            Computer Vision Engines
          </h2>
          <span className="text-xs font-black text-[#121829]/60 dark:text-white/60">
            Click any module panel to deploy
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {MODULE_CARDS.map((card, idx) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.06 }}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => handleDeployModule(card.id)}
                className="comic-panel-interactive p-5 bg-white cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-full border-2 border-[#121829] shadow-[1.5px_1.5px_0px_#121829] ${card.tagColor}`}>
                      {card.stats}
                    </span>
                    <span className="relative flex h-3 w-3">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-[#00f0ff] animate-ping" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00f0ff]" />
                    </span>
                  </div>

                  <div className="h-40 rounded-xl border-2 border-[#121829] overflow-hidden mb-3.5 shadow-[2px_2px_0px_#121829] bg-[#faf6ee] dark:bg-[#1a2337] relative">
                    <ModuleLivePreview moduleId={card.id} />
                  </div>

                  <h3
                    className="text-xl text-[#121829] dark:text-white group-hover:text-[#ff462b] transition-colors"
                    style={{ fontFamily: "'Bagel Fat One', cursive" }}
                  >
                    {card.name}
                  </h3>
                  <span className="text-xs font-black text-[#ff462b] block mt-0.5">
                    {card.subtitle}
                  </span>
                  <p className="text-xs font-bold text-[#121829]/75 dark:text-white/75 mt-2 leading-relaxed">
                    {card.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t-2 border-[#121829]/10 dark:border-white/10 flex items-center justify-between text-xs font-black text-[#121829] dark:text-white">
                  <span className="group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 text-[#ff462b]">
                    <span>Deploy Engine</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                  <div className="h-7 w-7 rounded-lg border-2 border-[#121829] bg-[#ffd000] flex items-center justify-center shadow-[1.5px_1.5px_0px_#121829] group-hover:bg-[#ff462b] group-hover:text-white transition-colors">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 comic-panel p-5 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h3
              className="text-lg text-[#121829] dark:text-white"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              Recent Vision Events
            </h3>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#ffd000] border-2 border-[#121829] text-[#121829]">
              {recentEvents.length} Events Logged
            </span>
          </div>

          {recentEvents.length === 0 ? (
            <p className="text-xs text-[#121829]/60 dark:text-white/60 py-6 text-center font-bold">
              No events recorded yet. Activate a module above to start streaming detections.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {recentEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-xl border-2 border-[#121829] dark:border-white/15 bg-[#faf6ee] dark:bg-[#182238] text-xs shadow-[2px_2px_0px_#121829]"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-[#121829] dark:text-white">{ev.title}</span>
                      <span className="text-xs font-mono font-black uppercase text-[#ff462b]">[{ev.module}]</span>
                    </div>
                    <p className="text-[#121829]/80 dark:text-white/80 font-bold">{ev.description}</p>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#121829]/60 dark:text-white/60 shrink-0">{ev.timestamp}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 comic-panel p-5 bg-white space-y-3">
          <h3
            className="text-lg text-[#121829] dark:text-white flex items-center gap-2"
            style={{ fontFamily: "'Bagel Fat One', cursive" }}
          >
            <Sparkles className="h-5 w-5 text-amber-500 dark:text-[#ffd000]" /> Exhibition Tips
          </h3>
          <p className="text-xs font-bold text-[#121829]/80 dark:text-white/80 leading-relaxed">
            Quick tips for presenting to science fair judges:
          </p>
          <ul className="text-xs font-bold text-[#121829]/80 dark:text-white/80 space-y-2.5 list-disc list-inside">
            <li><strong>PlantDoc AI</strong>: Hold a leaf or garden weed up to the camera to see instant chlorophyll ExG index &amp; organic diagnosis.</li>
            <li><strong>ARGUS Academy</strong>: Pre-trained on 15M+ images (ImageNet &amp; COCO). Click &quot;Capture &amp; Train&quot; to teach ARGUS your own custom objects!</li>
            <li><strong>GestureOS</strong>: Enable Gesture Control to take camera snapshots with Thumbs Up or switch modules with Victory.</li>
            <li><strong>Motion Intelligence</strong>: Stand back and do a squat to trigger the automated rep counter with celebration.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
