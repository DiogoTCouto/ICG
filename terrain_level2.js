// terrain_level2.js
// Generates terrain for Level 2 (night theme with lampposts).
// Disabled shadow casting on lamppost lights to prevent WebGL errors.
import * as THREE from 'three';
import { scene, createGlowingMaterial } from './scene.js'; // Needs scene access
import { world, wallMaterial } from './physics.js';
import { createNoise2D } from 'https://unpkg.com/simplex-noise@4.0.1/dist/esm/simplex-noise.js';
import { setupGoalPillar, createGoalMarker } from './wincondition.js'; // Reuse win condition logic

// --- Reused Helper Functions (Copied from terrain.js) ---

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


// --- Level 2 Terrain Generation ---
let terrainColumns = [];
let goalPillarData = null;
let lowestPoint = Infinity;
const noise2D = createNoise2D();

/**
 * initSpacedBlockyTerrainLevel2 - Creates terrain for Level 2.
 */
export function initSpacedBlockyTerrainLevel2(columnsArrayRef, rows, cols, columnSize, maxHeight, spacing = 2, lamppostProbability = 0.05) { // Reduced lamppost probability further
    columnsArrayRef.length = 0;
    terrainColumns = columnsArrayRef;
    goalPillarData = null;
    lowestPoint = Infinity;

    console.log("Initializing Level 2 Terrain...");

    const noiseScale = 0.12;
    const heightScale = maxHeight * 0.8;
    const baseHeight = maxHeight * 0.2;
    const lowColor = new THREE.Color(0x404050);
    const midColor = new THREE.Color(0x606070);
    const highColor = new THREE.Color(0x707090);
    const width = columnSize * spacing;
    const heightSpacing = width * Math.sqrt(3) / 2;
    const xOffset = width / 2;
    const zOffset = heightSpacing / 2;
    const bufferSize = 4;

    // --- Pillar Creation Loop ---
    for (let row = -bufferSize; row < rows + bufferSize; row++) {
        for (let col = -bufferSize; col < cols + bufferSize; col++) {
            const xPos = col * width * 1.2;
            const zPos = row * heightSpacing * 1.2;

            for (let triangleType = 0; triangleType < 2; triangleType++) {
                const isUpsideDown = triangleType === 1;
                let triangleX = xPos;
                let triangleZ = zPos;
                if (isUpsideDown) {
                    triangleX += xOffset;
                    triangleZ += zOffset;
                }

                const noiseValue = noise2D(triangleX * noiseScale, triangleZ * noiseScale);
                const normalizedNoise = (noiseValue + 1) * 0.5;
                const columnHeight = normalizedNoise * heightScale + baseHeight;
                lowestPoint = Math.min(lowestPoint, columnHeight);

                const heightRatio = (columnHeight - baseHeight) / heightScale;
                let color;
                if (heightRatio < 0.5) {
                    color = lowColor.clone().lerp(midColor, heightRatio * 2);
                } else {
                    color = midColor.clone().lerp(highColor, (heightRatio - 0.5) * 2);
                }

                const mesh = createTriangularColumnMesh(columnSize, columnHeight, color.getHex(), isUpsideDown, false);
                mesh.position.set(triangleX, columnHeight * 0.5, triangleZ);
                scene.add(mesh);

                const body = createTriangularColumnBody(columnSize, columnHeight, isUpsideDown);
                body.position.set(triangleX, columnHeight * 0.5, triangleZ);
                world.addBody(body);

                const columnData = {
                    x: triangleX, z: triangleZ, height: columnHeight,
                    radius: columnSize / 2, isUpsideDown: isUpsideDown,
                    mesh: mesh, body: body
                };
                terrainColumns.push(columnData);

                // Add Lamppost?
                const isEdgeArea = Math.abs(row) < 1 || Math.abs(col) < 1 || row >= rows - 1 || col >= cols - 1;
                // Add lamppost only if pillar is reasonably high
                if (!isEdgeArea && columnHeight > baseHeight + heightScale * 0.3 && Math.random() < lamppostProbability) {
                    const lamppostPosition = new THREE.Vector3(triangleX, columnHeight, triangleZ);
                    createLamppost(lamppostPosition);
                }
            }
        }
    }
    // --- End Pillar Creation Loop ---

    // Setup Goal Pillar
    const designatedGoalData = setupGoalPillar(terrainColumns);
    if (designatedGoalData) {
        scene.remove(designatedGoalData.mesh);
        const newGoalMesh = createTriangularColumnMesh(
            columnSize, designatedGoalData.height, 0, designatedGoalData.isUpsideDown, true
        );
        newGoalMesh.position.copy(designatedGoalData.body.position);
        scene.add(newGoalMesh);
        designatedGoalData.mesh = newGoalMesh;

        const markerPosition = new THREE.Vector3(designatedGoalData.x, designatedGoalData.height, designatedGoalData.z);
        createGoalMarker(markerPosition, scene);

        goalPillarData = {
            mesh: newGoalMesh, body: designatedGoalData.body, position: markerPosition
        };
        console.log("Level 2 Goal pillar visuals updated and marker created.");
    } else {
        console.warn("Could not designate Level 2 goal pillar.");
    }

    // Add safety floor and water
    const safetyFloorY = -40;
    createSafetyFloor(safetyFloorY);

    const waterLevel = lowestPoint + 0.2;
    const terrainSpanX = (cols + 2 * bufferSize) * width * 1.2;
    const terrainSpanZ = (rows + 2 * bufferSize) * heightSpacing * 1.2;
    const waterSize = Math.max(terrainSpanX, terrainSpanZ) * 1.2;
    addWater(waterLevel, waterSize);

    console.log("Level 2 Terrain Initialized.");
}


// --- Need to copy or import these from terrain.js ---
// (addWater and createSafetyFloor functions remain the same as previous response)
function addWater(waterHeight, waterSize) {
    const waterGeometry = new THREE.PlaneGeometry(waterSize, waterSize, 16, 16);
    waterGeometry.rotateX(-Math.PI / 2);
    const waterMaterial = new THREE.MeshPhongMaterial({
        color: 0x101025, transparent: true, opacity: 0.7,
        specular: 0x333355, shininess: 40, side: THREE.DoubleSide,
    });
    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.position.y = waterHeight;
    waterMesh.isWater = true;
    scene.add(waterMesh);
}
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