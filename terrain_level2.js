// terrain_level2.js
// Generates terrain for Level 2 (night theme with lampposts).
// Disabled shadow casting on lamppost lights to prevent WebGL errors.
import * as THREE from 'three';
import * as CANNON from 'cannon-es'; // Import CANNON for physics

import { scene, createGlowingMaterial } from './scene.js'; // Needs scene access
import { world, wallMaterial } from './physics.js';
import { createNoise2D } from 'https://unpkg.com/simplex-noise@4.0.1/dist/esm/simplex-noise.js';
import { setupGoalPillar, createGoalMarker } from './wincondition.js'; // Reuse win condition logic
import {
    initSpacedBlockyTerrain } from './terrain.js';                                           

/**
 * Creates the visual mesh for a triangular column.
 * Handles visual difference for the goal pillar.
 */

const lavaVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`;

const lavaFragmentShader = `
  uniform float uTime;
  uniform sampler2D uSampler;
  uniform sampler2D uNoiseSampler;
  varying vec2 vUv;

  void main() {
    // scale & scroll UVs over time
    vec2 p = vUv * 8.0;
    p.x += uTime * 0.05;

    // sample noise twice with time‐offset
    float n1 = texture2D( uNoiseSampler, p + vec2( uTime * 0.02, uTime * 0.02 ) ).r;
    float n2 = texture2D( uNoiseSampler, p - vec2( uTime * 0.02, uTime * 0.02 ) ).g;

    // combine noise to look up color ramp
    float f = n1 + n2;
    vec3 color = texture2D( uSampler, vec2( f, 0.0 ) ).rgb;

    gl_FragColor = vec4( color, 1.0 );
  }
`;

function createTriangularColumnMesh(columnSize, height, color, isUpsideDown = false, isGoal = false) {
    const radius = columnSize / 2;
    const radialSegments = 3;
    const geometry = new THREE.CylinderGeometry(radius, radius, height, radialSegments);

    if (isUpsideDown) {
        geometry.rotateY(Math.PI / 6);
    } else {
        geometry.rotateY(-Math.PI / 6);
    }

    let material;
    if (isGoal) {
        material = createGlowingMaterial(0x00ff00, 1.5); // Bright green glow
        material.emissiveIntensity = 1.0;
        console.log("Creating GOAL pillar mesh (Level 2).");
    } else {
        const textureLoader = new THREE.TextureLoader();
        // Use a variable to hold the material, assign texture map in callback
        let pillarMaterial = new THREE.MeshPhongMaterial({
            color: color, // Base color tint (can be dark)
            flatShading: true
        });
        const darkWoodTexture = textureLoader.load(
            'assets/wood_065.jpg', // User specified path
            (texture) => { // Success callback
                texture.encoding = THREE.sRGBEncoding;
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(1, height / columnSize);
                pillarMaterial.map = texture; // Assign texture map here
                pillarMaterial.needsUpdate = true; // Important!
            },
            undefined, // Progress callback (optional)
            (error) => { // Error callback
                console.error("Error loading dark wood texture (assets/wood_065.jpg):", error);
                // Fallback if texture fails (already created with base color)
                pillarMaterial.color.set(0x554433); // Dark brown fallback color
            }
        );
        material = pillarMaterial; // Assign the material reference
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.isTerrainPillar = true; // Mark for cleanup
    return mesh;
}

/**
 * Creates the physics body for a triangular column.
 */
function createTriangularColumnBody(columnSize, height, isUpsideDown = false) {
  const radius = columnSize / 2;
  const radialSegments = 3;
  const shape = new CANNON.Cylinder(radius, radius, height, radialSegments);

  const q = new CANNON.Quaternion();
  if (isUpsideDown) {
    q.setFromEuler(Math.PI * 0.5, 0, Math.PI / 6);
  } else {
    q.setFromEuler(Math.PI * 0.5, 0, -Math.PI / 6);
  }

  const body = new CANNON.Body({ mass: 0, material: wallMaterial });
  body.addShape(shape, new CANNON.Vec3(0, 0, 0), q);
  body.type = CANNON.Body.STATIC;
  body.isTerrainPillar = true; // Mark for cleanup
  return body;
}

/**
 * Creates a simple lamppost mesh with a point light.
 */
function createLamppost(position) {
    const postHeight = 3.5;
    const postRadius = 0.15;
    const lightSize = 0.4;

    const lamppostGroup = new THREE.Group();

    // Post
    const postGeo = new THREE.CylinderGeometry(postRadius, postRadius, postHeight, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6, metalness: 0.4 });
    const postMesh = new THREE.Mesh(postGeo, postMat);
    postMesh.position.y = postHeight / 2;
    postMesh.castShadow = true; // Post can cast shadow
    lamppostGroup.add(postMesh);

    // Light bulb
    const lightGeo = new THREE.SphereGeometry(lightSize, 16, 8);
    const lightMat = new THREE.MeshStandardMaterial({
        color: 0xffffee, emissive: 0xffffee, emissiveIntensity: 0.5,
        transparent: true, opacity: 0.9
     });
    const lightMesh = new THREE.Mesh(lightGeo, lightMat);
    lightMesh.position.y = postHeight + lightSize * 0.5;
    lamppostGroup.add(lightMesh);

    // THREE.js Point Light
    const pointLight = new THREE.PointLight(0xffd8a0, 2.5, 18, 1.5); // Color, Intensity, Distance, Decay
    pointLight.position.y = postHeight + lightSize * 0.5;

    // *** FIXED: Disable shadow casting for lamppost lights ***
    pointLight.castShadow = false; // Disable shadows to prevent uniform limit error

    lamppostGroup.add(pointLight);

    lamppostGroup.position.copy(position);
    lamppostGroup.name = "Lamppost";
    lamppostGroup.isLevelObject = true; // Mark for cleanup

    scene.add(lamppostGroup);
    return lamppostGroup;
}

let lavaMaterial = null;

function createLavaShaderPlane(y, spanX, spanZ) {
    // set up the three uniforms, pointing at your local files
    const uniforms = {
      uTime:        { value: 0 },
      uSampler:     { value: new THREE.TextureLoader().load('./assets/lavatile.jpg') },
      uNoiseSampler:{ value: new THREE.TextureLoader().load('./assets/lava_noise.png') }
    };
  
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader:   lavaVertexShader,
      fragmentShader: lavaFragmentShader,
      side:           THREE.DoubleSide
    });
  
    const geo  = new THREE.PlaneGeometry(spanX, spanZ);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    mesh.name = 'LavaShaderPlane';
    scene.add(mesh);
  
    return mat;
  }
// --- Level 2 Terrain Generation ---
// let terrainColumns = [];
let goalPillarData = null;
let lowestPoint = Infinity;
const noise2D = createNoise2D();

/**
 * initSpacedBlockyTerrainLevel2 - Creates terrain for Level 2.
 */




/**
 * initSpacedBlockyTerrainLevel2 - Night-mode copy of Level 1 layout,
 *                          with random lampposts for guidance.
 *
 * @param {Array}  columnsArrayRef    shared reference array (same as Level 1)
 * @param {number} rows               number of rows in the grid
 * @param {number} cols               number of columns in the grid
 * @param {number} columnSize         diameter of each pillar
 * @param {number} maxHeight          maximum pillar height
 * @param {number} spacing            spacing multiplier between pillars
 * @param {number} lamppostProbability  chance per pillar to spawn a lamppost
 */
export function initSpacedBlockyTerrainLevel2(
    columnsArrayRef,
    rows, cols,
    columnSize,
    maxHeight,
    spacing = 2
  ) {
    console.log("Initializing Level 2 Independent Terrain…");
  
    // 1) Clear any old pillar data
    columnsArrayRef.length = 0;

    // 2) Bring in a brand-new noise field
    const noise2D = createNoise2D();
  
    // 3) Switch to night if needed
    if (typeof window.toggleDayNight === 'function') {
      window.toggleDayNight();
    }
  
    // 4) Remove leftover water (flagged .isWater) or prior lava
    scene.children
      .filter(o => o.isWater === true || o.name === 'LavaShaderPlane')
      .forEach(o => scene.remove(o));
  
    // 5) Prepare your spacing & color parameters
    const width       = columnSize * spacing;
    const heightSpace = width * Math.sqrt(3) / 2;
    const buffer      = 4;
    const noiseScale  = 0.1;
    const heightScale = maxHeight * 0.7;
    const baseHeight  = maxHeight * 0.3;
    const lowColor    = new THREE.Color(0xbbbbbb);
    const midColor    = new THREE.Color(0xffffff);
    const highColor   = new THREE.Color(0x88aaff);
  
    // 6) Pillar loop (fresh, no Level 1 calls)
    for (let r = -buffer; r < rows + buffer; r++) {
      for (let c = -buffer; c < cols + buffer; c++) {
        for (let tri = 0; tri < 2; tri++) {
          const isUpsideDown = tri === 1;
          const x = c * width * 1.2 + (isUpsideDown ? width/2 : 0);
          const z = r * heightSpace * 1.2 + (isUpsideDown ? heightSpace/2 : 0);
  
          // sample noise → height
          const n = (noise2D(x*noiseScale, z*noiseScale) + 1) * 0.5;
          const h = n * heightScale + baseHeight;
  
          // blend color by height
          const t     = (h - baseHeight) / heightScale;
          const color = t < 0.5
            ? lowColor.clone().lerp(midColor, t*2)
            : midColor.clone().lerp(highColor, (t-0.5)*2);
  
          // create mesh + body
          const mesh = createTriangularColumnMesh(columnSize, h, color.getHex(), isUpsideDown, false);
          mesh.position.set(x, h/2, z);
          scene.add(mesh);
  
          const body = createTriangularColumnBody(columnSize, h, isUpsideDown);
          body.position.set(x, h/2, z);
          world.addBody(body);
  
          columnsArrayRef.push({ x, z, height: h, mesh, body });
        }
      }
    }
  
    // 7) Goal pillar setup
    const goalData = setupGoalPillar(columnsArrayRef);
    if (goalData) {
      scene.remove(goalData.mesh);
      const goalMesh = createTriangularColumnMesh(
        columnSize,
        goalData.height,
        0,
        goalData.isUpsideDown,
        true
      );
      goalMesh.position.copy(goalData.body.position);
      scene.add(goalMesh);

        const markerPos = new THREE.Vector3(
            goalData.x,
            goalData.height,
            goalData.z
            );
        createGoalMarker(markerPos, scene);

    }
  
    // 8) Add your lava plane
    const heights = columnsArrayRef.map(c => c.height);
    const lavaY   = Math.min(...heights) + 0.5;
    const spanX      = (cols + 2*buffer) * width * 1.2;
    const spanZ      = (rows + 2*buffer) * heightSpace * 1.2;
    lavaMaterial = createLavaShaderPlane(lavaY, spanX, spanZ);
  
    console.log("Level 2 ready with independent layout and lava!");
  }


// --- Need to copy or import these from terrain.js ---
// (addWater and createSafetyFloor functions remain the same as previous response)

function createSafetyFloor(yPosition) {
  const floorSize = 1000;
  const floorThickness = 1;
  const floorShape = new CANNON.Box(new CANNON.Vec3(floorSize/2, floorThickness/2, floorSize/2));
  const floorBody = new CANNON.Body({ mass: 0, material: wallMaterial });
  floorBody.addShape(floorShape);
  floorBody.position.set(0, yPosition, 0);
  floorBody.isSafetyFloor = true;
  world.addBody(floorBody);

  const floorGeometry = new THREE.BoxGeometry(floorSize, floorThickness, floorSize);
  const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x050510 });
  const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
  floorMesh.position.set(0, yPosition, 0);
  floorMesh.isSafetyFloor = true;
  scene.add(floorMesh);
}

export { lavaMaterial };
