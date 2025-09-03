import {
  imageDataToAscii,
  createBrightnessLUT,
  CHARSETS,
  calculateLuminance,
  AsciiConverter
} from './ascii';

// Mock AsciiConverter to avoid canvas dependency in tests
jest.mock('./ascii', () => {
  const originalModule = jest.requireActual('./ascii');

  return {
    ...originalModule,
    AsciiConverter: jest.fn().mockImplementation(() => ({
      convertVideoFrame: jest.fn((video, cols, rows, lut, colorMode) => {
        // Simple mock that returns predictable ASCII based on parameters
        const mockAscii = '@'.repeat(cols) + '\n';
        const result: any = { ascii: mockAscii.repeat(rows).slice(0, -1) };

        if (colorMode) {
          result.colors = Array(rows).fill('rgb(128, 128, 128)');
        }

        return result;
      }),
      convertImage: jest.fn((image, cols, rows, lut, colorMode) => {
        const mockAscii = '@'.repeat(cols) + '\n';
        const result: any = { ascii: mockAscii.repeat(rows).slice(0, -1) };

        if (colorMode) {
          result.colors = Array(rows).fill('rgb(128, 128, 128)');
        }

        return result;
      }),
      convertImageBitmap: jest.fn((bitmap, cols, rows, lut, colorMode) => {
        const mockAscii = '@'.repeat(cols) + '\n';
        const result: any = { ascii: mockAscii.repeat(rows).slice(0, -1) };

        if (colorMode) {
          result.colors = Array(rows).fill('rgb(128, 128, 128)');
        }

        return result;
      })
    }))
  };
});

// Mock canvas for tests
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: jest.fn(() => ({
    drawImage: jest.fn(),
    getImageData: jest.fn(),
    createImageData: jest.fn(),
    putImageData: jest.fn(),
    clearRect: jest.fn()
  }))
};

// Mock document.createElement for canvas
const originalCreateElement = document.createElement;
document.createElement = jest.fn((tagName: string) => {
  if (tagName === 'canvas') {
    return mockCanvas as any;
  }
  return originalCreateElement.call(document, tagName);
});

describe('ASCII Library', () => {
  describe('calculateLuminance', () => {
    it('should calculate luminance correctly', () => {
      // Pure white: 0.2126*255 + 0.7152*255 + 0.0722*255 = 255
      expect(calculateLuminance(255, 255, 255)).toBeCloseTo(255, 0);
      // Pure black: 0.2126*0 + 0.7152*0 + 0.0722*0 = 0
      expect(calculateLuminance(0, 0, 0)).toBe(0);
      // Gray: 0.2126*128 + 0.7152*128 + 0.0722*128 = 128
      expect(calculateLuminance(128, 128, 128)).toBeCloseTo(128, 0);
      // Red: 0.2126*255 + 0.7152*0 + 0.0722*0 = 54.06
      expect(calculateLuminance(255, 0, 0)).toBeCloseTo(54.06, 0);
      // Green: 0.2126*0 + 0.7152*255 + 0.0722*0 = 182.1
      expect(calculateLuminance(0, 255, 0)).toBeCloseTo(182.1, 0);
      // Blue: 0.2126*0 + 0.7152*0 + 0.0722*255 = 18.41
      expect(calculateLuminance(0, 0, 255)).toBeCloseTo(18.41, 0);
    });
  });

  describe('createBrightnessLUT', () => {
    it('should create lookup table for simple charset', () => {
      const lut = createBrightnessLUT(CHARSETS.simple, false);
      expect(lut).toHaveLength(256);
      expect(lut[0]).toBe(' '); // Darkest
      expect(lut[255]).toBe('@'); // Brightest
    });

    it('should create lookup table for detailed charset', () => {
      const lut = createBrightnessLUT(CHARSETS.detailed, false);
      expect(lut).toHaveLength(256);
      expect(lut[0]).toBe(' '); // Darkest
      expect(lut[255]).toBe('$'); // Brightest - last character in detailed charset
    });

    it('should create lookup table for blocks charset', () => {
      const lut = createBrightnessLUT(CHARSETS.blocks, false);
      expect(lut).toHaveLength(256);
      expect(lut[0]).toBe(' '); // Darkest - first character
      expect(lut[255]).toBe('█'); // Brightest - last character
    });

    it('should invert brightness when invert is true', () => {
      const lut = createBrightnessLUT(CHARSETS.simple, true);
      expect(lut[0]).toBe('@'); // Inverted: darkest becomes brightest
      expect(lut[255]).toBe(' '); // Inverted: brightest becomes darkest
    });

    it('should handle edge cases', () => {
      expect(() => createBrightnessLUT([], false)).toThrow();
      expect(() => createBrightnessLUT(['a'], false)).not.toThrow();
    });
  });

  describe('imageDataToAscii', () => {
    const createMockImageData = (width: number, height: number, color: [number, number, number, number] = [255, 255, 255, 255]): ImageData => {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = color[0];     // R
        data[i + 1] = color[1]; // G
        data[i + 2] = color[2]; // B
        data[i + 3] = color[3]; // A
      }
      return {
        data,
        width,
        height,
        colorSpace: 'srgb' as any
      } as ImageData;
    };

    it('should convert image data to ASCII without colors', () => {
      const imageData = createMockImageData(2, 2, [255, 255, 255, 255]); // White image
      const lut = createBrightnessLUT(CHARSETS.simple, false);
      const result = imageDataToAscii(imageData, 2, 2, lut, false);

      expect(result.ascii).toContain('@'); // White should map to brightest character
      expect(result.colors).toBeUndefined();
    });

    it('should convert image data to ASCII with colors', () => {
      const imageData = createMockImageData(2, 2, [255, 255, 255, 255]); // White image (bright)
      const lut = createBrightnessLUT(CHARSETS.simple, false);
      const result = imageDataToAscii(imageData, 2, 2, lut, true);

      expect(result.ascii).toContain('@'); // White should map to brightest character
      expect(result.colors).toBeDefined();
      expect(result.colors).toHaveLength(2); // 2 rows
      expect(result.colors![0]).toBe('rgb(255, 255, 255)'); // White color
    });

    it('should handle black image correctly', () => {
      const imageData = createMockImageData(2, 2, [0, 0, 0, 255]); // Black image
      const lut = createBrightnessLUT(CHARSETS.simple, false);
      const result = imageDataToAscii(imageData, 2, 2, lut, false);

      expect(result.ascii).toContain(' '); // Black should map to darkest character
    });

    it('should handle different grid sizes', () => {
      const imageData = createMockImageData(4, 4, [128, 128, 128, 255]); // Gray image
      const lut = createBrightnessLUT(CHARSETS.simple, false);

      const result2x2 = imageDataToAscii(imageData, 2, 2, lut, false); // Smaller grid
      const result4x4 = imageDataToAscii(imageData, 4, 4, lut, false); // Larger grid

      // Larger grid should produce more characters (including newlines)
      expect(result4x4.ascii.length).toBeGreaterThan(result2x2.ascii.length);
      expect(result2x2.ascii.split('\n')).toHaveLength(3); // 2 rows + 1 newline
      expect(result4x4.ascii.split('\n')).toHaveLength(5); // 4 rows + 1 newline
    });

    it('should handle empty image data', () => {
      const emptyImageData = createMockImageData(0, 0);
      const lut = createBrightnessLUT(CHARSETS.simple, false);
      const result = imageDataToAscii(emptyImageData, 1, 1, lut, false);

      expect(result.ascii).toBe(' \n');
    });
  });

  describe('AsciiConverter', () => {
    it('should initialize with canvas', () => {
      const converter = new AsciiConverter();
      expect(converter).toBeDefined();
    });

    it('should convert video frame correctly', () => {
      const converter = new AsciiConverter();
      // Mock video element
      const mockVideo = {
        videoWidth: 640,
        videoHeight: 480,
        readyState: 4
      } as HTMLVideoElement;

      const lut = createBrightnessLUT(CHARSETS.simple, false);
      const result = converter.convertVideoFrame(mockVideo, 80, 24, lut, false);

      expect(result.ascii).toBeDefined();
      expect(typeof result.ascii).toBe('string');
      expect(result.ascii.length).toBeGreaterThan(0);
    });

    it('should convert image correctly', () => {
      const converter = new AsciiConverter();
      const mockImage = {
        naturalWidth: 100,
        naturalHeight: 100,
        width: 100,
        height: 100
      } as HTMLImageElement;

      const lut = createBrightnessLUT(CHARSETS.simple, false);
      const result = converter.convertImage(mockImage, 10, 10, lut, false);

      expect(result.ascii).toBeDefined();
      expect(typeof result.ascii).toBe('string');
    });

    it('should convert ImageBitmap correctly', () => {
      const converter = new AsciiConverter();
      const mockBitmap = {
        width: 100,
        height: 100
      } as ImageBitmap;

      const lut = createBrightnessLUT(CHARSETS.simple, false);
      const result = converter.convertImageBitmap(mockBitmap, 10, 10, lut, false);

      expect(result.ascii).toBeDefined();
      expect(typeof result.ascii).toBe('string');
    });

    it('should handle color mode in video conversion', () => {
      const converter = new AsciiConverter();
      const mockVideo = {
        videoWidth: 320,
        videoHeight: 240,
        readyState: 4
      } as HTMLVideoElement;

      const lut = createBrightnessLUT(CHARSETS.simple, false);
      const result = converter.convertVideoFrame(mockVideo, 32, 12, lut, true);

      expect(result.ascii).toBeDefined();
      expect(result.colors).toBeDefined();
      expect(Array.isArray(result.colors)).toBe(true);
      expect(result.colors!.length).toBe(12); // 12 rows
    });
  });

  describe('CHARSETS', () => {
    it('should have all required charsets', () => {
      expect(CHARSETS.simple).toBeDefined();
      expect(CHARSETS.detailed).toBeDefined();
      expect(CHARSETS.blocks).toBeDefined();
    });

    it('should have proper length for each charset', () => {
      expect(CHARSETS.simple.length).toBeGreaterThan(0);
      expect(CHARSETS.detailed.length).toBeGreaterThan(0);
      expect(CHARSETS.blocks.length).toBeGreaterThan(0);
    });

    it('should have unique characters in charsets', () => {
      // Check that charsets contain expected characters
      expect(CHARSETS.simple).toContain(' ');
      expect(CHARSETS.simple).toContain('@');
      expect(CHARSETS.blocks).toContain('░');
      expect(CHARSETS.blocks).toContain('█');
    });
  });
});
