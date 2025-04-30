// throwControl.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es'; // Import CANNON for physics

import { createBall } from './ball.js';

function initThrowControl() {
  document.addEventListener('mousedown', () => {
    // Example: create a new ball at the player's position
    createBall();
  });
}

export { initThrowControl };
