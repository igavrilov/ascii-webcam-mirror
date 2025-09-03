/**
 * ASCII types and interfaces
 */

export type CharsetName = 'simple' | 'detailed' | 'blocks';

export interface AsciiMirrorSettings {
  cols: number;
  invert: boolean;
  colorMode: boolean;
  charset: CharsetName;
  fpsLimit: number;
  isPaused: boolean;
}
