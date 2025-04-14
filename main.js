// main.js
import * as THREE from 'three'; // Import THREE namespace
// Import necessary items from scene.js, including new flags/variables if added
import { scene, camera, renderer, cameraRotation, cameraTilt, isDragging } from './scene.js';
import { world } from './physics.js';
// Import specific terrain functions needed (Adjust based on active terrain file)
import { initTerrain, updateWater, findNearestColumn } from './terrain.js';
import { initBlockyTerrain, initSpacedBlockyTerrain } from './terrain.js';
// Import player functions and getters
import {
  initPlayer,
  setupPlayerControls,
  updatePlayer,
  getPlayerBody,
  // Import necessary getters for camera control
  getCameraMode,
  getPlayerMesh,      // Still needed for potential TP logic or future use
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

// Game state variables
let score = 0;
let lives = 3;
let hitCount = 0; // This seems unused if updateHitDisplay takes direct count? Let's assume it's needed.
let currentRate = 1;
let orbitAngle = 0; // For view mode camera
const orbitRadius = 50; // For view mode camera
const terrainCenterY = 20; // For view mode camera target
// Removed previousMouse, currentOrbitAngle, targetOrbitAngle as they seem related to old camera logic

// Third-person camera control variables
const defaultCameraTilt = Math.PI / 6; // ~30 degrees default downward tilt
const cameraDistance = 25; // Base distance from player
const cameraHeight = 15; // Base height offset from player feet (used with tilt)
let smoothedCameraRotation = cameraRotation || 0; // Initialize from scene.js value if available, fallback to 0
let smoothedCameraTilt = cameraTilt || defaultCameraTilt; // Initialize from scene.js value or default
let zoomLevel = 1.0; // For third-person zoom

// Pause state
let isPaused = false;

// Timing
const clock = new THREE.Clock(); // Use THREE.Clock for delta time

// --- UI Update Functions ---
function updateScore(newScore) {
  score = newScore;
  const scoreEl = document.getElementById('score');
  if (scoreEl) {
      scoreEl.textContent = score;
      // Use existing highlight mechanism if needed
      scoreEl.classList.add('highlight');
      setTimeout(() => scoreEl.classList.remove('highlight'), 500);
  }
}

// Updated function to directly set lives based on hits
function updateHitDisplay(newTotalHits) {
  const heartsContainer = document.getElementById('hearts');
  if (!heartsContainer) return;

  const previousLives = lives;
  lives = Math.max(0, 3 - newTotalHits); // Calculate lives based on total hits

  // Animate hearts if lives decreased
  if (lives < previousLives) {
    const hearts = heartsContainer.querySelectorAll('.heart');
    // Animate the hearts that were lost
    for (let i = lives; i < previousLives; i++) {
        if (hearts[i] && !hearts[i].classList.contains('lost')) {
            hearts[i].classList.add('animate-lost');
            // Add 'lost' class after animation completes
            setTimeout(() => {
                 if(hearts[i]) hearts[i].classList.add('lost');
            }, 500); // Match animation duration
        }
    }
  }

   // Ensure correct static state for all hearts
   const hearts = heartsContainer.querySelectorAll('.heart');
   for (let i = 0; i < hearts.length; i++) {
       if (i < lives) {
           hearts[i].classList.remove('lost', 'animate-lost');
       } else if (!hearts[i].classList.contains('animate-lost')) { // Don't override animation
           hearts[i].classList.add('lost');
       }
   }


  // Check for game over
  if (lives <= 0 && !isPaused) {
    if (window.showGameStatus) { // Use global function if available
        window.showGameStatus("Game Over! Press ESC to restart.", 10000);
    }
    pauseGame(); // Pause on game over
  }
}

// --- Game Pause/Resume ---
function pauseGame() {
    if (isPaused) return;
    isPaused = true;
    clock.stop(); // Stop the clock
    const pauseMenu = document.getElementById('pauseMenu');
    if (pauseMenu) pauseMenu.classList.add('active'); // Show pause menu
    spawnBallMachine(0); // Stop spawning balls
    document.exitPointerLock(); // Ensure pointer is unlocked when paused
    console.log("Game Paused");
}

function resumeGame() {
    // Only resume if paused and not game over
    if (!isPaused || lives <= 0) return;
    isPaused = false;
    clock.start(); // Restart the clock
    const pauseMenu = document.getElementById('pauseMenu');
    if (pauseMenu) pauseMenu.classList.remove('active'); // Hide pause menu
    spawnBallMachine(currentRate); // Resume spawning balls at current rate
    // If in FPS mode, request pointer lock again on resume
    if(getCameraMode() === 'firstPerson') {
        renderer.domElement.requestPointerLock();
    }
    requestAnimationFrame(animate); // Re-request frame to continue loop
    console.log("Game Resumed");
}

// --- Main Animate Loop (with Corrected Camera Logic) ---
function animate() {
    if (isPaused) {
        // Still render one frame when paused to show the pause menu overlay correctly
        renderer.render(scene, camera);
        // Do NOT request another frame while paused
        return;
    }

    // Request the next frame before processing the current one
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta(); // Get time since last frame

    // --- Physics Update ---
    // Use a fixed timestep for stability, but update based on elapsed time
    world.step(1 / 60, deltaTime, 3); // Recommended fixed step with delta time adjustment

    // --- Process Removals (After Physics Step) ---
    processBallRemovals();
    processCupcakeRemovals(); // Assuming this exists and is needed

    // --- Update Game Objects ---
    updatePlayer(); // Update player state (physics, rotation, etc.)
    updateBalls();
    updateCupcakes();
    updateWater(deltaTime); // Update water animation

    // --- Camera Update Logic --- // *** CORRECTED SECTION ***
    const playerBody = getPlayerBody();
    const currentCameraMode = getCameraMode(); // Get current mode from player.js

    if (viewMode) {
        // --- Free Look / View Mode Camera ---
        orbitAngle += 0.0001 * 60; // Can adjust speed, consider using deltaTime for frame rate independence
        camera.position.x = orbitRadius * Math.cos(orbitAngle);
        camera.position.z = orbitRadius * Math.sin(orbitAngle);
        camera.position.y = terrainCenterY + 25;
        camera.lookAt(0, terrainCenterY, 0);

    } else if (playerBody) { // Only update if player exists and not in viewMode
        if (currentCameraMode === 'firstPerson') {
            // --- First Person Camera ---
            // Rotation is handled fully in player.js based on mouse input.
            // Smoothly update camera *position* to follow head position.
            const headPosition = new THREE.Vector3();
            headPosition.copy(playerBody.position);
            headPosition.y += getPlayerHeightOffset(); // Eye level based on player setting

            // Optional small forward offset from head center (could also be done in player.js)
            // const forwardOffset = new THREE.Vector3(0, 0, 0.1); // Small offset
            // const playerMesh = getPlayerMesh(); // Get mesh for orientation if needed
            // if(playerMesh) forwardOffset.applyQuaternion(playerMesh.quaternion);
            // headPosition.add(forwardOffset);

            const positionSmoothingFactor = 0.2; // Adjust for desired position follow speed (0.0 to 1.0)
            camera.position.lerp(headPosition, positionSmoothingFactor);
            // Camera rotation is set directly in player.js, no slerp needed here.

        } else { // 'thirdPerson'
            // --- Third Person Camera (Smoothed Follow) ---
            const cameraPositionLerpFactor = 0.15; // How fast the camera position catches up (0.0 to 1.0)
            const cameraRotationSmoothFactor = 0.1; // How fast the camera rotation responds to mouse drag (0.0 to 1.0)

            // Smooth camera rotation/tilt inputs provided by scene.js (mouse drag)
            // Only smooth these external controls when dragging in third person
            if (isDragging) { // isDragging flag imported from scene.js
                 // Smooth horizontal rotation (Yaw)
                 smoothedCameraRotation += (cameraRotation - smoothedCameraRotation) * cameraRotationSmoothFactor;
                 // Smooth vertical tilt (Pitch)
                 smoothedCameraTilt += (cameraTilt - smoothedCameraTilt) * cameraRotationSmoothFactor;
                 // Clamp tilt to prevent flipping over (e.g., -85 to +85 degrees)
                 smoothedCameraTilt = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, smoothedCameraTilt));
            }
            // If not dragging (isDragging is false), smoothed values remain stable, providing a steady view unless moved.

            // Calculate target offset based on smoothed rotation/tilt and distance/zoom
            const horizontalDistance = cameraDistance * zoomLevel;
            const baseVerticalOffset = cameraHeight * zoomLevel; // Base height offset from player position

            const offset = new THREE.Vector3();
            // Calculate offset in XZ plane based on smoothed horizontal rotation
            offset.x = horizontalDistance * Math.sin(smoothedCameraRotation);
            offset.z = horizontalDistance * Math.cos(smoothedCameraRotation);
            // Calculate Y offset based on smoothed tilt and base height
            offset.y = horizontalDistance * Math.tan(smoothedCameraTilt) + baseVerticalOffset; // Tilt adjusts height relative to horizontal plane

            // Target camera position is player's position plus the calculated offset
            const targetCamPos = new THREE.Vector3();
            targetCamPos.copy(playerBody.position).add(offset);

            // Smoothly interpolate the camera's current position towards the target position
            camera.position.lerp(targetCamPos, cameraPositionLerpFactor);

            // Make the camera look at a point slightly above the player's base for better perspective
            const lookAtTarget = new THREE.Vector3(
                playerBody.position.x,
                playerBody.position.y + 1.0, // Look slightly above player feet (adjust as needed)
                playerBody.position.z
            );
            camera.lookAt(lookAtTarget);
        }
    } else {
        // Optional: Handle camera if player doesn't exist (e.g., initial load)
        camera.lookAt(0, 0, 0); // Look at origin
    }
     // *** END OF CORRECTED CAMERA SECTION ***

    // --- Render ---
    renderer.render(scene, camera);
    // if (renderComposer) renderComposer.render(); // Uncomment if using EffectComposer from scene.js
}

// --- Initialization ---
function initGame() {
    console.log("Initializing game...");
    console.log("View Mode:", viewMode);
    console.log("Initial Player Model:", initialModel);

    // Initialize terrain (Choose one - initBlockyTerrain or initSpacedBlockyTerrain)
    //initBlockyTerrain(0.2, 0.2, 7, 18); // Using blocky as example
    initSpacedBlockyTerrain(0.2, 0.2, 15, 18, 2); // Alternative with spacing

    // Initialize player using the model from URL param or default
    initPlayer(initialModel);

    // Setup controls and game elements only if not in view mode
    if (!viewMode) {
        setupPlayerControls(); // Sets up WASD, Space, F key, mouse look
        spawnBallMachine(currentRate); // Start spawning balls
        startCupcakeSpawner(3000); // Start spawning cupcakes
        renderer.domElement.addEventListener('click', handleClick); // Enable cupcake clicking
        // Make sure pointer lock works correctly with FPS mode toggle
    } else {
        // Configure view mode specifics (e.g., hide unnecessary UI)
        const uiElementsToHide = ['.game-ui', '.hearts-display', '.instructions']; // Selectors for UI to hide
        uiElementsToHide.forEach(selector => {
             const element = document.querySelector(selector);
             if (element) element.style.display = 'none';
        });
        // Show view mode banner (handled in game.html script)
    }

    // Setup UI Controls (Rate, Day/Night, Pause)
    const rateInput = document.getElementById('rateInput');
    const setRateBtn = document.getElementById('setRateBtn');
    const dayNightBtn = document.getElementById('dayNightBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn'); // Get resume button from pause menu
    const restartBtn = document.getElementById('restartBtn'); // Get restart button
    const exitBtn = document.getElementById('exitBtn');     // Get exit button

    if (setRateBtn && rateInput) {
        rateInput.value = currentRate; // Set initial value in input
        setRateBtn.addEventListener('click', () => {
            const newRate = parseFloat(rateInput.value);
            if (!isNaN(newRate) && newRate >= 0) {
                currentRate = newRate;
                // Only change spawn rate if game is running
                if (!isPaused && !viewMode) {
                    spawnBallMachine(currentRate);
                }
                console.log("Ball spawn rate set to:", currentRate);
            }
        });
    }

    // Add Day/Night toggle listener (assuming toggleDayNight is globally available or exported from scene.js)
    if (dayNightBtn) {
        dayNightBtn.addEventListener('click', () => {
            // Check if toggleDayNight is available (it might be on window or needs import)
            if (typeof toggleDayNight === 'function') {
                 toggleDayNight(); // Call function from scene.js
                 // Update button text/class (handled in game.html script based on return value or state)
            } else if (typeof window.toggleDayNight === 'function') {
                 window.toggleDayNight(); // Try calling from window scope
            } else {
                 console.warn("toggleDayNight function not found.");
            }
        });
         // Initialize button text/class based on initial state from scene.js if possible
         // This requires scene.js to expose its initial state or the toggle function to return it.
         // Alternatively, the game.html script handles this.
    }

    // Add listeners for pause menu buttons
    if (pauseBtn) pauseBtn.addEventListener('click', pauseGame);
    if (resumeBtn) resumeBtn.addEventListener('click', resumeGame);
    if (restartBtn) restartBtn.addEventListener('click', () => location.reload()); // Simple restart
    if (exitBtn) exitBtn.addEventListener('click', () => window.location.href = 'index.html'); // Go back to menu

    // Add global key listener for pause (ESC)
    window.addEventListener('keydown', (event) => {
        if (event.code === 'Escape') {
            if (event.target.tagName === 'INPUT') return; // Don't pause if typing

            if (isPaused) {
                if (lives > 0) resumeGame(); // Only resume if not game over
                else location.reload(); // Restart if game over and paused
            } else {
                pauseGame();
            }
        }
    });

    // Add zoom listener for third-person camera
    window.addEventListener('wheel', (event) => {
        // Only zoom if in third person, playing, and not scrolling over UI elements that might need scroll
        if (getCameraMode() === 'thirdPerson' && !viewMode && !isPaused && event.target === renderer.domElement) {
            zoomLevel -= event.deltaY * 0.001; // Adjust zoom sensitivity
            zoomLevel = Math.min(Math.max(zoomLevel, 0.4), 2.5); // Clamp zoom level (min 0.4x, max 2.5x)
        }
    });

    // Start the animation loop
    clock.start(); // Start the clock before the first frame
    animate();
    console.log("Game initialized and animation loop started.");
}

// Wait for DOM content to load before initializing the game
document.addEventListener('DOMContentLoaded', initGame);

// Export functions needed by other modules (e.g., UI updates)
export { updateScore, updateHitDisplay }; // Keep original exports needed by other modules