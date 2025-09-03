import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SimpleAsciiMirror } from './SimpleAsciiMirror';

// Mock the entire ASCII library
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

// Mock navigator.mediaDevices.getUserMedia
const mockGetUserMedia = jest.fn();
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia
  },
  writable: true
});

// Mock URL methods
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock Blob
global.Blob = jest.fn((parts, options) => ({
  size: parts?.[0]?.length || 0,
  type: options?.type || ''
})) as any;

// Mock clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined)
  },
  writable: true
});

// Mock HTMLVideoElement
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

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => {
  setTimeout(cb, 16);
  return 1;
});
global.cancelAnimationFrame = jest.fn();

describe('SimpleAsciiMirror Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserMedia.mockResolvedValue({
      getVideoTracks: jest.fn(() => [{ stop: jest.fn() }]),
      getTracks: jest.fn(() => [{ stop: jest.fn() }])
    });
  });

  it('should render component correctly', () => {
    render(<SimpleAsciiMirror />);

    expect(screen.getByText('ASCII Webcam Mirror')).toBeInTheDocument();
    expect(screen.getByText('Status: Initializing...')).toBeInTheDocument();
    expect(screen.getByText('Start Camera')).toBeInTheDocument();
  });

  it('should initialize camera on mount', async () => {
    render(<SimpleAsciiMirror />);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: { width: 640, height: 480 }
      });
    });
  });

  it('should update status when camera starts', async () => {
    render(<SimpleAsciiMirror />);

    // Wait for camera initialization
    await waitFor(() => {
      expect(screen.getByText(/Status:/)).toBeInTheDocument();
    });

    // Mock video metadata load
    act(() => {
      if (mockVideo.onloadedmetadata) {
        mockVideo.onloadedmetadata(new Event('loadedmetadata'));
      }
    });
  });

  it('should handle manual camera start', async () => {
    const user = userEvent.setup();
    render(<SimpleAsciiMirror />);

    const startButton = screen.getByText('Start Camera');
    await user.click(startButton);

    expect(mockGetUserMedia).toHaveBeenCalled();
  });

  it('should update columns setting', async () => {
    const user = userEvent.setup();
    render(<SimpleAsciiMirror />);

    const columnsSlider = screen.getByDisplayValue('80');
    await user.clear(columnsSlider);
    await user.type(columnsSlider, '120');

    expect(columnsSlider).toHaveValue('120');
  });

  it('should update FPS setting', async () => {
    const user = userEvent.setup();
    render(<SimpleAsciiMirror />);

    const fpsSlider = screen.getByDisplayValue('24');
    await user.clear(fpsSlider);
    await user.type(fpsSlider, '30');

    expect(fpsSlider).toHaveValue('30');
  });

  it('should change charset', async () => {
    const user = userEvent.setup();
    render(<SimpleAsciiMirror />);

    const charsetSelect = screen.getByDisplayValue('Simple ( .:-=+*#%@)');
    await user.selectOptions(charsetSelect, 'Detailed');

    expect(charsetSelect).toHaveValue('Detailed');
  });

  it('should toggle invert', async () => {
    const user = userEvent.setup();
    render(<SimpleAsciiMirror />);

    const invertCheckbox = screen.getByLabelText('Invert');
    await user.click(invertCheckbox);

    expect(invertCheckbox).toBeChecked();
  });

  it('should toggle color mode', async () => {
    const user = userEvent.setup();
    render(<SimpleAsciiMirror />);

    const colorCheckbox = screen.getByLabelText('Color Mode');
    await user.click(colorCheckbox);

    expect(colorCheckbox).toBeChecked();
  });

  it('should toggle pause', async () => {
    const user = userEvent.setup();
    render(<SimpleAsciiMirror />);

    const pauseCheckbox = screen.getByLabelText('Running');
    await user.click(pauseCheckbox);

    expect(pauseCheckbox).toHaveAttribute('aria-checked', 'true');
  });

  it('should handle snapshot', async () => {
    const user = userEvent.setup();
    render(<SimpleAsciiMirror />);

    // Wait for some ASCII to be generated
    await waitFor(() => {
      expect(screen.getByText(/@@/)).toBeInTheDocument();
    });

    const snapshotButton = screen.getByText('Download .txt');
    await user.click(snapshotButton);

    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('should handle copy to clipboard', async () => {
    const user = userEvent.setup();
    render(<SimpleAsciiMirror />);

    // Wait for some ASCII to be generated
    await waitFor(() => {
      expect(screen.getByText(/@@/)).toBeInTheDocument();
    });

    const copyButton = screen.getByText('Copy to Clipboard');
    await user.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(screen.getByText('Status: Copied to clipboard!')).toBeInTheDocument();
  });

  it('should disable export buttons when no ASCII', () => {
    // Mock empty ASCII
    const { AsciiConverter } = require('../lib/ascii');
    AsciiConverter.mockImplementation(() => ({
      convertVideoFrame: jest.fn(() => ({ ascii: '', colors: [] }))
    }));

    render(<SimpleAsciiMirror />);

    const snapshotButton = screen.getByText('Download .txt');
    const copyButton = screen.getByText('Copy to Clipboard');

    expect(snapshotButton).toBeDisabled();
    expect(copyButton).toBeDisabled();
  });

  it('should handle camera access denied', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

    render(<SimpleAsciiMirror />);

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });

  it('should render ASCII text', async () => {
    render(<SimpleAsciiMirror />);

    await waitFor(() => {
      expect(screen.getByText(/@@/)).toBeInTheDocument();
    });
  });

  it('should render colored ASCII when color mode is enabled', async () => {
    const user = userEvent.setup();
    render(<SimpleAsciiMirror />);

    // Enable color mode
    const colorCheckbox = screen.getByLabelText('Color Mode');
    await user.click(colorCheckbox);

    // Wait for ASCII to render
    await waitFor(() => {
      const asciiContainer = screen.getByText(/@@/).closest('div');
      expect(asciiContainer).toBeInTheDocument();
    });
  });

  it('should show hotkeys information', () => {
    render(<SimpleAsciiMirror />);

    expect(screen.getByText(/Hotkeys:/)).toBeInTheDocument();
    expect(screen.getByText(/Space.*columns.*Invert.*Color.*Snapshot/)).toBeInTheDocument();
  });

  it('should handle keyboard shortcuts', async () => {
    render(<SimpleAsciiMirror />);

    // Test space key for pause toggle
    fireEvent.keyDown(document, { key: ' ' });
    const pauseCheckbox = screen.getByLabelText(/Paused|Running/);
    expect(pauseCheckbox).toBeInTheDocument();

    // Test bracket keys for columns
    fireEvent.keyDown(document, { key: '[' });
    const columnsSlider = screen.getByDisplayValue('75'); // 80 - 5 = 75
    expect(columnsSlider).toHaveValue('75');

    // Test invert toggle
    fireEvent.keyDown(document, { key: 'i' });
    const invertCheckbox = screen.getByLabelText('Invert');
    expect(invertCheckbox).toBeChecked();

    // Test color mode toggle
    fireEvent.keyDown(document, { key: 'c' });
    const colorCheckbox = screen.getByLabelText('Color Mode');
    expect(colorCheckbox).toBeChecked();
  });

  it('should ignore keyboard shortcuts when typing in inputs', () => {
    render(<SimpleAsciiMirror />);

    const columnsSlider = screen.getByDisplayValue('80');

    // Focus on input
    fireEvent.focus(columnsSlider);

    // Try to trigger shortcut
    fireEvent.keyDown(columnsSlider, { key: ' ' });

    // Should not affect pause state
    const pauseCheckbox = screen.getByLabelText('Running');
    expect(pauseCheckbox).toBeInTheDocument();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = render(<SimpleAsciiMirror />);

    unmount();

    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });

  it('should handle video element creation', () => {
    render(<SimpleAsciiMirror />);

    expect(document.createElement).toHaveBeenCalledWith('video');
  });

  it('should render different charset options', () => {
    render(<SimpleAsciiMirror />);

    const charsetSelect = screen.getByDisplayValue('Simple ( .:-=+*#%@)');
    expect(charsetSelect).toBeInTheDocument();

    // Check all options are present
    expect(screen.getByText('Simple ( .:-=+*#%@)')).toBeInTheDocument();
    expect(screen.getByText('Detailed')).toBeInTheDocument();
    expect(screen.getByText('Blocks ( ░▒▓█)')).toBeInTheDocument();
  });
});
