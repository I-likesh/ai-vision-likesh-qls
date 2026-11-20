import { PlantDiagnosisResult, PlantHealthRating } from '../types';

export const BOTANICAL_DATABASE: PlantDiagnosisResult[] = [
  {
    id: 'dandelion',
    commonName: 'Dandelion',
    scientificName: 'Taraxacum officinale',
    family: 'Asteraceae (Composite Family)',
    isWeed: true,
    classificationBadge: 'INVASIVE WEED',
    confidence: 96.4,
    healthRating: 'Healthy / Vibrant',
    healthScore: 92,
    chlorophyllIndex: 0.78,
    nitrogenStatus: 'Adequate',
    ecoTreatment: 'Excavate central taproot 2 inches below crown; apply 10% horticultural vinegar solution on sunny mornings.',
    scientificFact: 'Deep taproot mines calcium and potassium from subsoil. Produces up to 15,000 wind-dispersed parachute achenes.',
    morphology: 'Basal rosette with sharply toothed, lanceolate runcinate leaves and hollow leafless milky scape.',
    weedThreatLevel: 'High Aggressive'
  },
  {
    id: 'crabgrass',
    commonName: 'Large Crabgrass',
    scientificName: 'Digitaria sanguinalis',
    family: 'Poaceae (Grass Family)',
    isWeed: true,
    classificationBadge: 'NOXIOUS WEED',
    confidence: 94.8,
    healthRating: 'Healthy / Vibrant',
    healthScore: 89,
    chlorophyllIndex: 0.72,
    nitrogenStatus: 'Adequate',
    ecoTreatment: 'Maintain lawn mowing height at 3+ inches to block sunlight; apply organic corn gluten meal in early spring.',
    scientificFact: 'A single crabgrass tiller produces over 150,000 seeds that can remain dormant in soil for 3 to 5 years.',
    morphology: 'Prostrate branching habit with purplish swollen leaf nodes and finger-like digitate seedheads.',
    weedThreatLevel: 'High Aggressive'
  },
  {
    id: 'plantain',
    commonName: 'Broadleaf Plantain',
    scientificName: 'Plantago major',
    family: 'Plantaginaceae (Plantain Family)',
    isWeed: true,
    classificationBadge: 'RESILIENT WEED',
    confidence: 91.5,
    healthRating: 'Early Chlorosis',
    healthScore: 78,
    chlorophyllIndex: 0.64,
    nitrogenStatus: 'Mild Deficiency',
    ecoTreatment: 'Aerate soil to alleviate mechanical compaction; manual weeding with dandelion fork.',
    scientificFact: 'Bio-indicator of heavy foot traffic and anaerobic compressed subsoil. Seeds develop adhesive mucilage when damp.',
    morphology: 'Dense basal rosette of broad oval leaves with 3 to 7 prominent parallel veins.',
    weedThreatLevel: 'Moderate'
  },
  {
    id: 'clover',
    commonName: 'White Clover',
    scientificName: 'Trifolium repens',
    family: 'Fabaceae (Legume Family)',
    isWeed: true,
    classificationBadge: 'NITROGEN-FIXING WEED',
    confidence: 95.2,
    healthRating: 'Healthy / Vibrant',
    healthScore: 95,
    chlorophyllIndex: 0.82,
    nitrogenStatus: 'Rich',
    ecoTreatment: 'Beneficial for honeybees; if turf monoculture is desired, hand-pull stolons before white flower anthesis.',
    scientificFact: 'Forms symbiotic root nodules with Rhizobium bacteria, fixing atmospheric nitrogen gas (N2) into organic soil nitrates.',
    morphology: 'Trifoliate compound leaves with crescent watermarks and creeping stolons rooting at nodes.',
    weedThreatLevel: 'Beneficial Wildflower'
  },
  {
    id: 'tomato',
    commonName: 'Garden Tomato',
    scientificName: 'Solanum lycopersicum',
    family: 'Solanaceae (Nightshade Family)',
    isWeed: false,
    classificationBadge: 'CROP / VEGETABLE',
    confidence: 97.1,
    healthRating: 'Healthy / Vibrant',
    healthScore: 94,
    chlorophyllIndex: 0.86,
    nitrogenStatus: 'Adequate',
    ecoTreatment: 'Mulch base with straw to stop fungal rain splash; supply bone meal or calcium nitrate to prevent blossom end rot.',
    scientificFact: 'Foliage contains glandular trichomes that secrete volatile aromatic sesquiterpenes serving as natural insect repellents.',
    morphology: 'Alternate odd-pinnate leaves with glandular hairs, pungent aroma, and yellow 5-merous star flowers.'
  },
  {
    id: 'basil',
    commonName: 'Sweet Basil',
    scientificName: 'Ocimum basilicum',
    family: 'Lamiaceae (Mint Family)',
    isWeed: false,
    classificationBadge: 'CULINARY HERB',
    confidence: 96.8,
    healthRating: 'Healthy / Vibrant',
    healthScore: 96,
    chlorophyllIndex: 0.88,
    nitrogenStatus: 'Adequate',
    ecoTreatment: 'Pinch top apical shoots regularly to stimulate lateral bushiness and delay bitter seed bolting.',
    scientificFact: 'Rich in eugenol and linalool essential oils synthesized within specialized peltate glandular trichomes on leaf epidermal cells.',
    morphology: 'Opposite ovate lustrous green leaves with square quadrangular stems and verticillaster floral whorls.'
  },
  {
    id: 'monstera',
    commonName: 'Swiss Cheese Plant',
    scientificName: 'Monstera deliciosa',
    family: 'Araceae (Arum Family)',
    isWeed: false,
    classificationBadge: 'TROPICAL HOUSEPLANT',
    confidence: 98.2,
    healthRating: 'Healthy / Vibrant',
    healthScore: 93,
    chlorophyllIndex: 0.85,
    nitrogenStatus: 'Adequate',
    ecoTreatment: 'Wipe foliage with microfiber cloth to remove domestic dust; provide moss pole for adventitious aerial root anchoring.',
    scientificFact: 'Leaf perforations (fenestrations) reduce wind drag in rainforest canopies and permit sunlight to penetrate lower leaves.',
    morphology: 'Large cordate leathery leaves developing deep pinnatifid perforations with climbing hemi-epiphytic habit.'
  },
  {
    id: 'pepper',
    commonName: 'Bell Pepper',
    scientificName: 'Capsicum annuum',
    family: 'Solanaceae (Nightshade Family)',
    isWeed: false,
    classificationBadge: 'CROP / VEGETABLE',
    confidence: 93.7,
    healthRating: 'Early Chlorosis',
    healthScore: 76,
    chlorophyllIndex: 0.62,
    nitrogenStatus: 'Mild Deficiency',
    ecoTreatment: 'Supplement with compost tea or chelated iron liquid fertilizer to restore vibrant green chloroplast synthesis.',
    scientificFact: 'Photosynthetic efficiency peaks at 24°C–28°C. Interveinal leaf chlorosis is an early bio-marker of micronutrient restriction.',
    morphology: 'Elliptic smooth-margined leaves with pendant white solitary flowers and hollow multilocular fruit.'
  }
];

export interface PlantSpectralAnalysis {
  diagnosis: PlantDiagnosisResult;
  excessGreenIndex: number;
  chlorophyllLevel: number;
  yellowChlorosisIndex: number;
  brownNecrosisIndex: number;
  rgbMeans: { r: number; g: number; b: number };
}

export class PlantDocService {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 160;
    this.canvas.height = 120;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  private extractMetricsFromCurrentCanvas(selectedSpecimenId?: string, autoClassifyBySpectrum = false): PlantSpectralAnalysis {
    let avgR = 80;
    let avgG = 135;
    let avgB = 60;
    let liveExg = 0.72;
    let liveYellow = 0.14;
    let liveBrown = 0.06;

    if (this.ctx) {
      const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const d = imgData.data;
      let sumR = 0, sumG = 0, sumB = 0;
      let yellowPixels = 0;
      let brownPixels = 0;
      const total = d.length / 4;

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        sumR += r;
        sumG += g;
        sumB += b;

        if (r > 130 && g > 130 && b < 100) yellowPixels++;
        if (r > 90 && g < 80 && b < 70) brownPixels++;
      }

      avgR = Math.round(sumR / total);
      avgG = Math.round(sumG / total);
      avgB = Math.round(sumB / total);
      liveExg = Math.min(1, Math.max(0.05, (2 * avgG - avgR - avgB) / 255));
      liveYellow = yellowPixels / total;
      liveBrown = brownPixels / total;
    }

    let baseSpecimen: PlantDiagnosisResult = BOTANICAL_DATABASE[0];
    if (selectedSpecimenId) {
      baseSpecimen = BOTANICAL_DATABASE.find((p) => p.id === selectedSpecimenId) || BOTANICAL_DATABASE[0];
    } else if (autoClassifyBySpectrum) {
      if (liveYellow > 0.2) {
        baseSpecimen = BOTANICAL_DATABASE[0];
      } else if (liveExg > 0.65) {
        baseSpecimen = BOTANICAL_DATABASE[6];
      } else if (avgG > avgR && liveExg > 0.35) {
        baseSpecimen = BOTANICAL_DATABASE[5];
      } else {
        baseSpecimen = BOTANICAL_DATABASE[1];
      }
    }

    let healthRating: PlantHealthRating = 'Healthy / Vibrant';
    let healthScore = Math.round(74 + liveExg * 26 - liveYellow * 28 - liveBrown * 24);
    healthScore = Math.max(45, Math.min(99, healthScore));

    if (liveBrown > 0.18) {
      healthRating = 'Leaf Spot / Blight';
    } else if (liveYellow > 0.22 || liveExg < 0.25) {
      healthRating = 'Early Chlorosis';
    } else if (healthScore < 70) {
      healthRating = 'Moisture Stress';
    }

    const diagnosis: PlantDiagnosisResult = {
      ...baseSpecimen,
      healthRating,
      healthScore,
      chlorophyllIndex: Number(liveExg.toFixed(2)),
      nitrogenStatus: baseSpecimen.id === 'clover' ? 'Rich' : liveYellow > 0.2 ? 'Mild Deficiency' : liveExg > 0.45 ? 'Adequate' : 'Depleted',
    };

    return {
      diagnosis,
      excessGreenIndex: Number(liveExg.toFixed(2)),
      chlorophyllLevel: Math.round(liveExg * 100),
      yellowChlorosisIndex: Number(liveYellow.toFixed(2)),
      brownNecrosisIndex: Number(liveBrown.toFixed(2)),
      rgbMeans: { r: avgR, g: avgG, b: avgB },
    };
  }

  public analyzeFrame(
    video: HTMLVideoElement,
    selectedSpecimenId?: string
  ): PlantSpectralAnalysis {
    if (this.ctx && video.readyState >= 2 && video.videoWidth > 0) {
      try {
        const cropW = Math.floor(video.videoWidth * 0.45);
        const cropH = Math.floor(video.videoHeight * 0.45);
        const startX = Math.floor((video.videoWidth - cropW) / 2);
        const startY = Math.floor((video.videoHeight - cropH) / 2);

        this.ctx.drawImage(
          video,
          startX,
          startY,
          cropW,
          cropH,
          0,
          0,
          this.canvas.width,
          this.canvas.height
        );
      } catch {
        return this.extractMetricsFromCurrentCanvas(selectedSpecimenId);
      }
    }
    return this.extractMetricsFromCurrentCanvas(selectedSpecimenId);
  }

  public analyzeImageElement(img: HTMLImageElement): PlantSpectralAnalysis {
    if (this.ctx && img.naturalWidth > 0) {
      this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
    }
    return this.extractMetricsFromCurrentCanvas(undefined, true);
  }
}

export const plantDocService = new PlantDocService();
