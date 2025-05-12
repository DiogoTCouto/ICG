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
            'assets/Ground_texture.jpeg', // User specified path
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
function createTriangularColumnBody(columnSize, height /*, isUpsideDown ignored */) {
    const radius = columnSize / 2;
    // Cylinder’s Y-axis lines up with the mesh’s axis by default
    const shape = new CANNON.Cylinder(radius, radius, height, 3);
  
    const body = new CANNON.Body({ mass: 0, material: wallMaterial });
    body.addShape(shape);                // ← no quaternion
    body.position.set(0, 0, 0);
    body.type = CANNON.Body.STATIC;
    body.isTerrainPillar = true;
    return body;
  }
/**
 * Creates a simple lamppost mesh with a point light.
 */
function createLamppost(position) {
    const postHeight = 15.0;
    const postRadius = 0.40;
    const lightSize = 1;

    const lamppostGroup = new THREE.Group();

    // Post Mesh
    const postGeo = new THREE.CylinderGeometry(postRadius, postRadius, postHeight, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6, metalness: 0.4 });
    const postMesh = new THREE.Mesh(postGeo, postMat);
    postMesh.position.y = postHeight / 2; // Relative to group
    postMesh.castShadow = true;
    lamppostGroup.add(postMesh);

    // Light bulb Mesh
    const lightGeo = new THREE.SphereGeometry(lightSize, 16, 8);
    const lightMat = new THREE.MeshStandardMaterial({
        color: 0xffffee, emissive: 0xffffee, emissiveIntensity: 0.7,
        transparent: true, opacity: 0.9
     });
    const lightMesh = new THREE.Mesh(lightGeo, lightMat);
    lightMesh.position.y = postHeight + lightSize * 0.5; // Relative to group
    lamppostGroup.add(lightMesh);

    // THREE.js Point Light
    const pointLight = new THREE.PointLight(0xffd8a0, 2.5, 25, 1.5);
    pointLight.position.y = postHeight + lightSize * 0.5; // Relative to group
    pointLight.castShadow = false;
    lamppostGroup.add(pointLight);

    lamppostGroup.position.copy(position); // Set group's world position
    lamppostGroup.name = "Lamppost";
    lamppostGroup.isLevelObject = true;
    scene.add(lamppostGroup);

    // Physics Body for the Lamppost Post
    const postShape = new CANNON.Cylinder(postRadius, postRadius, postHeight, 8);
    const postBody = new CANNON.Body({
        mass: 0, // Static
        material: wallMaterial,
        shape: postShape
    });
    // Position the physics body at the center of the post in world coordinates
    // The lamppostGroup is at `position`. The postMesh is offset by `postHeight / 2` within the group.
    postBody.position.set(
        position.x,
        position.y + postHeight / 2, 
        position.z
    );
    // No rotation needed for a vertical cylinder if its local Y is up.
    world.addBody(postBody);

    return lamppostGroup;
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
  
    // 8) Add static lava platform
    // Calculate lava height and platform dimensions
    const heights = columnsArrayRef.map(c => c.height);
    const lavaY = Math.min(...heights) + 0.5;
    const xs = columnsArrayRef.map(c => c.x), zs = columnsArrayRef.map(c => c.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const platformWidth = maxX - minX + columnSize * 2;
    const platformDepth = maxZ - minZ + columnSize * 2;
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    // Static lava platform mesh
    const lavaTex = new THREE.TextureLoader().load('./assets/lavatile.jpg');
    lavaTex.wrapS = lavaTex.wrapT = THREE.RepeatWrapping;
    lavaTex.repeat.set(platformWidth / columnSize, platformDepth / columnSize);
    const lavaMat = new THREE.MeshStandardMaterial({ // New emissive material for bloom
        map: lavaTex,
        emissive: 0xff6600, // Orange-red emissive color
        emissiveIntensity: 0.8, // Reduced from 1.0
        emissiveMap: lavaTex // Use lava texture for emission areas
    });
    const lavaGeo = new THREE.PlaneGeometry(platformWidth, platformDepth);
    const lavaMesh = new THREE.Mesh(lavaGeo, lavaMat);
    lavaMesh.rotation.x = -Math.PI / 2;
    lavaMesh.position.set(centerX, lavaY, centerZ);
    lavaMesh.name = 'LavaPlatform'; lavaMesh.isLevelObject = true;
    scene.add(lavaMesh);

    // Remove lampposts from corners
    // const cornerOffsets = [
    //     [minX, lavaY, minZ], [minX, lavaY, maxZ],
    //     [maxX, lavaY, minZ], [maxX, lavaY, maxZ]
    // ];
    // cornerOffsets.forEach(([x, y, z]) => createLamppost(new THREE.Vector3(x, y, z)));

    // Add lampposts to random non-goal pillars
    const lamppostProbability = 0.1; // 10% chance for a lamppost on a pillar
    columnsArrayRef.forEach(pillar => {
        let isGoalPillar = false;
        if (goalData && pillar.x === goalData.x && pillar.z === goalData.z && pillar.height === goalData.height) {
            isGoalPillar = true;
        }

        if (!isGoalPillar && Math.random() < lamppostProbability) {
            const lamppostPosition = new THREE.Vector3(pillar.x, pillar.height, pillar.z);
            createLamppost(lamppostPosition);
        }
    });

    // — extra lights to brighten the pillars —
    // soft “sky” and “ground” ambient
    const hemi = new THREE.HemisphereLight(0x8888ff, 0x444422, 0.4);
    scene.add(hemi);

    // a gentle key light from above
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(20, 30, 10);
    dir.castShadow = true;
    scene.add(dir);


     // 9) Safety floor: place it a bit below the lava so the player can land/respawn
    //     This body is flagged isSafetyFloor, and your world collision listener
    //     will teleport the player when they hit it.
    const safetyY = lavaY - 30;        // tweak the offset as needed
    createSafetyFloor(safetyY);
    console.log("Level 2 ready with independent layout and lava!");
  }


// --- Need to copy or import these from terrain.js ---
// (addWater and createSafetyFloor functions remain the same as previous response)

function createSafetyFloor(yPosition) {
    // Expose the floor height for respawn checks:
    window.safetyFloorY = yPosition;
  
    const floorSize = 1000;
    const floorThickness = 1;
    const floorShape = new CANNON.Box(new CANNON.Vec3(
      floorSize/2, floorThickness/2, floorSize/2
    ));
    const floorBody = new CANNON.Body({ mass: 0, material: wallMaterial });
    floorBody.addShape(floorShape);
    floorBody.position.set(0, yPosition, 0);
    floorBody.isSafetyFloor = true;
    world.addBody(floorBody);
  
    const floorGeometry = new THREE.BoxGeometry(
      floorSize, floorThickness, floorSize
    );
    const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x050510 });
    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.position.set(0, yPosition, 0);
    floorMesh.isSafetyFloor = true;
    scene.add(floorMesh);
  }
