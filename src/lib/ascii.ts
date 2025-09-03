/**
 * ASCII conversion library for webcam mirror
 */

import type { CharsetName } from '../types/ascii';

/**
 * Available character sets for ASCII conversion
 */
export const CHARSETS: Record<CharsetName, string> = {
  simple: " .:-=+*#%@",
  detailed: " .'^\",:;Il!i><~+_-?][}{1)(|\\/*tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  blocks: " ░▒▓█"
};

/**
 * Character aspect ratio constant - monospace chars are ~2x taller than wide
 */
export const CHAR_Y_PER_X = 2;

/**
 * Luminance calculation weights (ITU-R BT.709)
 */
const LUMINANCE_WEIGHTS = {
  R: 0.2126,
  G: 0.7152,
  B: 0.0722
} as const;

/**
 * Calculate luminance from RGB values
 * @param r Red component (0-255)
 * @param g Green component (0-255) 
 * @param b Blue component (0-255)
 * @returns Luminance value (0-255)
 */
export function calculateLuminance(r: number, g: number, b: number): number {
  return Math.round(
    r * LUMINANCE_WEIGHTS.R + 
    g * LUMINANCE_WEIGHTS.G + 
    b * LUMINANCE_WEIGHTS.B
  );
}

/**
 * Create a lookup table for brightness to character index mapping
 * @param charset Character set to use
 * @param invert Whether to invert the mapping
 * @returns Lookup table array
 */
export function createBrightnessLUT(charset: string, invert: boolean = false): string[] {
  if (!charset || charset.length === 0) {
    throw new Error('Charset cannot be empty');
  }

  const lut: string[] = new Array(256);
  const charCount = charset.length;

  for (let brightness = 0; brightness < 256; brightness++) {
    let charIndex = Math.floor((brightness / 255) * (charCount - 1));

    if (invert) {
      charIndex = charCount - 1 - charIndex;
    }

    lut[brightness] = charset[charIndex];
  }

  return lut;
}

/**
 * Calculate grid dimensions based on video dimensions and column count
 * @param videoWidth Video width in pixels
 * @param videoHeight Video height in pixels
 * @param cols Number of columns
 * @returns Object with cols and rows
 */
export function calculateGridDimensions(
  videoWidth: number, 
  videoHeight: number, 
  cols: number
): { cols: number; rows: number } {
  const rows = Math.floor(videoHeight / (videoWidth / cols * CHAR_Y_PER_X));
  return { cols, rows };
}

/**
 * Convert ImageData to ASCII string
 * @param imageData Canvas ImageData
 * @param cols Number of columns
 * @param rows Number of rows
 * @param lut Brightness lookup table
 * @param colorMode Whether to include color information
 * @returns ASCII string with optional color data
 */
export function imageDataToAscii(
  imageData: ImageData,
  cols: number,
  rows: number,
  lut: string[],
  colorMode: boolean = false
): { ascii: string; colors?: string[] } {
  const { data, width, height } = imageData;
  const cellWidth = width / cols;
  const cellHeight = height / rows;
  
  let ascii = '';
  const colors: string[] = [];
  
  for (let row = 0; row < rows; row++) {
    let rowString = '';
    let rowColor = '';
    
    for (let col = 0; col < cols; col++) {
      // Calculate average color for this cell
      let totalR = 0, totalG = 0, totalB = 0;
      let pixelCount = 0;
      
      const startX = Math.floor(col * cellWidth);
      const endX = Math.floor((col + 1) * cellWidth);
      const startY = Math.floor(row * cellHeight);
      const endY = Math.floor((row + 1) * cellHeight);
      
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const index = (y * width + x) * 4;
          totalR += data[index];
          totalG += data[index + 1];
          totalB += data[index + 2];
          pixelCount++;
        }
      }
      
      if (pixelCount > 0) {
        const avgR = totalR / pixelCount;
        const avgG = totalG / pixelCount;
        const avgB = totalB / pixelCount;
        
        const brightness = calculateLuminance(avgR, avgG, avgB);
        const char = lut[brightness];
        
        rowString += char;
        
        if (colorMode) {
          rowColor = `rgb(${Math.round(avgR)}, ${Math.round(avgG)}, ${Math.round(avgB)})`;
        }
      } else {
        rowString += lut[0]; // Default to darkest character
      }
    }
    
    ascii += rowString + '\n';
    if (colorMode) {
      colors.push(rowColor);
    }
  }
  
  return colorMode ? { ascii, colors } : { ascii };
}

/**
 * Optimized version that reuses typed arrays
 */
export class AsciiConverter {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private imageData: ImageData | null = null;
  
  constructor() {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not create canvas context');
    }
    this.ctx = ctx;
  }
  
  /**
   * Convert video frame to ASCII
   * @param video Video element
   * @param cols Number of columns
   * @param rows Number of rows
   * @param lut Brightness lookup table
   * @param colorMode Whether to include color
   * @returns ASCII conversion result
   */
  convertVideoFrame(
    video: HTMLVideoElement,
    cols: number,
    rows: number,
    lut: string[],
    colorMode: boolean = false
  ): { ascii: string; colors?: string[] } {
    // Resize canvas if needed
    if (this.canvas.width !== video.videoWidth || this.canvas.height !== video.videoHeight) {
      this.canvas.width = video.videoWidth;
      this.canvas.height = video.videoHeight;
    }
    
    // Draw video frame to canvas
    this.ctx.drawImage(video, 0, 0);
    
    // Get image data
    this.imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    // Convert to ASCII
    return imageDataToAscii(this.imageData, cols, rows, lut, colorMode);
  }
  
  /**
   * Convert ImageBitmap to ASCII
   * @param bitmap ImageBitmap obtained from ImageCapture
   * @param cols Number of columns
   * @param rows Number of rows
   * @param lut Brightness lookup table
   * @param colorMode Whether to include color
   */
  convertImageBitmap(
    bitmap: ImageBitmap,
    cols: number,
    rows: number,
    lut: string[],
    colorMode: boolean = false
  ): { ascii: string; colors?: string[] } {
    // Resize canvas to match bitmap
    this.canvas.width = bitmap.width;
    this.canvas.height = bitmap.height;
    
    this.ctx.drawImage(bitmap, 0, 0);
    this.imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    return imageDataToAscii(this.imageData, cols, rows, lut, colorMode);
  }
  
  /**
   * Convert image to ASCII
   * @param image Image element
   * @param cols Number of columns
   * @param rows Number of rows
   * @param lut Brightness lookup table
   * @param colorMode Whether to include color
   * @returns ASCII conversion result
   */
  convertImage(
    image: HTMLImageElement,
    cols: number,
    rows: number,
    lut: string[],
    colorMode: boolean = false
  ): { ascii: string; colors?: string[] } {
    // Resize canvas to match image
    this.canvas.width = image.naturalWidth || image.width;
    this.canvas.height = image.naturalHeight || image.height;
    
    // Draw image to canvas
    this.ctx.drawImage(image, 0, 0);
    
    // Get image data
    this.imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    // Convert to ASCII
    return imageDataToAscii(this.imageData, cols, rows, lut, colorMode);
  }
}
