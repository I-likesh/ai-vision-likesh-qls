export type AIModuleId = 
  | 'dashboard'
  | 'argus'
  | 'gesture'
  | 'motion'
  | 'facemesh'
  | 'plantdoc';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedObject {
  id: string;
  label: string;
  confidence: number;
  bbox: BoundingBox;
  category: 'person' | 'vehicle' | 'furniture' | 'electronic' | 'accessory' | 'custom' | 'other';
  color: string;
  timestamp: number;
}

export interface HandLandmark {
  x: number;
  y: number;
  z?: number;
}

export type HandGesture = 
  | 'Open Palm'
  | 'Closed Fist'
  | 'Thumbs Up'
  | 'Pointing'
  | 'Victory'
  | 'OK Sign'
  | 'None';

export interface HandDetectionResult {
  landmarks: HandLandmark[];
  worldLandmarks?: HandLandmark[];
  videoAspect?: number;
  gesture: HandGesture;
  confidence: number;
  handedness: 'Left' | 'Right';
  pinchDistance?: number;
}

export interface PoseLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface PoseAngles {
  leftElbow: number;
  rightElbow: number;
  leftKnee: number;
  rightKnee: number;
  leftShoulder: number;
  rightShoulder: number;
  spineTilt: number;
  postureScore: number;
}

export type RecognizedPose = 
  | 'Neutral Standing'
  | 'T-Pose'
  | 'Arms Raised'
  | 'Squat'
  | 'Warrior / Lunge'
  | 'Relaxed';

export interface PoseDetectionResult {
  landmarks: PoseLandmark[];
  angles: PoseAngles;
  recognizedPose: RecognizedPose;
  confidence: number;
  reps: number;
}

export interface FaceLandmark {
  x: number;
  y: number;
  z: number;
}

export interface FaceMeshResult {
  landmarks: FaceLandmark[];
  eyeAspectRatio: number;
  mouthOpenness: number;
  faceOrientation: {
    yaw: number;
    pitch: number;
    roll: number;
  };
  keypoints: {
    noseTip: FaceLandmark;
    leftEye: FaceLandmark;
    rightEye: FaceLandmark;
    mouthCenter: FaceLandmark;
  };
}

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export interface VisionEvent {
  id: string;
  timestamp: string;
  module: AIModuleId;
  title: string;
  description: string;
  type: 'info' | 'success' | 'alert';
}

export interface ArgusCustomClass {
  id: string;
  name: string;
  samplesCount: number;
  color: string;
  features: number[][];
  thumbnail?: string;
  createdAt: number;
}

export interface ArgusModelMetadata {
  backbone: 'mobilenet_v2' | 'lite_mobilenet_v2';
  trainingDataImages: string;
  parametersCount: string;
  totalClasses: number;
}

export type PlantHealthRating = 
  | 'Healthy / Vibrant'
  | 'Early Chlorosis'
  | 'Leaf Spot / Blight'
  | 'Moisture Stress';

export interface PlantDiagnosisResult {
  id: string;
  commonName: string;
  scientificName: string;
  family: string;
  isWeed: boolean;
  classificationBadge: string;
  confidence: number;
  healthRating: PlantHealthRating;
  healthScore: number;
  chlorophyllIndex: number;
  nitrogenStatus: 'Rich' | 'Adequate' | 'Mild Deficiency' | 'Depleted';
  ecoTreatment: string;
  scientificFact: string;
  morphology: string;
  weedThreatLevel?: 'High Aggressive' | 'Moderate' | 'Beneficial Wildflower';
}
