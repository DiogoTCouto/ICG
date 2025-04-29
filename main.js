// main.js
import * as THREE from 'three'; // Import THREE namespace
// Import necessary items from scene.js, including new flags/variables if added
import { scene, camera, renderer, cameraRotation, cameraTilt, isDragging } from './scene.js';
import { world } from './physics.js';
// Import from terrain.js (assuming this is the correct one based on init call)
import { initSpacedBlockyTerrain, updateWater, findNearestColumn } from './terrain.js';
// Import player functions and getters
import {
  initPlayer,
  setupPlayerControls,
  updatePlayer,
  getPlayerBody,
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

// Game state variables
let score = 0;
let lives = 3;
let hitCount = 0;
let currentRate = 1;
let orbitAngle = 0; // For view mode camera
let gameWon = false; // *** ADDED: Game won flag ***
const orbitRadius = 50; // For view mode camera
const terrainCenterY = 20; // For view mode camera target

// Third-person camera control variables
const defaultCameraTilt = Math.PI / 6;
const cameraDistance = 25;
const cameraHeight = 15;
let smoothedCameraRotation = cameraRotation || 0;
let smoothedCameraTilt = cameraTilt || defaultCameraTilt;
let zoomLevel = 1.0;

// Pause state
let isPaused = false;
let animationFrameId = null; // To store the requestAnimationFrame ID

// Timing
const clock = new THREE.Clock(); // Use THREE.Clock for delta time

// --- UI Update Functions ---
// (updateScore remains unchanged)
function updateScore(newScore) {
  score = newScore;
  const scoreEl = document.getElementById('score');
  if (scoreEl) {
      scoreEl.textContent = score;
      scoreEl.classList.add('highlight');
      setTimeout(() => scoreEl.classList.remove('highlight'), 500);
  }
}

// (updateHitDisplay remains largely unchanged, but checks gameWon flag)
function updateHitDisplay(newTotalHits) {
  const heartsContainer = document.getElementById('hearts');
  if (!heartsContainer) return;

  const previousLives = lives;
  lives = Math.max(0, 3 - newTotalHits); // Calculate lives based on total hits

  // Animate hearts if lives decreased
  if (lives < previousLives) {
    const hearts = heartsContainer.querySelectorAll('.heart');
    for (let i = lives; i < previousLives; i++) {
        if (hearts[i] && !hearts[i].classList.contains('lost')) {
            hearts[i].classList.add('animate-lost');
            setTimeout(() => {
                 if(hearts[i]) hearts[i].classList.add('lost');
            }, 500);
        }
    }
  }

   // Ensure correct static state for all hearts
   const hearts = heartsContainer.querySelectorAll('.heart');
   for (let i = 0; i < hearts.length; i++) {
       if (i < lives) {
           hearts[i].classList.remove('lost', 'animate-lost');
       } else if (!hearts[i].classList.contains('animate-lost')) {
           hearts[i].classList.add('lost');
       }
   }

  // Check for game over, only if game is not already won or paused
  if (lives <= 0 && !isPaused && !gameWon) { // *** ADDED: Check gameWon flag ***
    if (window.showGameStatus) {
        window.showGameStatus("Game Over! Press ESC to restart.", 10000);
    } else {
        alert("Game Over!"); // Fallback
    }
    pauseGame(); // Pause on game over
  }
}


// --- Game Pause/Resume ---
function pauseGame() {
    // Prevent pausing if already won
    if (isPaused || gameWon) return; // *** ADDED: Check gameWon flag ***
    isPaused = true;
    clock.stop(); // Stop the clock
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    const pauseMenu = document.getElementById('pauseMenu');
    if (pauseMenu) {
        // Ensure title is correct if paused normally (not win/game over)
        const pauseTitle = pauseMenu.querySelector('h2');
        if (pauseTitle && lives > 0) pauseTitle.textContent = "Game Paused";
        // Ensure resume button is visible if paused normally
        const resumeBtn = document.getElementById('resumeBtn');
        if (resumeBtn && lives > 0) resumeBtn.style.display = 'block';

        pauseMenu.classList.add('active'); // Show pause menu
    }
    spawnBallMachine(0); // Stop spawning balls
    // Stop cupcake spawner if it's interval-based (if not, it stops with the game loop)
    // clearInterval(cupcakeIntervalId); // Assuming cupcake spawner uses an interval ID

    document.exitPointerLock(); // Ensure pointer is unlocked when paused
    console.log("Game Paused");
}

function resumeGame() {
    // Only resume if paused, not game over, and not won
    if (!isPaused || lives <= 0 || gameWon) return; // *** ADDED: Check gameWon flag ***
    isPaused = false;
    clock.start(); // Restart the clock
    const pauseMenu = document.getElementById('pauseMenu');
    if (pauseMenu) pauseMenu.classList.remove('active'); // Hide pause menu
    spawnBallMachine(currentRate); // Resume spawning balls at current rate
    // Restart cupcake spawner if needed
    // startCupcakeSpawner(3000); // Assuming this restarts the interval

    // If in FPS mode, request pointer lock again on resume
    if(getCameraMode() === 'firstPerson') {
        renderer.domElement.requestPointerLock();
    }
    if (!animationFrameId) {
        animate(); // Re-request frame to continue loop
    }
    console.log("Game Resumed");
}

// *** ADDED: Global win condition trigger function ***
window.triggerWinCondition = function() {
    // Only trigger if not already won and not paused (to avoid race conditions)
    if (gameWon || isPaused) return;

    console.log("Win Condition Triggered!");
    gameWon = true; // Set the flag

    // Show win message via existing UI function
    if (window.showGameStatus) {
        window.showGameStatus("You Win! Press ESC to restart.", 15000); // Show for 15 seconds
    } else {
        alert("You Win!"); // Fallback
    }

    // Pause the game (stops loop, spawners)
    pauseGame(); // Call existing pause function

    // Optionally adjust pause menu for win state AFTER calling pauseGame
    const pauseMenu = document.getElementById('pauseMenu');
    if (pauseMenu) {
        const pauseTitle = pauseMenu.querySelector('h2');
        const resumeBtn = document.getElementById('resumeBtn');
        if (pauseTitle) pauseTitle.textContent = "You Win!"; // Change title
        if (resumeBtn) resumeBtn.style.display = 'none'; // Hide resume button
        // Ensure menu is visible if pauseGame didn't show it due to gameWon check
        pauseMenu.classList.add('active');
    }
};
// *** END ADDED ***


// --- Main Animate Loop ---
function animate() {
    // Store the ID returned by requestAnimationFrame to allow cancellation
    animationFrameId = requestAnimationFrame(animate);

    // Check pause state or win state at the beginning of the frame
    if (isPaused || gameWon) { // *** ADDED: Check gameWon flag ***
        // If paused or won, render one more frame for overlay/message,
        // but don't run game logic or request the next frame.
        renderer.render(scene, camera);
        // If using composer:
        // if (renderComposer) renderComposer.render();
        return; // Skip game logic
    }

    // --- Only run game logic if not paused and not won ---
    const deltaTime = clock.getDelta(); // Get time since last frame

    // --- Physics Update ---
    world.step(1 / 60, deltaTime, 3); // Recommended fixed step

    // --- Process Removals (After Physics Step) ---
    processBallRemovals();
    processCupcakeRemovals(); // Assuming this exists and is needed

    // --- Update Game Objects ---
    updatePlayer(deltaTime); // Pass deltaTime
    updateBalls();
    updateCupcakes();
    updateWater(deltaTime); // Update water animation

    // --- Camera Update Logic --- (Original logic restored)
    const playerBody = getPlayerBody();
    const currentCameraMode = getCameraMode();

    if (viewMode) {
        // View mode camera logic
        orbitAngle += 0.0001 * 60; // Adjust speed if needed
        camera.position.x = orbitRadius * Math.cos(orbitAngle);
        camera.position.z = orbitRadius * Math.sin(orbitAngle);
        camera.position.y = terrainCenterY + 25; // Adjust height if needed
        camera.lookAt(0, terrainCenterY, 0); // Look at the center of the terrain area

    } else if (playerBody) { // Gameplay camera logic
        if (currentCameraMode === 'firstPerson') {
            // First person camera logic
            const headPosition = new THREE.Vector3();
            headPosition.copy(playerBody.position);
            headPosition.y += getPlayerHeightOffset(); // Add player's eye height
            const positionSmoothingFactor = 0.2; // Adjust for smoother/faster follow
            camera.position.lerp(headPosition, positionSmoothingFactor);
            // Camera rotation is handled directly in player.js based on mouse input

        } else { // 'thirdPerson'
            // Third person camera logic
            const cameraPositionLerpFactor = 0.15; // How quickly camera moves to target
            const cameraRotationSmoothFactor = 0.1; // How quickly rotation adjusts

            // Smoothly update camera rotation/tilt based on mouse drag (if dragging)
            // isDragging, cameraRotation, cameraTilt are imported/managed by scene.js
            if (isDragging) {
                 smoothedCameraRotation += (cameraRotation - smoothedCameraRotation) * cameraRotationSmoothFactor;
                 smoothedCameraTilt += (cameraTilt - smoothedCameraTilt) * cameraRotationSmoothFactor;
                 // Clamp tilt to prevent looking too far up/down
                 smoothedCameraTilt = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, smoothedCameraTilt));
            }

            // Calculate camera offset based on rotation, tilt, and zoom
            const horizontalDistance = cameraDistance * zoomLevel;
            const baseVerticalOffset = cameraHeight * zoomLevel;

            const offset = new THREE.Vector3();
            // Calculate offset in spherical coordinates, then convert to Cartesian
            offset.x = horizontalDistance * Math.sin(smoothedCameraRotation);
            offset.z = horizontalDistance * Math.cos(smoothedCameraRotation);
            // Calculate vertical offset based on tilt and base height
            offset.y = horizontalDistance * Math.tan(smoothedCameraTilt) + baseVerticalOffset;

            // Target camera position is player position + calculated offset
            const targetCamPos = new THREE.Vector3();
            targetCamPos.copy(playerBody.position).add(offset);

            // Smoothly move camera towards the target position
            camera.position.lerp(targetCamPos, cameraPositionLerpFactor);

            // Make the camera look slightly above the player's feet
            const lookAtTarget = new THREE.Vector3(
                playerBody.position.x,
                playerBody.position.y + 1.0, // Look slightly higher than feet
                playerBody.position.z
            );
            camera.lookAt(lookAtTarget);
        }
    } else {
        // Fallback if playerBody doesn't exist yet
        camera.lookAt(0, 0, 0);
    }
    // --- End Camera Update ---

    // --- Render ---
    renderer.render(scene, camera);
    // if (renderComposer) renderComposer.render(); // If using post-processing
}

// --- Initialization ---
function initGame() {
    console.log("Initializing game...");
    console.log("View Mode:", viewMode);
    console.log("Initial Player Model:", initialModel);

    // Reset game state flags
    isPaused = false;
    gameWon = false; // *** ADDED: Reset gameWon flag on init ***
    lives = 3; // Reset lives
    hitCount = 0; // Reset hits
    updateHitDisplay(0); // Update UI for lives
    score = 0; // Reset score
    updateScore(0); // Update UI for score

    // Initialize terrain using the function from terrain.js
    // Using parameters that likely match the scattered terrain setup
    initSpacedBlockyTerrain(0.2, 0.2, 15, 18, 2); // Alternative with spacing

    // Initialize player using the model from URL param or default
    initPlayer(initialModel);

    // Setup controls and game elements only if not in view mode
    if (!viewMode) {
        setupPlayerControls(); // Sets up WASD, Space, F key, mouse look, etc.
        spawnBallMachine(currentRate); // Start spawning balls
        startCupcakeSpawner(3000); // Start spawning cupcakes every 3 seconds
        renderer.domElement.addEventListener('click', handleClick); // Enable cupcake clicking
    } else {
        // Configure view mode specifics (e.g., hide UI)
        const uiElementsToHide = ['.game-ui', '.hearts-display', '.instructions']; // Add class selectors for UI elements
        uiElementsToHide.forEach(selector => {
             const element = document.querySelector(selector);
             if (element) element.style.display = 'none';
        });
        // Optionally disable controls or spawners if they were started before this check
        spawnBallMachine(0); // Ensure balls don't spawn in view mode
        // Stop cupcake spawner if needed
    }

    // Setup UI Controls (Rate, Day/Night, Pause)
    const rateInput = document.getElementById('rateInput');
    const setRateBtn = document.getElementById('setRateBtn');
    const dayNightBtn = document.getElementById('dayNightBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const restartBtn = document.getElementById('restartBtn');
    const exitBtn = document.getElementById('exitBtn');

    if (setRateBtn && rateInput) {
        rateInput.value = currentRate;
        setRateBtn.addEventListener('click', () => {
            // Prevent changing rate if game is won
            if (gameWon) return; // *** ADDED: Check gameWon flag ***
            const newRate = parseFloat(rateInput.value);
            if (!isNaN(newRate) && newRate >= 0) {
                currentRate = newRate;
                // Only change spawner if not paused and not in view mode
                if (!isPaused && !viewMode) {
                    spawnBallMachine(currentRate);
                }
                console.log("Ball spawn rate set to:", currentRate);
            }
        });
    }

    if (dayNightBtn) { // Day/Night toggle
        dayNightBtn.addEventListener('click', () => {
            // Use the globally exposed function from scene.js
            if (typeof window.toggleDayNight === 'function') {
                 window.toggleDayNight();
            } else {
                 console.warn("toggleDayNight function not found on window.");
            }
        });
    }

    // Pause menu button listeners
    if (pauseBtn) pauseBtn.addEventListener('click', pauseGame);
    if (resumeBtn) resumeBtn.addEventListener('click', resumeGame);
    if (restartBtn) restartBtn.addEventListener('click', () => location.reload()); // Simple reload for restart
    if (exitBtn) exitBtn.addEventListener('click', () => window.location.href = 'index.html'); // Go back to main menu

    // Global ESC key listener for pause/resume/restart
    window.addEventListener('keydown', (event) => {
        if (event.code === 'Escape') {
            if (event.target.tagName === 'INPUT') return; // Ignore if typing in an input

            // If game is won or lost, ESC should restart
            if (gameWon || lives <= 0) { // *** MODIFIED: Check gameWon or lives <= 0 ***
                location.reload();
            }
            // Otherwise, toggle pause/resume
            else if (isPaused) {
                resumeGame();
            } else {
                pauseGame();
            }
        }
    });

    // Zoom listener for third-person camera
    window.addEventListener('wheel', (event) => {
        // Only allow zoom if in third person, not view mode, not paused, and not won
        if (getCameraMode() === 'thirdPerson' && !viewMode && !isPaused && !gameWon && event.target === renderer.domElement) { // *** ADDED: Check gameWon flag ***
            zoomLevel -= event.deltaY * 0.001; // Adjust zoom sensitivity
            zoomLevel = Math.min(Math.max(zoomLevel, 0.4), 2.5); // Clamp zoom level
        }
    });

    // Start the animation loop
    clock.start();
    if (!animationFrameId) { // Ensure loop starts if not already running
        animate();
    }
    console.log("Game initialized and animation loop started.");
}

// Wait for DOM content to load before initializing the game
document.addEventListener('DOMContentLoaded', initGame);

// Export functions needed by other modules (e.g., UI updates)
export { updateScore, updateHitDisplay };
