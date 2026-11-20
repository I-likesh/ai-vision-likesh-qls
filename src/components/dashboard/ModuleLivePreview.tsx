import React, { useRef, useEffect } from 'react';
import { AIModuleId } from '../../types';

interface ModuleLivePreviewProps {
  moduleId: AIModuleId;
}

export const ModuleLivePreview: React.FC<ModuleLivePreviewProps> = ({ moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const render = () => {
      t += 0.035;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = '#080c16';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      if (moduleId === 'argus') {
        const scanY = (Math.sin(t * 1.5) * 0.5 + 0.5) * h;

        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, scanY);
        ctx.lineTo(w, scanY);
        ctx.stroke();

        const boxX = w * 0.28;
        const boxY = h * 0.2;
        const boxW = w * 0.44;
        const boxH = h * 0.58;

        ctx.strokeStyle = '#ff462b';
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        ctx.fillStyle = '#ff462b';
        ctx.fillRect(boxX, boxY - 14, 88, 14);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('PERSON: 96.8%', boxX + 4, boxY - 3);

        const trackX = boxX + boxW * 0.5 + Math.sin(t * 2) * 14;
        const trackY = boxY + boxH * 0.4 + Math.cos(t * 2) * 8;
        ctx.fillStyle = '#ffd000';
        ctx.beginPath();
        ctx.arc(trackX, trackY, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 208, 0, 0.4)';
        ctx.beginPath();
        ctx.arc(trackX, trackY, 9, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('15.7M IMAGENET/COCO', 8, h - 8);
      } else if (moduleId === 'gesture') {
        const cx = w * 0.5;
        const cy = h * 0.52;
        const wave = Math.sin(t * 2) * 6;

        ctx.fillStyle = '#00f0ff';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;

        const palm = { x: cx, y: cy + 12 };
        const joints = [
          { x: cx - 22, y: cy - 14 + wave },
          { x: cx - 10, y: cy - 24 + wave },
          { x: cx + 2, y: cy - 26 + wave * 0.8 },
          { x: cx + 14, y: cy - 22 + wave * 0.6 },
          { x: cx + 26, y: cy - 6 },
        ];

        joints.forEach((j) => {
          ctx.beginPath();
          ctx.moveTo(palm.x, palm.y);
          ctx.lineTo(j.x, j.y);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(j.x, j.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.fillStyle = '#ffd000';
        ctx.beginPath();
        ctx.arc(palm.x, palm.y, 5, 0, Math.PI * 2);
        ctx.fill();

        const cursorX = w * 0.75 + Math.sin(t * 1.8) * 18;
        const cursorY = h * 0.35 + Math.cos(t * 1.8) * 12;
        ctx.fillStyle = '#ff462b';
        ctx.beginPath();
        ctx.arc(cursorX, cursorY, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('GESTURE: THUMBS_UP', 10, h - 8);
        ctx.fillText('21 PTS', w - 46, h - 8);
      } else if (moduleId === 'motion') {
        const cx = w * 0.5;
        const squatDepth = Math.sin(t * 1.8) * 8;
        const cy = h * 0.32 + squatDepth;

        ctx.strokeStyle = '#ffd000';
        ctx.lineWidth = 2.5;

        const head = { x: cx, y: cy };
        const chest = { x: cx, y: cy + 16 };
        const lHip = { x: cx - 12, y: cy + 30 };
        const rHip = { x: cx + 12, y: cy + 30 };
        const lKnee = { x: cx - 14, y: cy + 46 - squatDepth * 0.6 };
        const rKnee = { x: cx + 14, y: cy + 46 - squatDepth * 0.6 };
        const lAnkle = { x: cx - 14, y: h - 14 };
        const rAnkle = { x: cx + 14, y: h - 14 };

        ctx.fillStyle = '#ffd000';
        ctx.beginPath();
        ctx.arc(head.x, head.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(head.x, head.y + 6);
        ctx.lineTo(chest.x, chest.y);
        ctx.lineTo(lHip.x, lHip.y);
        ctx.lineTo(lKnee.x, lKnee.y);
        ctx.lineTo(lAnkle.x, lAnkle.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(chest.x, chest.y);
        ctx.lineTo(rHip.x, rHip.y);
        ctx.lineTo(rKnee.x, rKnee.y);
        ctx.lineTo(rAnkle.x, rAnkle.y);
        ctx.stroke();

        const lHand = { x: cx - 26, y: cy + 22 + squatDepth };
        const rHand = { x: cx + 26, y: cy + 22 + squatDepth };
        ctx.beginPath();
        ctx.moveTo(chest.x, chest.y);
        ctx.lineTo(lHand.x, lHand.y);
        ctx.moveTo(chest.x, chest.y);
        ctx.lineTo(rHand.x, rHand.y);
        ctx.stroke();

        const angleVal = Math.round(140 - squatDepth * 3);
        ctx.fillStyle = '#ffd000';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`KNEE: ${angleVal}°`, 10, h - 8);
        ctx.fillText('POSTURE: 98%', w - 75, h - 8);
      } else if (moduleId === 'facemesh') {
        const cx = w * 0.5;
        const cy = h * 0.48;
        const rot = Math.sin(t * 1.2) * 12;

        ctx.strokeStyle = '#ff2a85';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.ellipse(cx + rot * 0.3, cy, 28, 38, rot * 0.02, 0, Math.PI * 2);
        ctx.stroke();

        const leftEye = { x: cx - 12 + rot * 0.4, y: cy - 8 };
        const rightEye = { x: cx + 12 + rot * 0.4, y: cy - 8 };
        const nose = { x: cx + rot * 0.5, y: cy + 4 };
        const mouth = { x: cx + rot * 0.3, y: cy + 18 };

        [leftEye, rightEye].forEach((eye) => {
          ctx.fillStyle = '#00f0ff';
          ctx.beginPath();
          ctx.arc(eye.x, eye.y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(eye.x, eye.y);
          ctx.lineTo(nose.x, nose.y);
          ctx.stroke();
        });

        ctx.fillStyle = '#ffd000';
        ctx.beginPath();
        ctx.arc(nose.x, nose.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#00f0ff';
        ctx.beginPath();
        ctx.moveTo(mouth.x - 8, mouth.y);
        ctx.lineTo(mouth.x + 8, mouth.y);
        ctx.stroke();

        ctx.fillStyle = '#ff2a85';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('468 VERTICES', 10, h - 8);
        ctx.fillText('EAR: 0.32', w - 65, h - 8);
      } else if (moduleId === 'plantdoc') {
        const cx = w * 0.5;
        const cy = h * 0.48;

        const boxSize = 52;
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(cx - boxSize / 2, cy - boxSize / 2, boxSize, boxSize);
        ctx.setLineDash([]);

        ctx.strokeStyle = '#ffd000';
        ctx.lineWidth = 2;
        const cl = 8;
        const hf = boxSize / 2;
        ctx.beginPath();
        ctx.moveTo(cx - hf, cy - hf + cl);
        ctx.lineTo(cx - hf, cy - hf);
        ctx.lineTo(cx - hf + cl, cy - hf);
        ctx.moveTo(cx + hf - cl, cy - hf);
        ctx.lineTo(cx + hf, cy - hf);
        ctx.lineTo(cx + hf, cy - hf + cl);
        ctx.moveTo(cx - hf, cy + hf - cl);
        ctx.lineTo(cx - hf, cy + hf);
        ctx.lineTo(cx - hf + cl, cy + hf);
        ctx.moveTo(cx + hf - cl, cy + hf);
        ctx.lineTo(cx + hf, cy + hf);
        ctx.lineTo(cx + hf, cy + hf - cl);
        ctx.stroke();

        const pulse = Math.sin(t * 2) * 2;
        ctx.fillStyle = '#059669';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 14 + pulse, 22 + pulse, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffd000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy - 10);
        ctx.lineTo(cx + 10, cy + 10);
        ctx.stroke();

        const scanX = cx - hf + (Math.sin(t * 3) * 0.5 + 0.5) * boxSize;
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(scanX, cy - hf);
        ctx.lineTo(scanX, cy + hf);
        ctx.stroke();

        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('EXG: 0.84 CHLOROPHYLL', 8, h - 8);
        ctx.fillText('WEED / CROP', w - 74, h - 8);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [moduleId]);

  return (
    <div className="relative w-full h-full bg-[#080c16]">
      <canvas
        ref={canvasRef}
        width={240}
        height={160}
        className="w-full h-full object-cover block"
      />
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/75 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-white/90 border border-white/20">
        <span className="h-1.5 w-1.5 rounded-full bg-[#00f0ff] animate-ping" />
        <span>LIVE</span>
      </div>
    </div>
  );
};
