// player.js
import * as THREE from 'three';
import { scene, camera } from './scene.js'; // Assuming camera is needed for input calculation
import { world, playerMaterial } from './physics.js';
import { findNearestColumn } from './terrain.js'; // Assuming terrainColumns is not directly needed here

// --- Player Model Creation Functions ---

/**
 * Creates a cube player with a forward indicator
 */
function createCubePlayer() {
    const playerGroup = new THREE.Group();
    // Define colors
    const color = new THREE.Color(0x00cc44); // Adjusted green
    const darkerColor = color.clone().multiplyScalar(0.7);
    const topColor = new THREE.Color(0xeeeeee);
    const frontColor = color.clone().lerp(new THREE.Color(0xffffff), 0.2); // Slightly lighter front

    // Define materials for each face for clarity
    const materials = [
        new THREE.MeshPhongMaterial({ color: color, shininess: 30 }),        // Right (+X)
        new THREE.MeshPhongMaterial({ color: color, shininess: 30 }),        // Left (-X)
        new THREE.MeshPhongMaterial({ color: topColor, shininess: 50 }),     // Top (+Y)
        new THREE.MeshPhongMaterial({ color: darkerColor, shininess: 20 }),  // Bottom (-Y)
        new THREE.MeshPhongMaterial({ color: frontColor, shininess: 40 }),   // Front (+Z) - Distinct front
        new THREE.MeshPhongMaterial({ color: color, shininess: 30 })         // Back (-Z)
    ];
    const bodyGeometry = new THREE.BoxGeometry(2.5, 2.5, 2.5);
    const body = new THREE.Mesh(bodyGeometry, materials);
    playerGroup.add(body);

    // --- Eyes (Positioned relative to front face +Z) ---
    const eyeGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const pupilGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });

    const eyeY = 0.5;
    const eyeZ = 1.26; // Position eyes on the front surface (Box radius = 2.5/2 = 1.25)

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.6, eyeY, eyeZ);
    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    leftPupil.position.set(0, 0, 0.16); // Pupil slightly forward from eye center
    leftEye.add(leftPupil);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.6, eyeY, eyeZ);
    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    rightPupil.position.set(0, 0, 0.16);
    rightEye.add(rightPupil);

    playerGroup.add(leftEye, rightEye);

    // --- Mouth (Positioned relative to front face +Z) ---
    const mouthGeometry = new THREE.TorusGeometry(0.5, 0.08, 16, 16, Math.PI);
    const mouthMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouth.position.set(0, -0.3, eyeZ); // Position mouth on the front surface
    mouth.rotation.set(0, 0, Math.PI); // Rotate torus arc to form smile
    playerGroup.add(mouth);

    // --- Forward Indicator (Simple Arrow on Front Face) ---
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0.3);
    arrowShape.lineTo(0.4, -0.3);
    arrowShape.lineTo(0, -0.1);
    arrowShape.lineTo(-0.4, -0.3);
    arrowShape.lineTo(0, 0.3);
    const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
    // Use MeshBasicMaterial for indicators so they are visible regardless of light
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xffdd00, side: THREE.DoubleSide });
    const indicatorArrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    // Position it slightly in front of the face, below the mouth
    indicatorArrow.position.set(0, -0.9, eyeZ + 0.01); // Place just off the front surface
    indicatorArrow.scale.set(0.8, 0.8, 0.8);
    playerGroup.add(indicatorArrow);

    return playerGroup;
}

/**
 * Creates a sphere player with a forward indicator
 */
function createSpherePlayer() {
    const playerGroup = new THREE.Group();
    const color = new THREE.Color(0x3366ff);
    const sphereRadiusMesh = playerRadius * 0.9; // Mesh slightly smaller than physics body

    const bodyGeometry = new THREE.SphereGeometry(sphereRadiusMesh, 32, 32);
    const bodyMaterial = new THREE.MeshPhongMaterial({
        color: color, shininess: 60,
        emissive: color.clone().multiplyScalar(0.2), emissiveIntensity: 0.3
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    playerGroup.add(body);

    // --- Ring ---
    const ringGeometry = new THREE.TorusGeometry(playerRadius * 1.1, 0.15, 16, 32);
    const ringMaterial = new THREE.MeshPhongMaterial({ color: 0xffcc00, shininess: 80 });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.set(Math.PI / 2, 0, 0); // Rotate to be horizontal
    playerGroup.add(ring);

    // --- Eyes (Positioned relative to front +Z) ---
    const eyeGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const pupilGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });

    const eyeY = 0.5;
    // Calculate Z position to be on the surface of the sphere mesh
    const eyeAngle = Math.asin(0.5 / sphereRadiusMesh); // Angle based on horizontal separation
    const eyeDistZ = sphereRadiusMesh * Math.cos(eyeAngle); // Z distance from center

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.5, eyeY, eyeDistZ);
    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    leftPupil.position.set(0, 0, 0.16);
    leftEye.add(leftPupil);
    // Rotate eye slightly to face outwards along sphere normal (optional but nice)
    leftEye.lookAt(playerGroup.position); // Look at center first
    leftEye.rotation.y += Math.PI; // Flip to face outwards

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.5, eyeY, eyeDistZ);
    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    rightPupil.position.set(0, 0, 0.16);
    rightEye.add(rightPupil);
    // Rotate eye slightly
    rightEye.lookAt(playerGroup.position);
    rightEye.rotation.y += Math.PI;

    playerGroup.add(leftEye, rightEye);

    // --- Forward Indicator (Cone Pointer) ---
    const pointerGeometry = new THREE.ConeGeometry(0.3, 0.8, 8); // Base radius, height, segments
    const pointerMaterial = new THREE.MeshBasicMaterial({ color: 0xffdd00 }); // Basic material
    const indicatorPointer = new THREE.Mesh(pointerGeometry, pointerMaterial);
    // Position it in front of the sphere, pointing forward (+Z)
    indicatorPointer.position.set(0, 0, sphereRadiusMesh + 0.4); // Place tip just outside sphere radius (height/2 = 0.4)
    indicatorPointer.rotation.set(Math.PI / 2, 0, 0); // Rotate cone's axis from Y to Z
    playerGroup.add(indicatorPointer);

    return playerGroup;
}

/**
 * Creates a robot-like player (assuming eyes/panel define front)
 */
function createRobotPlayer() {
    const playerGroup = new THREE.Group();
    const headColor = 0xaaaaaa;
    const bodyColor = 0x777777;
    const headDepth = 1.4;
    const bodyDepth = 1.6;

    // --- Head ---
    const headGeometry = new THREE.BoxGeometry(1.8, 1.4, headDepth);
    const headMaterial = new THREE.MeshPhongMaterial({ color: headColor, shininess: 70, metalness: 0.6 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 0.8, 0);
    playerGroup.add(head);

    // --- Robot body ---
    const bodyGeometry = new THREE.BoxGeometry(2.2, 1.8, bodyDepth);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: bodyColor, shininess: 60 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, -0.6, 0);
    playerGroup.add(body);

    // --- Robot eyes (Define the front +Z) ---
    const eyeGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.1); // Thin eyes
    const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.8 });
    const eyeY = 1.0; // Relative to group center
    const eyeZ = headDepth / 2 + 0.01; // Place on head's front surface

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.5, eyeY, eyeZ);
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.5, eyeY, eyeZ);
    playerGroup.add(leftEye, rightEye);

    // --- Robot antenna ---
    const antennaBaseY = 1.5; // Relative to group center
    const antennaGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
    const antennaMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
    const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    antenna.position.set(0, antennaBaseY + 0.4, 0); // Position relative to group center
    const antennaTipGeometry = new THREE.SphereGeometry(0.12, 16, 16);
    const antennaTipMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.6 });
    const antennaTip = new THREE.Mesh(antennaTipGeometry, antennaTipMaterial);
    antennaTip.position.set(0, antennaBaseY + 0.8, 0); // Position relative to group center
    playerGroup.add(antenna, antennaTip);

    // --- Decorative chest panel (Also defines front +Z) ---
    const panelGeometry = new THREE.PlaneGeometry(1.5, 1);
    const panelMaterial = new THREE.MeshPhongMaterial({ color: 0x555555, shininess: 90 });
    const panel = new THREE.Mesh(panelGeometry, panelMaterial);
    const panelZ = bodyDepth / 2 + 0.01; // Place on body's front surface
    panel.position.set(0, -0.6, panelZ);
    playerGroup.add(panel);

    // --- Panel lights ---
    for (let i = 0; i < 3; i++) {
        const lightGeometry = new THREE.CircleGeometry(0.1, 16);
        const lightMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.5 });
        const light = new THREE.Mesh(lightGeometry, lightMaterial);
        light.position.set(-0.5 + i * 0.5, -0.6, panelZ + 0.01); // Position lights just off panel surface
        playerGroup.add(light);
    }


    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0.2); arrowShape.lineTo(0.3, -0.2); arrowShape.lineTo(0, -0.1);
    arrowShape.lineTo(-0.3, -0.2); arrowShape.lineTo(0, 0.2);
    const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xffdd00, side: THREE.DoubleSide });
    const indicatorArrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    indicatorArrow.position.set(0, -1.2, panelZ + 0.02); // On body, below panel, slightly forward
    indicatorArrow.scale.set(0.7, 0.7, 0.7);
    playerGroup.add(indicatorArrow);


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
let playerModel = 'cube'; // Default model
const playerRadius = 1.5; // Physics shape radius

// Movement parameters
const moveSpeed = 9;
const jumpForce = 18;
const velocityLerpFactor = 0.18; // Smoothing factor for velocity change
const rotationSlerpFactor = 0.15; // Smoothing factor for rotation change
const minMoveSpeedForRotation = 0.1; // Minimum speed threshold to rotate based on velocity

// State variables
let canJump = false;
let lastValidYaw = 0; // Stores the last angle the player was facing when moving

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
const groundCheckDistance = playerRadius + 0.2; // How far below the center to check
const raycastOptions = { collisionFilterMask: -1, skipBackfaces: true };
const rayResult = new CANNON.RaycastResult();


/**
 * Initializes the player physics body and visual mesh.
 */
function initPlayer(initialModel = 'cube') {
    playerModel = initialModel;
    const sphereShape = new CANNON.Sphere(playerRadius);

    playerBody = new CANNON.Body({
        mass: 70,
        material: playerMaterial,
        fixedRotation: true, // Prevents physics body from tipping
        linearDamping: 0.9, // Natural slowdown
        angularDamping: 1.0 // No spinning
    });
    playerBody.addShape(sphereShape);
    playerBody.isPlayer = true; // Custom flag if needed elsewhere

    // Find a starting position
    const startColumn = findNearestColumn(0, 0) || { height: 5, x: 0, z: 0 }; // Fallback
    const startY = startColumn.height + playerRadius + 0.1; // Start slightly above column
    playerBody.position.set(startColumn.x, startY, startColumn.z);
    playerBody.sleepState = CANNON.Body.AWAKE; // Ensure physics is active
    playerBody.allowSleep = false; // Keep physics active

    // Create the visual mesh
    const createModelFn = playerModels[playerModel]?.create || createCubePlayer; // Use selected or default
    playerMesh = createModelFn();
    playerMesh.castShadow = true;

    // Sync mesh position and initial rotation (face forward Z)
    playerMesh.position.copy(playerBody.position);
    lastValidYaw = 0; // Start facing world +Z
    playerMesh.quaternion.setFromEuler(new THREE.Euler(0, lastValidYaw, 0));

    scene.add(playerMesh);
    world.addBody(playerBody);
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
    const currentQuaternion = playerMesh.quaternion.clone(); // Preserve current rotation

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

    // Restore position and rotation
    playerMesh.position.copy(currentPosition);
    playerMesh.quaternion.copy(currentQuaternion);

    scene.add(playerMesh);
}

/**
 * Sets up keyboard event listeners for player controls.
 */
function setupPlayerControls() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
}

/**
 * Handles keydown events to update movement state.
 */
function onKeyDown(event) {
    switch (event.code) {
        case 'KeyW': case 'ArrowUp': movementState.forward = true; break;
        case 'KeyS': case 'ArrowDown': movementState.backward = true; break;
        case 'KeyA': case 'ArrowLeft': movementState.left = true; break;
        case 'KeyD': case 'ArrowRight': movementState.right = true; break;
        case 'Space': movementState.jump = true; break;
    }
}

/**
 * Handles keyup events to update movement state.
 */
function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW': case 'ArrowUp': movementState.forward = false; break;
        case 'KeyS': case 'ArrowDown': movementState.backward = false; break;
        case 'KeyA': case 'ArrowLeft': movementState.left = false; break;
        case 'KeyD': case 'ArrowRight': movementState.right = false; break;
        case 'Space': movementState.jump = false; break; // Reset jump request on key up
    }
}

/**
 * Updates the player's state each frame (physics, position, rotation).
 */
function updatePlayer() {
    if (!playerBody || !playerMesh || !camera) return; // Ensure everything is initialized

    // --- 1. Ground Check ---
    groundCheckRay.from.copy(playerBody.position);
    groundCheckRay.to.copy(playerBody.position);
    groundCheckRay.to.y -= groundCheckDistance; // Check below the player center
    rayResult.reset();
    world.raycastClosest(groundCheckRay.from, groundCheckRay.to, raycastOptions, rayResult);
    canJump = rayResult.hasHit;

    // --- 2. Calculate Intended Movement Direction (Relative to Camera) ---
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    camera.getWorldDirection(forward); // Get camera's view direction
    forward.y = 0; // Project onto XZ plane
    forward.normalize();
    right.crossVectors(camera.up, forward).normalize(); // Calculate right vector based on camera view

    const moveDirection = new THREE.Vector3(); // This is the direction the player *wants* to move in world space
    if (movementState.forward) moveDirection.add(forward);
    if (movementState.backward) moveDirection.sub(forward);
    if (movementState.left) moveDirection.sub(right);
    if (movementState.right) moveDirection.add(right);

    const isTryingToMove = moveDirection.lengthSq() > 0.01; // Check if any movement key is pressed
    moveDirection.normalize(); // Normalize to get direction only

    // --- 3. Apply Smoothed Movement Velocity ---
    const currentVelocity = playerBody.velocity;
    // Target velocity based on input direction
    const targetVelocityXZ = new CANNON.Vec3(
        moveDirection.x * moveSpeed,
        0, // Only concerned with XZ plane for movement input
        moveDirection.z * moveSpeed
    );

    // Smoothly interpolate X and Z velocity towards the target
    playerBody.velocity.x += (targetVelocityXZ.x - currentVelocity.x) * velocityLerpFactor;
    playerBody.velocity.z += (targetVelocityXZ.z - currentVelocity.z) * velocityLerpFactor;
    // Y velocity is handled by physics (gravity) and jumping

    // --- 4. Handle Jumping ---
    if (movementState.jump && canJump) {
        // Apply an immediate upward velocity change. Resetting Y velocity first can make jumps feel more consistent.
        playerBody.velocity.y = jumpForce;
        canJump = false; // Prevent double jump until next ground contact
        movementState.jump = false; // Consume the jump request
    }

    // --- 5. Update Mesh Position ---
    // Directly copy physics body position to the visual mesh
    playerMesh.position.copy(playerBody.position);

    // --- 6. Update Mesh Rotation (Face Movement Direction) ---
    const horizontalSpeedSq = currentVelocity.x * currentVelocity.x + currentVelocity.z * currentVelocity.z;
    let targetYaw = lastValidYaw; // Default to the last direction the player was actually moving

    if (horizontalSpeedSq > minMoveSpeedForRotation * minMoveSpeedForRotation) {
        // If moving significantly, calculate yaw from the *actual* velocity vector
        targetYaw = Math.atan2(currentVelocity.x, currentVelocity.z); // atan2(x, z) gives yaw angle relative to +Z axis
        lastValidYaw = targetYaw; // Update the last valid direction the player was moving
    } else if (isTryingToMove) {
        // If not moving much BUT *trying* to move (keys pressed), face the *intended* direction
        targetYaw = Math.atan2(moveDirection.x, moveDirection.z);
        // Do not update lastValidYaw here, as the player isn't actually moving significantly in this direction yet
    }
    // If idle (not moving fast enough and no keys pressed), targetYaw remains lastValidYaw, so the player keeps facing the last direction.

    const targetQuaternion = new THREE.Quaternion();
    // Set target rotation around Y axis based on calculated yaw
    targetQuaternion.setFromEuler(new THREE.Euler(0, targetYaw, 0, 'YXZ')); // Use 'YXZ' order for clarity

    // Smoothly interpolate the mesh's current rotation towards the target rotation
    playerMesh.quaternion.slerp(targetQuaternion, rotationSlerpFactor);

    // --- 7. Fall Check / Respawn ---
    if (playerBody.position.y < -25) { // Check if player fell off
        const respawnColumn = findNearestColumn(0, 0) || { height: 5, x: 0, z: 0 };
        const respawnY = respawnColumn.height + playerRadius + 0.1;
        // Reset physics state
        playerBody.position.set(respawnColumn.x, respawnY, respawnColumn.z);
        playerBody.velocity.set(0, 0, 0);
        playerBody.angularVelocity.set(0, 0, 0);

        // Reset mesh state immediately
        playerMesh.position.copy(playerBody.position);
        lastValidYaw = 0; // Reset facing direction to forward (+Z)
        playerMesh.quaternion.setFromEuler(new THREE.Euler(0, lastValidYaw, 0));
    }
}

/**
 * Returns the player's physics body.
 */
function getPlayerBody() {
    return playerBody;
}

/**
 * Returns the currently selected player model name.
 */
function getPlayerModel() {
    return playerModel;
}

// Export necessary functions and variables
export {
    initPlayer,
    setupPlayerControls,
    updatePlayer,
    getPlayerBody,
    changePlayerModel,
    playerModels, // Exporting the models dictionary might be useful for UI
    getPlayerModel,
};