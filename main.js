// main.js
import { scene, camera, renderer, cameraRotation, cameraTilt, isDragging } from './scene.js';
import { world } from './physics.js';
import { initWalls, initRandomPillars } from './walls.js';
import {
  initPlayer,
  setupPlayerControls,
  updatePlayer,
  getPlayerBody
} from './player.js';
import { spawnBallMachine, updateBalls, BALL_TYPES, processRemovals } from './ball.js';
import { initTerrain, updateWater } from './terrain.js';  // Add updateWater import
import { initBlockyTerrain,initSpacedBlockyTerrain } from './terrain.js';
import { handleClick, startCupcakeSpawner, updateCupcakes } from './cupcake.js';


const urlParams = new URLSearchParams(window.location.search);
const initialModel = urlParams.get('model') || 'cube';
const viewMode = urlParams.get('viewMode') === 'true';

let score = 0;
let lives = 3; 
let hitCount = 0; // Make sure we have this initialized
let currentRate = 1;

let orbitAngle = 0; // used for view mode orbiting
const orbitRadius = 50; // view mode orbit radius
const terrainCenterY = 20;

// NEW variables for click-drag camera orbit in play mode:
let previousMouse = { x: 0, y: 0 };
let currentOrbitAngle = 0;  // The current orbit angle around the player
let targetOrbitAngle = 0;   // The target angle updated on mouse move
const orbitDistance = 25;   // Horizontal distance from player
const heightOffset = 15;    // Vertical offset from player

// NEW variables for camera control
const defaultCameraTilt = 0.3;  // Default tilt angle (slightly looking down)
const cameraDistance = 25;      // Base distance from player
const cameraHeight = 15;        // Base height above player
let smoothedCameraRotation = 0;
let smoothedCameraTilt = defaultCameraTilt;
let zoomLevel = 1.0;            // Camera zoom level

// Timing for animations
let lastTime = performance.now();

// Update score function
function updateScore(newScore) {
  score = newScore;
  const scoreEl = document.getElementById('score');
  if (scoreEl) scoreEl.textContent = score;
}

// Update hit count function - now handles lives
function updateHitDisplay(newHits) {
  const heartsContainer = document.getElementById('hearts');
  if (!heartsContainer) return;
  
  // Calculate how many new hits occurred
  const newHitsCount = newHits - hitCount;
  
  if (newHitsCount > 0) {
    // Update internal hit counter
    hitCount = newHits;
    
    // Update lives - subtract one life per hit
    lives = Math.max(0, lives - newHitsCount);
    
    // Update heart display
    const hearts = heartsContainer.querySelectorAll('.heart');
    
    // Update each heart based on remaining lives
    for (let i = 0; i < hearts.length; i++) {
      if (i < lives) {
        hearts[i].classList.remove('lost');
      } else {
        // Only animate hearts that were just lost in this hit
        if (i >= lives && i < lives + newHitsCount) {
          hearts[i].classList.add('animate-lost');
          
          // Add the lost class after animation completes
          setTimeout(() => {
            hearts[i].classList.add('lost');
            hearts[i].classList.remove('animate-lost');
          }, 500);
        } else {
          // Hearts that were already lost
          hearts[i].classList.add('lost');
        }
      }
    }
    
    // Game over check
    if (lives <= 0) {
      if (window.showGameStatus) {
        window.showGameStatus("Game Over!", 5000);
      }
      // Could add more game over logic here
    }
  }
}

function animate() {
  const currentTime = performance.now();
  const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
  lastTime = currentTime;

  requestAnimationFrame(animate);

  // Step physics
  world.step(1 / 60);
  
  // Process any physics removals AFTER the physics step is complete
  processRemovals();

  // Update the player (sync Cannon body with Three mesh)
  updatePlayer();

  // Update all spawned balls and cupcakes
  updateBalls();
  updateCupcakes();
  
  // Update water animation
  updateWater(deltaTime);
  
  if (viewMode) {
    // In view mode: orbit the camera around the terrain center
    orbitAngle += 0.0001 * 60;
    camera.position.x = orbitRadius * Math.cos(orbitAngle);
    camera.position.z = orbitRadius * Math.sin(orbitAngle);
    camera.position.y = terrainCenterY + 25;
    camera.lookAt(0, terrainCenterY, 0);
  } else {
    // Play mode: camera follows player but is controlled by dragging
    const playerBody = getPlayerBody();
    if (playerBody) {
      // Smooth out camera rotation and tilt for more natural movement
      smoothedCameraRotation = isDragging ? smoothedCameraRotation * 0.9 + cameraRotation * 0.1 : smoothedCameraRotation;
      smoothedCameraTilt = isDragging ? smoothedCameraTilt * 0.9 + cameraTilt * 0.1 : smoothedCameraTilt;
      
      // Calculate camera position based on rotation around player
      const horizontalDistance = cameraDistance * zoomLevel;
      const verticalDistance = cameraHeight * zoomLevel;
      
      camera.position.x = playerBody.position.x + horizontalDistance * Math.sin(smoothedCameraRotation);
      camera.position.z = playerBody.position.z + horizontalDistance * Math.cos(smoothedCameraRotation);
      camera.position.y = playerBody.position.y + verticalDistance + horizontalDistance * Math.sin(smoothedCameraTilt);

      // Make the camera look at a point slightly above the player for better angle
      camera.lookAt(
        playerBody.position.x,
        playerBody.position.y + 2,  // Look at point slightly above player
        playerBody.position.z
      );
    }
  }
  
  // Render the scene
  renderer.render(scene, camera);
}

// Add an event listener for zoom with mouse wheel
window.addEventListener('wheel', (event) => {
  if (!viewMode) {
    // Adjust zoom level based on wheel direction
    zoomLevel += event.deltaY * -0.0005;
    
    // Clamp zoom level between reasonable values
    zoomLevel = Math.min(Math.max(zoomLevel, 0.5), 2.0);
  }
});

// Set up UI controls - Do this directly instead of in initGame
const rateInput = document.getElementById('rateInput');
const setRateBtn = document.getElementById('setRateBtn');

if (setRateBtn && rateInput) {
  setRateBtn.addEventListener('click', () => {
    const newRate = parseFloat(rateInput.value);
    if (!isNaN(newRate)) {
      currentRate = newRate;
      spawnBallMachine(newRate);
    }
  });
}

// Set up day/night toggle - This needs to be properly initialized
document.addEventListener('DOMContentLoaded', () => {
  const dayNightBtn = document.getElementById('dayNightBtn');
  if (dayNightBtn) {
    dayNightBtn.addEventListener('click', () => {
      // Toggle the day/night mode
      // We'll implement this function in scene.js
      if (window.toggleDayNight) {
        window.toggleDayNight();
      }
    });
  }
});

// Add click listener for cupcakes
renderer.domElement.addEventListener('click', handleClick);

// Start cupcake spawner with a shorter interval for more cupcakes
startCupcakeSpawner(3000); // Spawn every 3 seconds instead of 5

// Initialize the game components
// For example, a 10x10 grid, each column is size=2, maxHeight=10
initBlockyTerrain(0.2, 0.2, 7, 18);
//initSpacedBlockyTerrain(0.2, 0.2, 7, 18, 3);


//nitBlockyTerrain(20, 20, 7, 18);  // Increased rows and columns for a larger terrain
initPlayer(initialModel);

if (!viewMode) {
  setupPlayerControls();
} else {
  const infoElement = document.getElementById("info");
  if (infoElement) {
    infoElement.style.display = "none";
  }
  const gameControls = document.querySelector('.game-controls');
  if (gameControls) {
    gameControls.style.display = 'flex';
  }
}
spawnBallMachine(currentRate);

// Initialize lastTime before starting animation
lastTime = performance.now();
  
// Start the animation loop
animate();

// Export functions for use in other modules
export { updateScore, updateHitDisplay };
