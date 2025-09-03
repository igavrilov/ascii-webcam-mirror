import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

// Mock all external dependencies
jest.mock('../lib/ascii', () => ({
  AsciiConverter: jest.fn().mockImplementation(() => ({
    convertVideoFrame: jest.fn(() => ({
      ascii: '@@@\n@@@\n@@@',
      colors: ['rgb(255,0,0)', 'rgb(0,255,0)', 'rgb(0,0,255)']
    }))
  })),
  CHARSETS: {
    simple: ' .:-=+*#%@',
    detailed: ' .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
    blocks: ' ░▒▓█'
  },
  createBrightnessLUT: jest.fn(() => Array(256).fill('@'))
}));

// Mock browser APIs
const mockGetUserMedia = jest.fn();
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia
  },
  writable: true
});

global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();
global.Blob = jest.fn((parts, options) => ({
  size: parts?.[0]?.length || 0,
  type: options?.type || ''
})) as any;

Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined)
  },
  writable: true
});

// Mock video element
const mockVideo = {
  videoWidth: 640,
  videoHeight: 480,
  readyState: 4,
  srcObject: null,
  muted: false,
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  onloadedmetadata: null
};

const originalCreateElement = document.createElement;
document.createElement = jest.fn((tagName: string) => {
  if (tagName === 'video') {
    return mockVideo as any;
  }
  return originalCreateElement.call(document, tagName);
});

global.requestAnimationFrame = jest.fn((cb) => {
  setTimeout(cb, 16);
  return 1;
});
global.cancelAnimationFrame = jest.fn();

describe('Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserMedia.mockResolvedValue({
      getVideoTracks: jest.fn(() => [{ stop: jest.fn() }]),
      getTracks: jest.fn(() => [{ stop: jest.fn() }])
    });
  });

  describe('Full Application Flow', () => {
    it('should render complete application', () => {
      render(<App />);

      expect(screen.getByText('ASCII Webcam Mirror')).toBeInTheDocument();
      expect(screen.getByText('Status: Initializing...')).toBeInTheDocument();
    });

    it('should handle complete camera initialization flow', async () => {
      render(<App />);

      // Should attempt to get camera access
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      // Should show ASCII after initialization
      await waitFor(() => {
        expect(screen.getByText(/@@/)).toBeInTheDocument();
      });
    });

    it('should handle user interactions end-to-end', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('ASCII Webcam Mirror')).toBeInTheDocument();
      });

      // Test settings changes
      const columnsSlider = screen.getByDisplayValue('80');
      await user.clear(columnsSlider);
      await user.type(columnsSlider, '120');

      // Test color mode toggle
      const colorCheckbox = screen.getByLabelText('Color Mode');
      await user.click(colorCheckbox);

      // Test charset change
      const charsetSelect = screen.getByDisplayValue('Simple ( .:-=+*#%@)');
      await user.selectOptions(charsetSelect, 'Blocks ( ░▒▓█)');

      // Verify changes were applied
      expect(columnsSlider).toHaveValue('120');
      expect(colorCheckbox).toBeChecked();
      expect(charsetSelect).toHaveValue('Blocks ( ░▒▓█)');
    });

    it('should handle export functionality', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Wait for ASCII to be generated
      await waitFor(() => {
        expect(screen.getByText(/@@/)).toBeInTheDocument();
      });

      // Test snapshot download
      const snapshotButton = screen.getByText('Download .txt');
      await user.click(snapshotButton);

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.Blob).toHaveBeenCalled();

      // Test copy to clipboard
      const copyButton = screen.getByText('Copy to Clipboard');
      await user.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it('should handle pause/resume functionality', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('ASCII Webcam Mirror')).toBeInTheDocument();
      });

      // Test pause toggle
      const pauseCheckbox = screen.getByLabelText('Running');
      await user.click(pauseCheckbox);

      expect(pauseCheckbox).toHaveAttribute('aria-checked', 'true');

      // Test resume
      await user.click(pauseCheckbox);
      expect(pauseCheckbox).toHaveAttribute('aria-checked', 'false');
    });

    it('should handle keyboard shortcuts', async () => {
      render(<App />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('ASCII Webcam Mirror')).toBeInTheDocument();
      });

      // Test space for pause
      fireEvent.keyDown(document, { key: ' ' });
      const pauseCheckbox = screen.getByLabelText(/Paused|Running/);
      expect(pauseCheckbox).toBeInTheDocument();

      // Test [ and ] for columns
      fireEvent.keyDown(document, { key: '[' });
      const columnsSlider = screen.getByDisplayValue('75'); // 80 - 5 = 75
      expect(columnsSlider).toHaveValue('75');

      fireEvent.keyDown(document, { key: ']' });
      const columnsSlider2 = screen.getByDisplayValue('80'); // 75 + 5 = 80
      expect(columnsSlider2).toHaveValue('80');
    });

    it('should handle error states gracefully', async () => {
      // Mock camera failure
      mockGetUserMedia.mockRejectedValue(new Error('Camera not available'));

      render(<App />);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      });

      // Should still allow manual camera start
      const startButton = screen.getByText('Start Camera');
      expect(startButton).toBeInTheDocument();
    });

    it('should handle different screen sizes', () => {
      // Test with different viewport sizes
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 800
      });

      render(<App />);

      // Should still render correctly
      expect(screen.getByText('ASCII Webcam Mirror')).toBeInTheDocument();
    });

    it('should cleanup resources on unmount', () => {
      const { unmount } = render(<App />);

      unmount();

      // Should cleanup animation frames and media streams
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });

    it('should handle rapid setting changes', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('ASCII Webcam Mirror')).toBeInTheDocument();
      });

      // Rapidly change multiple settings
      const columnsSlider = screen.getByDisplayValue('80');
      const fpsSlider = screen.getByDisplayValue('24');

      await user.clear(columnsSlider);
      await user.type(columnsSlider, '160');

      await user.clear(fpsSlider);
      await user.type(fpsSlider, '60');

      // Should handle rapid changes without crashing
      expect(columnsSlider).toHaveValue('160');
      expect(fpsSlider).toHaveValue('60');
    });

    it('should maintain state consistency', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('ASCII Webcam Mirror')).toBeInTheDocument();
      });

      // Make several state changes
      const invertCheckbox = screen.getByLabelText('Invert');
      const colorCheckbox = screen.getByLabelText('Color Mode');

      await user.click(invertCheckbox);
      await user.click(colorCheckbox);

      // Verify state consistency
      expect(invertCheckbox).toBeChecked();
      expect(colorCheckbox).toBeChecked();

      // State should persist across re-renders
      expect(invertCheckbox).toBeChecked();
      expect(colorCheckbox).toBeChecked();
    });
  });
});
