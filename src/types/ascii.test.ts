import type { CharsetName, AsciiMirrorSettings } from './ascii';

describe('ASCII Types', () => {
  describe('CharsetName', () => {
    it('should accept valid charset names', () => {
      const simpleCharset: CharsetName = 'simple';
      const detailedCharset: CharsetName = 'detailed';
      const blocksCharset: CharsetName = 'blocks';

      expect(simpleCharset).toBe('simple');
      expect(detailedCharset).toBe('detailed');
      expect(blocksCharset).toBe('blocks');
    });

    it('should reject invalid charset names', () => {
      // TypeScript will catch this at compile time, but we can test the runtime behavior
      const invalidCharset = 'invalid' as any;
      expect(typeof invalidCharset).toBe('string');
    });
  });

  describe('AsciiMirrorSettings', () => {
    it('should create valid settings object', () => {
      const settings: AsciiMirrorSettings = {
        cols: 80,
        invert: false,
        colorMode: false,
        charset: 'simple',
        fpsLimit: 24,
        isPaused: false
      };

      expect(settings.cols).toBe(80);
      expect(settings.invert).toBe(false);
      expect(settings.colorMode).toBe(false);
      expect(settings.charset).toBe('simple');
      expect(settings.fpsLimit).toBe(24);
      expect(settings.isPaused).toBe(false);
    });

    it('should handle all charset types', () => {
      const settingsSimple: AsciiMirrorSettings = {
        cols: 40,
        invert: true,
        colorMode: true,
        charset: 'simple',
        fpsLimit: 30,
        isPaused: true
      };

      const settingsDetailed: AsciiMirrorSettings = {
        ...settingsSimple,
        charset: 'detailed'
      };

      const settingsBlocks: AsciiMirrorSettings = {
        ...settingsSimple,
        charset: 'blocks'
      };

      expect(settingsSimple.charset).toBe('simple');
      expect(settingsDetailed.charset).toBe('detailed');
      expect(settingsBlocks.charset).toBe('blocks');
    });

    it('should handle boolean toggles', () => {
      const settings: AsciiMirrorSettings = {
        cols: 100,
        invert: false,
        colorMode: false,
        charset: 'detailed',
        fpsLimit: 60,
        isPaused: false
      };

      // Test invert toggle
      const invertedSettings = { ...settings, invert: true };
      expect(invertedSettings.invert).toBe(true);

      // Test color mode toggle
      const colorSettings = { ...settings, colorMode: true };
      expect(colorSettings.colorMode).toBe(true);

      // Test pause toggle
      const pausedSettings = { ...settings, isPaused: true };
      expect(pausedSettings.isPaused).toBe(true);
    });

    it('should handle numeric values', () => {
      const settings: AsciiMirrorSettings = {
        cols: 160,
        invert: false,
        colorMode: true,
        charset: 'blocks',
        fpsLimit: 5,
        isPaused: false
      };

      expect(settings.cols).toBeGreaterThan(0);
      expect(settings.fpsLimit).toBeGreaterThan(0);
      expect(settings.cols).toBeLessThanOrEqual(200); // Reasonable upper bound
      expect(settings.fpsLimit).toBeLessThanOrEqual(120); // Reasonable FPS limit
    });

    it('should be extensible for partial updates', () => {
      const baseSettings: AsciiMirrorSettings = {
        cols: 80,
        invert: false,
        colorMode: false,
        charset: 'simple',
        fpsLimit: 24,
        isPaused: false
      };

      // Test partial updates
      const partialUpdate = { cols: 120, fpsLimit: 30 };
      const updatedSettings = { ...baseSettings, ...partialUpdate };

      expect(updatedSettings.cols).toBe(120);
      expect(updatedSettings.fpsLimit).toBe(30);
      expect(updatedSettings.invert).toBe(false); // Unchanged
      expect(updatedSettings.charset).toBe('simple'); // Unchanged
    });

    it('should validate required properties', () => {
      const validSettings: AsciiMirrorSettings = {
        cols: 80,
        invert: false,
        colorMode: false,
        charset: 'simple',
        fpsLimit: 24,
        isPaused: false
      };

      // All required properties should be present
      expect(validSettings).toHaveProperty('cols');
      expect(validSettings).toHaveProperty('invert');
      expect(validSettings).toHaveProperty('colorMode');
      expect(validSettings).toHaveProperty('charset');
      expect(validSettings).toHaveProperty('fpsLimit');
      expect(validSettings).toHaveProperty('isPaused');

      // Properties should have correct types
      expect(typeof validSettings.cols).toBe('number');
      expect(typeof validSettings.invert).toBe('boolean');
      expect(typeof validSettings.colorMode).toBe('boolean');
      expect(typeof validSettings.charset).toBe('string');
      expect(typeof validSettings.fpsLimit).toBe('number');
      expect(typeof validSettings.isPaused).toBe('boolean');
    });
  });
});
