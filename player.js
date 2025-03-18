// improved-player.js
import { scene } from './scene.js';
import { world } from './physics.js';
import { findNearestColumn, findJumpableColumns, terrainColumns } from './terrain.js';

const urlParams = new URLSearchParams(window.location.search);
const userPreferences = urlParams.get('color');

let playerBody = null;
let playerMesh = null;
let playerModel = 'cube'; // Default model

// Movement and jump parameters
let targetPosition = null;
let isJumping = false;
const jumpHeight = 8;
const jumpSpeed = 15;
const moveDistance = 8;
const maxHeightDiff = 5;

//Visual indicators for jumpable positions
let jumpIndicators = [];
let showingJumpIndicators = false;

//Player models collection
const playerModels = {
  cube: {
    create: createCubePlayer,
    scale: 1.0
  },
  sphere: {
    create: createSpherePlayer,
    scale: 1.0
  },
  robot: {
    create: createRobotPlayer,
    scale: 1.0
  }
};

/**
 * Creates a cube player 
 */
function createCubePlayer() {
  const playerGroup = new THREE.Group();
  const color = new THREE.Color(userPreferences.playerColor);
  const darkerColor = color.clone().multiplyScalar(0.8); // Reduces RGB values by 20%
  
  const saturatedColor = color.clone();
  const hsl = { h: 0, s: 0, l: 0 };
  saturatedColor.getHSL(hsl);
  saturatedColor.setHSL(hsl.h, Math.min(hsl.s + 0.2, 1), hsl.l);

  const bodyMaterials = [
    new THREE.MeshPhongMaterial({ color: color, shininess: 30 }),
    new THREE.MeshPhongMaterial({ color: color, shininess: 30 }),
    new THREE.MeshPhongMaterial({ color: 0xaaaaaa, shininess: 50 }),
    new THREE.MeshPhongMaterial({ color: darkerColor, shininess: 30 }),
    new THREE.MeshPhongMaterial({ color: saturatedColor, shininess: 50 }),
    new THREE.MeshPhongMaterial({ color: saturatedColor, shininess: 50 })
  ];
const bodyGeometry = new THREE.BoxGeometry(3, 3, 3, 2, 2, 2);

  const body = new THREE.Mesh(bodyGeometry, bodyMaterials);
  playerGroup.add(body);
  
  const eyeGeometry = new THREE.SphereGeometry(0.4, 16, 16);
  const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
  const pupilGeometry = new THREE.SphereGeometry(0.2, 16, 16);
  const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
  
  //Left eye
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.7, 0.7, 1.51);
  const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  leftPupil.position.set(-0.7, 0.7, 1.71);
  
  //Right eye
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.position.set(0.7, 0.7, 1.51);
  const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  rightPupil.position.set(0.7, 0.7, 1.71);
  
  playerGroup.add(leftEye, leftPupil, rightEye, rightPupil);
  
  //Mouth 
  const mouthGeometry = new THREE.TorusGeometry(0.7, 0.1, 16, 16, Math.PI);
  const mouthMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
  const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
  mouth.position.set(0, -0.3, 1.51);
  mouth.rotation.set(0, 0, Math.PI);
  playerGroup.add(mouth);
  
  //Direction indicator
  const arrowGeometry = new THREE.ConeGeometry(0.4, 1, 16);
  const arrowMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
  const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
  arrow.position.set(0, 2, 0);
  arrow.rotation.set(0, 0, 0);
  playerGroup.add(arrow);

  return playerGroup;
}

/**
 * Creates a sphere player with improved visuals
 */
function createSpherePlayer() {
  const playerGroup = new THREE.Group();
  
 
  const bodyGeometry = new THREE.SphereGeometry(1.5, 32, 32);
  const bodyMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x3366ff, 
    shininess: 60,
    emissive: 0x112244,
    emissiveIntensity: 0.2
  });
  
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  playerGroup.add(body);
  
  const ringGeometry = new THREE.TorusGeometry(1.8, 0.2, 16, 32);
  const ringMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xffcc00,
    shininess: 80 
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.set(Math.PI/2, 0, 0);
  playerGroup.add(ring);
  
  //Eyes
  const eyeGeometry = new THREE.SphereGeometry(0.3, 16, 16);
  const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
  const pupilGeometry = new THREE.SphereGeometry(0.15, 16, 16);
  const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
  
  //Left eye
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.6, 0.5, 1.2);
  const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  leftPupil.position.set(-0.6, 0.5, 1.35);
  
  //Right eye
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.position.set(0.6, 0.5, 1.2);
  const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  rightPupil.position.set(0.6, 0.5, 1.35);
  
  playerGroup.add(leftEye, leftPupil, rightEye, rightPupil);
  
  //Direction arrow
  const arrowGeometry = new THREE.ConeGeometry(0.3, 0.8, 16);
  const arrowMaterial = new THREE.MeshPhongMaterial({ color: 0xff3300 });
  const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
  arrow.position.set(0, 1.8, 0);
  playerGroup.add(arrow);

  return playerGroup;
}

/**
 * Creates a robot-like player
 */
function createRobotPlayer() {
  const playerGroup = new THREE.Group();
  
  const headGeometry = new THREE.BoxGeometry(2, 1.5, 1.5);
  const headMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x888888,
    shininess: 70,
    metalness: 0.7
  });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.set(0, 1.25, 0);
  playerGroup.add(head);
  
  //Robot body
  const bodyGeometry = new THREE.BoxGeometry(2.5, 2, 1.8);
  const bodyMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x666666, 
    shininess: 60
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.set(0, -0.5, 0);
  playerGroup.add(body);
  
  //Robot eyes
  const eyeGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.1);
  const eyeMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 0.8
  });
  
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.5, 1.5, 0.8);
  
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.position.set(0.5, 1.5, 0.8);
  
  playerGroup.add(leftEye, rightEye);
  
  //Robot antenna
  const antennaGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
  const antennaMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
  const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
  antenna.position.set(0, 2.2, 0);
  
  const antennaTipGeometry = new THREE.SphereGeometry(0.12, 16, 16);
  const antennaTipMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.5
  });
  const antennaTip = new THREE.Mesh(antennaTipGeometry, antennaTipMaterial);
  antennaTip.position.set(0, 2.6, 0);
  
  playerGroup.add(antenna, antennaTip);
  
  //Decorative chest panel
  const panelGeometry = new THREE.PlaneGeometry(1.5, 1);
  const panelMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x444444,
    shininess: 90
  });
  const panel = new THREE.Mesh(panelGeometry, panelMaterial);
  panel.position.set(0, -0.5, 0.91);
  playerGroup.add(panel);
  
  //Panel lights
  for (let i = 0; i < 3; i++) {
    const lightGeometry = new THREE.CircleGeometry(0.1, 16);
    const lightMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 0.5
    });
    const light = new THREE.Mesh(lightGeometry, lightMaterial);
    light.position.set(0, -0.5 + i * 0.3, 0.92);
    playerGroup.add(light);
  }
  
  return playerGroup;
}

/**
 * Initializes the player with the selected model
 */
function initPlayer(initialModel = 'cube') {
  playerModel = initialModel;
  const radius = 1.5;
  const sphereShape = new CANNON.Sphere(radius);

  playerBody = new CANNON.Body({
    mass: 1,
    fixedRotation: true,
    linearDamping: 0.9,
  });
  playerBody.addShape(sphereShape);
  playerBody.isPlayer = true;

  //Position player at a good starting column
  const column = findNearestColumn(0, 0);
  const startY = column ? column.height + radius : radius;
  playerBody.position.set(0, startY, 0);

  const createModelFn = playerModels[playerModel].create;
  playerMesh = createModelFn();
  
  playerMesh.position.copy(playerBody.position);
  
  scene.add(playerMesh);

  world.addBody(playerBody);
}

/**
 * Changes the player model
 * @param {string} modelName - The name of the model to switch to
 */
function changePlayerModel(modelName) {
  if (!playerModels[modelName]) {
    console.error(`Model "${modelName}" not found!`);
    return;
  }
  
  const currentPosition = playerBody.position.clone();
  const currentRotation = playerMesh.rotation.clone();
  
  scene.remove(playerMesh);
  
  playerModel = modelName;
  const createModelFn = playerModels[modelName].create;
  playerMesh = createModelFn();
  
  playerMesh.position.copy(currentPosition);
  playerMesh.rotation.copy(currentRotation);
  
  scene.add(playerMesh);
}

/**
 * Sets up player controls
 */
function setupPlayerControls() {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
}

/**
 * Handles keydown event for player movement
 */
function onKeyDown(event) {
  //Don't process new moves if already jumping
  if (isJumping) return;
  
  // Get current position
  const currentPos = new CANNON.Vec3().copy(playerBody.position);
  
  // Get current column
  const currentColumn = findNearestColumn(currentPos.x, currentPos.z);
  if (!currentColumn) return; // Safety check
  
  // Search direction based on key press
  let searchDirection = null;
  
  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      searchDirection = { x: 0, z: -1 }; //Forward (negative Z)
      break;
    case 'KeyS':
    case 'ArrowDown':
      searchDirection = { x: 0, z: 1 };  //Backward (positive Z)
      break;
    case 'KeyA':
    case 'ArrowLeft':
      searchDirection = { x: -1, z: 0 }; //Left (negative X)
      break;
    case 'KeyD':
    case 'ArrowRight':
      searchDirection = { x: 1, z: 0 };  //Right (positive X)
      break;
    case 'Space':

      toggleJumpIndicators();
      return;
    default:
      return; // Not a movement key
  }
  
  if (searchDirection) {
    const angle = Math.atan2(searchDirection.x, searchDirection.z);
    
    const targetQuaternion = new THREE.Quaternion();
    targetQuaternion.setFromEuler(new THREE.Euler(0, angle, 0));
    
    // Apply rotation immediately - looks better for responsiveness
    playerMesh.quaternion.copy(targetQuaternion);
  }
  
  const searchRadius = moveDistance * 2; // Wider search area to find nearby columns
  
  const columnsInDirection = terrainColumns.filter(column => {
    const dirX = column.x - currentColumn.x;
    const dirZ = column.z - currentColumn.z;
    
    const inDirectionX = (searchDirection.x === 0) || (Math.sign(dirX) === Math.sign(searchDirection.x));
    const inDirectionZ = (searchDirection.z === 0) || (Math.sign(dirZ) === Math.sign(searchDirection.z));
    
    const distance = Math.sqrt(dirX * dirX + dirZ * dirZ);
    

    return (column !== currentColumn) && 
           (distance <= searchRadius) && 
           inDirectionX && inDirectionZ &&
           (Math.abs(column.height - currentColumn.height) <= maxHeightDiff);
  });
  
  let nearestColumn = null;
  let minDistance = Infinity;
  
  columnsInDirection.forEach(column => {
    const distance = Math.sqrt(
      Math.pow(column.x - currentColumn.x, 2) + 
      Math.pow(column.z - currentColumn.z, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestColumn = column;
    }
  });
  
  if (nearestColumn) {
    targetPosition = new CANNON.Vec3(
      nearestColumn.x,
      nearestColumn.height + 1.5, 
      nearestColumn.z
    );
    
    startJump(currentPos);
    
    if (showingJumpIndicators) {
      toggleJumpIndicators();
    }
  }
}

/**
 * Toggles jump indicators to show possible moves
 */
function toggleJumpIndicators() {
  if (showingJumpIndicators) {
    jumpIndicators.forEach(indicator => {
      scene.remove(indicator);
    });
    jumpIndicators = [];
    showingJumpIndicators = false;
    return;
  }
  
  const currentPos = new CANNON.Vec3().copy(playerBody.position);
  const jumpableColumns = findJumpableColumns(
    currentPos.x, 
    currentPos.z, 
    moveDistance * 1.5, // Allow a little extra range for visibility
    maxHeightDiff
  );
  
  jumpableColumns.forEach(column => {
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.5, 8);
    const material = new THREE.MeshPhongMaterial({ 
      color: 0xffff00,
      transparent: true,
      opacity: 0.7,
      emissive: 0xffff00,
      emissiveIntensity: 0.3
    });
    const indicator = new THREE.Mesh(geometry, material);
    
    indicator.position.set(
      column.x,
      column.height + 0.5,
      column.z
    );
    
    scene.add(indicator);
    jumpIndicators.push(indicator);
  });
  
  showingJumpIndicators = true;
}

/**
 * Starts a jump animation to the target position
 */
function startJump(startPosition) {
  if (!targetPosition || isJumping) return;
  
  isJumping = true;
  
  const jumpHeightAbsolute = Math.max(
    startPosition.y + jumpHeight,
    targetPosition.y + jumpHeight
  );
  
  const midPosition = new CANNON.Vec3(
    (startPosition.x + targetPosition.x) / 2,
    jumpHeightAbsolute,
    (startPosition.z + targetPosition.z) / 2
  );
  
  const distance = Math.sqrt(
    Math.pow(targetPosition.x - startPosition.x, 2) + 
    Math.pow(targetPosition.z - startPosition.z, 2)
  );
  const animationTime = distance / jumpSpeed;
  
  const originalMass = playerBody.mass;
  playerBody.mass = 0;
  playerBody.updateMassProperties();
  playerBody.velocity.set(0, 0, 0);
  
  const movementDirection = new THREE.Vector3(
    targetPosition.x - startPosition.x,
    0,
    targetPosition.z - startPosition.z
  ).normalize();
  
  const rotationAxis = new THREE.Vector3(0, 1, 0).cross(movementDirection).normalize();
  
  let startTime = Date.now();
  function animateJump() {
    const elapsed = (Date.now() - startTime) / 1000; //seconds
    const progress = Math.min(elapsed / animationTime, 1);
    
    if (progress < 0.5) {
      const subProgress = progress * 2; //0-1 for first half
      playerBody.position.x = startPosition.x + (midPosition.x - startPosition.x) * subProgress;
      playerBody.position.z = startPosition.z + (midPosition.z - startPosition.z) * subProgress;
      playerBody.position.y = startPosition.y + (midPosition.y - startPosition.y) * subProgress;
      
      //Rotate the player during jump (first half - 180 degrees)
      playerMesh.rotation.x = Math.PI * subProgress;
    } else {
      //Second half - moving down toward target
      const subProgress = (progress - 0.5) * 2; // 0-1 for second half
      playerBody.position.x = midPosition.x + (targetPosition.x - midPosition.x) * subProgress;
      playerBody.position.z = midPosition.z + (targetPosition.z - midPosition.z) * subProgress;
      playerBody.position.y = midPosition.y + (targetPosition.y - midPosition.y) * subProgress;
      
      //Continue rotation (second half - 180 to 360 degrees)
      playerMesh.rotation.x = Math.PI + Math.PI * subProgress;
    }
    
    //Update mesh position to match physics body
    playerMesh.position.copy(playerBody.position);
    
    //Add some wobble effect during jump for style
    const wobble = Math.sin(progress * Math.PI * 4) * 0.1;
    playerMesh.rotation.z = wobble;
    
    if (progress < 1) {
      requestAnimationFrame(animateJump);
    } else {
      playerBody.position.copy(targetPosition);
      
      playerMesh.rotation.set(0, playerMesh.rotation.y, 0);
      
      playerBody.mass = originalMass;
      playerBody.updateMassProperties();
      playerBody.velocity.set(0, 0, 0); 
      
      targetPosition = null;
      isJumping = false;
    }
  }
  
  animateJump();
}

function onKeyUp(event) {
}

/**
 * Updates the player each frame
 */
function updatePlayer() {
  if (!playerBody || !playerMesh) return;
  
  if (!isJumping) {
    playerMesh.position.copy(playerBody.position);
    
    if (playerBody.position.y < -25) {
      const column = findNearestColumn(0, 0);
      const startY = column ? column.height + 1.5 : 5;
      playerBody.position.set(0, startY, 0);
      playerBody.velocity.set(0, 0, 0);
    }
    
    if (showingJumpIndicators) {
      const time = Date.now() * 0.001;
      jumpIndicators.forEach((indicator, index) => {
        indicator.position.y += Math.sin(time * 2 + index * 0.5) * 0.01;
        indicator.rotation.y += 0.01; 
      });
    }
    
    const idleTime = Date.now() * 0.001;
    playerMesh.position.y += Math.sin(idleTime * 1.5) * 0.03;
    playerMesh.rotation.y += 0.005; 
  }
}

/**
 * Returns the player body for physics
 */
function getPlayerBody() {
  return playerBody;
}

/**
 * Returns player model name
 */
function getPlayerModel() {
  return playerModel;
}

export {
  initPlayer,
  setupPlayerControls,
  updatePlayer,
  getPlayerBody,
  changePlayerModel,
  playerModels
};