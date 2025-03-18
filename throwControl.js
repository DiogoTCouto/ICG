// throwControl.js
import { createBall } from './ball.js';

function initThrowControl() {
  document.addEventListener('mousedown', () => {
    // Example: create a new ball at the player's position
    createBall();
  });
}

export { initThrowControl };
