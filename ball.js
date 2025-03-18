// ball.js
import { scene, createGlowingMaterial } from './scene.js';
import { world, ballMaterial } from './physics.js';
import { getPlayerBody } from './player.js';
import { terrainColumns, findNearestColumn } from './terrain.js';
import { updateHitDisplay } from './main.js';

// Track all ball objects and related variables
let spawnIntervalId = null;
const balls = []; // Array of { mesh, body, shadow, trail, type, effects }
let playerHitCount = 0;
const hitCountEl = document.getElementById('hitCount');

// Define ball types for variety
const BALL_TYPES = [
  {
    id: 'standard',
    color: 0xff0000,     // Red
    trailColor: 0xff6666,
    size: 0.5,
    mass: 1,
    damping: 0.5,
    glow: false,
    bounceEffect: true,
    spawnChance: 60      // 60% chance of spawning this type
  },
  {
    id: 'heavy',
    color: 0x333333,     // Dark grey
    trailColor: 0x555555,
    size: 0.7,
    mass: 3,
    damping: 0.2,        // Less damping = moves faster
    glow: false,
    bounceEffect: true,
    spawnChance: 25      // 25% chance
  },
  {
    id: 'light',
    color: 0x00aaff,     // Light blue
    trailColor: 0x99ddff,
    size: 0.4,
    mass: 0.5,
    damping: 0.6,        // More damping = moves slower
    glow: true,
    bounceEffect: true,
    spawnChance: 15      // 15% chance
  }
];

/**
 * Creates a ball with random type based on spawn chances
 */
function createBall() {
  if (terrainColumns.length === 0) return;

  // 1) Select random pillar and spawn above it
  const column = terrainColumns[Math.floor(Math.random() * terrainColumns.length)];
  const spawnHeight = column.height + 30;
  const x = column.x;
  const z = column.z;

  // 2) Select ball type
  const ballType = selectRandomBallType();

  // 3) Create mesh with enhanced visuals
  const ballMesh = createBallMesh(ballType);
  ballMesh.position.set(x, spawnHeight, z);
  scene.add(ballMesh);

  // 4) Create physics body
  const ballBody = createBallPhysics(x, spawnHeight, z, ballType);
  world.addBody(ballBody);
  
  // Store the ball type in the body for reference
  ballBody.ballType = ballType.id;

  // 5) Create improved shadow
  const shadowMesh = createBallShadow(x, column.height + 0.01, z, ballType);
  scene.add(shadowMesh);

  // 6) Create trail system if enabled for this type
  const trailSystem = ballType.glow ? createTrailSystem(ballType) : null;
  if (trailSystem) {
    scene.add(trailSystem);
  }

  // 7) Collision handling
  setupCollisionHandling(ballBody, ballType);

  // 8) Store all parts together
  balls.push({
    mesh: ballMesh,
    body: ballBody,
    shadow: shadowMesh,
    trail: trailSystem,
    type: ballType,
    spawnTime: Date.now(),
    trailPositions: [],
    lastTrailUpdate: Date.now()
  });

  // Auto-remove balls after a while to prevent buildup
  setTimeout(() => {
    const index = balls.findIndex(ball => ball.body === ballBody);
    if (index !== -1) {
      removeBall(ballBody);
    }
  }, 15000); // 15 seconds timeout
}

/**
 * Selects a random ball type based on spawn chances
 */
function selectRandomBallType() {
  // Calculate total spawn chance
  const totalChance = BALL_TYPES.reduce((sum, type) => sum + type.spawnChance, 0);
  
  // Get random value within the total range
  const roll = Math.random() * totalChance;
  
  // Find which type this roll corresponds to
  let runningTotal = 0;
  for (const type of BALL_TYPES) {
    runningTotal += type.spawnChance;
    if (roll <= runningTotal) {
      return type;
    }
  }
  
  // Default fallback
  return BALL_TYPES[0];
}

/**
 * Creates an enhanced ball mesh based on type
 */
function createBallMesh(ballType) {
  // Create geometry based on ball type
  const geometry = new THREE.SphereGeometry(ballType.size, 24, 24);
  
  // Choose material based on ball type
  let material;
  if (ballType.glow) {
    material = createGlowingMaterial(ballType.color, 0.6);
  } else {
    material = new THREE.MeshPhongMaterial({ 
      color: ballType.color,
      shininess: 70,
      specular: 0xffffff
    });
  }
  
  // Create mesh
  const mesh = new THREE.Mesh(geometry, material);
  
  // Add details based on ball type
  if (ballType.id === 'heavy') {
    // Add rings to heavy ball to make it look more distinct
    const ringGeometry = new THREE.TorusGeometry(ballType.size * 1.05, ballType.size * 0.1, 8, 24);
    const ringMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x222222,
      shininess: 30
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    mesh.add(ring);
    
    // Add second perpendicular ring
    const ring2 = new THREE.Mesh(ringGeometry.clone(), ringMaterial);
    ring2.rotation.y = Math.PI / 2;
    mesh.add(ring2);
  }
  
  // Cast and receive shadows (if we implement shadow mapping)
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  
  return mesh;
}

/**
 * Creates ball physics body based on type
 */
function createBallPhysics(x, y, z, ballType) {
  const shape = new CANNON.Sphere(ballType.size);
  const body = new CANNON.Body({
    mass: ballType.mass,
    material: ballMaterial,
    linearDamping: ballType.damping,
    angularDamping: 0.4,
    fixedRotation: false
  });
  body.addShape(shape);
  body.position.set(x, y, z);
  
  // Add small random initial velocity for more natural behavior
  body.velocity.set(
    (Math.random() - 0.5) * 2, 
    -0.5 - Math.random(), 
    (Math.random() - 0.5) * 2
  );
  
  // Add random spin
  body.angularVelocity.set(
    (Math.random() - 0.5) * 5,
    (Math.random() - 0.5) * 5,
    (Math.random() - 0.5) * 5
  );
  
  // Make sure it's awake
  body.sleepState = CANNON.Body.AWAKE;
  body.allowSleep = false;
  
  return body;
}

/**
 * Creates an improved shadow for the ball
 */
function createBallShadow(x, y, z, ballType) {
  const shadowSize = ballType.size * 1.5; // Shadow a bit larger than ball
  const shadowGeo = new THREE.CircleGeometry(shadowSize, 24);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.4,
    depthWrite: false
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.set(x, y, z);
  return shadowMesh;
}

/**
 * Creates a trail system for the ball if enabled
 */
function createTrailSystem(ballType) {
  // Create a simple trail using points
  const trailGeometry = new THREE.BufferGeometry();
  const trailMaterial = new THREE.PointsMaterial({
    color: ballType.trailColor || ballType.color,
    size: ballType.size * 0.6,
    transparent: true,
    opacity: 0.6,
    depthWrite: false
  });
  
  // Start with empty positions
  const positions = new Float32Array(30 * 3); // 30 trail points max
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  return new THREE.Points(trailGeometry, trailMaterial);
}

// Queue for bodies to remove after physics step
const removeBodiesQueue = [];

/**
 * Set up collision handling for a ball
 */
function setupCollisionHandling(ballBody, ballType) {
  ballBody.addEventListener('collide', (event) => {
    // Check what we collided with
    if (event.body === getPlayerBody()) {
      // Player hit!
      playerHitCount++;
      if (hitCountEl) hitCountEl.textContent = playerHitCount;
      updateHitDisplay(playerHitCount);
      
      // Create hit effect
      createHitEffect(ballBody.position, ballType);
      
      // Queue ball for removal instead of removing immediately
      queueBallForRemoval(ballBody);
    } 
    else if (event.body.isTerrain) {
      // Hit terrain - create bounce effect if enabled for this type
      if (ballType.bounceEffect) {
        createBounceEffect(ballBody.position, ballType);
      }
      
      // Queue ball for removal instead of removing immediately
      queueBallForRemoval(ballBody);
    }
  });
}

/**
 * Queue a ball for removal after physics step completes
 */
function queueBallForRemoval(body) {
  // Only add to queue if not already there
  if (!removeBodiesQueue.includes(body)) {
    removeBodiesQueue.push(body);
  }
}

/**
 * Process all queued removals
 */
function processRemovals() {
  // Process all removals
  while (removeBodiesQueue.length > 0) {
    const body = removeBodiesQueue.pop();
    removeBall(body);
  }
}

/**
 * Create a hit effect when a player is hit
 */
function createHitEffect(position, ballType) {
  // Create particles for impact
  const particleCount = 20;
  const particles = new THREE.BufferGeometry();
  const particleMaterial = new THREE.PointsMaterial({
    color: ballType.color,
    size: 0.3,
    transparent: true,
    opacity: 0.8
  });
  
  const positions = new Float32Array(particleCount * 3);
  
  // Create particles at random positions around impact
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = position.x + (Math.random() - 0.5) * 2;
    positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 2;
    positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 2;
  }
  
  particles.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  
  const particleSystem = new THREE.Points(particles, particleMaterial);
  scene.add(particleSystem);
  
  // Animate and remove after 1 second
  let time = 0;
  function animate() {
    time += 0.05;
    
    // Move particles outward
    const positions = particles.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] += (Math.random() - 0.5) * 0.2;
      positions[i * 3 + 1] += Math.random() * 0.2;
      positions[i * 3 + 2] += (Math.random() - 0.5) * 0.2;
    }
    particles.attributes.position.needsUpdate = true;
    
    // Fade out
    particleMaterial.opacity -= 0.02;
    
    // Remove when done
    if (time > 1.5) {
      scene.remove(particleSystem);
      particles.dispose();
      particleMaterial.dispose();
      return;
    }
    
    requestAnimationFrame(animate);
  }
  
  animate();
}

/**
 * Create a bounce effect when ball hits terrain
 */
function createBounceEffect(position, ballType) {
  // Simple ripple effect - circle that expands and fades
  const ringGeometry = new THREE.RingGeometry(0.1, 0.3, 16);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: ballType.color,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = -Math.PI / 2; // Flat on ground
  ring.position.copy(position);
  ring.position.y += 0.05; // Slightly above ground
  scene.add(ring);
  
  // Animate and remove
  let time = 0;
  function animate() {
    time += 0.05;
    
    // Expand ring
    ring.scale.x += 0.2;
    ring.scale.y += 0.2;
    ring.scale.z += 0.2;
    
    // Fade out
    ringMaterial.opacity -= 0.03;
    
    // Remove when done
    if (time > 1.0) {
      scene.remove(ring);
      ringGeometry.dispose();
      ringMaterial.dispose();
      return;
    }
    
    requestAnimationFrame(animate);
  }
  
  animate();
}

/**
 * Updates all balls each frame
 */
function updateBalls() {
  // Process any pending removals first
  processRemovals();
  
  const currentTime = Date.now();
  
  for (let i = balls.length - 1; i >= 0; i--) {
    const ball = balls[i];
    const body = ball.body;
    const mesh = ball.mesh;
    const shadow = ball.shadow;
    const trail = ball.trail;
    const type = ball.type;

    // Update mesh position and rotation
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);

    // Update shadow position and appearance
    const column = findNearestColumn(body.position.x, body.position.z);
    if (column) {
      shadow.position.set(
        body.position.x,
        column.height + 0.01,
        body.position.z
      );
      
      // Scale shadow based on height from ground (further = smaller shadow)
      const heightAboveGround = body.position.y - column.height;
      const shadowScale = Math.max(0.3, 1 - heightAboveGround * 0.02);
      shadow.scale.set(shadowScale, shadowScale, 1);
      
      // Fade shadow based on height
      shadow.material.opacity = Math.max(0.1, 0.4 - heightAboveGround * 0.01);
    }

    // Update trail if available
    if (trail && type.glow) {
      // Only update trail every 50ms for performance
      if (currentTime - ball.lastTrailUpdate > 50) {
        updateTrail(ball, currentTime);
      }
    }

    // Remove if below safety floor
    if (body.position.y < -25) {
      removeBall(body);
    }
  }
}

/**
 * Updates the ball's trail
 */
function updateTrail(ball, currentTime) {
  const trailMaxLength = 10; // Maximum number of trail points
  const mesh = ball.mesh;
  const trail = ball.trail;
  
  // Add current position to trail history
  ball.trailPositions.unshift({
    position: mesh.position.clone(),
    time: currentTime
  });
  
  // Keep only the most recent positions
  if (ball.trailPositions.length > trailMaxLength) {
    ball.trailPositions.pop();
  }
  
  // Update trail geometry
  const positions = trail.geometry.attributes.position.array;
  
  for (let i = 0; i < ball.trailPositions.length; i++) {
    const pos = ball.trailPositions[i].position;
    positions[i * 3] = pos.x;
    positions[i * 3 + 1] = pos.y;
    positions[i * 3 + 2] = pos.z;
    
    // Fade out opacity based on age
    const age = (currentTime - ball.trailPositions[i].time) / 1000; // seconds
    const pointOpacity = Math.max(0, 1 - age);
    // We can't set individual point opacities with basic material,
    // but we could use a custom shader for this if needed
  }
  
  // Fill remaining positions with last point
  for (let i = ball.trailPositions.length; i < trailMaxLength; i++) {
    if (ball.trailPositions.length > 0) {
      const lastPos = ball.trailPositions[ball.trailPositions.length - 1].position;
      positions[i * 3] = lastPos.x;
      positions[i * 3 + 1] = lastPos.y;
      positions[i * 3 + 2] = lastPos.z;
    }
  }
  
  // Update the buffer
  trail.geometry.attributes.position.needsUpdate = true;
  ball.lastTrailUpdate = currentTime;
}

/**
 * Removes a ball and all its associated objects
 */
function removeBall(body) {
  const index = balls.findIndex(ball => ball.body === body);
  if (index === -1) return;

  const ball = balls[index];
  
  // Remove from physics world
  if (world.bodies.indexOf(ball.body) !== -1) {
    world.remove(ball.body);
  }
  
  // Remove meshes from scene
  scene.remove(ball.mesh);
  scene.remove(ball.shadow);
  if (ball.trail) scene.remove(ball.trail);
  
  // Clean up geometries and materials
  if (ball.mesh.geometry) ball.mesh.geometry.dispose();
  if (ball.mesh.material) {
    if (Array.isArray(ball.mesh.material)) {
      ball.mesh.material.forEach(m => m.dispose());
    } else {
      ball.mesh.material.dispose();
    }
  }
  
  if (ball.shadow.geometry) ball.shadow.geometry.dispose();
  if (ball.shadow.material) ball.shadow.material.dispose();
  
  if (ball.trail) {
    if (ball.trail.geometry) ball.trail.geometry.dispose();
    if (ball.trail.material) ball.trail.material.dispose();
  }
  
  // Remove from array
  balls.splice(index, 1);
}

/**
 * Controls the ball spawn rate
 */
function spawnBallMachine(ballsPerSecond) {
  if (spawnIntervalId) clearInterval(spawnIntervalId);
  if (ballsPerSecond <= 0) return;

  const intervalMs = 1000 / ballsPerSecond;
  spawnIntervalId = setInterval(() => {
    createBall();
  }, intervalMs);
}

/**
 * Add a new ball type that can be spawned
 */
function addBallType(ballType) {
  if (!ballType.id || !ballType.color || !ballType.size) {
    console.error('Invalid ball type');
    return false;
  }
  
  // Check if a type with this ID already exists
  const existingIndex = BALL_TYPES.findIndex(type => type.id === ballType.id);
  if (existingIndex !== -1) {
    // Replace existing type
    BALL_TYPES[existingIndex] = ballType;
  } else {
    // Add new type
    BALL_TYPES.push(ballType);
  }
  
  return true;
}

/**
 * Export a method to create a specific ball type
 */
function createSpecificBall(typeId, x, y, z) {
  // Find the ball type
  const ballType = BALL_TYPES.find(type => type.id === typeId);
  if (!ballType) {
    console.error(`Ball type "${typeId}" not found`);
    return;
  }
  
  // Create the ball at the specified position
  const ballMesh = createBallMesh(ballType);
  ballMesh.position.set(x, y, z);
  scene.add(ballMesh);

  const ballBody = createBallPhysics(x, y, z, ballType);
  world.addBody(ballBody);
  
  ballBody.ballType = typeId;

  const column = findNearestColumn(x, z);
  const shadowMesh = createBallShadow(x, column ? column.height + 0.01 : 0, z, ballType);
  scene.add(shadowMesh);

  const trailSystem = ballType.glow ? createTrailSystem(ballType) : null;
  if (trailSystem) {
    scene.add(trailSystem);
  }

  setupCollisionHandling(ballBody, ballType);

  balls.push({
    mesh: ballMesh,
    body: ballBody,
    shadow: shadowMesh,
    trail: trailSystem,
    type: ballType,
    spawnTime: Date.now(),
    trailPositions: [],
    lastTrailUpdate: Date.now()
  });
  
  return ballBody;
}

// Export functions
export { 
  spawnBallMachine, 
  updateBalls, 
  createBall, 
  createSpecificBall, 
  addBallType,
  BALL_TYPES,
  processRemovals  // Export this to be called after physics step
};
