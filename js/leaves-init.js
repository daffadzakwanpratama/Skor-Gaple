import { FallingLeaves } from './vendor/falling-leaves/index.js';

// Initialize falling leaves background effect
if (typeof window !== 'undefined') {
  window.fallingLeavesInstance = new FallingLeaves({
    count: 18,
    opacity: 0.85,
    zIndex: 9999
  });
}
