import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraViewport } from '../common/CameraViewport';
import { useCamera } from '../../context/CameraContext';
import { plantDocService, BOTANICAL_DATABASE } from '../../services/plantDocService';
import { PlantDiagnosisResult, VisionEvent } from '../../types';
import { soundFx } from '../../services/soundFx';
import confetti from 'canvas-confetti';
import {
  Sprout,
  AlertTriangle,
  ShieldCheck,
  Activity,
  Layers,
  Upload,
  Camera,
  HelpCircle,
  Sparkles,
  Volume2,
  VolumeX,
  Microscope,
  X,
} from 'lucide-react';

interface PlantDocAIProps {
  onLogEvent: (event: Omit<VisionEvent, 'id' | 'timestamp'>) => void;
}

export const PlantDocAI: React.FC<PlantDocAIProps> = ({ onLogEvent }) => {
  const { videoRef, isStreaming, startCamera } = useCamera();
  const [selectedSpecimenId, setSelectedSpecimenId] = useState<string>('dandelion');
  const [currentDiagnosis, setCurrentDiagnosis] = useState<PlantDiagnosisResult>(BOTANICAL_DATABASE[0]);
  const [exgIndex, setExgIndex] = useState<number>(0.78);
  const [chlorophyllLevel, setChlorophyllLevel] = useState<number>(78);
  const [rgbMeans, setRgbMeans] = useState<{ r: number; g: number; b: number }>({ r: 78, g: 142, b: 64 });
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(soundFx.getIsMuted());
  const [lastAnalyzedTime, setLastAnalyzedTime] = useState<string>('Standby');
  const [reportSaved, setReportSaved] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanPhaseRef = useRef<number>(0);

  const performDiagnosis = useCallback(() => {
    if (!videoRef.current) return;
    const result = plantDocService.analyzeFrame(videoRef.current, selectedSpecimenId);
    setCurrentDiagnosis(result.diagnosis);
    setExgIndex(result.excessGreenIndex);
    setChlorophyllLevel(result.chlorophyllLevel);
    setRgbMeans(result.rgbMeans);
    setLastAnalyzedTime(new Date().toLocaleTimeString());
  }, [selectedSpecimenId, videoRef]);

  useEffect(() => {
    const match = BOTANICAL_DATABASE.find((p) => p.id === selectedSpecimenId);
    if (match) {
      setCurrentDiagnosis(match);
      setExgIndex(match.chlorophyllIndex);
      setChlorophyllLevel(Math.round(match.chlorophyllIndex * 100));
      if (match.isWeed) {
        soundFx.playWeedAlert();
      } else {
        soundFx.playSuccessChime();
      }
      onLogEvent({
        module: 'plantdoc',
        title: `${match.isWeed ? 'Weed Identified' : 'Flora Verified'}: ${match.commonName}`,
        description: `Botanical: ${match.scientificName} (${match.family}). Health: ${match.healthRating}.`,
        type: match.isWeed ? 'alert' : 'success',
      });
    }
  }, [selectedSpecimenId, onLogEvent]);

  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      performDiagnosis();
    }, 1000);
    return () => clearInterval(interval);
  }, [isStreaming, performDiagnosis]);

  const handleDrawOverlay = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      scanPhaseRef.current = (scanPhaseRef.current + 0.04) % (Math.PI * 2);
      const centerX = width / 2;
      const centerY = height / 2;
      const boxSize = Math.min(width, height) * 0.46;
      const halfBox = boxSize / 2;

      ctx.save();

      const laserY = centerY - halfBox + ((Math.sin(scanPhaseRef.current) * 0.5 + 0.5) * boxSize);
      const grad = ctx.createLinearGradient(centerX - halfBox, laserY - 12, centerX - halfBox, laserY + 12);
      grad.addColorStop(0, 'rgba(0, 240, 255, 0)');
      grad.addColorStop(0.5, currentDiagnosis.isWeed ? 'rgba(255, 70, 43, 0.45)' : 'rgba(16, 185, 129, 0.45)');
      grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(centerX - halfBox, laserY - 12, boxSize, 24);

      ctx.strokeStyle = currentDiagnosis.isWeed ? '#ff462b' : '#10b981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(centerX - halfBox, laserY);
      ctx.lineTo(centerX + halfBox, laserY);
      ctx.stroke();

      ctx.strokeStyle = currentDiagnosis.isWeed ? '#ff462b' : '#10b981';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.strokeRect(centerX - halfBox, centerY - halfBox, boxSize, boxSize);
      ctx.setLineDash([]);

      const cornerLen = 24;
      ctx.strokeStyle = '#ffd000';
      ctx.lineWidth = 4;

      ctx.beginPath();
      ctx.moveTo(centerX - halfBox, centerY - halfBox + cornerLen);
      ctx.lineTo(centerX - halfBox, centerY - halfBox);
      ctx.lineTo(centerX - halfBox + cornerLen, centerY - halfBox);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(centerX + halfBox - cornerLen, centerY - halfBox);
      ctx.lineTo(centerX + halfBox, centerY - halfBox);
      ctx.lineTo(centerX + halfBox, centerY - halfBox + cornerLen);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(centerX - halfBox, centerY + halfBox - cornerLen);
      ctx.lineTo(centerX - halfBox, centerY + halfBox);
      ctx.lineTo(centerX - halfBox + cornerLen, centerY + halfBox);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(centerX + halfBox - cornerLen, centerY + halfBox);
      ctx.lineTo(centerX + halfBox, centerY + halfBox);
      ctx.lineTo(centerX + halfBox, centerY + halfBox - cornerLen);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 208, 0, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX - 18, centerY);
      ctx.lineTo(centerX + 18, centerY);
      ctx.moveTo(centerX, centerY - 18);
      ctx.lineTo(centerX, centerY + 18);
      ctx.stroke();

      const badgeText = currentDiagnosis.isWeed
        ? `[!] WEED: ${currentDiagnosis.commonName.toUpperCase()} (${currentDiagnosis.confidence}%)`
        : `[✓] FLORA: ${currentDiagnosis.commonName.toUpperCase()} (${currentDiagnosis.confidence}%)`;

      ctx.font = "bold 13px 'JetBrains Mono', monospace";
      const metrics = ctx.measureText(badgeText);
      const bgW = metrics.width + 24;
      const bgH = 30;

      ctx.fillStyle = currentDiagnosis.isWeed ? '#ff462b' : '#059669';
      ctx.fillRect(centerX - bgW / 2, centerY - halfBox - bgH - 8, bgW, bgH);
      ctx.strokeStyle = '#121829';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(centerX - bgW / 2, centerY - halfBox - bgH - 8, bgW, bgH);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, centerX, centerY - halfBox - bgH / 2 - 8);

      const exgText = `ExG: ${exgIndex} · CHL: ${chlorophyllLevel}%`;
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      const exgMetrics = ctx.measureText(exgText);
      ctx.fillStyle = 'rgba(18, 24, 41, 0.85)';
      ctx.fillRect(centerX - (exgMetrics.width + 18) / 2, centerY + halfBox + 8, exgMetrics.width + 18, 22);
      ctx.fillStyle = '#00f0ff';
      ctx.fillText(exgText, centerX, centerY + halfBox + 19);

      ctx.restore();
    },
    [currentDiagnosis, exgIndex, chlorophyllLevel]
  );

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setUploadedPreviewUrl(previewUrl);

    const img = new Image();
    img.onload = () => {
      const analysis = plantDocService.analyzeImageElement(img);
      setSelectedSpecimenId(analysis.diagnosis.id);
      setCurrentDiagnosis(analysis.diagnosis);
      setExgIndex(analysis.excessGreenIndex);
      setChlorophyllLevel(analysis.chlorophyllLevel);
      setRgbMeans(analysis.rgbMeans);
      setLastAnalyzedTime(new Date().toLocaleTimeString());

      confetti({
        particleCount: 45,
        spread: 65,
        origin: { y: 0.6 },
      });

      if (analysis.diagnosis.isWeed) {
        soundFx.playWeedAlert();
      } else {
        soundFx.playSuccessChime();
      }

      onLogEvent({
        module: 'plantdoc',
        title: `Leaf Specimen Scanned: ${analysis.diagnosis.commonName}`,
        description: `Spectral ExG=${analysis.excessGreenIndex} · Classification: ${analysis.diagnosis.classificationBadge}.`,
        type: analysis.diagnosis.isWeed ? 'alert' : 'success',
      });
    };
    img.src = previewUrl;
  };

  const handleGenerateReport = () => {
    confetti({
      particleCount: 55,
      spread: 75,
      origin: { y: 0.5 },
    });
    soundFx.playSuccessChime();
    setReportSaved(true);
    setTimeout(() => setReportSaved(false), 3000);

    onLogEvent({
      module: 'plantdoc',
      title: 'Botanical Diagnosis Report Generated',
      description: `Report filed for ${currentDiagnosis.commonName} (${currentDiagnosis.scientificName}). Health Score: ${currentDiagnosis.healthScore}%.`,
      type: 'info',
    });
  };

  const toggleSound = () => {
    const next = soundFx.toggleMute();
    setIsMuted(next);
  };

  return (
    <div className="space-y-6">
      <div className="comic-panel p-6 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border-2 border-[#121829] bg-[#ffd000] text-[#121829] text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#121829] mb-2">
            <Sprout className="h-3.5 w-3.5 text-[#059669]" />
            <span>Botanical Science Vision Lab</span>
          </div>
          <h2
            className="text-2xl sm:text-3xl text-[#121829]"
            style={{ fontFamily: "'Bagel Fat One', cursive" }}
          >
            PlantDoc AI – Weed &amp; Flora Diagnostician
          </h2>
          <p className="text-xs sm:text-sm font-bold text-[#121829]/75 mt-1 max-w-2xl">
            Real-time on-device botanical classification. Identifies invasive agricultural weeds versus cultivated flora, evaluates live chlorophyll index (ExG = 2G - R - B), and prescribes organic treatments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={toggleSound}
            className="comic-btn comic-btn-white p-2.5 rounded-xl text-xs uppercase cursor-pointer"
            title={isMuted ? 'Unmute Audio Synthesizer' : 'Mute Audio Synthesizer'}
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-[#ff462b]" /> : <Volume2 className="h-4 w-4 text-[#059669]" />}
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="comic-btn comic-btn-cyan px-3.5 py-2.5 rounded-xl text-xs uppercase cursor-pointer flex items-center gap-1.5"
          >
            <Upload className="h-4 w-4" />
            <span>Scan Leaf Photo</span>
          </button>

          {!isStreaming && (
            <button
              onClick={() => startCamera()}
              className="comic-btn comic-btn-yellow px-4 py-2.5 rounded-xl text-xs uppercase cursor-pointer flex items-center gap-1.5"
            >
              <Camera className="h-4 w-4" />
              <span>Start Camera</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          <CameraViewport
            onDrawOverlay={handleDrawOverlay}
            overlayBadge={
              currentDiagnosis.isWeed
                ? `WEED: ${currentDiagnosis.commonName.toUpperCase()}`
                : `FLORA: ${currentDiagnosis.commonName.toUpperCase()}`
            }
          />

          {uploadedPreviewUrl && (
            <div className="comic-panel p-4 bg-white flex flex-col sm:flex-row items-center gap-4">
              <div className="relative w-36 h-28 rounded-xl border-2 border-[#121829] overflow-hidden shrink-0 shadow-[2px_2px_0px_#121829]">
                <img
                  src={uploadedPreviewUrl}
                  alt="Uploaded leaf specimen"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => setUploadedPreviewUrl(null)}
                  className="absolute top-1 right-1 p-1 rounded-md bg-black/75 text-white hover:bg-[#ff462b] cursor-pointer"
                  title="Dismiss specimen preview"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex-1 space-y-2 w-full">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase flex items-center gap-1.5 text-[#059669]">
                    <Microscope className="h-4 w-4" /> Uploaded Leaf Spectral Breakdown
                  </span>
                  <span className="text-[11px] font-mono text-[#121829]/60">{lastAnalyzedTime}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-lg border border-[#121829] bg-[#faf6ee]">
                    <span className="text-[10px] block text-[#ff462b] font-black">RED ({rgbMeans.r})</span>
                    <div className="w-full h-1.5 bg-white rounded-full mt-1 overflow-hidden">
                      <div className="bg-[#ff462b] h-full" style={{ width: `${(rgbMeans.r / 255) * 100}%` }} />
                    </div>
                  </div>
                  <div className="p-2 rounded-lg border border-[#121829] bg-[#faf6ee]">
                    <span className="text-[10px] block text-[#059669] font-black">GREEN ({rgbMeans.g})</span>
                    <div className="w-full h-1.5 bg-white rounded-full mt-1 overflow-hidden">
                      <div className="bg-[#059669] h-full" style={{ width: `${(rgbMeans.g / 255) * 100}%` }} />
                    </div>
                  </div>
                  <div className="p-2 rounded-lg border border-[#121829] bg-[#faf6ee]">
                    <span className="text-[10px] block text-[#0284c7] font-black">BLUE ({rgbMeans.b})</span>
                    <div className="w-full h-1.5 bg-white rounded-full mt-1 overflow-hidden">
                      <div className="bg-[#0284c7] h-full" style={{ width: `${(rgbMeans.b / 255) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="comic-panel p-5 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <h4
                className="text-lg text-[#121829] flex items-center gap-2"
                style={{ fontFamily: "'Bagel Fat One', cursive" }}
              >
                <Layers className="h-5 w-5 text-[#059669]" />
                <span>Botanical Taxonomy Specimen Rack</span>
              </h4>
              <span className="text-xs font-mono font-bold text-[#121829]/60">
                Select specimen to inspect:
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-extrabold">
              {BOTANICAL_DATABASE.map((specimen) => {
                const isSelected = selectedSpecimenId === specimen.id;
                return (
                  <button
                    key={specimen.id}
                    onClick={() => setSelectedSpecimenId(specimen.id)}
                    className={`p-2.5 rounded-xl border-2 border-[#121829] text-left transition-all cursor-pointer ${
                      isSelected
                        ? specimen.isWeed
                          ? 'bg-[#ff462b] text-white shadow-[3px_3px_0px_#121829] scale-[1.02]'
                          : 'bg-[#059669] text-white shadow-[3px_3px_0px_#121829] scale-[1.02]'
                        : 'bg-[#faf6ee] hover:bg-white text-[#121829] shadow-[1.5px_1.5px_0px_#121829]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-black truncate">{specimen.commonName}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase shrink-0 ${
                          specimen.isWeed
                            ? 'bg-[#ffd000] text-[#121829]'
                            : 'bg-white text-[#059669]'
                        }`}
                      >
                        {specimen.isWeed ? 'Weed' : 'Crop'}
                      </span>
                    </div>
                    <span className="text-[10px] italic block opacity-85 truncate mt-0.5">
                      {specimen.scientificName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div
            className={`comic-panel p-5 ${
              currentDiagnosis.isWeed ? 'bg-[#ff462b] text-white' : 'bg-[#059669] text-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider opacity-90">
                SPECIMEN CLASSIFICATION
              </span>
              {currentDiagnosis.isWeed ? (
                <AlertTriangle className="h-6 w-6 text-[#ffd000]" />
              ) : (
                <ShieldCheck className="h-6 w-6 text-[#ffd000]" />
              )}
            </div>

            <div
              className="text-3xl text-white mt-1"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              {currentDiagnosis.commonName}
            </div>
            <div className="text-xs italic text-white/90 font-mono mt-0.5 font-bold">
              {currentDiagnosis.scientificName}
            </div>

            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-[#121829] bg-[#ffd000] text-[#121829] text-xs font-black uppercase shadow-[1.5px_1.5px_0px_#121829]">
              <span>{currentDiagnosis.classificationBadge}</span>
              <span>· {currentDiagnosis.confidence}% Match</span>
            </div>

            <div className="mt-3 pt-3 border-t border-white/20 text-xs space-y-1">
              <div className="flex justify-between font-bold">
                <span className="opacity-80">Botanical Family:</span>
                <span className="font-black">{currentDiagnosis.family}</span>
              </div>
              {currentDiagnosis.weedThreatLevel && (
                <div className="flex justify-between font-bold">
                  <span className="opacity-80">Weed Invasiveness:</span>
                  <span className="font-black text-[#ffd000]">
                    {currentDiagnosis.weedThreatLevel}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="comic-panel p-5 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <h4
                className="text-lg text-[#121829] flex items-center gap-2"
                style={{ fontFamily: "'Bagel Fat One', cursive" }}
              >
                <Activity className="h-5 w-5 text-[#ff462b]" />
                <span>Chlorophyll Spectrometer</span>
              </h4>
              <span className="text-[10px] font-mono text-[#121829]/60">{lastAnalyzedTime}</span>
            </div>

            <div className="space-y-2 text-xs font-bold">
              <div className="p-2.5 rounded-xl border-2 border-[#121829] bg-[#faf6ee] shadow-[1.5px_1.5px_0px_#121829]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#121829]/70">Excess Green Index (ExG):</span>
                  <span className="font-mono text-sm text-[#0284c7] dark:text-[#00f0ff] font-black">
                    {exgIndex} ({chlorophyllLevel}%)
                  </span>
                </div>
                <div className="w-full bg-white border border-[#121829] h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#10b981] h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, chlorophyllLevel)}%` }}
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl border-2 border-[#121829] bg-[#faf6ee] shadow-[1.5px_1.5px_0px_#121829]">
                <div className="flex items-center justify-between">
                  <span className="text-[#121829]/70">Leaf Health Status:</span>
                  <span
                    className={`font-black uppercase text-xs px-2 py-0.5 rounded border border-[#121829] ${
                      currentDiagnosis.healthScore >= 85
                        ? 'bg-[#10b981] text-white'
                        : 'bg-[#ffd000] text-[#121829]'
                    }`}
                  >
                    {currentDiagnosis.healthRating} ({currentDiagnosis.healthScore}%)
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl border-2 border-[#121829] bg-[#faf6ee] shadow-[1.5px_1.5px_0px_#121829]">
                <div className="flex items-center justify-between">
                  <span className="text-[#121829]/70">Nitrogen Balance:</span>
                  <span className="font-mono text-xs font-black text-[#121829]">
                    {currentDiagnosis.nitrogenStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="comic-panel p-5 bg-white space-y-2">
            <h4
              className="text-base text-[#121829] flex items-center gap-1.5"
              style={{ fontFamily: "'Bagel Fat One', cursive" }}
            >
              <HelpCircle className="h-4 w-4 text-amber-500 dark:text-[#ffd000]" />
              <span>Scientific Action Plan</span>
            </h4>
            <p className="text-xs font-bold text-[#121829]/80 leading-relaxed bg-[#faf6ee] p-3 rounded-xl border-2 border-[#121829] shadow-[1.5px_1.5px_0px_#121829]">
              {currentDiagnosis.ecoTreatment}
            </p>

            <div className="pt-1.5">
              <span className="text-[10px] font-black uppercase text-[#121829]/60 block mb-1">
                Morphology &amp; Botanical Fact:
              </span>
              <p className="text-xs font-bold text-[#121829]/75 italic leading-relaxed">
                {currentDiagnosis.morphology} &mdash; &ldquo;{currentDiagnosis.scientificFact}&rdquo;
              </p>
            </div>

            <button
              onClick={handleGenerateReport}
              className="comic-btn comic-btn-primary w-full py-2.5 rounded-xl text-xs uppercase cursor-pointer mt-3"
            >
              <Sparkles className="h-4 w-4" />
              <span>{reportSaved ? '✓ Report Filed!' : 'Save Science Exhibition Report'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
