// player.js
// Revised jump logic for reliable double jump.
// Added win condition collision detection.
import * as THREE from 'three';
// --- Ensure this import points to the correct terrain file ---
// NOTE: main.js uses terrain.js for initialization. This import might need correction
// if terrain_scattered.js is not intended to be used here.
import { findNearestColumn } from './terrain.js'; // <<< Changed to terrain.js based on main.js usage
// ---
import { scene, camera, renderer } from './scene.js'; //
import { world, playerMaterial } from './physics.js'; //

// --- Player Model Creation Functions ---
// (createHeadlight, createCubePlayer, createSpherePlayer, createRobotPlayer functions remain unchanged)
function createHeadlight() {
    const lightGeometry = new THREE.SphereGeometry(0.25, 16, 8);
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    const headlight = new THREE.Mesh(lightGeometry, lightMaterial);
    headlight.name = "HeadlightIndicator";
    return headlight;
}
function createCubePlayer() {
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
    playerGroup.castShadow = true;
    body.castShadow = true;
    return playerGroup;
}
function createSpherePlayer() {
    const playerGroup = new THREE.Group();
    const playerRadius = 1.5; // Reference for visual elements if needed
    const playerRadiusVisual = playerRadius * 0.9;
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
    playerGroup.castShadow = true;
    body.castShadow = true;
    ring.castShadow = true;
    return playerGroup;
 }
function createRobotPlayer() {
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
    playerGroup.castShadow = true;
    head.castShadow = true;
    body.castShadow = true;
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

// --- Player Physics Dimensions ---
const playerPhysicsRadius = 1.0;
const playerPhysicsHeight = 5.0;
// ---

const playerHeightOffset = playerPhysicsHeight / 2 + 0.1; // Eye height offset

// Movement parameters
const moveSpeed = 12;
const jumpForce = 25;
const airControlFactor = 0.3;

// State variables
let isGrounded = false;
let jumpsRemaining = 0;
const maxJumps = 2;
let cameraMode = 'thirdPerson';
let isPointerLocked = false;
let canWin = true; // *** ADDED: Flag to prevent multiple win triggers ***

// --- Coyote Time ---
let coyoteTimer = 0;
const coyoteTimeDuration = 0.15; // Seconds player can still jump after leaving ground
// ---

// Input state
const movementState = {
    forward: false, backward: false, left: false, right: false, jump: false
};

// FPS Camera control variables
let playerYaw = 0;
let playerPitch = 0;
const mouseSensitivity = 0.002;

// --- Ground Check Variables ---
const groundCheckRay = new CANNON.Ray(new CANNON.Vec3(), new CANNON.Vec3(0, -1, 0));
const groundCheckDistance = playerPhysicsHeight / 2 + 0.2;
const raycastOptions = { collisionFilterMask: -1, skipBackfaces: true };
const rayResult = new CANNON.RaycastResult();
const groundCheckOffsets = [
    { x: 0, z: 0 },
    { x: playerPhysicsRadius * 0.7, z: 0 },
    { x: -playerPhysicsRadius * 0.7, z: 0 },
    { x: 0, z: playerPhysicsRadius * 0.7 },
    { x: 0, z: -playerPhysicsRadius * 0.7 },
];
const _rayFrom = new CANNON.Vec3();
const _rayTo = new CANNON.Vec3();
// ---

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
    cameraMode = 'thirdPerson';
    jumpsRemaining = maxJumps;
    isGrounded = false;
    coyoteTimer = 0;
    playerYaw = 0;
    playerPitch = 0;
    canWin = true; // *** ADDED: Reset win flag on init ***

    const playerCylinderShape = new CANNON.Cylinder(playerPhysicsRadius, playerPhysicsRadius, playerPhysicsHeight, 12);

    // Remove previous body if exists
    if (playerBody && world.bodies.includes(playerBody)) {
        playerBody.removeEventListener('collide', handlePlayerCollision); // Remove old listener
        world.removeBody(playerBody);
    }
    // Remove previous mesh if exists
    if (playerMesh && scene.children.includes(playerMesh)) {
         scene.remove(playerMesh);
         // Proper disposal would go here if needed
    }


    playerBody = new CANNON.Body({
        mass: 70, material: playerMaterial,
        fixedRotation: true,
        linearDamping: 0.1,
        angularDamping: 1.0
    });
    playerBody.addShape(playerCylinderShape);
    playerBody.isPlayer = true; // Mark as player body if needed elsewhere

    const startColumn = findNearestColumn(0, 0) || { height: 10, x: 0, z: 0 };
    const startY = startColumn.height + playerPhysicsHeight / 2 + 0.1;
    playerBody.position.set(startColumn.x, startY, startColumn.z);
    playerBody.sleepState = CANNON.Body.AWAKE;
    playerBody.allowSleep = false;

    const createModelFn = playerModels[playerModel]?.create || createCubePlayer;
    playerMesh = createModelFn();
    playerMesh.castShadow = true;
    playerMesh.position.copy(playerBody.position);
    playerMesh.quaternion.setFromEuler(new THREE.Euler(0, playerYaw, 0));
    playerMesh.visible = (cameraMode === 'thirdPerson');

    scene.add(playerMesh);
    world.addBody(playerBody);

    // *** ADDED: Collision event listener for win condition ***
    playerBody.addEventListener('collide', handlePlayerCollision);
    // *** END ADDED ***

    console.log("Player initialized with CYLINDER physics shape.");
}

// *** ADDED: Collision handler function ***
/**
 * Handles collision events for the player body.
 * Checks for collision with the goal pillar.
 * @param {object} event - The collision event object from Cannon-es.
 */
function handlePlayerCollision(event) {
    // Check if the collided body is the goal and if winning is allowed
    if (event.body.isGoal === true && canWin === true) { // Check the isGoal flag and the canWin flag
      console.log("Player collided with the goal!"); // Optional log
      canWin = false; // Prevent triggering win multiple times

      // Call the global win function defined in main.js
      if (typeof window.triggerWinCondition === 'function') {
        window.triggerWinCondition(); // Trigger the win state in main.js
      } else {
        console.error("triggerWinCondition function not found on window!");
      }
    }
    // Add other collision logic here if needed (e.g., taking damage from balls)
  }
// *** END ADDED ***

/**
 * Changes the player's visual model.
 */
function changePlayerModel(modelName) {
    if (!playerModels[modelName] || !playerBody) {
        console.error(`Model "${modelName}" not found or player not initialized!`);
        return;
    }
    const currentPosition = playerBody.position.clone();
    const currentRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, playerYaw, 0));

    if (playerMesh) {
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
    }

    playerModel = modelName;
    const createModelFn = playerModels[playerModel].create;
    playerMesh = createModelFn();
    playerMesh.castShadow = true;
    playerMesh.position.copy(currentPosition);
    playerMesh.quaternion.copy(currentRotation);
    playerMesh.visible = (cameraMode === 'thirdPerson');

    scene.add(playerMesh);
    console.log(`Player model changed to: ${modelName}`);
}

/**
 * Sets up keyboard event listeners and Pointer Lock.
 */
function setupPlayerControls() {
    // Clean up previous listeners first
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    document.removeEventListener('mousemove', onMouseMove);
    renderer?.domElement.removeEventListener('click', requestPointerLock);

    // Add new listeners
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMove);

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
    } else {
        isPointerLocked = false;
        console.log("Pointer Unlocked");
    }
}

/**
 * Handle mouse movement for camera control.
 */
function onMouseMove(event) {
    if (!isPointerLocked || cameraMode !== 'firstPerson') return;
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;
    playerYaw -= movementX * mouseSensitivity;
    playerPitch -= movementY * mouseSensitivity;
    const maxPitch = Math.PI / 2 - 0.01;
    playerPitch = Math.max(-maxPitch, Math.min(maxPitch, playerPitch));
}


/**
 * Handles keydown events.
 */
function onKeyDown(event) {
    // Ignore input if focus is on an input element (like the rate input)
    if (event.target.tagName === 'INPUT') return;
    switch (event.code) {
        case 'KeyW': case 'ArrowUp': movementState.forward = true; break;
        case 'KeyS': case 'ArrowDown': movementState.backward = true; break;
        case 'KeyA': case 'ArrowLeft': movementState.left = true; break;
        case 'KeyD': case 'ArrowRight': movementState.right = true; break;
        case 'Space': if (!movementState.jump) { movementState.jump = true; } break; // Trigger jump on press
        case 'KeyF': if (!event.repeat) { toggleCameraMode(); } break; // Toggle camera on 'F'
    }
}

/**
 * Handles keyup events.
 */
function onKeyUp(event) {
    if (event.target.tagName === 'INPUT') return;
    switch (event.code) {
        case 'KeyW': case 'ArrowUp': movementState.forward = false; break;
        case 'KeyS': case 'ArrowDown': movementState.backward = false; break;
        case 'KeyA': case 'ArrowLeft': movementState.left = false; break;
        case 'KeyD': case 'ArrowRight': movementState.right = false; break;
        case 'Space': movementState.jump = false; break; // Reset jump state on release
    }
}

/**
 * Toggles between camera modes.
 */
function toggleCameraMode() {
    if (cameraMode === 'thirdPerson') {
        cameraMode = 'firstPerson';
        if (playerMesh) playerMesh.visible = false;
        requestPointerLock(); // Attempt to lock pointer
    } else {
        cameraMode = 'thirdPerson';
        if (playerMesh) playerMesh.visible = true;
        document.exitPointerLock(); // Release pointer
    }
    console.log("Camera mode switched to:", cameraMode);
}


/**
 * Updates the player's state each frame (physics, position, rotation).
 * Uses Multi-Ray Ground Check & Revised Jump Logic.
 */
function updatePlayer(deltaTime) { // Added deltaTime parameter
    if (!playerBody || !camera) return;

    // --- 1. Multi-Ray Ground Check ---
    let groundHit = false;
    const currentPos = playerBody.position;
    const rayVerticalOffset = 0.1; // Start ray slightly inside the body

    for (const offset of groundCheckOffsets) {
        _rayFrom.set(
            currentPos.x + offset.x,
            currentPos.y - rayVerticalOffset, // Start slightly below center
            currentPos.z + offset.z
        );
        _rayTo.set(
            _rayFrom.x,
            _rayFrom.y - (groundCheckDistance - rayVerticalOffset), // Check down further
            _rayFrom.z
        );
        rayResult.reset();
        // Raycast against everything except the player itself (if needed, adjust mask)
        world.raycastClosest(_rayFrom, _rayTo, raycastOptions, rayResult);
        if (rayResult.hasHit) {
            groundHit = true;
            break; // Exit loop if any ray hits the ground
        }
    }
    // --- End Multi-Ray Check ---

    const previouslyGrounded = isGrounded;
    isGrounded = groundHit;

    // --- Coyote Time & Jump Reset Update ---
    if (isGrounded) {
        // Landed or still on ground
        jumpsRemaining = maxJumps; // Reset jumps
        coyoteTimer = coyoteTimeDuration; // Reset coyote timer available window
    } else {
        // Airborne
        if (previouslyGrounded) {
             // Just became airborne, coyote timer starts automatically (set above)
        }
        if (coyoteTimer > 0) {
            coyoteTimer -= deltaTime; // Decrease timer while airborne
        }
    }
    // ---

    // --- 2. Update Camera Rotation and Player Mesh Rotation (First Person) ---
    if (cameraMode === 'firstPerson') {
        _cameraQuaternion.setFromEuler(new THREE.Euler(playerPitch, playerYaw, 0, 'YXZ'));
        camera.quaternion.copy(_cameraQuaternion);
        // Player mesh rotation only needs yaw (body rotation)
        _playerMeshQuaternion.setFromEuler(new THREE.Euler(0, playerYaw, 0, 'YXZ'));
        if (playerMesh) {
             // Smoothly rotate mesh towards camera yaw in FPS? Optional.
             // playerMesh.quaternion.slerp(_playerMeshQuaternion, 0.1); // Example smoothing
             playerMesh.quaternion.copy(_playerMeshQuaternion); // Direct rotation
        }
    }

    // --- 3. Calculate Movement Direction ---
    // Get camera direction projected onto the horizontal plane
    camera.getWorldDirection(_worldDirection);
    _worldDirection.y = 0; // Ignore vertical component for movement
    _worldDirection.normalize();
    // Calculate right direction relative to camera
    _rightDirection.crossVectors(camera.up, _worldDirection).normalize(); // Use camera.up which is (0,1,0)

    _movementDirection.set(0, 0, 0); // Reset movement vector
    if (movementState.forward) _movementDirection.add(_worldDirection);
    if (movementState.backward) _movementDirection.sub(_worldDirection);
    if (movementState.left) _movementDirection.add(_rightDirection); // Add right vector for left movement
    if (movementState.right) _movementDirection.sub(_rightDirection); // Subtract right vector for right movement

    const hasInput = _movementDirection.lengthSq() > 0.01; // Check if there's movement input
    if (hasInput) {
        _movementDirection.normalize(); // Ensure consistent speed regardless of diagonal movement
    }

    // --- 4. Apply Movement Velocity ---
    const currentVelocity = playerBody.velocity;
    let targetVelocityX = 0;
    let targetVelocityZ = 0;
    const speed = moveSpeed;

    if (hasInput) {
        targetVelocityX = _movementDirection.x * speed;
        targetVelocityZ = _movementDirection.z * speed;
    }

    const groundVelocityLerpFactor = 0.15; // How quickly velocity changes on ground
    // airControlFactor is defined above

    if (isGrounded) {
        // On ground: Directly influence velocity towards target (smoother)
        playerBody.velocity.x += (targetVelocityX - currentVelocity.x) * groundVelocityLerpFactor;
        playerBody.velocity.z += (targetVelocityZ - currentVelocity.z) * groundVelocityLerpFactor;
    } else {
        // In air: Apply force for less direct control
        const forceX = (targetVelocityX - currentVelocity.x) * airControlFactor * playerBody.mass * 10; // Apply force based on difference
        const forceZ = (targetVelocityZ - currentVelocity.z) * airControlFactor * playerBody.mass * 10;
        playerBody.applyForce(new CANNON.Vec3(forceX, 0, forceZ), CANNON.Vec3.ZERO); // Apply force at center of mass
    }

    // --- 5. Handle Jumping (Revised Logic) ---
    if (movementState.jump) { // Jump key is being pressed *this frame*
        // Check if we have any jumps left *and* if we are in a state where a jump can occur
        // (Either on ground, within coyote time, or airborne with jumps remaining)
        const canAttemptJump = isGrounded || coyoteTimer > 0 || jumpsRemaining > 0; // Can we possibly jump?

        if (jumpsRemaining > 0 && canAttemptJump) {
            // Determine if it's the first jump (ground or coyote) or an air jump
            let isFirstJump = isGrounded || coyoteTimer > 0;

            // Apply impulse for jump
            playerBody.velocity.y = 0; // Reset vertical velocity for consistent jump height, prevents accumulation
            playerBody.applyImpulse(new CANNON.Vec3(0, jumpForce * playerBody.mass, 0), CANNON.Vec3.ZERO); // Apply upward impulse

            // State changes *after* jump is initiated
            jumpsRemaining--;
            isGrounded = false;   // Force airborne state after jumping
            coyoteTimer = 0;      // Consume coyote time window if used

            console.log(`${isFirstJump ? 'Ground/Coyote' : 'Air'} Jump! Remaining: ${jumpsRemaining}`);
        }

        // Consume the jump input press regardless of success to prevent repeated jumps in one press
        movementState.jump = false; // Reset jump input state for this frame
    }


    // --- 6. Update Mesh Position ---
    if (playerMesh) {
        playerMesh.position.copy(playerBody.position);
        // playerMesh.position.y -= 0.0; // Apply potential visual offset if needed
    }

    // --- 7. Update Mesh Rotation (Third Person - Visual Only) ---
    if (cameraMode === 'thirdPerson' && playerMesh) {
        const horizontalSpeedSq = currentVelocity.x * currentVelocity.x + currentVelocity.z * currentVelocity.z;
        let targetYaw = playerYaw; // Default to current yaw if not moving

        // If moving significantly, face the direction of velocity
        if (horizontalSpeedSq > 0.1 * 0.1) { // Threshold to prevent jitter when stopping
            targetYaw = Math.atan2(currentVelocity.x, currentVelocity.z);
        }
        // If not moving fast but there is input, face the input direction
        else if (hasInput) {
            targetYaw = Math.atan2(_movementDirection.x, _movementDirection.z);
        }

        // Smoothly rotate playerYaw towards targetYaw
        const wrap = (a, b) => (a % b + b) % b; // Helper to wrap angles correctly
        const angleDiff = wrap(targetYaw - playerYaw + Math.PI, Math.PI * 2) - Math.PI; // Find shortest angle difference
        playerYaw += angleDiff * 0.15; // Apply smoothed rotation (adjust factor for speed)

        // Apply the smoothed yaw to the mesh quaternion
        _playerMeshQuaternion.setFromEuler(new THREE.Euler(0, playerYaw, 0, 'YXZ'));
        playerMesh.quaternion.slerp(_playerMeshQuaternion, 0.2); // Slerp for smoother visual rotation
    }

    // --- 8. Fall Check / Respawn ---
    if (playerBody.position.y < (-25 + playerPhysicsHeight / 2)) { // Adjust check for cylinder center
        const respawnColumn = findNearestColumn(0, 0) || { height: 10.0, x: 0, z: 0 };
        const respawnY = respawnColumn.height + playerPhysicsHeight / 2 + 0.1;
        playerBody.position.set(respawnColumn.x, respawnY, respawnColumn.z);
        playerBody.velocity.set(0, 0, 0); // Reset velocity
        playerBody.angularVelocity.set(0, 0, 0); // Reset angular velocity

        if (playerMesh) {
            playerMesh.position.copy(playerBody.position);
            // playerMesh.position.y -= 0.0; // Apply offset if needed
            playerMesh.quaternion.setFromEuler(new THREE.Euler(0, playerYaw, 0)); // Reset rotation
            playerMesh.visible = (cameraMode === 'thirdPerson');
        }
        jumpsRemaining = maxJumps; // Reset jumps on respawn
        isGrounded = true; // Assume respawned on ground
        coyoteTimer = 0; // Reset coyote time
        console.log("Player respawned.");
    }
} // End of updatePlayer function


// --- Getters ---
function getPlayerBody() { return playerBody; }
function getPlayerModel() { return playerModel; }
function getPlayerMesh() { return playerMesh; }
function getCameraMode() { return cameraMode; }
function getPlayerHeightOffset() { return playerHeightOffset; }
function getPlayerYaw() { return playerYaw; }
function getPlayerPitch() { return playerPitch; }

// --- Exports ---
export {
    initPlayer,
    setupPlayerControls,
    updatePlayer, // Remember main.js needs to pass deltaTime to this
    getPlayerBody,
    changePlayerModel,
    playerModels,
    getPlayerModel,
    getCameraMode,
    getPlayerMesh,
    getPlayerHeightOffset,
    getPlayerYaw,
    getPlayerPitch
};
