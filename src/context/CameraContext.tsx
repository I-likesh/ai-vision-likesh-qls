import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { CameraDevice } from '../types';

interface CameraContextType {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  availableCameras: CameraDevice[];
  selectedDeviceId: string;
  resolution: '720p' | '480p' | '360p';
  isMirrored: boolean;
  fps: number;
  startCamera: () => Promise<boolean>;
  stopCamera: () => void;
  switchCamera: (deviceId: string) => Promise<void>;
  setResolution: (res: '720p' | '480p' | '360p') => void;
  setIsMirrored: (mirror: boolean) => void;
  captureSnapshot: () => string | null;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export const CameraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [resolution, setResolution] = useState<'720p' | '480p' | '360p'>('720p');
  const [isMirrored, setIsMirrored] = useState(true);
  const [fps] = useState(30);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${index + 1}`,
        }));
      setAvailableCameras(videoInputs);
      setSelectedDeviceId((prev) => prev || (videoInputs[0]?.deviceId ?? ''));
    } catch (e) {
      console.warn('Could not enumerate camera devices:', e);
    }
  }, []);

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const stopTracks = useCallback((s: MediaStream | null) => {
    if (s) {
      s.getTracks().forEach((track) => track.stop());
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refreshDevices();
    return () => {
      mountedRef.current = false;
      requestIdRef.current++;
      stopTracks(streamRef.current);
      streamRef.current = null;
    };
  }, [refreshDevices, stopTracks]);

  const stopCamera = useCallback(() => {
    requestIdRef.current++;
    stopTracks(streamRef.current);
    streamRef.current = null;
    setStream(null);
    setIsStreaming(false);
    setIsLoading(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stopTracks]);

  const getConstraints = useCallback(
    (deviceId?: string) => {
      let width = 1280;
      let height = 720;
      if (resolution === '480p') {
        width = 854;
        height = 480;
      } else if (resolution === '360p') {
        width = 640;
        height = 360;
      }

      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: width },
        height: { ideal: height },
      };

      if (deviceId) {
        videoConstraints.deviceId = { exact: deviceId };
      } else {
        videoConstraints.facingMode = 'user';
      }

      return {
        video: videoConstraints,
        audio: false,
      };
    },
    [resolution]
  );

  const acquireStream = useCallback(
    async (deviceId?: string): Promise<MediaStream> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Webcam API is not supported in this browser. Please use a modern browser.');
      }
      try {
        return await navigator.mediaDevices.getUserMedia(getConstraints(deviceId));
      } catch (err) {
        if (err instanceof DOMException && err.name === 'OverconstrainedError') {
          return await navigator.mediaDevices.getUserMedia({
            video: deviceId ? { deviceId: { ideal: deviceId } } : true,
            audio: false,
          });
        }
        throw err;
      }
    },
    [getConstraints]
  );

  const startCamera = useCallback(async (): Promise<boolean> => {
    const reqId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    stopTracks(streamRef.current);
    streamRef.current = null;
    setStream(null);

    let acquiredStream: MediaStream | null = null;
    try {
      acquiredStream = await acquireStream(selectedDeviceId || undefined);

      if (!mountedRef.current || reqId !== requestIdRef.current) {
        stopTracks(acquiredStream);
        return false;
      }

      streamRef.current = acquiredStream;
      setStream(acquiredStream);
      if (videoRef.current) {
        videoRef.current.srcObject = acquiredStream;
        await videoRef.current.play();
      }

      if (!mountedRef.current || reqId !== requestIdRef.current) {
        stopTracks(acquiredStream);
        if (streamRef.current === acquiredStream) {
          streamRef.current = null;
        }
        return false;
      }

      setIsStreaming(true);
      setIsLoading(false);
      await refreshDevices();
      return true;
    } catch (err: unknown) {
      stopTracks(acquiredStream);
      if (streamRef.current === acquiredStream) {
        streamRef.current = null;
      }
      if (mountedRef.current && reqId === requestIdRef.current) {
        const message =
          err instanceof Error ? err.message : 'Webcam permission denied or camera device not found.';
        setError(message);
        setIsLoading(false);
        setIsStreaming(false);
        setStream(null);
      }
      return false;
    }
  }, [stopTracks, acquireStream, selectedDeviceId, refreshDevices]);

  const switchCamera = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      if (!isStreaming) return;

      const reqId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);
      stopTracks(streamRef.current);
      streamRef.current = null;
      setStream(null);

      let acquiredStream: MediaStream | null = null;
      try {
        acquiredStream = await acquireStream(deviceId);

        if (!mountedRef.current || reqId !== requestIdRef.current) {
          stopTracks(acquiredStream);
          return;
        }

        streamRef.current = acquiredStream;
        setStream(acquiredStream);
        if (videoRef.current) {
          videoRef.current.srcObject = acquiredStream;
          await videoRef.current.play();
        }
        if (mountedRef.current && reqId === requestIdRef.current) {
          setIsStreaming(true);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        stopTracks(acquiredStream);
        if (mountedRef.current && reqId === requestIdRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to switch camera');
          setIsStreaming(false);
          setIsLoading(false);
          setStream(null);
        }
      }
    },
    [isStreaming, stopTracks, acquireStream]
  );

  const captureSnapshot = useCallback((): string | null => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/png');
  }, [isMirrored]);

  return (
    <CameraContext.Provider
      value={{
        videoRef,
        stream,
        isStreaming,
        isLoading,
        error,
        availableCameras,
        selectedDeviceId,
        resolution,
        isMirrored,
        fps,
        startCamera,
        stopCamera,
        switchCamera,
        setResolution,
        setIsMirrored,
        captureSnapshot,
      }}
    >
      <video ref={videoRef} playsInline muted autoPlay className="hidden" />
      {children}
    </CameraContext.Provider>
  );
};

export function useCamera() {
  const ctx = useContext(CameraContext);
  if (!ctx) {
    throw new Error('useCamera must be used within a CameraProvider');
  }
  return ctx;
}
