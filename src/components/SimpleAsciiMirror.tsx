import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AsciiConverter, CHARSETS, createBrightnessLUT, calculateGridDimensions } from '../lib/ascii';
import type { CharsetName } from '../types/ascii';

// Settings interface
interface AsciiMirrorSettings {
  cols: number;
  invert: boolean;
  colorMode: boolean;
  charset: CharsetName;
  fpsLimit: number;
  isPaused: boolean;
}

export const SimpleAsciiMirror: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const converterRef = useRef<AsciiConverter | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const [ascii, setAscii] = useState<string>('');
  const [colors, setColors] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('Initializing...');
  const [lastSnapshot, setLastSnapshot] = useState<string>('');

  // Settings state
  const [settings, setSettings] = useState<AsciiMirrorSettings>({
    cols: 80,
    invert: false,
    colorMode: false,
    charset: 'simple',
    fpsLimit: 24,
    isPaused: false
  });

  // Use ref for settings to avoid interrupting animation
  const settingsRef = useRef<AsciiMirrorSettings>(settings);

  // Animation loop - moved above useEffect that uses it
  const animate = useCallback(() => {
    if (!videoRef.current || !converterRef.current) {
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    const video = videoRef.current;
    const converter = converterRef.current;
    const currentSettings = settingsRef.current;

    if (currentSettings.isPaused) {
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    const currentTime = performance.now();
    const deltaTime = currentTime - lastFrameTimeRef.current;
    const targetFrameTime = 1000 / currentSettings.fpsLimit;

    if (deltaTime >= targetFrameTime && video.readyState >= 2 && video.videoWidth > 0) {
      try {
        const lut = createBrightnessLUT(CHARSETS[currentSettings.charset], currentSettings.invert);
        const rows = Math.floor(video.videoHeight / (video.videoWidth / currentSettings.cols) * 0.5);
        const result = converter.convertVideoFrame(video, currentSettings.cols, rows, lut, currentSettings.colorMode);
        setAscii(result.ascii);

        if (result.colors) {
          setColors(result.colors);
        } else {
          setColors([]);
        }
        lastFrameTimeRef.current = currentTime;
      } catch (error) {
        console.error('Animation error:', error);
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }, []); // Remove settings dependency to avoid recreating function

  useEffect(() => {
    // Initialize converter
    converterRef.current = new AsciiConverter();

    // Start camera immediately
    startCamera();
  }, []);

  // Start/stop animation
  useEffect(() => {
    console.log('Starting animation loop');
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [animate]);

  // Handle pause/resume separately
  useEffect(() => {
    if (settings.isPaused) {
      console.log('Animation paused');
    } else {
      console.log('Animation resumed');
    }
  }, [settings.isPaused]);

  const startCamera = async () => {
    try {
      setStatus('Requesting camera...');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });

      setStatus('Camera access granted');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;

        videoRef.current.onloadedmetadata = () => {
          setStatus(`Video ready: ${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}`);

          // Start animation loop
          animate();
        };

        await videoRef.current.play();
        setStatus('Video playing');
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      console.error(error);
    }
  };

  // Update settings
  const updateSettings = useCallback((updates: Partial<AsciiMirrorSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  // Sync settings ref with state
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Handle snapshot
  const handleSnapshot = useCallback(() => {
    if (!ascii) return;

    setLastSnapshot(ascii);

    // Download as .txt file
    const blob = new Blob([ascii], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ascii-snapshot-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [ascii]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async () => {
    if (!ascii) return;

    try {
      await navigator.clipboard.writeText(ascii);
      setStatus('Copied to clipboard!');
      setTimeout(() => setStatus('Camera ready'), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, [ascii]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case ' ':
          event.preventDefault();
          updateSettings({ isPaused: !settings.isPaused });
          break;
        case '[':
          event.preventDefault();
          updateSettings({ cols: Math.max(40, settings.cols - 5) });
          break;
        case ']':
          event.preventDefault();
          updateSettings({ cols: Math.min(160, settings.cols + 5) });
          break;
        case 'i':
          event.preventDefault();
          updateSettings({ invert: !settings.invert });
          break;
        case 'c':
          event.preventDefault();
          updateSettings({ colorMode: !settings.colorMode });
          break;
        case 's':
          event.preventDefault();
          handleSnapshot();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings, updateSettings, handleSnapshot]);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', background: '#000', color: '#0f0' }}>
      <h1 style={{ color: '#64ff64', marginBottom: '20px' }}>ASCII Webcam Mirror</h1>

      <div style={{ margin: '10px 0', padding: '10px', background: '#111', border: '1px solid #333' }}>
        Status: {status}
      </div>

      {/* Controls */}
      <div style={{ margin: '20px 0', padding: '20px', background: '#111', border: '1px solid #333' }}>
        <h3 style={{ marginBottom: '15px' }}>Controls</h3>
        <div style={{ marginBottom: '15px', fontSize: '12px', color: '#888' }}>
          <strong>Hotkeys:</strong> Space (pause), [/] (columns), I (invert), C (color), S (snapshot)
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Columns: {settings.cols}</label>
          <input
            type="range"
            min="40"
            max="160"
            value={settings.cols}
            onChange={(e) => updateSettings({ cols: parseInt(e.target.value) })}
            style={{ width: '100%', margin: '5px 0' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>FPS Limit: {settings.fpsLimit}</label>
          <input
            type="range"
            min="5"
            max="60"
            value={settings.fpsLimit}
            onChange={(e) => updateSettings({ fpsLimit: parseInt(e.target.value) })}
            style={{ width: '100%', margin: '5px 0' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Charset:</label>
          <select
            value={settings.charset}
            onChange={(e) => updateSettings({ charset: e.target.value as CharsetName })}
            style={{ width: '100%', margin: '5px 0', padding: '5px' }}
          >
            <option value="simple">Simple ( .:-=+*#%@)</option>
            <option value="detailed">Detailed</option>
            <option value="blocks">Blocks ( ░▒▓█)</option>
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            <input
              type="checkbox"
              checked={settings.invert}
              onChange={(e) => updateSettings({ invert: e.target.checked })}
              style={{ marginRight: '8px' }}
            />
            Invert
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            <input
              type="checkbox"
              checked={settings.colorMode}
              onChange={(e) => updateSettings({ colorMode: e.target.checked })}
              style={{ marginRight: '8px' }}
            />
            Color Mode
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            <input
              type="checkbox"
              checked={settings.isPaused}
              onChange={(e) => updateSettings({ isPaused: e.target.checked })}
              style={{ marginRight: '8px' }}
            />
            {settings.isPaused ? 'Paused' : 'Running'}
          </label>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={startCamera}
            style={{
              background: '#333',
              color: '#0f0',
              border: '1px solid #555',
              padding: '8px 16px',
              cursor: 'pointer'
            }}
          >
            Start Camera
          </button>

          <button
            onClick={handleSnapshot}
            disabled={!ascii}
            style={{
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              cursor: ascii ? 'pointer' : 'not-allowed',
              opacity: ascii ? 1 : 0.5
            }}
          >
            Download .txt
          </button>

          <button
            onClick={copyToClipboard}
            disabled={!ascii}
            style={{
              background: '#2196F3',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              cursor: ascii ? 'pointer' : 'not-allowed',
              opacity: ascii ? 1 : 0.5
            }}
          >
            Copy to Clipboard
          </button>
        </div>
      </div>

      {/* ASCII Display */}
      <div style={{
        background: '#111',
        padding: '10px',
        border: '1px solid #333',
        whiteSpace: 'pre',
        fontSize: '10px',
        lineHeight: '1',
        maxHeight: '500px',
        overflowY: 'auto',
        marginTop: '20px'
      }}>
        {settings.colorMode && colors.length > 0 ? (
          // Color mode: render each line with its color
          ascii.split('\n').map((line, index) => (
            <div
              key={index}
              style={{
                color: colors[index] || '#0f0',
                margin: 0,
                padding: 0,
                lineHeight: '1'
              }}
            >
              {line}
            </div>
          ))
        ) : (
          // Normal mode: render as plain text
          <div style={{ color: '#0f0' }}>
            {ascii || 'ASCII will appear here...'}
          </div>
        )}
      </div>

      {/* Hidden video */}
      <video
        ref={videoRef}
        style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }}
        autoPlay
        playsInline
        muted
      />
    </div>
  );
};
