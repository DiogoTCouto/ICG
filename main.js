// main.js
import * as THREE from 'three'; // Import THREE namespace
import { scene, camera, renderer, cameraRotation, cameraTilt, isDragging } from './scene.js';
import { world } from './physics.js';
// Import specific terrain functions needed (KEEPING ORIGINAL IMPORTS)
import { initTerrain, updateWater, findNearestColumn } from './terrain.js';
import { initBlockyTerrain, initSpacedBlockyTerrain } from './terrain.js';
// Import player functions and getters
import {
  initPlayer,
  setupPlayerControls,
  updatePlayer,
  getPlayerBody,
  // Import new getters for camera control
  getCameraMode,
  getPlayerMesh,
  getPlayerHeightOffset
} from './player.js';
// Import ball functions and processRemovals
import { spawnBallMachine, updateBalls, processRemovals as processBallRemovals } from './ball.js';
// Import cupcake functions and processRemovals
import { handleClick, startCupcakeSpawner, updateCupcakes, processRemovals as processCupcakeRemovals } from './cupcake.js';

// Get initial settings from URL
const urlParams = new URLSearchParams(window.location.search);
const initialModel = urlParams.get('model') || 'cube';
const viewMode = urlParams.get('viewMode') === 'true'; // Check if viewMode is active

// Game state variables (KEEPING ORIGINAL)
let score = 0;
let lives = 3;
let hitCount = 0;
let currentRate = 1;
let orbitAngle = 0;
const orbitRadius = 50;
const terrainCenterY = 20;
let previousMouse = { x: 0, y: 0 };
let currentOrbitAngle = 0;
let targetOrbitAngle = 0;
const orbitDistance = 25;
const heightOffset = 15;
const defaultCameraTilt = 0.3;
const cameraDistance = 25;
const cameraHeight = 15;
let smoothedCameraRotation = cameraRotation || 0; // Initialize from scene.js value if available
let smoothedCameraTilt = cameraTilt || defaultCameraTilt; // Initialize from scene.js value or default
let zoomLevel = 1.0;
let isPaused = false; // Added pause state if not already present

// Timing
const clock = new THREE.Clock(); // Use THREE.Clock for delta time

// --- UI Update Functions (KEEPING ORIGINAL) ---
function updateScore(newScore) {
  score = newScore;
  const scoreEl = document.getElementById('score');
  if (scoreEl) {
      scoreEl.textContent = score;
      scoreEl.classList.add('highlight');
      setTimeout(() => scoreEl.classList.remove('highlight'), 500);
  }
}

function updateHitDisplay(newHits) {
  const heartsContainer = document.getElementById('hearts');
  if (!heartsContainer) return;
  const newHitsCount = newHits - hitCount;
  if (newHitsCount > 0) {
    hitCount = newHits;
    lives = Math.max(0, lives - newHitsCount);
    const hearts = heartsContainer.querySelectorAll('.heart');
    for (let i = 0; i < hearts.length; i++) {
      if (i < lives) {
        hearts[i].classList.remove('lost', 'animate-lost');
      } else {
        if (i >= lives && i < lives + newHitsCount) {
          if (!hearts[i].classList.contains('lost')) {
            hearts[i].classList.add('animate-lost');
            setTimeout(() => {
              hearts[i].classList.add('lost');
              hearts[i].classList.remove('animate-lost');
            }, 500);
          }
        } else {
           hearts[i].classList.add('lost');
           hearts[i].classList.remove('animate-lost');
        }
      }
    }
    if (lives <= 0 && !isPaused) {
      if (window.showGameStatus) {
        window.showGameStatus("Game Over! Press ESC to restart.", 10000);
      }
      pauseGame();
    }
  }
}

// --- Game Pause/Resume (KEEPING ORIGINAL IF PRESENT, ADDING IF NOT) ---
function pauseGame() {
    if (isPaused) return;
    isPaused = true;
    clock.stop();
    const pauseMenu = document.getElementById('pauseMenu');
    if (pauseMenu) pauseMenu.classList.add('active');
    spawnBallMachine(0);
    console.log("Game Paused");
}

function resumeGame() {
    if (!isPaused || lives <= 0) return;
    isPaused = false;
    clock.start();
    const pauseMenu = document.getElementById('pauseMenu');
    if (pauseMenu) pauseMenu.classList.remove('active');
    spawnBallMachine(currentRate);
    requestAnimationFrame(animate); // Re-request frame
    console.log("Game Resumed");
}

// --- Main Animate Loop (MODIFIED CAMERA LOGIC) ---
function animate() {
    if (isPaused) {
        renderer.render(scene, camera); // Render one frame for pause menu
        return;
    }

    const deltaTime = clock.getDelta();
    requestAnimationFrame(animate);

    // --- Physics Update ---
    world.step(1 / 60, deltaTime, 3); // Use fixed step with delta time

    // --- Process Removals ---
    processBallRemovals();
    processCupcakeRemovals(); // Assuming this exists

    // --- Update Game Objects ---
    updatePlayer(); // Update player state (physics, rotation, etc.)
    updateBalls();
    updateCupcakes();
    updateWater(deltaTime);

    // --- Camera Update Logic --- // *** MODIFIED SECTION ***
    const playerBody = getPlayerBody();
    const currentCameraMode = getCameraMode(); // Get current mode from player.js

    if (viewMode) {
        // --- Free Look / View Mode Camera --- (KEEPING ORIGINAL VIEW MODE LOGIC)
        orbitAngle += 0.0001 * 60; // Use deltaTime? Maybe keep original speed for now.
        camera.position.x = orbitRadius * Math.cos(orbitAngle);
        camera.position.z = orbitRadius * Math.sin(orbitAngle);
        camera.position.y = terrainCenterY + 25;
        camera.lookAt(0, terrainCenterY, 0);

    } else if (playerBody) { // Only update camera relative to player if player exists and not in viewMode
        if (currentCameraMode === 'firstPerson') {
            // --- First Person Camera ---
            const playerMesh = getPlayerMesh(); // Get the visual mesh for rotation
            if (playerMesh) {
                const headPosition = new THREE.Vector3();
                headPosition.copy(playerBody.position); // Start at player physics body center
                headPosition.y += getPlayerHeightOffset(); // Add vertical offset for eye level

                // Optional: Add a small forward offset based on player rotation
                const forwardOffset = new THREE.Vector3(0, 0, 0.3); // Adjust Z offset as needed
                forwardOffset.applyQuaternion(playerMesh.quaternion); // Rotate offset by player's facing direction
                headPosition.add(forwardOffset);

                // Smoothly interpolate the camera's rotation towards the player's rotation
                const smoothingFactor = 0.05; // Adjust this value (0.0 to 1.0). Smaller = smoother/slower.
                camera.quaternion.slerp(playerMesh.quaternion, smoothingFactor); // Smoothly interpolate camera rotation towards player rotation
                camera.position.lerp(headPosition, smoothingFactor); // Smoothly interpolate camera position towards head position
            }

        } else { // 'thirdPerson'
            // --- Third Person Camera (Smoothed Follow) ---
            const cameraPositionLerpFactor = 0.15; // Smoothing factor for position (Adjust 0.05 to 0.3)
            const cameraRotationSmoothFactor = 0.1; // Smoothing factor for rotation/tilt input (Adjust 0.05 to 0.2)

            // Smooth camera rotation/tilt inputs (driven by mouse/controls in scene.js)
            // Use the isDragging flag from scene.js to only smooth when dragging
            if (isDragging) {
                 smoothedCameraRotation += (cameraRotation - smoothedCameraRotation) * cameraRotationSmoothFactor;
                 smoothedCameraTilt += (cameraTilt - smoothedCameraTilt) * cameraRotationSmoothFactor;
                 // Clamp tilt to prevent flipping over
                 smoothedCameraTilt = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, smoothedCameraTilt));
            }
            // If not dragging, smoothed values remain unchanged, providing stable view unless moved

            // Calculate target offset based on smoothed rotation/tilt and distance/zoom
            const horizontalDistance = cameraDistance * zoomLevel;
            const verticalDistance = cameraHeight * zoomLevel;

            const offset = new THREE.Vector3();
            offset.x = horizontalDistance * Math.sin(smoothedCameraRotation);
            offset.z = horizontalDistance * Math.cos(smoothedCameraRotation);
            offset.y = verticalDistance + horizontalDistance * Math.sin(smoothedCameraTilt);

            const targetCamPos = new THREE.Vector3();
            targetCamPos.copy(playerBody.position).add(offset); // Target position is player + offset

            // Smoothly interpolate the camera's current position towards the target position
            camera.position.lerp(targetCamPos, cameraPositionLerpFactor);

            // Make the camera look at a point slightly above the player's base
            const lookAtTarget = new THREE.Vector3(
                playerBody.position.x,
                playerBody.position.y + 1.0, // Adjust Y offset for desired look-at height
                playerBody.position.z
            );
            camera.lookAt(lookAtTarget);
        }
    } else {
        // Optional: Handle camera if player doesn't exist (e.g., initial load before player init)
        camera.lookAt(0, 0, 0);
    }
     // *** END OF MODIFIED SECTION ***

    // --- Render ---
    renderer.render(scene, camera);
    // if (renderComposer) renderComposer.render(); // If using post-processing
}

// --- Initialization --- (KEEPING ORIGINAL CALLS)
function initGame() {
    console.log("Initializing game...");
    console.log("View Mode:", viewMode);
    console.log("Initial Player Model:", initialModel);

    // Initialize terrain (KEEPING ORIGINAL CALL)
    initBlockyTerrain(0.2, 0.2, 7, 18);
    // initSpacedBlockyTerrain(0.2, 0.2, 7, 18, 3); // Example alternative

    // Initialize player
    initPlayer(initialModel);

    // Setup controls only if not in view mode
    if (!viewMode) {
        setupPlayerControls(); // Sets up WASD, Space, F key
        spawnBallMachine(currentRate); // Start spawning balls
        startCupcakeSpawner(3000); // Start spawning cupcakes
        renderer.domElement.addEventListener('click', handleClick); // Enable cupcake clicking
    } else {
        // Configure view mode specifics (KEEPING ORIGINAL)
        const infoElement = document.getElementById("info");
        if (infoElement) infoElement.style.display = "none";
        const gameControls = document.querySelector('.game-controls');
        if (gameControls) gameControls.style.display = 'flex'; // Assuming this should be flex? Or none? Check original intent.
    }

    // Setup UI Controls (Rate, Day/Night, Pause) - Moved setup here
    const rateInput = document.getElementById('rateInput');
    const setRateBtn = document.getElementById('setRateBtn');
    const dayNightBtn = document.getElementById('dayNightBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn'); // Get resume button from pause menu

    if (setRateBtn && rateInput) {
        rateInput.value = currentRate; // Set initial value
        setRateBtn.addEventListener('click', () => {
            const newRate = parseFloat(rateInput.value);
            if (!isNaN(newRate) && newRate >= 0) {
                currentRate = newRate;
                if (!isPaused && !viewMode) { // Only spawn if not paused/view mode
                    spawnBallMachine(currentRate);
                }
                console.log("Ball spawn rate set to:", currentRate);
            }
        });
    }

    if (dayNightBtn) {
        dayNightBtn.addEventListener('click', () => {
            if (window.toggleDayNight) { // Check if function exists
                window.toggleDayNight(); // Call function from scene.js
            }
        });
    }

    // Add pause/resume listeners if pause menu elements exist
    if (pauseBtn && resumeBtn) {
        pauseBtn.addEventListener('click', pauseGame);
        resumeBtn.addEventListener('click', resumeGame);
    } else {
        console.warn("Pause/Resume buttons not found in the DOM.");
    }


    // Add global key listener for pause (ESC)
    window.addEventListener('keydown', (event) => {
        if (event.code === 'Escape') {
            if (isPaused) {
                if (lives > 0) resumeGame(); // Only resume if not game over
                else location.reload(); // Restart if game over
            } else {
                pauseGame();
            }
        }
    });

    // Add zoom listener (KEEPING ORIGINAL)
    window.addEventListener('wheel', (event) => {
        if (!viewMode && !isPaused) { // Only zoom if playing
            zoomLevel -= event.deltaY * 0.0005; // Adjust zoom sensitivity
            zoomLevel = Math.min(Math.max(zoomLevel, 0.5), 2.0); // Clamp zoom
        }
    });

    // Start the animation loop
    clock.start(); // Start the clock before the first frame
    animate();
    console.log("Game initialized and animation loop started.");
}

// Wait for DOM content to load before initializing
document.addEventListener('DOMContentLoaded', initGame);

// Export functions needed by other modules (e.g., UI updates)
export { updateScore, updateHitDisplay }; // KEEPING ORIGINAL EXPORTS