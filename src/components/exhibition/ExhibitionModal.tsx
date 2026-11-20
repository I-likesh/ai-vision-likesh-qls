import React, { useState } from 'react';
import { AIModuleId } from '../../types';
import { Sparkles, Eye, Hand, Activity, Compass, Sprout, X, ArrowRight } from 'lucide-react';

interface ExhibitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModule: (id: AIModuleId) => void;
}

export const ExhibitionModal: React.FC<ExhibitionModalProps> = ({
  isOpen,
  onClose,
  onSelectModule,
}) => {
  const [selectedTopic, setSelectedTopic] = useState<number>(0);

  if (!isOpen) return null;

  const TOPICS = [
    {
      moduleId: 'argus' as AIModuleId,
      name: 'ARGUS · Deep Detection & Transfer Learning',
      icon: Eye,
      scienceConcept: 'Deep CNNs (15M+ ImageNet/COCO) & In-Browser Transfer Learning',
      summary:
        'ARGUS leverages MobileNetV2 SSD pre-trained on 14.2M ImageNet and 1.5M MS COCO instances. Using in-browser transfer learning and real-time data augmentation (jitter, scaling, color moments), users can train custom classes on-device without cloud servers.',
      keyTakeaway: 'Shows how transfer learning allows deep models to master new objects instantly using local browser memory.',
    },
    {
      moduleId: 'gesture' as AIModuleId,
      name: 'GestureOS · Hand Tracking',
      icon: Hand,
      scienceConcept: 'Kinematic Landmark Regression & Vector Dot Products',
      summary:
        'Maps 21 3D coordinates per hand in real-time. By computing angular vectors between the wrist, metacarpals, and finger tips, the system classifies gestures (fist, thumbs up, victory) without requiring specialized hardware.',
      keyTakeaway: 'Translates natural hand kinematics into touchless Human-Computer Interaction (HCI).',
    },
    {
      moduleId: 'motion' as AIModuleId,
      name: 'Motion Intelligence · Pose Biomechanics',
      icon: Activity,
      scienceConcept: 'Skeletal Trigonometry & Repetition State Machines',
      summary:
        'Extracts 33 human skeletal keypoints to calculate precise joint angles (e.g. knee angle between hip, knee, and ankle). A finite state machine registers exercise repetitions when knee angles drop below 115° and return to vertical extension.',
      keyTakeaway: 'Useful in physical therapy, athletic training, and workplace ergonomics.',
    },
    {
      moduleId: 'facemesh' as AIModuleId,
      name: 'FaceMesh Lab · 3D Facial Geometry',
      icon: Compass,
      scienceConcept: 'Dense 3D Mesh Topology & Eye Aspect Ratio (EAR)',
      summary:
        'Projects 468 3D vertices onto facial landmarks. Measures the Eye Aspect Ratio (EAR) to detect natural eye blinks and estimates 3D head rotation angles (Yaw, Pitch, Roll) using 2D-to-3D perspective alignment.',
      keyTakeaway: 'Strictly mathematical topology without facial recognition or emotion profiling.',
    },
    {
      moduleId: 'plantdoc' as AIModuleId,
      name: 'PlantDoc AI · Botanical Weed & Crop Diagnostician',
      icon: Sprout,
      scienceConcept: 'Excess Green Index (ExG = 2G - R - B) & Foliar Pathology',
      summary:
        'Applies agricultural colorimetry and leaf morphology algorithms directly in the browser. Distinguishes invasive lawn weeds (Dandelion, Crabgrass, Plantain) from cultivated flora (Tomato, Basil, Peppers), evaluating chlorophyll health ratios and proposing organic horticultural remedies.',
      keyTakeaway: 'Demonstrates environmental science & automated precision agriculture running completely offline on consumer webcams.',
    },
  ];

  const current = TOPICS[selectedTopic];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl rounded-2xl border-[3px] border-[#121829] dark:border-[#27354f] bg-white dark:bg-[#121828] p-6 sm:p-8 shadow-[6px_6px_0px_#121829] dark:shadow-[6px_6px_0px_#040711] text-[#121829] dark:text-[#f1f5f9] max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between pb-4 border-b-2 border-[#121829] dark:border-[#27354f]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ffd000] border-2 border-[#121829] shadow-[2.5px_2.5px_0px_#121829] text-[#121829]">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3
                className="text-xl text-[#121829] dark:text-white"
                style={{ fontFamily: "'Bagel Fat One', cursive" }}
              >
                School Science Exhibition Tour
              </h3>
              <p className="text-xs font-bold text-[#121829]/75 dark:text-white/75">
                Computer vision curriculum guide for judges, teachers, and students
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 border-2 border-[#121829] bg-[#faf6ee] dark:bg-[#1a2337] hover:bg-[#ff462b] hover:text-white transition-colors cursor-pointer shadow-[2px_2px_0px_#121829]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="my-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-4 space-y-2">
            <span className="text-xs font-black tracking-wider uppercase text-[#121829]/60 dark:text-white/60 block mb-2">
              SELECT MODULE
            </span>
            {TOPICS.map((t, idx) => {
              const TIcon = t.icon;
              const isSel = idx === selectedTopic;
              return (
                <button
                  key={t.name}
                  onClick={() => setSelectedTopic(idx)}
                  className={`w-full text-left p-3 rounded-xl border-2 border-[#121829] text-xs font-black transition-all cursor-pointer flex items-center justify-between ${
                    isSel
                      ? 'bg-[#ff462b] text-white shadow-[3px_3px_0px_#121829] translate-x-1'
                      : 'bg-[#faf6ee] dark:bg-[#1a2337] text-[#121829] dark:text-white hover:bg-white shadow-[1.5px_1.5px_0px_#121829]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <TIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t.name.split('·')[0]}</span>
                  </div>
                  {isSel && <ArrowRight className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="md:col-span-8 space-y-4">
            <div className="p-4 rounded-xl border-2 border-[#121829] bg-[#ffd000] text-[#121829] shadow-[2.5px_2.5px_0px_#121829]">
              <span className="text-[10px] font-black uppercase tracking-wider block opacity-75">
                UNDERLYING SCIENCE PRINCIPLE
              </span>
              <h4
                className="text-lg text-[#121829] mt-0.5"
                style={{ fontFamily: "'Bagel Fat One', cursive" }}
              >
                {current.scienceConcept}
              </h4>
            </div>

            <div className="space-y-3 text-xs leading-relaxed font-bold text-[#121829] dark:text-[#cbd5e1]">
              <div className="p-4 rounded-xl border-2 border-[#121829] dark:border-[#27354f] bg-[#faf6ee] dark:bg-[#1a2337] shadow-[2px_2px_0px_#121829]">
                <span className="text-[#ff462b] font-black uppercase block mb-1">
                  How This Model Operates:
                </span>
                <p>{current.summary}</p>
              </div>

              <div className="p-4 rounded-xl border-2 border-[#121829] dark:border-[#27354f] bg-white dark:bg-[#121828] shadow-[2px_2px_0px_#121829]">
                <span className="text-[#059669] font-black uppercase block mb-1">
                  Exhibition Takeaway for Judges:
                </span>
                <p>{current.keyTakeaway}</p>
              </div>
            </div>

            <button
              onClick={() => {
                onSelectModule(current.moduleId);
                onClose();
              }}
              className="comic-btn comic-btn-primary w-full py-3 rounded-xl text-xs uppercase cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              <Icon className="h-4 w-4" />
              <span>Launch {current.name.split('·')[0]} Live Module</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t-2 border-[#121829] dark:border-[#27354f] text-xs font-bold text-[#121829]/75 dark:text-white/75">
          <span>5 Modular Computer Vision Applications in One App</span>
          <button
            onClick={onClose}
            className="comic-btn comic-btn-white px-4 py-2 rounded-xl text-xs uppercase cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
