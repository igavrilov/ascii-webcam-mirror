import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  AsciiConverter, 
  CHARSETS, 
  createBrightnessLUT, 
  calculateGridDimensions 
} from '../lib/ascii';
import type { CharsetName, AsciiMirrorSettings } from '../types/ascii';

interface AsciiMirrorProps {
  settings: AsciiMirrorSettings;
  onError: (error: string) => void;
  onSnapshot: (ascii: string) => void;
}

export const AsciiMirror: React.FC<AsciiMirrorProps> = ({
  settings,
  onError,
  onSnapshot
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const converterRef = useRef<AsciiConverter | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const initTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [ascii, setAscii] = useState<string>('');
  const [colors, setColors] = useState<string[]>([]);
  const [isWebcamAvailable, setIsWebcamAvailable] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [dimensions, setDimensions] = useState<{ cols: number; rows: number }>({ cols: 80, rows: 24 });
  
  // Initialize ASCII converter
  useEffect(() => {
    try {
      converterRef.current = new AsciiConverter();
    } catch (error) {
      onError('Failed to initialize ASCII converter');
    }
  }, [onError]);
  
  // Initialize webcam - simplified version
  const initializeWebcam = useCallback(async () => {
    console.log('Starting simple camera initialization...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      console.log('Camera stream obtained');
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;

        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded');
          if (videoRef.current) {
            const { videoWidth, videoHeight } = videoRef.current;
            if (videoWidth > 0 && videoHeight > 0) {
              const dims = calculateGridDimensions(videoWidth, videoHeight, 80);
              setDimensions(dims);
              setIsWebcamAvailable(true);
              setIsInitialized(true);
              console.log('Camera ready with dimensions:', dims);
            }
          }
        };

        videoRef.current.play().then(() => {
          console.log('Video playback started');
        }).catch((err) => {
          console.error('Play failed:', err);
        });
      }
    } catch (error) {
      console.error('Camera error:', error);
      setIsWebcamAvailable(false);
      setIsInitialized(true);
      onError('Camera access failed');
    }
  }, [onError]);
  
  // Handle video metadata loaded
  const handleVideoLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      const { videoWidth, videoHeight } = videoRef.current;
      const newDimensions = calculateGridDimensions(videoWidth, videoHeight, settings.cols);
      setDimensions(newDimensions);
    }
  }, [settings.cols]);
  
  // Handle image upload
  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !converterRef.current) return;
    
    const img = new Image();
    img.onload = () => {
      const newDimensions = calculateGridDimensions(img.naturalWidth, img.naturalHeight, settings.cols);
      setDimensions(newDimensions);
      
      const lut = createBrightnessLUT(CHARSETS[settings.charset], settings.invert);
      const result = converterRef.current!.convertImage(
        img, 
        newDimensions.cols, 
        newDimensions.rows, 
        lut, 
        settings.colorMode
      );
      
      setAscii(result.ascii);
      if (result.colors) {
        setColors(result.colors);
      }
    };
    
    img.src = URL.createObjectURL(file);
  }, [settings.cols, settings.charset, settings.invert, settings.colorMode]);
  
  // Animation loop - simplified and more reliable
  const animate = useCallback(() => {
    const video = videoRef.current;
    const converter = converterRef.current;

    if (!video || !converter || settings.isPaused) {
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    try {
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        const lut = createBrightnessLUT(CHARSETS[settings.charset], settings.invert);
        const result = converter.convertVideoFrame(
          video,
          dimensions.cols,
          dimensions.rows,
          lut,
          settings.colorMode
        );

        if (result.ascii && result.ascii.length > 10) {
          setAscii(result.ascii);
          if (result.colors) {
            setColors(result.colors);
          }
        }
      }
    } catch (error) {
      console.error('Animation error:', error);
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [settings.cols, settings.rows, settings.charset, settings.invert, settings.colorMode, settings.isPaused, dimensions.cols, dimensions.rows]);
  
  // Start/stop animation
  useEffect(() => {
    console.log('Animation effect triggered, isPaused:', settings.isPaused);

    if (!settings.isPaused) {
      console.log('Starting animation loop');
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      console.log('Cleaning up animation');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [animate, settings.isPaused]);
  
  // Update dimensions when cols change
  useEffect(() => {
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const { videoWidth, videoHeight } = videoRef.current;
      const newDimensions = calculateGridDimensions(videoWidth, videoHeight, settings.cols);
      setDimensions(newDimensions);
    }
  }, [settings.cols]);
  
  // Initialize on mount
  useEffect(() => {
    console.log('Component mounted, starting camera...');
    initializeWebcam();

    return () => {
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [initializeWebcam]);
  
  // User gesture fallback to satisfy autoplay policies
  useEffect(() => {
    const onPointerDown = () => {
      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', onPointerDown, { once: true });
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);
  
  // Handle snapshot
  const handleSnapshot = useCallback(() => {
    if (ascii) {
      onSnapshot(ascii);
    }
  }, [ascii, onSnapshot]);
  
  // Render ASCII with optional colors
  const renderAscii = () => {
    if (!ascii) return null;
    
    if (settings.colorMode && colors.length > 0) {
      const lines = ascii.split('\n');
      return (
        <div className="ascii-display text-xs">
          {lines.map((line, index) => (
            <div 
              key={index} 
              style={{ color: colors[index] || 'currentColor' }}
              className="block"
            >
              {line}
            </div>
          ))}
        </div>
      );
    }
    
    return (
      <pre className="ascii-display text-xs m-0 p-0">
        {ascii}
      </pre>
    );
  };
  
  if (!isInitialized) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-800 rounded-lg space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
        <div className="text-gray-400 text-center">
          <div>Initializing camera...</div>
          <div className="text-sm text-gray-500 mt-2">
            Please allow camera access when prompted
          </div>
        </div>
        <button
          onClick={initializeWebcam}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm"
        >
          Retry Camera Access
        </button>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Video element (keep in viewport; some browsers pause offscreen decoding) */}
      <video
        ref={videoRef}
        style={{ position: 'fixed', right: '8px', bottom: '8px', width: '320px', height: '240px', opacity: 0, pointerEvents: 'none' }}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={handleVideoLoadedMetadata}
      />
      
      {/* Image upload fallback */}
      {!isWebcamAvailable && (
        <div className="space-y-4">
          <div className="bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
            <div className="space-y-4">
              <button
                onClick={initializeWebcam}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors mr-4"
              >
                Retry Camera
              </button>
              
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                onClick={() => imageInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Upload Image
              </button>
            </div>
            <p className="text-gray-400 mt-2 text-sm">
              Camera not available. Try to retry camera access or upload an image instead.
            </p>
          </div>
        </div>
      )}
      
      {/* ASCII output */}
      <div className="bg-black rounded-lg p-4 overflow-auto max-h-96 border border-gray-700">
        <div className="text-green-400 text-center mb-2 text-xs">
          {dimensions.cols} × {dimensions.rows} characters
          {/* Debug info */}
          <div className="text-gray-500 text-xs mt-1">
            Video ready: {videoRef.current?.readyState || 0}/4 | 
            ASCII length: {ascii.length} | 
            Paused: {settings.isPaused ? 'Yes' : 'No'}
          </div>
        </div>
        {ascii ? renderAscii() : (
          <div className="text-gray-500 text-center py-8">
            {isWebcamAvailable ? 'Processing video...' : 'No video source'}
          </div>
        )}
      </div>
      
      {/* Control buttons */}
      <div className="flex justify-center space-x-4">
        {ascii && (
          <button
            onClick={handleSnapshot}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-sm"
          >
            Take Snapshot
          </button>
        )}
        
        {/* Debug buttons */}
        {isInitialized && !isWebcamAvailable && streamRef.current && (
          <button
            onClick={() => {
              console.log('Force camera activation...');
              if (videoRef.current && streamRef.current) {
                const video = videoRef.current;
                console.log('Current video state:', {
                  readyState: video.readyState,
                  videoWidth: video.videoWidth,
                  videoHeight: video.videoHeight,
                  paused: video.paused
                });
                
                // Force set as available if we have stream and dimensions
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                  console.log('Forcing camera as available');
                  setIsWebcamAvailable(true);
                  const newDimensions = calculateGridDimensions(video.videoWidth, video.videoHeight, settings.cols);
                  setDimensions(newDimensions);
                } else if (video.videoWidth === 0) {
                  console.log('Video dimensions still 0, trying to refresh stream');
                  video.load();
                }
              }
            }}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors text-sm"
          >
            Force Activate Camera
          </button>
        )}
        
        {isWebcamAvailable && !ascii && (
          <button
            onClick={() => {
              console.log('Force processing frame...');
              if (videoRef.current && converterRef.current) {
                try {
                  const lut = createBrightnessLUT(CHARSETS[settings.charset], settings.invert);
                  const result = converterRef.current.convertVideoFrame(
                    videoRef.current,
                    dimensions.cols,
                    dimensions.rows,
                    lut,
                    settings.colorMode
                  );
                  console.log('Force result:', result);
                  if (result.ascii) {
                    setAscii(result.ascii);
                  }
                } catch (error) {
                  console.error('Force processing error:', error);
                }
              }
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm"
          >
            Force Process Frame
          </button>
        )}
      </div>
    </div>
  );
};
