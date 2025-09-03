import '@testing-library/jest-dom';

// Create a canvas context mock that returns proper ImageData
const createCanvasContextMock = () => ({
  drawImage: jest.fn(),
  getImageData: jest.fn((x: number, y: number, width: number, height: number) => {
    // Create ImageData object with proper structure
    const data = new Uint8ClampedArray(width * height * 4);
    // Fill with gray color (RGB: 128, 128, 128, Alpha: 255)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;     // R
      data[i + 1] = 128; // G
      data[i + 2] = 128; // B
      data[i + 3] = 255; // A
    }
    return {
      data,
      width,
      height,
      colorSpace: 'srgb'
    };
  }),
  createImageData: jest.fn(),
  putImageData: jest.fn(),
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  fillText: jest.fn(),
  measureText: jest.fn(() => ({ width: 10 }))
});

// Mock HTMLCanvasElement.getContext
HTMLCanvasElement.prototype.getContext = jest.fn((contextId: string) => {
  if (contextId === '2d') {
    return createCanvasContextMock() as any;
  }
  return null;
});

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getVideoTracks: jest.fn(() => [{
        stop: jest.fn()
      }]),
      getTracks: jest.fn(() => [{
        stop: jest.fn()
      }])
    })
  },
  writable: true
});

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock Blob
global.Blob = jest.fn((parts, options) => ({
  size: parts?.[0]?.length || 0,
  type: options?.type || ''
})) as any;

// Mock HTMLVideoElement
Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
  get: () => 640,
  configurable: true
});

Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
  get: () => 480,
  configurable: true
});

Object.defineProperty(HTMLVideoElement.prototype, 'readyState', {
  get: () => 4, // HAVE_ENOUGH_DATA
  configurable: true
});

// Mock HTMLElement.style
Object.defineProperty(HTMLElement.prototype, 'style', {
  get: function() {
    if (!this._style) {
      this._style = {};
      // Make style properties settable
      Object.defineProperty(this._style, 'position', {
        get: () => 'absolute',
        set: (value: string) => value,
        configurable: true
      });
      Object.defineProperty(this._style, 'left', {
        get: () => '0px',
        set: (value: string) => value,
        configurable: true
      });
      Object.defineProperty(this._style, 'opacity', {
        get: () => '1',
        set: (value: string) => value,
        configurable: true
      });
      Object.defineProperty(this._style, 'pointerEvents', {
        get: () => 'auto',
        set: (value: string) => value,
        configurable: true
      });
    }
    return this._style;
  },
  configurable: true
});

// Mock clipboard with configurable property
let clipboardMock = {
  writeText: jest.fn().mockResolvedValue(undefined)
};

Object.defineProperty(navigator, 'clipboard', {
  get: () => clipboardMock,
  set: (value) => { clipboardMock = value; },
  configurable: true
});

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));

// Mock performance.now
global.performance.now = jest.fn(() => Date.now());
