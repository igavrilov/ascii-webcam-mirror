import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock the SimpleAsciiMirror component
jest.mock('./components/SimpleAsciiMirror', () => ({
  SimpleAsciiMirror: () => <div data-testid="ascii-mirror">ASCII Webcam Mirror Component</div>
}));

describe('App Component', () => {
  it('should render the main application', () => {
    render(<App />);

    expect(screen.getByTestId('ascii-mirror')).toBeInTheDocument();
    expect(screen.getByText('ASCII Webcam Mirror Component')).toBeInTheDocument();
  });

  it('should render without crashing', () => {
    expect(() => render(<App />)).not.toThrow();
  });

  it('should contain the ASCII mirror component', () => {
    const { container } = render(<App />);

    expect(container.firstChild).toBeInTheDocument();
    expect(screen.getByTestId('ascii-mirror')).toBeInTheDocument();
  });

  it('should have proper structure', () => {
    const { container } = render(<App />);

    // App should render a single div or fragment
    expect(container.children.length).toBe(1);
  });
});
