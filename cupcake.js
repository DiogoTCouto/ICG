// cupcake.js
import { scene, camera, renderer, createGlowingMaterial } from './scene.js';
import { world, cupcakeMaterial } from './physics.js';
import { terrainColumns } from './terrain.js';
import { updateScore } from './main.js';

let cupcakes = []; // Stores { mesh, body, shadow, hovered }
let score = 0;
const scoreEl = document.getElementById('score');

// Enhanced cupcake appearance settings
const CUPCAKE_COLORS = {
  base: 0xFFB6C1,     // Pink
  frosting: 0xFF69B4,  // Hot pink
  cherry: 0xFF0000,    // Red
  glow: 0xFFABD6,      // Pinkish glow
  shadow: 0x000000     // Black shadow
};

// Track mouse position for hover effects
window.mouseX = 0;
window.mouseY = 0;
renderer.domElement.addEventListener('mousemove', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  window.mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  window.mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
});

// Queue for cupcakes to remove
const removeCupcakesQueue = [];

/**
 * Queue a cupcake for removal
 */
function queueCupcakeForRemoval(body) {
  if (!removeCupcakesQueue.includes(body)) {
    removeCupcakesQueue.push(body);
  }
}

/**
 * Process all queued cupcake removals
 */
function processRemovals() {
  while (removeCupcakesQueue.length > 0) {
    const body = removeCupcakesQueue.pop();
    removeCupcake(body);
  }
}

/**
 * Creates a more visible and attractive cupcake
 */
function createCupcake() {
  if (terrainColumns.length === 0) return;

  // 1. Select random pillar
  const column = terrainColumns[Math.floor(Math.random() * terrainColumns.length)];
  const spawnHeight = column.height + 20;
  
  // 2. Create an improved Three.js cupcake group
  const cupcakeGroup = new THREE.Group();
  
  // Base (cone with better texture)
  const baseGeom = new THREE.CylinderGeometry(0.7, 0.5, 1.2, 32); // Slightly larger
  const baseMat = new THREE.MeshPhongMaterial({ 
    color: CUPCAKE_COLORS.base,
    shininess: 60,
    specular: 0xffffff
  });
  const base = new THREE.Mesh(baseGeom, baseMat);
  
  // Frosting (hemisphere with better shape)
  const frostingGeom = new THREE.SphereGeometry(0.8, 32, 32);
  const frostingMat = new THREE.MeshPhongMaterial({ 
    color: CUPCAKE_COLORS.frosting,
    shininess: 70,
    specular: 0xffffff
  });
  const frosting = new THREE.Mesh(frostingGeom, frostingMat);
  frosting.position.y = 0.7; // Position on top of the base
  frosting.scale.set(1, 0.6, 1); // Squash to look more like frosting
  
  // Cherry (small sphere with glow)
  const cherryGeom = new THREE.SphereGeometry(0.25, 32, 32);
  const cherryMat = createGlowingMaterial(CUPCAKE_COLORS.cherry, 0.3);
  const cherry = new THREE.Mesh(cherryGeom, cherryMat);
  cherry.position.y = 1.0; // Position on top of frosting
  
  // Add some sprinkles for more visual appeal
  const sprinkleColors = [0xFFFF00, 0x00FFFF, 0xFFFFFF, 0xAAFF00];
  for (let i = 0; i < 6; i++) {
    const sprinkleGeom = new THREE.BoxGeometry(0.05, 0.2, 0.05);
    const sprinkleMat = new THREE.MeshPhongMaterial({
      color: sprinkleColors[i % sprinkleColors.length]
    });
    const sprinkle = new THREE.Mesh(sprinkleGeom, sprinkleMat);
    
    // Calculate position on the frosting
    const angle = (i / 6) * Math.PI * 2;
    const radius = 0.5;
    sprinkle.position.set(
      Math.cos(angle) * radius,
      0.85,
      Math.sin(angle) * radius
    );
    
    // Random rotation for variety
    sprinkle.rotation.x = Math.random() * Math.PI;
    sprinkle.rotation.z = Math.random() * Math.PI;
    
    cupcakeGroup.add(sprinkle);
  }
  
  // Add components to the group
  cupcakeGroup.add(base);
  cupcakeGroup.add(frosting);
  cupcakeGroup.add(cherry);
  
  // Set position and add to scene
  cupcakeGroup.position.set(column.x, spawnHeight, column.z);
  scene.add(cupcakeGroup);

  // 3. Create improved physics body
  const body = createCupcakePhysics(column.x, spawnHeight, column.z);
  world.addBody(body);

  // 4. Create more visible shadow
  const shadowSize = 1.2; // Larger shadow for visibility
  const shadowGeo = new THREE.CircleGeometry(shadowSize, 32);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: CUPCAKE_COLORS.shadow,
    transparent: true,
    opacity: 0.5 // More visible opacity
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(column.x, column.height + 0.01, column.z);
  scene.add(shadow);

  // Store reference with additional hover state
  cupcakes.push({ 
    group: cupcakeGroup, 
    body, 
    shadow,
    hovered: false,
    animationPhase: Math.random() * Math.PI * 2 // Random start phase for floating animation
  });

  // Auto-remove if not collected
  setTimeout(() => queueCupcakeForRemoval(body), 15000); // Remove after 15 seconds
}

/**
 * Create improved physics body for cupcakes
 */
function createCupcakePhysics(x, y, z) {
  // Create a compound shape for better physics behavior
  const body = new CANNON.Body({
    mass: 0.8,
    material: cupcakeMaterial,
    linearDamping: 0.4,      // More air resistance to slow descent
    angularDamping: 0.6      // Less spin for more stable movement
  });
  
  // Add both shapes to better represent the cupcake
  const baseShape = new CANNON.Cylinder(0.7, 0.5, 1.2, 8); // Match visual size
  const frostingShape = new CANNON.Sphere(0.8);
  
  const baseQuat = new CANNON.Quaternion();
  baseQuat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI/2);
  
  body.addShape(baseShape, new CANNON.Vec3(0, 0, 0), baseQuat);
  body.addShape(frostingShape, new CANNON.Vec3(0, 0.7, 0));
  
  // Position the body
  body.position.set(x, y, z);
  
  // Make sure it's not sleeping
  body.sleepState = CANNON.Body.AWAKE;
  body.allowSleep = false;
  
  // Add a small initial impulse for natural movement
  body.applyImpulse(
    new CANNON.Vec3(
      (Math.random() - 0.5) * 1,
      -0.5,
      (Math.random() - 0.5) * 1
    ),
    new CANNON.Vec3(0, 0, 0)
  );
  
  return body;
}

/**
 * Find nearest terrain column to position
 */
function findNearestColumn(x, z) {
  if (terrainColumns.length === 0) return null;
  
  // Find the nearest column by calculating distance
  let nearest = terrainColumns[0];
  let minDist = Math.sqrt(Math.pow(x - nearest.x, 2) + Math.pow(z - nearest.z, 2));
  
  for (let i = 1; i < terrainColumns.length; i++) {
    const col = terrainColumns[i];
    const dist = Math.sqrt(Math.pow(x - col.x, 2) + Math.pow(z - col.z, 2));
    if (dist < minDist) {
      minDist = dist;
      nearest = col;
    }
  }
  
  return nearest;
}

/**
 * Update cupcakes each frame with improved visuals and hover effects
 */
function updateCupcakes() {
  // Process any pending removals
  processRemovals();
  
  // Use raycaster for hover detection
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(window.mouseX, window.mouseY);
  
  // Update the raycaster
  raycaster.setFromCamera(mouse, camera);
  
  // Get flat array of all meshes in cupcake groups
  const allCupcakeMeshes = [];
  cupcakes.forEach(cupcake => {
    cupcake.group.traverse(child => {
      if (child.isMesh) {
        // Store reference to parent group
        child.userData.parentGroup = cupcake.group;
        allCupcakeMeshes.push(child);
      }
    });
  });
  
  // Check for intersections
  const intersects = raycaster.intersectObjects(allCupcakeMeshes);
  
  // Reset hover state for all cupcakes
  cupcakes.forEach(cupcake => {
    if (cupcake.hovered) {
      cupcake.hovered = false;
      // Remove hover effect
      cupcake.group.scale.set(1, 1, 1);
    }
  });
  
  // Apply hover effect to intersected cupcake
  if (intersects.length > 0) {
    const intersectedMesh = intersects[0].object;
    const parentGroup = intersectedMesh.userData.parentGroup;
    
    const hoveredCupcake = cupcakes.find(c => c.group === parentGroup);
    if (hoveredCupcake) {
      hoveredCupcake.hovered = true;
      // Apply hover effect - scale up slightly
      hoveredCupcake.group.scale.set(1.1, 1.1, 1.1);
      
      // Change cursor to pointer
      renderer.domElement.style.cursor = 'pointer';
    }
  } else {
    // Reset cursor
    renderer.domElement.style.cursor = 'default';
  }
  
  // Get current time for animations
  const time = performance.now() * 0.001; // convert to seconds
  
  cupcakes.forEach((cupcake, index) => {
    // Sync graphics with physics
    cupcake.group.position.copy(cupcake.body.position);
    cupcake.group.quaternion.copy(cupcake.body.quaternion);
    
    // Add gentle rotation for visibility
    cupcake.group.rotation.y += 0.01;
    
    // Add floating animation based on sine wave
    if (!cupcake.body.isGrounded) {
      // Only float if not resting on ground
      const floatOffset = Math.sin(time * 2 + cupcake.animationPhase) * 0.1;
      cupcake.group.position.y += floatOffset;
    }
    
    // Update shadow position and size based on height
    const column = findNearestColumn(cupcake.body.position.x, cupcake.body.position.z);
    if (column) {
      cupcake.shadow.position.set(
        cupcake.body.position.x,
        column.height + 0.01,
        cupcake.body.position.z
      );
      
      // Scale shadow based on distance from ground (further = smaller shadow)
      const heightAboveGround = cupcake.body.position.y - column.height;
      const shadowScale = Math.max(0.5, 1.2 - heightAboveGround * 0.05);
      cupcake.shadow.scale.set(shadowScale, shadowScale, 1);
      
      // Fade shadow with height
      cupcake.shadow.material.opacity = Math.max(0.1, 0.5 - heightAboveGround * 0.02);
    }

    // If cupcake is on the ground for a while, mark it as grounded
    if (!cupcake.body.isGrounded) {
      const heightAboveGround = cupcake.body.position.y - (column ? column.height : 0);
      if (heightAboveGround < 1.5 && 
          Math.abs(cupcake.body.velocity.y) < 0.5) {
        cupcake.body.isGrounded = true;
      }
    }

    // Remove if below ground
    if (cupcake.body.position.y < -15) {
      queueCupcakeForRemoval(cupcake.body);
    }
  });
}

/**
 * Remove a cupcake from the scene and physics world
 */
function removeCupcake(body) {
  const index = cupcakes.findIndex(c => c.body === body);
  if (index === -1) return;

  const [cupcake] = cupcakes.splice(index, 1);
  
  // Queue removal to avoid issues during physics step
  setTimeout(() => {
    // Check if the body is still in the world
    if (world.bodies.indexOf(cupcake.body) !== -1) {
      world.remove(cupcake.body);
    }
    
    scene.remove(cupcake.group);
    scene.remove(cupcake.shadow);
    
    // Clean up resources
    cupcake.group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    
    if (cupcake.shadow.geometry) cupcake.shadow.geometry.dispose();
    if (cupcake.shadow.material) cupcake.shadow.material.dispose();
  }, 0);
}

/**
 * Create a collection effect when cupcake is clicked
 */
function createCollectionEffect(position) {
  // Create particle effect for visual feedback
  const particleCount = 20;
  const particles = new THREE.BufferGeometry();
  const particleMaterial = new THREE.PointsMaterial({
    color: CUPCAKE_COLORS.frosting,
    size: 0.3,
    transparent: true,
    opacity: 0.8
  });
  
  const positions = new Float32Array(particleCount * 3);
  
  // Create particles at random positions
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = position.x + (Math.random() - 0.5) * 2;
    positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 2;
    positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 2;
  }
  
  particles.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  
  const particleSystem = new THREE.Points(particles, particleMaterial);
  scene.add(particleSystem);
  
  // Create "+" score text above cupcake
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 128;
  canvas.height = 64;
  
  context.fillStyle = '#ffffff';
  context.font = 'bold 48px Arial';
  context.fillText('+500', 32, 40);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ 
    map: texture,
    transparent: true
  });
  
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.position.y += 2;
  sprite.scale.set(2, 1, 1);
  scene.add(sprite);
  
  // Animate particles and text
  let time = 0;
  function animate() {
    time += 0.05;
    
    // Move particles outward
    const positions = particles.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] += (Math.random() - 0.5) * 0.1;
      positions[i * 3 + 1] += Math.random() * 0.2;
      positions[i * 3 + 2] += (Math.random() - 0.5) * 0.1;
    }
    particles.attributes.position.needsUpdate = true;
    
    // Fade out particles
    particleMaterial.opacity -= 0.02;
    
    // Move score text upward
    sprite.position.y += 0.1;
    
    // Remove when animation complete
    if (time > 1.5) {
      scene.remove(particleSystem);
      scene.remove(sprite);
      particles.dispose();
      particleMaterial.dispose();
      texture.dispose();
      material.dispose();
      return;
    }
    
    requestAnimationFrame(animate);
  }
  
  animate();
}

/**
 * Handle click event for cupcake collection
 */
function handleClick(event) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  
  // Get normalized coordinates
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Flat array of all meshes in all cupcake groups
  const allCupcakeMeshes = [];
  cupcakes.forEach(cupcake => {
    cupcake.group.traverse(child => {
      if (child.isMesh) {
        child.userData.parentGroup = cupcake.group;
        allCupcakeMeshes.push(child);
      }
    });
  });
  
  // Check intersections with all cupcake meshes
  const intersects = raycaster.intersectObjects(allCupcakeMeshes, false);

  if (intersects.length > 0) {
    const clickedMesh = intersects[0].object;
    const clickedGroup = clickedMesh.userData.parentGroup;
    
    const clickedCupcake = cupcakes.find(c => c.group === clickedGroup);
    
    if (clickedCupcake) {
      // Increase score
      score += 500;
      if (scoreEl) scoreEl.textContent = score;
      updateScore(score);
      
      // Create collection effect at cupcake position
      createCollectionEffect(clickedCupcake.body.position);
      
      // Queue removal instead of removing immediately
      queueCupcakeForRemoval(clickedCupcake.body);
      
      // Play sound effect if available
      if (window.playCollectionSound) {
        window.playCollectionSound();
      }
    }
  }
}

/**
 * Start spawning cupcakes at intervals
 */
let cupcakeInterval;
function startCupcakeSpawner(interval = 5000) {
  if (cupcakeInterval) {
    clearInterval(cupcakeInterval);
  }
  cupcakeInterval = setInterval(createCupcake, interval);
  
  // Spawn one immediately
  createCupcake();
}

export { createCupcake, updateCupcakes, handleClick, startCupcakeSpawner, processRemovals };