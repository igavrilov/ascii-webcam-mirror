import { calculateGridDimensions } from '../lib/ascii';

describe('calculateGridDimensions', () => {
  it('should calculate correct grid dimensions', () => {
    const result = calculateGridDimensions(640, 480, 80);
    expect(result.cols).toBe(80);
    expect(result.rows).toBe(30); // 480 / (640 / 80 * 2) = 30
  });

  it('should handle different aspect ratios', () => {
    const result = calculateGridDimensions(1920, 1080, 120);
    expect(result.cols).toBe(120);
    expect(result.rows).toBe(33); // 1080 / (1920 / 120 * 2) = 33
  });

  it('should handle square video', () => {
    const result = calculateGridDimensions(640, 640, 80);
    expect(result.cols).toBe(80);
    expect(result.rows).toBe(40); // 640 / (640 / 80) * 0.5 = 40
  });

  it('should handle edge cases', () => {
    const result = calculateGridDimensions(320, 240, 40);
    expect(result.cols).toBe(40);
    expect(result.rows).toBe(15); // 240 / (320 / 40) * 0.5 = 15
  });
});
