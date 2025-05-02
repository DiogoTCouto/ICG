// main.js - Updated for Level System & Fixed const assignment error
import * as THREE from 'three';
import * as CANNON from 'cannon-es'; // Import CANNON for physics

import { scene, camera, renderer, cameraRotation, cameraTilt, isDragging } from './scene.js';
import { world } from './physics.js';
// Import terrain functions for BOTH levels
// Make sure the paths and exported names match your actual files
import { initSpacedBlockyTerrain, terrainColumns as terrainColumnsLvl1Ref, goalPillarData as goalPillarLvl1Ref } from './terrain.js'; // Renamed imports slightly for clarity
import { initSpacedBlockyTerrainLevel2 } from './terrain_level2.js'; // Import Level 2 init
// Import player functions
import {
  initPlayer,
  setupPlayerControls,
  updatePlayer,
  resetPlayerState, // Import reset function
  getPlayerBody,
  getCameraMode,
  getPlayerMesh,
  getPlayerHeightOffset
} from './player.js';
// Import item/enemy functions
import { spawnBallMachine, updateBalls, processRemovals as processBallRemovals } from './ball.js';
import { handleClick, startCupcakeSpawner, updateCupcakes, processRemovals as processCupcakeRemovals } from './cupcake.js';
import { lavaMaterial } from './terrain_level2.js';
// --- Game State Variables ---
const urlParams = new URLSearchParams(window.location.search);
const initialModel = urlParams.get('model') || 'cube';
const viewMode = urlParams.get('viewMode') === 'true';

let score = 0;
let lives = 3;
let hitCount = 0;
let currentRate = 1; // Ball spawn rate
let gameWon = false; // Final win state
let isPaused = false;
let animationFrameId = null;
const clock = new THREE.Clock();

// --- Level Management ---
let currentLevel = 1;
const maxLevels = 2;
let terrainColumns = []; // Shared array to hold current level's column data
let currentGoalPillarData = null; // Reference to the current level's goal data

// --- Camera Variables ---
let orbitAngle = 0; // For view mode camera
const orbitRadius = 50;
const terrainCenterY = 20;
const defaultCameraTilt = Math.PI / 6;
const cameraDistance = 25;
const cameraHeight = 15;
let smoothedCameraRotation = cameraRotation || 0;
let smoothedCameraTilt = cameraTilt || defaultCameraTilt;
let zoomLevel = 1.0;

// --- UI Elements ---
const scoreEl = document.getElementById('score');
const heartsContainer = document.getElementById('hearts');
const pauseMenu = document.getElementById('pauseMenu');
const gameStatusEl = document.getElementById('gameStatus');
// *** FIXED: Changed const to let for levelDisplayEl ***
let levelDisplayEl = document.getElementById('levelDisplay'); // Allow reassignment if created dynamically

// --- UI Update Functions ---
function updateScore(newScore) {
  score = newScore;
  if (scoreEl) {
      scoreEl.textContent = score;
      scoreEl.classList.add('highlight');
      setTimeout(() => scoreEl.classList.remove('highlight'), 500);
  }
}

function updateHitDisplay(newTotalHits) {
  if (!heartsContainer) return;
  const previousLives = lives;
  lives = Math.max(0, 3 - newTotalHits);

  if (lives < previousLives) {
    const hearts = heartsContainer.querySelectorAll('.heart');
    for (let i = lives; i < previousLives; i++) {
        if (hearts[i] && !hearts[i].classList.contains('lost')) {
            hearts[i].classList.add('animate-lost');
            setTimeout(() => { if(hearts[i]) hearts[i].classList.add('lost'); }, 500);
        }
    }
  }

   const hearts = heartsContainer.querySelectorAll('.heart');
   for (let i = 0; i < hearts.length; i++) {
       if (i < lives) {
           hearts[i].classList.remove('lost', 'animate-lost');
       } else if (!hearts[i].classList.contains('animate-lost')) {
           hearts[i].classList.add('lost');
       }
   }

  // Check for game over
  if (lives <= 0 && !isPaused && !gameWon) {
    showStatusMessage("Game Over! Press ESC to restart.", 10000);
    pauseGame(true); // Pause and indicate game over state
  }
}

function updateLevelDisplay() {
    // Check if levelDisplayEl exists before trying to update it
    if (levelDisplayEl) {
        levelDisplayEl.textContent = `Level: ${currentLevel}`;
    } else {
        console.warn("Level display element not found when trying to update.");
        // Attempt to find it again in case it was added after initial load but before this call
        levelDisplayEl = document.getElementById('levelDisplay');
        if (levelDisplayEl) {
            levelDisplayEl.textContent = `Level: ${currentLevel}`;
        }
    }
}


function showStatusMessage(message, duration = 3000) {
    if (gameStatusEl) {
        gameStatusEl.textContent = message;
        gameStatusEl.classList.add('visible');
        setTimeout(() => {
            gameStatusEl.classList.remove('visible');
        }, duration);
    } else if (window.showGameStatus) { // Fallback to function defined in HTML
        window.showGameStatus(message, duration);
    } else {
        console.log("STATUS:", message); // Console fallback
    }
}


// --- Game Pause/Resume ---
function pauseGame(isGameOver = false) {
    // Prevent pausing if already won
    if (isPaused || gameWon) return;
    isPaused = true;
    clock.stop();
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (pauseMenu) {
        const pauseTitle = pauseMenu.querySelector('h2');
        const resumeBtn = document.getElementById('resumeBtn');
        if (pauseTitle) {
             pauseTitle.textContent = isGameOver ? "Game Over" : (gameWon ? "You Win!" : "Game Paused"); // Handle win state text
        }
        if (resumeBtn) {
            // Hide resume if game over OR game won
            resumeBtn.style.display = (isGameOver || gameWon) ? 'none' : 'block';
        }
        pauseMenu.classList.add('active');
    }
    spawnBallMachine(0); // Stop spawning balls
    // Stop cupcake spawner if interval-based
    // clearInterval(cupcakeIntervalId);

    document.exitPointerLock();
    console.log(isGameOver ? "Game Over - Paused" : (gameWon ? "Game Won - Paused" : "Game Paused"));
}

function resumeGame() {
    // Only resume if paused, not game over, and not won
    if (!isPaused || lives <= 0 || gameWon) return;
    isPaused = false;
    clock.start();
    if (pauseMenu) pauseMenu.classList.remove('active');
    spawnBallMachine(currentRate);
    // Restart cupcake spawner if needed
    // startCupcakeSpawner(3000);

    if(getCameraMode() === 'firstPerson') {
        renderer.domElement.requestPointerLock();
    }
    if (!animationFrameId) {
        animate();
    }
    console.log("Game Resumed");
}

// --- Level Loading and Clearing ---

/**
 * Removes all objects associated with the current level from the scene and physics world.
 */
function clearLevel() {
    console.log("Clearing current level...");

    // Remove physics bodies (terrain, floor)
    // Use flags added in terrain_level2.js
    const bodiesToRemove = world.bodies.filter(body => body.isTerrainPillar || body.isSafetyFloor);
    bodiesToRemove.forEach(body => world.removeBody(body));
    console.log(`Removed ${bodiesToRemove.length} physics bodies.`);

    // Remove meshes (terrain, floor, water, goal marker, lampposts)
    // Use flags/names added in terrain_level2.js
    const meshesToRemove = scene.children.filter(child =>
        child.isTerrainPillar || child.isSafetyFloor || child.isWater || child.name === "GoalMarker" || child.name === "Lamppost" || child.isLevelObject
    );
     meshesToRemove.forEach(mesh => {
        // Dispose geometry and material
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => {
                    if(m.map) m.map.dispose(); // Dispose textures
                    m.dispose();
                });
            } else {
                 if(mesh.material.map) mesh.material.map.dispose(); // Dispose texture
                 mesh.material.dispose();
            }
        }
        // Dispose lights within lampposts
        if (mesh.name === "Lamppost") {
            mesh.traverse(child => {
                if (child.isLight) {
                    child.dispose(); // Dispose THREE.js lights
                }
            });
        }
        scene.remove(mesh); // Remove from scene after disposal
    });
    console.log(`Removed ${meshesToRemove.length} scene objects.`);


    // Clear the shared terrain data array and goal data reference
    terrainColumns.length = 0;
    currentGoalPillarData = null;

    // Note: Player, balls, cupcakes are handled separately
    // Consider clearing active balls/cupcakes here if they shouldn't carry over.
    // Example:
    // clearActiveItems(); // You would need to implement this in ball.js/cupcake.js
}

/**
 * Loads the specified level.
 * @param {number} levelNumber - The level to load (1 or 2).
 */
function loadLevel(levelNumber) {
    clearLevel(); // Clear previous level first

    console.log(`Loading Level ${levelNumber}...`);
    currentLevel = levelNumber;
    updateLevelDisplay(); // Update UI

    // Reset player state (allow winning again)
    resetPlayerState(); // From player.js
    const playerBody = getPlayerBody();

    // Initialize terrain based on level number
    if (levelNumber === 1) {
        // Use parameters for Level 1
        // Pass the shared terrainColumns array to be populated
        initSpacedBlockyTerrain(0.2, 0.2, 15, 20, 2);
        // Goal data is now handled internally by terrain/wincondition modules

        // Ensure day mode
        if (window.isNightModeActive === true && typeof window.toggleDayNight === 'function') {
            console.log("Switching to Day Mode for Level 1");
            window.toggleDayNight();
        }
        showStatusMessage("Level 1", 4000);

    } else if (levelNumber === 2) {
        // Use parameters for Level 2
        // Pass the shared terrainColumns array to be populated
        initSpacedBlockyTerrainLevel2(terrainColumns, 0.2, 0.2, 15, 20, 2, 0.15);
        // Goal data is now handled internally by terrain/wincondition modules

        // Ensure night mode
        if (window.isNightModeActive === false && typeof window.toggleDayNight === 'function') {
             console.log("Switching to Night Mode for Level 2");
             window.toggleDayNight();
        }
         showStatusMessage("Level 2", 4000);
    }

     // Reposition player AFTER terrain is generated and terrainColumns is populated
     if (playerBody) {
        // Find starting column for the level (e.g., near 0,0) using the now populated terrainColumns
       const startColumn = findNearestColumn(0, 0) || { height: 10, x: 0, z: 0 }; // Fallback
       const startY = startColumn.height + getPlayerHeightOffset() + 1.0; // Start slightly above
       playerBody.position.set(startColumn.x, startY, startColumn.z);
       playerBody.velocity.set(0, 0, 0);
       playerBody.angularVelocity.set(0, 0, 0);
       // Force awake state after repositioning
       playerBody.wakeUp();
       console.log(`Player repositioned for Level ${levelNumber} at`, playerBody.position);
   } else {
       console.error("Player body not available for repositioning!");
   }


    // Reset game state variables relevant to the level start
    isPaused = false; // Ensure game isn't paused
    gameWon = false; // Ensure final win flag is false
    if (clock.running === false) clock.start(); // Start clock if stopped
    if (!animationFrameId) animate(); // Start animation loop if stopped

}

// --- Win Condition / Level Progression ---

/**
 * Called by player.js when goal is reached. Handles level advance or final win.
 */
window.advanceLevelOrWin = function() {
    // don’t advance if we’re paused or already in a win state
    if (isPaused || gameWon) return;

    if (currentLevel < maxLevels) {
        const nextLevel = currentLevel + 1;
        console.log(`Level ${currentLevel} Complete! Advancing to Level ${nextLevel}`);
        showStatusMessage(`Level ${currentLevel} Complete!`, 3000);
        setTimeout(() => {
            loadLevel(nextLevel);
        }, 1500);
    } else {
        console.log(`Level ${currentLevel} Complete! Game Won!`);
        triggerFinalWin();
    }
};

/**
 * Handles the final win state after completing the last level.
 */
function triggerFinalWin() {
    if (gameWon) return; // Prevent multiple triggers
    gameWon = true;
    console.log("Final Win Condition Triggered!");

    showStatusMessage("You Win! Congratulations!", 15000);

    // Pause the game and show a modified pause menu
    pauseGame(true); // Use game over state styling for the pause menu (hides resume)

    if (pauseMenu) {
        const pauseTitle = pauseMenu.querySelector('h2');
        if (pauseTitle) pauseTitle.textContent = "You Win!"; // Override "Game Over"
        pauseMenu.classList.add('active'); // Ensure menu is visible
    }
}


// --- Main Animate Loop ---
function animate() {
    animationFrameId = requestAnimationFrame(animate);

    // Check pause or final win state
    if (isPaused || gameWon) {
        renderer.render(scene, camera); // Render UI overlay
        // if (renderComposer) renderComposer.render();
        return; // Skip game logic
    }

    const deltaTime = clock.getDelta();

    // Physics Update
    world.step(1 / 60, deltaTime, 3);

    // Process Removals
    processBallRemovals();
    processCupcakeRemovals();

    // Update Game Objects
    updatePlayer(deltaTime);
    updateBalls();
    updateCupcakes();
    // updateWater(deltaTime); // Water animation might be handled internally now
    if (lavaMaterial && lavaMaterial.uniforms && lavaMaterial.uniforms.uTime) {
        // Use elapsed time (in seconds) to drive the lava
        lavaMaterial.uniforms.uTime.value = performance.now() * 0.001;
      }
    // Camera Update Logic (remains the same as previous version)
    const playerBody = getPlayerBody();
    const currentCameraMode = getCameraMode();
    if (viewMode) {
        orbitAngle += 0.0001 * 60;
        camera.position.x = orbitRadius * Math.cos(orbitAngle);
        camera.position.z = orbitRadius * Math.sin(orbitAngle);
        camera.position.y = terrainCenterY + 25;
        camera.lookAt(0, terrainCenterY, 0);
    } else if (playerBody) {
        if (currentCameraMode === 'firstPerson') {
            const headPosition = new THREE.Vector3();
            headPosition.copy(playerBody.position);
            headPosition.y += getPlayerHeightOffset();
            const positionSmoothingFactor = 0.2;
            camera.position.lerp(headPosition, positionSmoothingFactor);
        } else { // 'thirdPerson'
            const cameraPositionLerpFactor = 0.15;
            const cameraRotationSmoothFactor = 0.1;
            if (isDragging) {
                 smoothedCameraRotation += (cameraRotation - smoothedCameraRotation) * cameraRotationSmoothFactor;
                 smoothedCameraTilt += (cameraTilt - smoothedCameraTilt) * cameraRotationSmoothFactor;
                 smoothedCameraTilt = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, smoothedCameraTilt));
            }
            const horizontalDistance = cameraDistance * zoomLevel;
            const baseVerticalOffset = cameraHeight * zoomLevel;
            const offset = new THREE.Vector3();
            offset.x = horizontalDistance * Math.sin(smoothedCameraRotation);
            offset.z = horizontalDistance * Math.cos(smoothedCameraRotation);
            offset.y = horizontalDistance * Math.tan(smoothedCameraTilt) + baseVerticalOffset;
            const targetCamPos = new THREE.Vector3();
            targetCamPos.copy(playerBody.position).add(offset);
            camera.position.lerp(targetCamPos, cameraPositionLerpFactor);
            const lookAtTarget = new THREE.Vector3(
                playerBody.position.x, playerBody.position.y + 1.0, playerBody.position.z
            );
            camera.lookAt(lookAtTarget);
        }
    } else {
        camera.lookAt(0, 0, 0);
    }

    // Render
    renderer.render(scene, camera);
    // if (renderComposer) renderComposer.render();
}

// --- Initialization ---
function initGame() {
    console.log("Initializing game...");
    console.log("View Mode:", viewMode);
    console.log("Initial Player Model:", initialModel);

    // Reset core game state
    isPaused = false;
    gameWon = false;
    lives = 3;
    hitCount = 0;
    updateHitDisplay(0);
    score = 0;
    updateScore(0);
    currentLevel = 1; // Start at level 1

    // Initialize player (position will be set by loadLevel)
    initPlayer(initialModel);

    // Setup controls (only if not in view mode)
    if (!viewMode) {
        setupPlayerControls();
        spawnBallMachine(currentRate); // Start spawners
        startCupcakeSpawner(3000);
        renderer.domElement.addEventListener('click', handleClick);
    } else {
        // Configure view mode specifics
        const uiElementsToHide = ['.game-ui', '.hearts-display', '#levelDisplay']; // Hide level display too
        uiElementsToHide.forEach(selector => {
             const element = document.querySelector(selector);
             if (element) element.style.display = 'none';
        });
        spawnBallMachine(0); // Ensure no spawns
    }

    // Load the first level
    loadLevel(1); // This now handles terrain init and player positioning

    // Setup UI Controls (Rate, Day/Night, Pause)
    const rateInput = document.getElementById('rateInput');
    const setRateBtn = document.getElementById('setRateBtn');
    const dayNightBtn = document.getElementById('dayNightBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const restartBtn = document.getElementById('restartBtn');
    const exitBtn = document.getElementById('exitBtn');
    const debugLevelBtn = document.getElementById('debugLevelBtn');  // ← your “Next Level (Debug)” button


    if (setRateBtn && rateInput) {
        rateInput.value = currentRate;
        setRateBtn.addEventListener('click', () => {
            if (gameWon) return; // Prevent changes after win
            const newRate = parseFloat(rateInput.value);
            if (!isNaN(newRate) && newRate >= 0) {
                currentRate = newRate;
                if (!isPaused && !viewMode) {
                    spawnBallMachine(currentRate);
                }
                console.log("Ball spawn rate set to:", currentRate);
            }
        });
    }

    if (dayNightBtn) {
        dayNightBtn.addEventListener('click', () => {
            if (typeof window.toggleDayNight === 'function') {
                 window.toggleDayNight();
                 // Update button text/class based on new state
                 const isNight = window.isNightModeActive; // Assuming scene.js exposes this
                 dayNightBtn.innerHTML = isNight ? '<i class="fas fa-sun"></i> Day Mode' : '<i class="fas fa-moon"></i> Night Mode';
                 // Ensure only one class is active
                 dayNightBtn.classList.remove('day-mode', 'night-mode');
                 dayNightBtn.classList.add(isNight ? 'day-mode' : 'night-mode');
            } else {
                 console.warn("toggleDayNight function not found on window.");
            }
        });
        // Initial button state based on scene.js (if possible)
        const isNight = window.isNightModeActive;
        dayNightBtn.innerHTML = isNight ? '<i class="fas fa-sun"></i> Day Mode' : '<i class="fas fa-moon"></i> Night Mode';
        // Ensure only one class is active
        dayNightBtn.classList.remove('day-mode', 'night-mode');
        dayNightBtn.classList.add(isNight ? 'day-mode' : 'night-mode');
    }

    // Pause menu button listeners
    if (pauseBtn) pauseBtn.addEventListener('click', () => pauseGame(false)); // Normal pause
    if (resumeBtn) resumeBtn.addEventListener('click', resumeGame);
    if (restartBtn) restartBtn.addEventListener('click', () => location.reload());
    if (exitBtn) exitBtn.addEventListener('click', () => window.location.href = 'index.html');

    // **DEBUG: Next Level button**
    if (debugLevelBtn) {
        debugLevelBtn.addEventListener('click', () => {
        console.log('Debug: advancing to next level');
        window.advanceLevelOrWin();
        });
    }

    // Global ESC key listener
    window.addEventListener('keydown', (event) => {
        if (event.code === 'Escape') {
            if (event.target.tagName === 'INPUT') return;
            if (gameWon || lives <= 0) { // If game is over (win or lose)
                location.reload(); // ESC restarts
            } else if (isPaused) {
                resumeGame();
            } else {
                pauseGame(false); // Normal pause
            }
        }
    });

    // Zoom listener
    window.addEventListener('wheel', (event) => {
        if (getCameraMode() === 'thirdPerson' && !viewMode && !isPaused && !gameWon && event.target === renderer.domElement) {
            zoomLevel -= event.deltaY * 0.001;
            zoomLevel = Math.min(Math.max(zoomLevel, 0.4), 2.5);
        }
    });

    // Start the clock and animation loop (if not already started by loadLevel)
    if (!clock.running) clock.start();
    if (!animationFrameId) animate();

    console.log("Game initialized.");
}

// Wait for DOM content to load before initializing
document.addEventListener('DOMContentLoaded', () => {
    // Add the level display element dynamically if it doesn't exist in HTML
    // Ensure levelDisplayEl is assigned correctly here
    if (!document.getElementById('levelDisplay')) {
        const levelDiv = document.createElement('div');
        levelDiv.id = 'levelDisplay';
        // Apply styling (same as before)
        levelDiv.style.position = 'absolute';
        levelDiv.style.top = '20px';
        levelDiv.style.right = '150px'; // Adjust as needed
        levelDiv.style.zIndex = '100';
        levelDiv.style.color = 'white';
        levelDiv.style.fontSize = '20px';
        levelDiv.style.padding = '10px 15px';
        levelDiv.style.background = 'rgba(0,0,0,0.5)';
        levelDiv.style.borderRadius = '10px';
        levelDiv.textContent = 'Level: 1'; // Initial text
        document.body.appendChild(levelDiv);
        levelDisplayEl = levelDiv; // Assign to the 'let' variable
    } else {
         // If it exists, ensure the 'let' variable references it
         levelDisplayEl = document.getElementById('levelDisplay');
    }
    initGame(); // Initialize the game after DOM is ready
});

// Export potentially useful functions
export { updateScore, updateHitDisplay };

// Helper function to find nearest column (needed for player repositioning)
// Ensure this function uses the shared 'terrainColumns' array
function findNearestColumn(x, z) {
  if (terrainColumns.length === 0) {
      console.warn("findNearestColumn called but terrainColumns is empty.");
      return null; // Return null if no columns exist
  }
  let nearestColumn = null;
  let minDistanceSq = Infinity;
  for (const column of terrainColumns) {
    const dx = column.x - x;
    const dz = column.z - z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < minDistanceSq) {
      minDistanceSq = distanceSq;
      nearestColumn = column;
    }
  }
  // If no column was found (shouldn't happen if array not empty, but safety check)
  if (!nearestColumn) {
      console.warn("findNearestColumn could not find a nearest column, returning first column.");
      return terrainColumns[0];
  }
  return nearestColumn;
}
