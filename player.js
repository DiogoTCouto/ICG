// player.js
import * as THREE from 'three';
import { scene, camera } from './scene.js'; // Camera needed for input calculation
import { world, playerMaterial } from './physics.js';
import { findNearestColumn } from './terrain.js';

// --- Player Model Creation Functions ---

// Helper function to create a simple "headlight" mesh
function createHeadlight() {
    const lightGeometry = new THREE.SphereGeometry(0.25, 16, 8);
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    const headlight = new THREE.Mesh(lightGeometry, lightMaterial);
    headlight.name = "HeadlightIndicator";
    return headlight;
}

// createCubePlayer, createSpherePlayer, createRobotPlayer functions remain the same
// (Including the headlight addition from the previous step)
// ... (Paste the createCubePlayer, createSpherePlayer, createRobotPlayer functions here, unchanged from the previous correct version) ...
/**
 * Creates a cube player with a forward indicator (headlight)
 */
function createCubePlayer() {
    const playerGroup = new THREE.Group();
    const color = new THREE.Color(0x00cc44);
    const darkerColor = color.clone().multiplyScalar(0.7);
    const topColor = new THREE.Color(0xeeeeee);
    const frontColor = color.clone().lerp(new THREE.Color(0xffffff), 0.2);

    const materials = [
        new THREE.MeshPhongMaterial({ color: color, shininess: 30 }),        // Right (+X)
        new THREE.MeshPhongMaterial({ color: color, shininess: 30 }),        // Left (-X)
        new THREE.MeshPhongMaterial({ color: topColor, shininess: 50 }),     // Top (+Y)
        new THREE.MeshPhongMaterial({ color: darkerColor, shininess: 20 }),  // Bottom (-Y)
        new THREE.MeshPhongMaterial({ color: frontColor, shininess: 40 }),   // Front (+Z)
        new THREE.MeshPhongMaterial({ color: color, shininess: 30 })         // Back (-Z)
    ];
    const bodyGeometry = new THREE.BoxGeometry(2.5, 2.5, 2.5);
    const body = new THREE.Mesh(bodyGeometry, materials);
    playerGroup.add(body);

    const eyeGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const pupilGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
    const eyeY = 0.5;
    const eyeZ = 1.26; // Front surface (Box radius = 1.25)

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.6, eyeY, eyeZ);
    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    leftPupil.position.set(0, 0, 0.16);
    leftEye.add(leftPupil);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.6, eyeY, eyeZ);
    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    rightPupil.position.set(0, 0, 0.16);
    rightEye.add(rightPupil);
    playerGroup.add(leftEye, rightEye);

    const mouthGeometry = new THREE.TorusGeometry(0.5, 0.08, 16, 16, Math.PI);
    const mouthMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouth.position.set(0, -0.3, eyeZ);
    mouth.rotation.set(0, 0, Math.PI);
    playerGroup.add(mouth);

    // --- Headlight Indicator ---
    const headlight = createHeadlight();
    headlight.position.set(0, 0.0, eyeZ + 0.1);
    playerGroup.add(headlight);

    return playerGroup;
}
/**
 * Creates a sphere player with a forward indicator (headlight)
 */
function createSpherePlayer() {
    const playerGroup = new THREE.Group();
    const color = new THREE.Color(0x3366ff);
    const sphereRadiusMesh = playerRadius * 0.9;

    const bodyGeometry = new THREE.SphereGeometry(sphereRadiusMesh, 32, 32);
    const bodyMaterial = new THREE.MeshPhongMaterial({
        color: color, shininess: 60,
        emissive: color.clone().multiplyScalar(0.2), emissiveIntensity: 0.3
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    playerGroup.add(body);

    const ringGeometry = new THREE.TorusGeometry(playerRadius * 1.1, 0.15, 16, 32);
    const ringMaterial = new THREE.MeshPhongMaterial({ color: 0xffcc00, shininess: 80 });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.set(Math.PI / 2, 0, 0);
    playerGroup.add(ring);

    const eyeGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const pupilGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
    const eyeY = 0.5;
    const eyeAngle = Math.asin(0.5 / sphereRadiusMesh);
    const eyeDistZ = sphereRadiusMesh * Math.cos(eyeAngle);

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.5, eyeY, eyeDistZ);
    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    leftPupil.position.set(0, 0, 0.16);
    leftEye.add(leftPupil);
    leftEye.lookAt(playerGroup.position); leftEye.rotation.y += Math.PI;

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.5, eyeY, eyeDistZ);
    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    rightPupil.position.set(0, 0, 0.16);
    rightEye.add(rightPupil);
    rightEye.lookAt(playerGroup.position); rightEye.rotation.y += Math.PI;
    playerGroup.add(leftEye, rightEye);

    // --- Headlight Indicator ---
    const headlight = createHeadlight();
    headlight.position.set(0, 0, sphereRadiusMesh + 0.05);
    playerGroup.add(headlight);

    return playerGroup;
}
/**
 * Creates a robot-like player with a forward indicator (headlight)
 */
function createRobotPlayer() {
    const playerGroup = new THREE.Group();
    const headColor = 0xaaaaaa;
    const bodyColor = 0x777777;
    const headDepth = 1.4;
    const bodyDepth = 1.6;

    const headGeometry = new THREE.BoxGeometry(1.8, 1.4, headDepth);
    const headMaterial = new THREE.MeshPhongMaterial({ color: headColor, shininess: 70, metalness: 0.6 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 0.8, 0);
    playerGroup.add(head);

    const bodyGeometry = new THREE.BoxGeometry(2.2, 1.8, bodyDepth);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: bodyColor, shininess: 60 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, -0.6, 0);
    playerGroup.add(body);

    const eyeGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.1);
    const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.8 });
    const eyeY = 1.0;
    const eyeZ = headDepth / 2 + 0.01; // On head's front surface
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.5, eyeY, eyeZ);
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.5, eyeY, eyeZ);
    playerGroup.add(leftEye, rightEye);

    const antennaBaseY = 1.5;
    const antennaGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
    const antennaMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
    const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    antenna.position.set(0, antennaBaseY + 0.4, 0);
    const antennaTipGeometry = new THREE.SphereGeometry(0.12, 16, 16);
    const antennaTipMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.6 });
    const antennaTip = new THREE.Mesh(antennaTipGeometry, antennaTipMaterial);
    antennaTip.position.set(0, antennaBaseY + 0.8, 0);
    playerGroup.add(antenna, antennaTip);

    const panelGeometry = new THREE.PlaneGeometry(1.5, 1);
    const panelMaterial = new THREE.MeshPhongMaterial({ color: 0x555555, shininess: 90 });
    const panel = new THREE.Mesh(panelGeometry, panelMaterial);
    const panelZ = bodyDepth / 2 + 0.01; // On body's front surface
    panel.position.set(0, -0.6, panelZ);
    playerGroup.add(panel);

    for (let i = 0; i < 3; i++) {
        const lightGeometry = new THREE.CircleGeometry(0.1, 16);
        const lightMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.5 });
        const light = new THREE.Mesh(lightGeometry, lightMaterial);
        light.position.set(-0.5 + i * 0.5, -0.6, panelZ + 0.01); // Just off panel
        playerGroup.add(light);
    }

    // --- Headlight Indicator ---
    const headlight = createHeadlight();
    headlight.position.set(0, eyeY, eyeZ + 0.1);
    playerGroup.add(headlight);

    return playerGroup;
}


// --- Player Models Dictionary ---
const playerModels = {
    cube: { create: createCubePlayer, name: 'Cube' },
    sphere: { create: createSpherePlayer, name: 'Sphere' },
    robot: { create: createRobotPlayer, name: 'Robot' },
    // Add pyramid if you create it:
    // pyramid: { create: createPyramidPlayer, name: 'Pyramid' },
};

// --- Module Variables ---
let playerBody = null;
let playerMesh = null;
let playerModel = 'cube';
const playerRadius = 1.5;
const playerHeightOffset = 1.6;

// Movement parameters
const moveSpeed = 9;
const strafeSpeedFactor = 0.7; // Strafing is 70% of forward speed
const jumpForce = 22; // Increased jump force
const velocityLerpFactor = 0.18;
const rotationSlerpFactor = 0.15;
const minMoveSpeedForRotation = 0.1;

// State variables
let canJump = false; // Is the player currently touching the ground?
let jumpsRemaining = 0; // For double jump
const maxJumps = 2; // Allow double jump
let lastValidYaw = 0;
let cameraMode = 'thirdPerson';

// Input state
const movementState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false
};

// Raycaster for ground check
const groundCheckRay = new CANNON.Ray(new CANNON.Vec3(0, 0, 0), new CANNON.Vec3(0, -1, 0));
const groundCheckDistance = playerRadius + 0.2;
const raycastOptions = { collisionFilterMask: -1, skipBackfaces: true };
const rayResult = new CANNON.RaycastResult();


/**
 * Initializes the player physics body and visual mesh.
 */
function initPlayer(initialModel = 'cube') {
    playerModel = initialModel;
    cameraMode = 'thirdPerson';
    jumpsRemaining = maxJumps; // Initialize jumps
    const sphereShape = new CANNON.Sphere(playerRadius);

    playerBody = new CANNON.Body({
        mass: 70, material: playerMaterial, fixedRotation: true,
        linearDamping: 0.9, angularDamping: 1.0
    });
    playerBody.addShape(sphereShape);
    playerBody.isPlayer = true;

    const startColumn = findNearestColumn(0, 0) || { height: 5, x: 0, z: 0 };
    const startY = startColumn.height + playerRadius + 0.1;
    playerBody.position.set(startColumn.x, startY, startColumn.z);
    playerBody.sleepState = CANNON.Body.AWAKE;
    playerBody.allowSleep = false;

    const createModelFn = playerModels[playerModel]?.create || createCubePlayer;
    playerMesh = createModelFn();
    playerMesh.castShadow = true;

    playerMesh.position.copy(playerBody.position);
    lastValidYaw = 0;
    playerMesh.quaternion.setFromEuler(new THREE.Euler(0, lastValidYaw, 0));
    playerMesh.visible = true;

    scene.add(playerMesh);
    world.addBody(playerBody);
}

/**
 * Changes the player's visual model.
 */
function changePlayerModel(modelName) {
    // ... (Function remains the same as previous version) ...
    if (!playerModels[modelName] || !playerBody || !playerMesh) {
        console.error(`Model "${modelName}" not found or player not initialized!`);
        return;
    }
    const currentPosition = playerBody.position.clone();
    const currentQuaternion = playerMesh.quaternion.clone();

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
    playerMesh.quaternion.copy(currentQuaternion);
    // Ensure visibility matches current camera mode after model change
    playerMesh.visible = (cameraMode === 'thirdPerson');

    scene.add(playerMesh);
}

/**
 * Sets up keyboard event listeners for player controls and camera toggle.
 */
function setupPlayerControls() {
    // ... (Function remains the same as previous version) ...
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
}

/**
 * Handles keydown events to update movement state and toggle camera.
 */
function onKeyDown(event) {
    // ... (Function remains the same as previous version) ...
    switch (event.code) {
        case 'KeyW': case 'ArrowUp': movementState.forward = true; break;
        case 'KeyS': case 'ArrowDown': movementState.backward = true; break;
        case 'KeyA': case 'ArrowLeft': movementState.left = true; break;
        case 'KeyD': case 'ArrowRight': movementState.right = true; break;
        case 'Space':
             // Trigger jump only on initial press down, not hold
             if (!movementState.jump) {
                 movementState.jump = true;
             }
             break;
    }
    if (event.code === 'KeyF' && !event.repeat) {
        toggleCameraMode();
    }
}

/**
 * Handles keyup events to update movement state.
 */
function onKeyUp(event) {
    // ... (Function remains the same as previous version) ...
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
    // ... (Function remains the same as previous version) ...
    if (cameraMode === 'thirdPerson') {
        cameraMode = 'firstPerson';
        if (playerMesh) playerMesh.visible = false; // Hide mesh in first person
    } else {
        cameraMode = 'thirdPerson';
        if (playerMesh) playerMesh.visible = true; // Show mesh in third person
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
    groundCheckRay.to.copy(playerBody.position);
    groundCheckRay.to.y -= groundCheckDistance;
    rayResult.reset();
    world.raycastClosest(groundCheckRay.from, groundCheckRay.to, raycastOptions, rayResult);
    canJump = rayResult.hasHit;

    // Reset jumps if grounded
    if (canJump) {
        jumpsRemaining = maxJumps;
    }

    // --- 2. Calculate Intended Movement Direction (Relative to Camera) ---
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(camera.up, forward).normalize();

    // Calculate forward/backward and left/right components separately
    const forwardMove = new THREE.Vector3();
    if (movementState.forward) forwardMove.add(forward);
    if (movementState.backward) forwardMove.sub(forward);

    const strafeMove = new THREE.Vector3();
    // *** A/D REVERSE FIX: Swapped .add and .sub ***
    if (movementState.left) strafeMove.add(right); // A moves left (adds right vector relative to camera looking forward?) NO, A should subtract right. Let's test this. If A moves right, swap back.
    if (movementState.right) strafeMove.sub(right); // D moves right (subtracts right vector?) NO, D should add right. Let's test this. If D moves left, swap back.
    // *** Correction: Standard right-handed system: A/Left subtracts right vector, D/Right adds right vector ***
    // Let's revert the swap and assume the standard system. If it's still reversed, the issue might be elsewhere (camera setup?).
    strafeMove.set(0,0,0); // Reset strafeMove
    if (movementState.left) strafeMove.sub(right);  // A/Left subtracts right vector
    if (movementState.right) strafeMove.add(right); // D/Right adds right vector


    const isTryingToMove = movementState.forward || movementState.backward || movementState.left || movementState.right;

    // --- 3. Apply Smoothed Movement Velocity ---
    const currentVelocity = playerBody.velocity;

    // Calculate target velocity components with different speeds
    const targetForwardVel = forwardMove.multiplyScalar(moveSpeed);
    const targetStrafeVel = strafeMove.multiplyScalar(moveSpeed * strafeSpeedFactor); // Apply strafe factor

    // Combine target velocities
    const targetVelocityXZ = new CANNON.Vec3(
        targetForwardVel.x + targetStrafeVel.x,
        0, // Only target XZ velocity based on input
        targetForwardVel.z + targetStrafeVel.z
    );

    // Interpolate towards target velocity
    playerBody.velocity.x += (targetVelocityXZ.x - currentVelocity.x) * velocityLerpFactor;
    playerBody.velocity.z += (targetVelocityXZ.z - currentVelocity.z) * velocityLerpFactor;

    // --- 4. Handle Jumping (with Double Jump) ---
    if (movementState.jump && jumpsRemaining > 0) {
        playerBody.velocity.y = jumpForce; // Apply jump impulse
        jumpsRemaining--; // Decrement jumps remaining
        canJump = false; // Prevent ground check from resetting jumps immediately
        movementState.jump = false; // Consume the jump request for this frame
        console.log("Jump! Remaining:", jumpsRemaining); // Debug log
    }
    // Ensure jump flag is reset if key is released, even if jump didn't happen
    if (!movementState.jump && !window.onkeyup) { // Check if key is actually up
         movementState.jump = false;
    }


    // --- 5. Update Mesh Position ---
    playerMesh.position.copy(playerBody.position);

    // --- 6. Update Mesh Rotation (Face Movement Direction) ---
    // *** ROTATION FIX: Only rotate mesh in 3rd person OR when strafing (A/D) ***
    const isStrafing = movementState.left || movementState.right;
    if (cameraMode === 'thirdPerson' || isStrafing) {
        const horizontalSpeedSq = currentVelocity.x * currentVelocity.x + currentVelocity.z * currentVelocity.z;
        let targetYaw = lastValidYaw;

        // Determine combined move direction for rotation target if trying to move
        const combinedMoveDirection = new THREE.Vector3();
        if (movementState.forward) combinedMoveDirection.add(forward);
        if (movementState.backward) combinedMoveDirection.sub(forward);
        if (movementState.left) combinedMoveDirection.sub(right); // Use corrected strafe direction
        if (movementState.right) combinedMoveDirection.add(right); // Use corrected strafe direction
        combinedMoveDirection.normalize();


        if (horizontalSpeedSq > minMoveSpeedForRotation * minMoveSpeedForRotation) {
            // If moving significantly, face actual velocity direction
            targetYaw = Math.atan2(currentVelocity.x, currentVelocity.z);
            lastValidYaw = targetYaw;
        } else if (isTryingToMove) {
            // If trying to move (even slowly), face the intended combined direction
             if (combinedMoveDirection.lengthSq() > 0.01) { // Ensure there is an intended direction
                 targetYaw = Math.atan2(combinedMoveDirection.x, combinedMoveDirection.z);
                 // Don't update lastValidYaw here unless actually moving significantly
             }
        }
        // If idle, targetYaw remains lastValidYaw

        const targetQuaternion = new THREE.Quaternion();
        targetQuaternion.setFromEuler(new THREE.Euler(0, targetYaw, 0, 'YXZ'));

        // Smoothly rotate the mesh towards the target rotation
        playerMesh.quaternion.slerp(targetQuaternion, rotationSlerpFactor);
    }
    // If in first person and moving only forward/backward, mesh rotation doesn't change.

    // --- 7. Fall Check / Respawn ---
    if (playerBody.position.y < -25) {
        // ... (Respawn logic remains the same as previous version) ...
        const respawnColumn = findNearestColumn(0, 0) || { height: 5, x: 0, z: 0 };
        const respawnY = respawnColumn.height + playerRadius + 0.1;
        playerBody.position.set(respawnColumn.x, respawnY, respawnColumn.z);
        playerBody.velocity.set(0, 0, 0);
        playerBody.angularVelocity.set(0, 0, 0);
        playerMesh.position.copy(playerBody.position);
        lastValidYaw = 0;
        playerMesh.quaternion.setFromEuler(new THREE.Euler(0, lastValidYaw, 0));
        playerMesh.visible = (cameraMode === 'thirdPerson');
        jumpsRemaining = maxJumps; // Reset jumps on respawn
    }
}

// --- Getters ---
// ... (Getters remain the same as previous version) ...
function getPlayerBody() { return playerBody; }
function getPlayerModel() { return playerModel; }
function getPlayerMesh() { return playerMesh; }
function getCameraMode() { return cameraMode; }
function getPlayerHeightOffset() { return playerHeightOffset; }

// --- Exports ---
// ... (Exports remain the same as previous version) ...
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
};