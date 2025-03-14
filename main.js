// main.js
import { scene, camera, renderer, rotateCube } from './scene.js';
import { world } from './physics.js';
import { initWalls, initRandomPillars } from './walls.js';

function animate() {
  requestAnimationFrame(animate);

  world.step(1 / 60);

  rotateCube();
  initWalls();
  initRandomPillars();
  renderer.render(scene, camera);
}

animate();
