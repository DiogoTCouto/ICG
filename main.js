// main.js
import { scene, camera, renderer, rotateCube } from './scene.js';
import { world } from './physics.js';

function animate() {
  requestAnimationFrame(animate);

  // Step the physics world
  world.step(1 / 60);

  rotateCube();

  renderer.render(scene, camera);
}

// Start the animation loop
animate();
