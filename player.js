// player.js
// Implemented FPS mouse look, strafing, and smoother movement physics.
import * as THREE from 'three';
// *** Ensure this path is correct for your terrain file ***
import { findNearestColumn } from './terrain_scattered.js';
// ***
import { scene, camera, renderer } from './scene.js'; // Camera/Renderer needed for Pointer Lock & FPS view
import { world, playerMaterial } from './physics.js';

// --- Player Model Creation Functions ---
// (Keep your existing createCubePlayer, createSpherePlayer, createRobotPlayer functions here)
// Helper function to create a simple "headlight" mesh
function createHeadlight() {
    const lightGeometry = new THREE.SphereGeometry(0.25, 16, 8);
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    const headlight = new THREE.Mesh(lightGeometry, lightMaterial);
    headlight.name = "HeadlightIndicator";
    return headlight;
}
/** Creates a cube player */
function createCubePlayer() { /* ... Paste your existing function ... */
    const playerGroup = new THREE.Group();
    const color = new THREE.Color(0x00cc44);
    const darkerColor = color.clone().multiplyScalar(0.7);
    const topColor = new THREE.Color(0xeeeeee);
    const frontColor = color.clone().lerp(new THREE.Color(0xffffff), 0.2);
    const materials = [
        new THREE.MeshPhongMaterial({ color: color, shininess: 30 }), new THREE.MeshPhongMaterial({ color: color, shininess: 30 }),
        new THREE.MeshPhongMaterial({ color: topColor, shininess: 50 }), new THREE.MeshPhongMaterial({ color: darkerColor, shininess: 20 }),
        new THREE.MeshPhongMaterial({ color: frontColor, shininess: 40 }), new THREE.MeshPhongMaterial({ color: color, shininess: 30 })
    ];
    const bodyGeometry = new THREE.BoxGeometry(2.5, 2.5, 2.5);
    const body = new THREE.Mesh(bodyGeometry, materials); playerGroup.add(body);
    const eyeGeometry = new THREE.SphereGeometry(0.3, 16, 16); const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const pupilGeometry = new THREE.SphereGeometry(0.15, 16, 16); const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
    const eyeY = 0.5; const eyeZ = 1.26;
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial); leftEye.position.set(-0.6, eyeY, eyeZ);
    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial); leftPupil.position.set(0, 0, 0.16); leftEye.add(leftPupil);
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial); rightEye.position.set(0.6, eyeY, eyeZ);
    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial); rightPupil.position.set(0, 0, 0.16); rightEye.add(rightPupil);
    playerGroup.add(leftEye, rightEye);
    const mouthGeometry = new THREE.TorusGeometry(0.5, 0.08, 16, 16, Math.PI); const mouthMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial); mouth.position.set(0, -0.3, eyeZ); mouth.rotation.set(0, 0, Math.PI); playerGroup.add(mouth);
    //const headlight = createHeadlight(); headlight.position.set(0, 0.0, eyeZ + 0.1); playerGroup.add(headlight);
    return playerGroup;
 }
/** Creates a sphere player */
function createSpherePlayer() { /* ... Paste your existing function ... */
    const playerGroup = new THREE.Group(); const playerRadiusVisual = 1.5 * 0.9; // Match visual size closer to physics radius
    const color = new THREE.Color(0x3366ff);
    const bodyGeometry = new THREE.SphereGeometry(playerRadiusVisual, 32, 32);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: color, shininess: 60, emissive: color.clone().multiplyScalar(0.2), emissiveIntensity: 0.3 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial); playerGroup.add(body);
    const ringGeometry = new THREE.TorusGeometry(playerRadius * 1.1, 0.15, 16, 32); const ringMaterial = new THREE.MeshPhongMaterial({ color: 0xffcc00, shininess: 80 });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial); ring.rotation.set(Math.PI / 2, 0, 0); playerGroup.add(ring);
    const eyeGeometry = new THREE.SphereGeometry(0.3, 16, 16); const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const pupilGeometry = new THREE.SphereGeometry(0.15, 16, 16); const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
    const eyeY = 0.5; const eyeAngle = Math.asin(0.5 / playerRadiusVisual); const eyeDistZ = playerRadiusVisual * Math.cos(eyeAngle);
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial); leftEye.position.set(-0.5, eyeY, eyeDistZ);
    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial); leftPupil.position.set(0, 0, 0.16); leftEye.add(leftPupil); leftEye.lookAt(playerGroup.position); leftEye.rotation.y += Math.PI;
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial); rightEye.position.set(0.5, eyeY, eyeDistZ);
    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial); rightPupil.position.set(0, 0, 0.16); rightEye.add(rightPupil); rightEye.lookAt(playerGroup.position); rightEye.rotation.y += Math.PI;
    playerGroup.add(leftEye, rightEye);
    const headlight = createHeadlight(); headlight.position.set(0, 0, playerRadiusVisual + 0.05); playerGroup.add(headlight);
    return playerGroup;
}
/** Creates a robot player */
function createRobotPlayer() { /* ... Paste your existing function ... */
    const playerGroup = new THREE.Group(); const headColor = 0xaaaaaa; const bodyColor = 0x777777; const headDepth = 1.4; const bodyDepth = 1.6;
    const headGeometry = new THREE.BoxGeometry(1.8, 1.4, headDepth); const headMaterial = new THREE.MeshPhongMaterial({ color: headColor, shininess: 70, metalness: 0.6 });
    const head = new THREE.Mesh(headGeometry, headMaterial); head.position.set(0, 0.8, 0); playerGroup.add(head);
    const bodyGeometry = new THREE.BoxGeometry(2.2, 1.8, bodyDepth); const bodyMaterial = new THREE.MeshPhongMaterial({ color: bodyColor, shininess: 60 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial); body.position.set(0, -0.6, 0); playerGroup.add(body);
    const eyeGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.1); const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.8 });
    const eyeY = 1.0; const eyeZ = headDepth / 2 + 0.01;
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial); leftEye.position.set(-0.5, eyeY, eyeZ);
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial); rightEye.position.set(0.5, eyeY, eyeZ); playerGroup.add(leftEye, rightEye);
    const antennaBaseY = 1.5; const antennaGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8); const antennaMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
    const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial); antenna.position.set(0, antennaBaseY + 0.4, 0);
    const antennaTipGeometry = new THREE.SphereGeometry(0.12, 16, 16); const antennaTipMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.6 });
    const antennaTip = new THREE.Mesh(antennaTipGeometry, antennaTipMaterial); antennaTip.position.set(0, antennaBaseY + 0.8, 0); playerGroup.add(antenna, antennaTip);
    const panelGeometry = new THREE.PlaneGeometry(1.5, 1); const panelMaterial = new THREE.MeshPhongMaterial({ color: 0x555555, shininess: 90 });
    const panel = new THREE.Mesh(panelGeometry, panelMaterial); const panelZ = bodyDepth / 2 + 0.01; panel.position.set(0, -0.6, panelZ); playerGroup.add(panel);
    for (let i = 0; i < 3; i++) {
        const lightGeometry = new THREE.CircleGeometry(0.1, 16); const lightMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.5 });
        const light = new THREE.Mesh(lightGeometry, lightMaterial); light.position.set(-0.5 + i * 0.5, -0.6, panelZ + 0.01); playerGroup.add(light);
    }
    const headlight = createHeadlight(); headlight.position.set(0, eyeY, eyeZ + 0.1); playerGroup.add(headlight);
    return playerGroup;
 }
// --- Player Models Dictionary ---
const playerModels = {
    cube: { create: createCubePlayer, name: 'Cube' },
    sphere: { create: createSpherePlayer, name: 'Sphere' },
    robot: { create: createRobotPlayer, name: 'Robot' },
};

// --- Module Variables ---
let playerBody = null;
let playerMesh = null;
let playerModel = 'cube';
const playerRadius = 1.5; // Physics radius
const playerHeightOffset = 1.6; // Eye height offset from body center

// Movement parameters
const moveSpeed = 12; // Slightly increased base speed
const strafeSpeedFactor = 0.9; // Strafing almost as fast as forward
const jumpForce = 25; // Adjusted jump force (tweak based on new gravity)
const airControlFactor = 0.3; // How much control player has in the air (0=none, 1=full)

// State variables
let canJump = false;
let jumpsRemaining = 0;
const maxJumps = 2; // Allow double jump
let cameraMode = 'thirdPerson';
let isPointerLocked = false;

// Input state
const movementState = {
    forward: false, backward: false, left: false, right: false, jump: false
};

// FPS Camera control variables
let playerYaw = 0; // Left/right rotation (radians)
let playerPitch = 0; // Up/down rotation (radians)
const mouseSensitivity = 0.002; // Adjust sensitivity

// Raycaster for ground check
const groundCheckRay = new CANNON.Ray(new CANNON.Vec3(0, 0, 0), new CANNON.Vec3(0, -1, 0));
const groundCheckDistance = playerRadius + 0.15; // Slightly shorter distance
const raycastOptions = { collisionFilterMask: -1, skipBackfaces: true };
const rayResult = new CANNON.RaycastResult();

// Temporary vectors for calculations
const _worldDirection = new THREE.Vector3();
const _movementDirection = new THREE.Vector3();
const _rightDirection = new THREE.Vector3();
const _cameraQuaternion = new THREE.Quaternion();
const _playerMeshQuaternion = new THREE.Quaternion();


/**
 * Initializes the player physics body and visual mesh.
 */
function initPlayer(initialModel = 'cube') {
    playerModel = initialModel;
    cameraMode = 'thirdPerson'; // Default to third person
    jumpsRemaining = maxJumps;
    playerYaw = 0; // Reset yaw/pitch
    playerPitch = 0;

    const sphereShape = new CANNON.Sphere(playerRadius);

    playerBody = new CANNON.Body({
        mass: 70, material: playerMaterial,
        fixedRotation: true, // Keep physics body upright
        linearDamping: 0.1, // *** Significantly reduced damping ***
        angularDamping: 1.0 // Keep high angular damping
    });
    playerBody.addShape(sphereShape);
    playerBody.isPlayer = true; // Mark as player body

    // Find starting position
    const startColumn = findNearestColumn(0, 0) || { height: 10, x: 0, z: 0 };
    const startY = startColumn.height + playerRadius + 5;
    playerBody.position.set(startColumn.x, startY, startColumn.z);
    playerBody.sleepState = CANNON.Body.AWAKE;
    playerBody.allowSleep = false;

    // Create mesh
    const createModelFn = playerModels[playerModel]?.create || createCubePlayer;
    playerMesh = createModelFn();
    playerMesh.castShadow = true;

    playerMesh.position.copy(playerBody.position);
    playerMesh.quaternion.setFromEuler(new THREE.Euler(0, playerYaw, 0)); // Initial rotation
    playerMesh.visible = (cameraMode === 'thirdPerson'); // Hide if starting in FP (though default is TP)

    scene.add(playerMesh);
    world.addBody(playerBody);

    console.log("Player initialized.");
}

/**
 * Changes the player's visual model.
 */
function changePlayerModel(modelName) {
    if (!playerModels[modelName] || !playerBody || !playerMesh) {
        console.error(`Model "${modelName}" not found or player not initialized!`);
        return;
    }
    const currentPosition = playerBody.position.clone();
    // Use current yaw for rotation consistency
    const currentRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, playerYaw, 0));

    // Remove old mesh and dispose resources
    scene.remove(playerMesh);
    playerMesh.traverse(child => {
        if (child.isMesh) {
            child.geometry?.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m?.dispose());
                } else {
                    child.material?.dispose();
                }
            }
        }
    });

    // Create and add new mesh
    playerModel = modelName;
    const createModelFn = playerModels[playerModel].create;
    playerMesh = createModelFn();
    playerMesh.castShadow = true;
    playerMesh.position.copy(currentPosition);
    playerMesh.quaternion.copy(currentRotation);
    playerMesh.visible = (cameraMode === 'thirdPerson'); // Set visibility based on current mode

    scene.add(playerMesh);
    console.log(`Player model changed to: ${modelName}`);
}

/**
 * Sets up keyboard event listeners and Pointer Lock.
 */
function setupPlayerControls() {
    // Remove previous listeners to avoid duplicates
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    document.removeEventListener('mousemove', onMouseMove);
    renderer?.domElement.removeEventListener('click', requestPointerLock); // Use optional chaining

    // Add new listeners
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMove); // Listen for mouse movement

    // Request pointer lock on click (only when game is active)
    if (renderer?.domElement) {
        renderer.domElement.addEventListener('click', requestPointerLock);
    } else {
        console.warn("Renderer DOM element not found for pointer lock listener.");
    }

    console.log("Player controls and pointer lock setup.");
}

/**
 * Request pointer lock when canvas is clicked.
 */
function requestPointerLock() {
    // Only lock if in first-person mode and game isn't paused (add pause check later if needed)
    if (cameraMode === 'firstPerson' && renderer?.domElement) {
        renderer.domElement.requestPointerLock();
    }
}

/**
 * Handle pointer lock state changes.
 */
function onPointerLockChange() {
    if (document.pointerLockElement === renderer?.domElement) {
        isPointerLocked = true;
        console.log("Pointer Locked");
        // Optional: Hide UI elements that obstruct view
    } else {
        isPointerLocked = false;
        console.log("Pointer Unlocked");
        // Optional: Show UI elements again, maybe pause game?
        // Reset movement state if desired when pointer unlocks
        // movementState.forward = false; // etc.
    }
}

/**
 * Handle mouse movement for camera control (only when pointer locked).
 */
function onMouseMove(event) {
    if (!isPointerLocked || cameraMode !== 'firstPerson') {
        return; // Only run if pointer is locked and in first person
    }

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    // Adjust yaw (left/right) based on horizontal mouse movement
    playerYaw -= movementX * mouseSensitivity;

    // Adjust pitch (up/down) based on vertical mouse movement
    playerPitch -= movementY * mouseSensitivity;

    // Clamp pitch to prevent flipping over (e.g., +/- 89 degrees)
    playerPitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, playerPitch));
}


/**
 * Handles keydown events.
 */
function onKeyDown(event) {
    // Allow default browser actions if pointer isn't locked (e.g., F5 refresh)
    // Or if typing in an input field etc.
    // if (!isPointerLocked && cameraMode === 'firstPerson') return;

    switch (event.code) {
        case 'KeyW': case 'ArrowUp': movementState.forward = true; break;
        case 'KeyS': case 'ArrowDown': movementState.backward = true; break;
        case 'KeyA': case 'ArrowLeft': movementState.left = true; break;
        case 'KeyD': case 'ArrowRight': movementState.right = true; break;
        case 'Space':
             if (!movementState.jump) { // Trigger jump only on initial press
                 movementState.jump = true;
             }
             break;
        case 'KeyF': // Toggle camera mode
             if (!event.repeat) { // Prevent toggle spam if key held down
                 toggleCameraMode();
             }
             break;
    }
}

/**
 * Handles keyup events.
 */
function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW': case 'ArrowUp': movementState.forward = false; break;
        case 'KeyS': case 'ArrowDown': movementState.backward = false; break;
        case 'KeyA': case 'ArrowLeft': movementState.left = false; break;
        case 'KeyD': case 'ArrowRight': movementState.right = false; break;
        case 'Space': movementState.jump = false; break; // Reset jump flag on key up
    }
}

/**
 * Toggles between camera modes and updates player mesh visibility.
 */
function toggleCameraMode() {
    if (cameraMode === 'thirdPerson') {
        cameraMode = 'firstPerson';
        if (playerMesh) playerMesh.visible = false; // Hide mesh in first person
        // Attempt to lock pointer when switching to first person
        requestPointerLock();
    } else {
        cameraMode = 'thirdPerson';
        if (playerMesh) playerMesh.visible = true; // Show mesh in third person
        // Unlock pointer when switching away from first person
        document.exitPointerLock();
    }
    console.log("Camera mode switched to:", cameraMode);
}


/**
 * Updates the player's state each frame (physics, position, rotation).
 */
function updatePlayer() {
    if (!playerBody || !playerMesh || !camera) return;

    // --- 1. Ground Check ---
    groundCheckRay.from.copy(playerBody.position);
    groundCheckRay.from.y -= playerRadius * 0.5; // Start ray slightly lower for robustness
    groundCheckRay.to.copy(playerBody.position);
    groundCheckRay.to.y -= groundCheckDistance;
    rayResult.reset();
    world.raycastClosest(groundCheckRay.from, groundCheckRay.to, raycastOptions, rayResult);
    const onGround = rayResult.hasHit;

    // Reset jumps if grounded
    if (onGround) {
        if (!canJump) { // Landed this frame
             jumpsRemaining = maxJumps;
        }
        canJump = true;
    } else {
        canJump = false;
    }

    // --- 2. Update Camera Rotation (First Person) ---
    if (cameraMode === 'firstPerson') {
        // Calculate camera quaternion based on yaw (body) and pitch (mouse)
        _cameraQuaternion.setFromEuler(new THREE.Euler(playerPitch, playerYaw, 0, 'YXZ'));
        camera.quaternion.copy(_cameraQuaternion);

        // Make player mesh visually face the same direction (yaw only)
        _playerMeshQuaternion.setFromEuler(new THREE.Euler(0, playerYaw, 0, 'YXZ'));
        playerMesh.quaternion.copy(_playerMeshQuaternion);
    }

    // --- 3. Calculate Movement Direction ---
    // Get camera's horizontal forward and right vectors
    camera.getWorldDirection(_worldDirection);
    _worldDirection.y = 0;
    _worldDirection.normalize();

    _rightDirection.crossVectors(camera.up, _worldDirection).normalize(); // Use camera.up

    // Combine inputs into a single movement direction vector
    _movementDirection.set(0, 0, 0);
    if (movementState.forward) _movementDirection.add(_worldDirection);
    if (movementState.backward) _movementDirection.sub(_worldDirection);
    if (movementState.left) _movementDirection.sub(_rightDirection); // A = strafe left
    if (movementState.right) _movementDirection.add(_rightDirection); // D = strafe right

    _movementDirection.normalize(); // Ensure consistent speed regardless of diagonal movement

    // --- 4. Apply Movement Velocity ---
    const currentVelocity = playerBody.velocity;
    let targetVelocityX = 0;
    let targetVelocityZ = 0;

    if (_movementDirection.lengthSq() > 0.01) { // If there is input
        const speed = moveSpeed; // Use base move speed
        targetVelocityX = _movementDirection.x * speed;
        targetVelocityZ = _movementDirection.z * speed;
    }

    if (onGround) {
        // On ground: Directly set velocity for responsive control
        playerBody.velocity.x = targetVelocityX;
        playerBody.velocity.z = targetVelocityZ;
    } else {
        // In air: Apply force allowing for some air control, affected by airControlFactor
        const forceX = (targetVelocityX - currentVelocity.x) * airControlFactor * playerBody.mass * 10; // Multiply by mass and a factor for force strength
        const forceZ = (targetVelocityZ - currentVelocity.z) * airControlFactor * playerBody.mass * 10;
        playerBody.applyForce(new CANNON.Vec3(forceX, 0, forceZ), CANNON.Vec3.ZERO);
    }


    // --- 5. Handle Jumping ---
    if (movementState.jump && jumpsRemaining > 0) {
        // Apply jump impulse only if allowed
        if (canJump || jumpsRemaining < maxJumps) { // Allow jump if on ground OR if double jump available
            // Reset vertical velocity before jump for consistent height
            playerBody.velocity.y = 0;
            // Apply upward impulse
            playerBody.applyImpulse(new CANNON.Vec3(0, jumpForce * playerBody.mass, 0), CANNON.Vec3.ZERO);

            jumpsRemaining--;
            canJump = false; // Prevent immediate re-jump this frame
            movementState.jump = false; // Consume the jump request
            console.log("Jump! Remaining:", jumpsRemaining);
        } else {
             movementState.jump = false; // Consume jump request even if not performed
        }
    }
     // Ensure jump flag is reset if key is released
     if (!movementState.jump && !window.onkeyup) { // Check if key is actually up (basic check)
          movementState.jump = false;
     }

    // --- 6. Update Mesh Position ---
    // Always update mesh position from physics body
    playerMesh.position.copy(playerBody.position);

    // --- 7. Update Mesh Rotation (Third Person) ---
    // In first person, mesh rotation is handled above based on camera yaw
    if (cameraMode === 'thirdPerson') {
        const horizontalSpeedSq = currentVelocity.x * currentVelocity.x + currentVelocity.z * currentVelocity.z;
        let targetYaw = playerYaw; // Default to current yaw

        if (horizontalSpeedSq > 0.1 * 0.1) {
            // If moving significantly, face velocity direction
            targetYaw = Math.atan2(currentVelocity.x, currentVelocity.z);
        } else if (_movementDirection.lengthSq() > 0.01) {
            // If trying to move (even slowly), face intended direction
            targetYaw = Math.atan2(_movementDirection.x, _movementDirection.z);
        }
        // If idle, targetYaw remains the current playerYaw

        // Smoothly interpolate playerYaw towards targetYaw
        const wrap = (a, b) => (a % b + b) % b; // Ensure angle is within -PI to PI range for slerp
        const angleDiff = wrap(targetYaw - playerYaw + Math.PI, Math.PI * 2) - Math.PI;
        playerYaw += angleDiff * 0.15; // Rotation interpolation factor (adjust for speed)

        // Apply smoothed yaw to the mesh
        _playerMeshQuaternion.setFromEuler(new THREE.Euler(0, playerYaw, 0, 'YXZ'));
        playerMesh.quaternion.slerp(_playerMeshQuaternion, 0.2); // Slerp for smoother visual rotation in TP
    }


    // --- 8. Fall Check / Respawn ---
    if (playerBody.position.y < -25) { // Check if player fell too low
        const respawnColumn = findNearestColumn(0, 0) || { height: 10.0, x: 0, z: 0 };
        const respawnY = respawnColumn.height + playerRadius + 10.0; // Respawn slightly higher
        playerBody.position.set(respawnColumn.x, respawnY + 5.0, respawnColumn.z);
        playerBody.velocity.set(0, 0, 0);
        playerBody.angularVelocity.set(0, 0, 0);
        playerMesh.position.copy(playerBody.position);
        // Reset yaw/pitch on respawn? Optional.
        // playerYaw = 0; playerPitch = 0;
        playerMesh.quaternion.setFromEuler(new THREE.Euler(0, playerYaw, 0)); // Use current yaw
        playerMesh.visible = (cameraMode === 'thirdPerson');
        jumpsRemaining = maxJumps; // Reset jumps
        canJump = true; // Assume respawn point is ground
        console.log("Player respawned.");
    }
}

// --- Getters ---
function getPlayerBody() { return playerBody; }
function getPlayerModel() { return playerModel; }
function getPlayerMesh() { return playerMesh; }
function getCameraMode() { return cameraMode; }
function getPlayerHeightOffset() { return playerHeightOffset; }
function getPlayerYaw() { return playerYaw; } // Expose yaw if needed by camera in main.js
function getPlayerPitch() { return playerPitch; } // Expose pitch if needed

// --- Exports ---
export {
    initPlayer,
    setupPlayerControls,
    updatePlayer,
    getPlayerBody,
    changePlayerModel,
    playerModels,
    getPlayerModel,
    getCameraMode,
    getPlayerMesh,
    getPlayerHeightOffset,
    getPlayerYaw, // Export yaw/pitch if main.js camera needs them
    getPlayerPitch
};
