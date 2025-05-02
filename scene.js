// scene.js - Enhanced
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
  antialias: true, 
  logarithmicDepthBuffer: true,
  powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8; // reduced exposure for softer lighting
document.body.appendChild(renderer.domElement);

let isDragging = false;
let previousMousePosition = {
    x: 0,
    y: 0
};
let cameraOffset = {
    x: 0,
    y: 0
};
let cameraRotation = 0;
let cameraTilt = 0;

// Add this method to initialize drag controls
function initDragControls() {
    // Add event listeners to the renderer's DOM element
    renderer.domElement.addEventListener('mousedown', onMouseDown, false);
    renderer.domElement.addEventListener('mousemove', onMouseMove, false);
    renderer.domElement.addEventListener('mouseup', onMouseUp, false);
    renderer.domElement.addEventListener('wheel', onMouseWheel, false);
    
    // Touch support for mobile devices
    renderer.domElement.addEventListener('touchstart', onTouchStart, false);
    renderer.domElement.addEventListener('touchmove', onTouchMove, false);
    renderer.domElement.addEventListener('touchend', onTouchEnd, false);
}

function onMouseDown(event) {
    isDragging = true;
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

function onMouseMove(event) {
    if (!isDragging) return;
    
    const deltaMove = {
        x: event.clientX - previousMousePosition.x,
        y: event.clientY - previousMousePosition.y
    };
    
    // Update rotation and tilt based on drag
    cameraRotation -= deltaMove.x * 0.01;
    cameraTilt -= deltaMove.y * 0.01;
    
    // Limit the tilt to avoid camera flipping
    cameraTilt = Math.max(-Math.PI/3, Math.min(Math.PI/3, cameraTilt));
    
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

function onMouseWheel(event) {
    // Handle zoom with mouse wheel
    cameraOffset.z = Math.max(5, Math.min(50, cameraOffset.z + event.deltaY * 0.05));
}

function onMouseUp() {
    isDragging = false;
}

// Touch event handlers
function onTouchStart(event) {
    if (event.touches.length === 1) {
        isDragging = true;
        previousMousePosition = {
            x: event.touches[0].pageX,
            y: event.touches[0].pageY
        };
    }
}

function onTouchMove(event) {
    if (!isDragging || event.touches.length !== 1) return;
    
    const deltaMove = {
        x: event.touches[0].pageX - previousMousePosition.x,
        y: event.touches[0].pageY - previousMousePosition.y
    };
    
    // Update rotation and tilt based on drag
    cameraRotation -= deltaMove.x * 0.01;
    cameraTilt -= deltaMove.y * 0.01;
    
    // Limit the tilt to avoid camera flipping
    cameraTilt = Math.max(-Math.PI/3, Math.min(Math.PI/3, cameraTilt));
    
    previousMousePosition = {
        x: event.touches[0].pageX,
        y: event.touches[0].pageY
    };
}

function onTouchEnd() {
    isDragging = false;
}

function moveCamera(deltaMove) {
    // Define movement speed/sensitivity
    const movementSpeed = 0.1;
    
    // Move the camera horizontally based on the x delta
    camera.position.x -= deltaMove.x * movementSpeed;
    
    // For y movement, you can either move up/down or forward/back
    // This moves the camera up/down
    camera.position.y += deltaMove.y * movementSpeed;
}

// Sky setup
const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);

// Cloud system
const clouds = [];
const createClouds = () => {
  // Clear existing clouds
  clouds.forEach(cloud => {
    scene.remove(cloud);
    cloud.geometry.dispose();
    cloud.material.dispose();
  });
  clouds.length = 0;
  
  // Create cloud planes at different heights and sizes
  const cloudCount = isNightMode ? 15 : 30;
  
  for (let i = 0; i < cloudCount; i++) {
    const cloudSize = THREE.MathUtils.randFloat(70, 200);
    const cloudOpacity = isNightMode ? 
      THREE.MathUtils.randFloat(0.1, 0.4) : 
      THREE.MathUtils.randFloat(0.5, 0.9);
    
    const cloudMaterial = new THREE.MeshLambertMaterial({
      transparent: true,
      opacity: cloudOpacity,
      side: THREE.DoubleSide,
      color: isNightMode ? 0x555566 : 0xffffff,
    });
    
    const cloudGeometry = new THREE.PlaneGeometry(cloudSize, cloudSize/2);
    const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
    
    // Position randomly in sky
    cloud.position.set(
      THREE.MathUtils.randFloatSpread(800), 
      THREE.MathUtils.randFloat(80, 200),
      THREE.MathUtils.randFloatSpread(800)
    );
    
    // Random rotation for variety but keeping clouds horizontal
    cloud.rotation.x = Math.PI / 2;
    cloud.rotation.z = THREE.MathUtils.randFloat(0, Math.PI * 2);
    
    // Store movement properties
    cloud.userData = {
      speed: THREE.MathUtils.randFloat(0.05, 0.2),
      direction: new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(0.2),
        0,
        THREE.MathUtils.randFloatSpread(0.2)
      ).normalize()
    };
    
    scene.add(cloud);
    clouds.push(cloud);
  }
};

// Moon system
let moon;
const createMoon = () => {
  if (moon) {
    scene.remove(moon);
    moon.geometry.dispose();
    moon.material.dispose();
  }
  
  const moonGeometry = new THREE.SphereGeometry(15, 32, 32);
  const moonMaterial = new THREE.MeshStandardMaterial({
    emissive: 0xffffee,
    emissiveIntensity: 0.8,
    roughness: 0.5,
    metalness: 0.1
  });
  
  moon = new THREE.Mesh(moonGeometry, moonMaterial);
  scene.add(moon);
  
  // Position the moon in night sky
  const phi = THREE.MathUtils.degToRad(90 - nightPreset.elevation - 10);
  const theta = THREE.MathUtils.degToRad(nightPreset.azimuth + 20);
  const radius = 400;
  
  moon.position.setFromSphericalCoords(radius, phi, theta);
};

const sun = new THREE.Vector3();

// Enhanced presets with more visually appealing parameters
const dayPreset = {
  turbidity: 3.5,              
  rayleigh: 1.2,               // softer blue sky effect
  mieCoefficient: 0.0025,      
  mieDirectionalG: 0.85,       
  elevation: 45,               
  azimuth: 180,
  sunLightColor: 0xfff4e0,     // warmer sun light color
  sunLightIntensity: 1.0,      // reduced intensity to avoid washes
  ambientLightColor: 0x90a0c0,  
  ambientLightIntensity: 0.4,  // lowered ambient light for mood
  fogColor: 0xc4deff,          
  fogDensity: 0.0005,          // slightly reduced fog density
  hemisphereColor: 0xffeeb1,   
  hemisphereGroundColor: 0x080820,
  rimLightColor: 0xffa726      
};

// Night mode presets
const nightPreset = {
  turbidity: 0.2,              // Lower for clearer night sky
  rayleigh: 0.25,              // Reduced for darker blue
  mieCoefficient: 0.0015,      // Lower haze
  mieDirectionalG: 0.65,
  elevation: -5,               // Sun below horizon
  azimuth: 180,
  sunLightColor: 0x223344,     // Cool blue moonlight
  sunLightIntensity: 0.15,     // Dimmer
  ambientLightColor: 0x101428, // Dark blue ambient
  ambientLightIntensity: 0.2,
  fogColor: 0x090a18,          // Very dark blue fog
  fogDensity: 0.001,           // Slightly increased for night effect
  hemisphereColor: 0x0a0e2a,   // Dark blue top
  hemisphereGroundColor: 0x000000, // Completely dark ground
  rimLightColor: 0x2233aa      // Blue-tinted rim
};

// Current sky settings (start with day)
let skyParams = { ...dayPreset };

// Current mode tracker
let isNightMode = false;

// Stars system
let stars;
let starsVisible = false;

// Function to toggle between day and night
function toggleDayNight() {
  isNightMode = !isNightMode;
  
  // Update sky parameters based on mode
  skyParams = isNightMode ? { ...nightPreset } : { ...dayPreset };
  
  // Update visuals
  updateSky();
  updateLighting();
  
  // Handle stars and moon
  if (isNightMode) {
    if (!starsVisible) {
      addStars();
      starsVisible = true;
    }
    createMoon();
  } else {
    if (starsVisible) {
      removeStars();
      starsVisible = false;
    }
    if (moon) {
      scene.remove(moon);
      moon = null;
    }
  }
  
  // Update fog
  scene.fog.color.set(skyParams.fogColor);
  scene.fog.density = skyParams.fogDensity;
  
  // Update clouds for day/night
  createClouds();
  
  // Update button text
  const dayNightBtn = document.getElementById('dayNightBtn');
  if (dayNightBtn) {
    dayNightBtn.textContent = isNightMode ? "Toggle Day Mode" : "Toggle Night Mode";
    dayNightBtn.className = isNightMode ? "day-mode" : "night-mode";
  }
  window.isNightModeActive = isNightMode;
  return isNightMode;
}

// Make toggleDayNight accessible globally for the button
window.toggleDayNight = toggleDayNight;

// Simplified star system
function addStars() {
  const starsGeometry = new THREE.BufferGeometry();
  const starsMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.8,
    sizeAttenuation: true
  });
  
  const starsVertices = [];
  
  // Create 2000 stars
  for (let i = 0; i < 2000; i++) {
    // Position with emphasis on above-horizon placement
    const x = THREE.MathUtils.randFloatSpread(1000);
    const y = THREE.MathUtils.randFloat(50, 500); // Keep stars above horizon
    const z = THREE.MathUtils.randFloatSpread(1000);
    starsVertices.push(x, y, z);
  }
  
  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
  
  stars = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(stars);
}

function removeStars() {
  if (stars) {
    scene.remove(stars);
    stars.geometry.dispose();
    stars.material.dispose();
    stars = null;
  }
}

// Update sky parameters
function updateSky() {
  const uniforms = sky.material.uniforms;
  uniforms['turbidity'].value = skyParams.turbidity;
  uniforms['rayleigh'].value = skyParams.rayleigh;
  uniforms['mieCoefficient'].value = skyParams.mieCoefficient;
  uniforms['mieDirectionalG'].value = skyParams.mieDirectionalG;

  const phi = THREE.MathUtils.degToRad(90 - skyParams.elevation);
  const theta = THREE.MathUtils.degToRad(skyParams.azimuth);
  sun.setFromSphericalCoords(1, phi, theta);
  uniforms['sunPosition'].value.copy(sun);
}

// Update all lighting elements to match current sky settings
function updateLighting() {
  // Update lights
  ambientLight.color.set(skyParams.ambientLightColor);
  ambientLight.intensity = skyParams.ambientLightIntensity;
  
  sunLight.color.set(skyParams.sunLightColor);
  sunLight.intensity = skyParams.sunLightIntensity;
  
  // Position sunLight to match sun position
  const sunDistance = 100;
  sunLight.position.set(
    sun.x * sunDistance,
    sun.y * sunDistance,
    sun.z * sunDistance
  );
  
  // Update hemisphere light
  hemisphereLight.color.set(skyParams.hemisphereColor);
  hemisphereLight.groundColor.set(skyParams.hemisphereGroundColor);
  
  // Update rim light
  rimLight.color.set(skyParams.rimLightColor);
}

// Initialize sky
updateSky();

// Lighting System
const ambientLight = new THREE.AmbientLight(skyParams.ambientLightColor, skyParams.ambientLightIntensity);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(skyParams.sunLightColor, skyParams.sunLightIntensity);
sunLight.position.copy(sun);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;  // Reduced for better performance
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 500;
sunLight.shadow.camera.left = -100;
sunLight.shadow.camera.right = 100;
sunLight.shadow.camera.top = 100;
sunLight.shadow.camera.bottom = -100;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

// Environmental Fog
scene.fog = new THREE.FogExp2(skyParams.fogColor, skyParams.fogDensity);

// Hemisphere Light for Better Environmental Coloring
const hemisphereLight = new THREE.HemisphereLight(
  skyParams.hemisphereColor, 
  skyParams.hemisphereGroundColor, 
  0.4
);
scene.add(hemisphereLight);

// Rim Lighting for Edge Highlights
const rimLight = new THREE.DirectionalLight(skyParams.rimLightColor, 0.4);
rimLight.position.set(-10, 10, 10);
rimLight.castShadow = true;
scene.add(rimLight);

// Simplified Material Creator
function createEnhancedMaterial(options = {}) {
  const defaults = {
    color: 0x7777ff,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.5,
    metalness: 0.2,
    opacity: 1.0,
    transparent: false,
    flatShading: false
  };
  
  const settings = { ...defaults, ...options };
  
  // Use standard material for better compatibility and performance
  const material = new THREE.MeshStandardMaterial({
    color: settings.color,
    emissive: settings.emissive,
    emissiveIntensity: settings.emissiveIntensity,
    roughness: settings.roughness,
    metalness: settings.metalness,
    transparent: settings.transparent,
    opacity: settings.opacity,
    flatShading: settings.flatShading,
    side: THREE.FrontSide,
  });
  
  return material;
}

// Create glowing material (special case for emissive objects)
function createGlowingMaterial(baseColor, intensity = 1.2) {
  return createEnhancedMaterial({
    color: baseColor,
    emissive: baseColor,
    emissiveIntensity: intensity,
    roughness: 0.2,
    metalness: 0.1,
  });
}

// Simplified Post-processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// Add subtle bloom for glow effects
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.15,    // lowered strength for subtle glow
  0.3,     // reduced radius for fine bloom control
  1.0      // increased threshold to keep bright details in check
);
composer.addPass(bloomPass);

// Create simple environment map for reflections
function addEnvironmentMap() {
  try {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    
    // Use sky as environment map
    const renderTarget = pmremGenerator.fromScene(scene);
    scene.environment = renderTarget.texture;
  } catch (error) {
    console.error("Error creating environment map:", error);
  }
}

// Animation loop for clouds
function animateClouds() {
  clouds.forEach(cloud => {
    const { speed, direction } = cloud.userData;
    
    cloud.position.x += direction.x * speed;
    cloud.position.z += direction.z * speed;
    
    // Wrap clouds around when they go too far
    const limit = 500;
    if (Math.abs(cloud.position.x) > limit) {
      cloud.position.x = -Math.sign(cloud.position.x) * limit;
    }
    if (Math.abs(cloud.position.z) > limit) {
      cloud.position.z = -Math.sign(cloud.position.z) * limit;
    }
  });
  
  requestAnimationFrame(animateClouds);
}

// Initialize clouds
createClouds();
animateClouds();

// Add environment map
addEnvironmentMap();

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// Call this in your initialization function
initDragControls();

// Export everything needed
export { 
  scene, 
  camera, 
  renderer, 
  composer as renderComposer, 
  createEnhancedMaterial, 
  createGlowingMaterial,
  addEnvironmentMap,
  cameraRotation,
  cameraTilt,
  cameraOffset,
  isDragging
};
