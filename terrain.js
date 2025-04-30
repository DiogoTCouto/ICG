// terrain.js
import * as THREE from 'three'; // Import THREE namespace for Vector3 etc.
import * as CANNON from 'cannon-es'; // Import CANNON for physics
// Import scene and material functions (createGlowingMaterial is used for goal pillar mesh)
import { scene, createGlowingMaterial } from './scene.js';
import { world, wallMaterial } from './physics.js';
import { createNoise2D } from 'https://unpkg.com/simplex-noise@4.0.1/dist/esm/simplex-noise.js';
// *** ADDED: Import functions from the wincondition.js file ***
import { setupGoalPillar, createGoalMarker } from './wincondition.js';


// Create a 2D noise function for more natural-looking terrain
const noise2D = createNoise2D();

// Store terrain column data for collision detection and movement
const terrainColumns = [];
// *** MODIFIED: goalPillarData is now set after calling setupGoalPillar ***
let goalPillarData = null;

// Store the lowest points for water placement
let lowestPoint = Infinity;
let waterLevel = 0;
let waterMesh = null;

// *** REMOVED: createGoalMarker function (moved to wincondition.js) ***

/**
 * Creates the visual mesh for a triangular column.
 * Handles visual difference for the goal pillar.
 * @param {number} columnSize - Base size of the column.
 * @param {number} height - Height of the column.
 * @param {number} color - Hex color for the material (used if not goal).
 * @param {boolean} isUpsideDown - Orientation of the triangle.
 * @param {boolean} isGoal - Flag to indicate if this is the goal pillar.
 * @returns {THREE.Mesh} The created mesh.
 */
function createTriangularColumnMesh(columnSize, height, color, isUpsideDown = false, isGoal = false) {
    const radius = columnSize / 2;
    const radialSegments = 3;
    const geometry = new THREE.CylinderGeometry(radius, radius, height, radialSegments);

    // Rotate the VISUAL mesh only for the triangular appearance
    if (isUpsideDown) {
        geometry.rotateY(Math.PI / 6);
    } else {
        geometry.rotateY(-Math.PI / 6);
    }

    let material;
    if (isGoal) {
        // Use a glowing material for the goal pillar
        material = createGlowingMaterial(0x00ff00, 1.5); // Bright green glow
        material.emissiveIntensity = 1.0; // Make it visibly glow
        console.log("Creating GOAL pillar mesh."); // Log goal mesh creation
    } else {
        // Load dirt texture for regular pillars
        const textureLoader = new THREE.TextureLoader();
        // Use a variable to hold the material, assign texture map in callback
        let pillarMaterial = new THREE.MeshPhongMaterial({
            color: color, // Base color tint
            flatShading: true
        });
        const dirtTexture = textureLoader.load(
            'assets/wood_2.jpg', // Path relative to HTML file
            (texture) => {
                texture.encoding = THREE.sRGBEncoding;
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(1, height / columnSize);
                pillarMaterial.map = texture; // Assign texture map here
                pillarMaterial.needsUpdate = true; // Important!
            },
            undefined,
            (error) => {
                console.error("Error loading ground texture (assets/wood_2.jpg):", error);
                 // Fallback if texture fails
                pillarMaterial.color.set(0xaaaaaa); // Gray fallback color
            }
        );
         material = pillarMaterial; // Assign the material reference
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.isTerrainPillar = true; // Mark mesh for potential cleanup/identification
    return mesh;
}

/**
 * Creates the physics body for a triangular column.
 * @param {number} columnSize - Base size of the column.
 * @param {number} height - Height of the column.
 * @param {boolean} isUpsideDown - Orientation of the triangle (IGNORED for physics shape).
 * @returns {CANNON.Body} The created physics body.
 */
function createTriangularColumnBody(columnSize, height, isUpsideDown = false) {
  const radius = columnSize / 2;
  const radialSegments = 3; // Number of segments for physics cylinder (can be higher for better approximation if needed)

  // Create a standard CANNON.Cylinder shape. Its height axis is Y by default.
  const shape = new CANNON.Cylinder(radius, radius, height, radialSegments);

  const body = new CANNON.Body({ mass: 0, material: wallMaterial });

  // *** FIXED: Add the shape WITHOUT the incorrect quaternion rotation ***
  // The default Y-axis orientation of the CANNON.Cylinder matches the THREE.CylinderGeometry
  body.addShape(shape); // Add shape at the body's origin (0,0,0) with default orientation

  body.type = CANNON.Body.STATIC;
  body.isTerrainPillar = true; // *** Standardized flag for identifying terrain ***

  return body;
}

/**
 * initBlockyTerrain - Creates a terrain of perfectly tessellated triangular columns
 * (This function remains unchanged from the previous version)
 * @param {number} rows - Number of rows in the grid
 * @param {number} cols - Number of columns in the grid
 * @param {number} columnSize - Size of each column
 * @param {number} maxHeight - Maximum height of columns
 */
export function initBlockyTerrain(rows, cols, columnSize, maxHeight) {
    // Clear previous terrain data
    terrainColumns.length = 0;
    goalPillarData = null; // Reset goal pillar info

    // Reset lowest point tracking
    lowestPoint = Infinity;

    const noiseScale = 0.1;
    const heightScale = maxHeight * 0.7;
    const baseHeight = maxHeight * 0.3;
    const lowColor = new THREE.Color(0xbbbbbb);
    const midColor = new THREE.Color(0xffffff);
    const highColor = new THREE.Color(0x88aaff);
    const width = columnSize;
    const heightSpacing = width * Math.sqrt(3) / 2;
    const xOffset = width / 2;
    const zOffset = heightSpacing / 2;
    const bufferSize = 4;

    // --- Main Pillar Creation Loop ---
    for (let row = -bufferSize; row < rows + bufferSize; row++) {
        for (let col = -bufferSize; col < cols + bufferSize; col++) {
            const xPos = col * width;
            const zPos = row * heightSpacing;

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

                // Create mesh initially as non-goal
                const mesh = createTriangularColumnMesh(columnSize, columnHeight, color.getHex(), isUpsideDown, false);
                // Position mesh centered vertically
                mesh.position.set(triangleX, columnHeight * 0.5, triangleZ);
                scene.add(mesh);

                // Create physics body
                const body = createTriangularColumnBody(columnSize, columnHeight, isUpsideDown);
                 // Position physics body centered vertically (matches mesh)
                body.position.set(triangleX, columnHeight * 0.5, triangleZ);
                world.addBody(body);

                // Store column data
                terrainColumns.push({
                    x: triangleX, z: triangleZ, height: columnHeight,
                    radius: columnSize / 2, isUpsideDown: isUpsideDown,
                    mesh: mesh, body: body // Ensure body is stored
                });
            }
        }
    }
    // --- End Pillar Creation Loop ---

    // *** Setup Goal Pillar using wincondition.js ***
    const designatedGoalData = setupGoalPillar(terrainColumns); // Mark the body

    if (designatedGoalData) {
        // Now update the visual mesh and add the marker
        scene.remove(designatedGoalData.mesh); // Remove original mesh

        // Create the new glowing mesh
        const newGoalMesh = createTriangularColumnMesh(
            columnSize,
            designatedGoalData.height,
            0, // Color doesn't matter for goal mesh
            designatedGoalData.isUpsideDown,
            true // Explicitly true
        );
        newGoalMesh.position.copy(designatedGoalData.body.position);
        scene.add(newGoalMesh);

        // Update the mesh reference in our stored data
        designatedGoalData.mesh = newGoalMesh;

        // Create the marker above the pillar
        const markerPosition = new THREE.Vector3(
            designatedGoalData.x,
            designatedGoalData.height, // Position marker at the top surface
            designatedGoalData.z
        );
        createGoalMarker(markerPosition, scene); // Create marker using the function from wincondition.js

        // Store final goal data reference (optional, but can be useful)
        goalPillarData = {
            mesh: newGoalMesh,
            body: designatedGoalData.body,
            position: markerPosition // Store top position
        };
        console.log("Goal pillar visuals updated and marker created.");
    } else {
        console.warn("Could not designate or update goal pillar visuals.");
    }
    // *** END Goal Setup ***

    createSafetyFloor(-30);
    waterLevel = lowestPoint + 0.5;
    // Calculate water size based on the actual span of the generated terrain
    const terrainSpanX = (cols + 2 * bufferSize) * width;
    const terrainSpanZ = (rows + 2 * bufferSize) * heightSpacing;
    const waterSize = Math.max(terrainSpanX, terrainSpanZ) * 1.2; // Make water slightly larger than terrain span
    addWater(waterLevel, waterSize);
}


// *** REPLACED FUNCTION with user's version + win condition integration ***
/**
 * initSpacedBlockyTerrain - Creates terrain with increased spacing between pillars
 * @param {number} rows - Number of rows in the grid
 * @param {number} cols - Number of columns in the grid
 * @param {number} columnSize - Size of each column
 * @param {number} maxHeight - Maximum height of columns
 * @param {number} spacing - Additional spacing between columns (User's parameter name)
 */
export function initSpacedBlockyTerrain(rows, cols, columnSize, maxHeight, spacing = 2) { // Using user's parameter name 'spacing'
    // Clear previous terrain data
    terrainColumns.length = 0;
    goalPillarData = null; // Reset goal pillar info

    // Reset lowest point tracking
    lowestPoint = Infinity;

    // Use simplex noise to generate more natural terrain
    const noiseScale = 0.1; // Controls how smooth/jagged the terrain is
    const heightScale = maxHeight * 0.7; // Scale factor for height
    const baseHeight = maxHeight * 0.3; // Minimum height

    // Colors for gradient based on height
    const lowColor = new THREE.Color(0xbbbbbb);  // Gray for low areas
    const midColor = new THREE.Color(0xffffff);  // White for mid areas
    const highColor = new THREE.Color(0x88aaff); // Light blue for high areas

    // Calculate spacing for a proper triangular tessellation with additional space (User's logic)
    const width = columnSize * spacing; // User's width calculation
    const heightSpacing = width * Math.sqrt(3) / 2; // User's height spacing calculation (renamed from 'height' to avoid conflict)

    // Calculate the x and z offsets for tessellation
    const xOffset = width / 2;
    const zOffset = heightSpacing / 2; // Use renamed variable

    // Create a grid with buffer around edges
    const bufferSize = 4;

    // --- Main Pillar Creation Loop (using user's spacing logic) ---
    for (let row = -bufferSize; row < rows + bufferSize; row++) {
        for (let col = -bufferSize; col < cols + bufferSize; col++) {
            // Calculate positions with increased spacing (User's logic with multiplier)
            const xPos = col * width * 1.2; // User's xPos calculation
            const zPos = row * heightSpacing * 1.2; // User's zPos calculation (using renamed variable)

            // Create both triangles for each grid cell
            for (let triangleType = 0; triangleType < 2; triangleType++) {
                const isUpsideDown = triangleType === 1;

                // Calculate exact position based on triangle type
                let triangleX = xPos;
                let triangleZ = zPos;

                if (isUpsideDown) {
                    triangleX += xOffset;
                    triangleZ += zOffset;
                }

                // Use noise to generate height
                const noiseValue = noise2D(triangleX * noiseScale, triangleZ * noiseScale);
                const normalizedNoise = (noiseValue + 1) * 0.5; // Convert from [-1,1] to [0,1]
                const columnHeight = normalizedNoise * heightScale + baseHeight;

                // Track lowest point for water placement
                lowestPoint = Math.min(lowestPoint, columnHeight);

                // Calculate color based on height - mix between three colors for better gradient
                const heightRatio = (columnHeight - baseHeight) / heightScale;
                let color;
                if (heightRatio < 0.5) {
                    // Mix between low and mid colors
                    color = lowColor.clone().lerp(midColor, heightRatio * 2);
                } else {
                    // Mix between mid and high colors
                    color = midColor.clone().lerp(highColor, (heightRatio - 0.5) * 2);
                }

                // Create mesh initially as non-goal
                const mesh = createTriangularColumnMesh(columnSize, columnHeight, color.getHex(), isUpsideDown, false);
                mesh.position.set(triangleX, columnHeight * 0.5, triangleZ);
                scene.add(mesh);

                // Create physics body
                const body = createTriangularColumnBody(columnSize, columnHeight, isUpsideDown);
                body.position.set(triangleX, columnHeight * 0.5, triangleZ);
                world.addBody(body);
                // body.isTerrain = true; // *** REMOVED - Using isTerrainPillar now ***

                // Store column data, ensuring body is included
                terrainColumns.push({
                    x: triangleX,
                    z: triangleZ,
                    height: columnHeight,
                    radius: columnSize / 2,
                    isUpsideDown: isUpsideDown,
                    mesh: mesh, // Store mesh reference
                    body: body  // *** Ensure body is stored ***
                });
            }
        }
    }
    // --- End Pillar Creation Loop ---

    // *** Setup Goal Pillar using wincondition.js ***
    const designatedGoalData = setupGoalPillar(terrainColumns); // Mark the body

    if (designatedGoalData) {
        // Now update the visual mesh and add the marker
        scene.remove(designatedGoalData.mesh); // Remove original mesh

        // Create the new glowing mesh
        const newGoalMesh = createTriangularColumnMesh(
            columnSize,
            designatedGoalData.height,
            0, // Color doesn't matter for goal mesh
            designatedGoalData.isUpsideDown,
            true // Explicitly true
        );
        newGoalMesh.position.copy(designatedGoalData.body.position);
        scene.add(newGoalMesh);

        // Update the mesh reference in our stored data
        designatedGoalData.mesh = newGoalMesh;

        // Create the marker above the pillar
        const markerPosition = new THREE.Vector3(
            designatedGoalData.x,
            designatedGoalData.height, // Position marker at the top surface
            designatedGoalData.z
        );
        createGoalMarker(markerPosition, scene); // Create marker using the function from wincondition.js

        // Store final goal data reference (optional, but can be useful)
        goalPillarData = {
            mesh: newGoalMesh,
            body: designatedGoalData.body,
            position: markerPosition // Store top position
        };
        console.log("Goal pillar visuals updated and marker created (Spaced Terrain).");
    } else {
        console.warn("Could not designate or update goal pillar visuals (Spaced Terrain).");
    }
    // *** END Goal Setup ***

    createSafetyFloor(-30);
    waterLevel = lowestPoint + 1.0; // Adjust water level if needed for spacing
    // Calculate water size based on the actual span of the generated terrain
    const terrainSpanX = (cols + 2 * bufferSize) * width * 1.2; // Approximate span using user's logic
    const terrainSpanZ = (rows + 2 * bufferSize) * heightSpacing * 1.2; // Approximate span using user's logic
    const waterSize = Math.max(terrainSpanX, terrainSpanZ) * 1.2; // Make water slightly larger than terrain span
    addWater(waterLevel, waterSize);
}
// *** END REPLACED FUNCTION ***


/**
 * addWater - Creates a water plane at specified height
 * (Function remains the same, ensure texture path is correct)
 */
function addWater(waterHeight, waterSize) {
    if (waterMesh) {
        scene.remove(waterMesh);
        if (waterMesh.geometry) waterMesh.geometry.dispose();
        if (waterMesh.material) waterMesh.material.dispose();
        waterMesh = null;
    }

    const waterGeometry = new THREE.PlaneGeometry(waterSize, waterSize, 32, 32);
    waterGeometry.rotateX(-Math.PI / 2);

    const textureLoader = new THREE.TextureLoader();
    const waterTexture = textureLoader.load(
        'assets/water1.jpg', // Ensure this path is correct relative to HTML
        (texture) => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(waterSize / 20, waterSize / 20); // Adjust repeat based on size
        },
        undefined,
        (error) => {
            console.error("Error loading water texture:", error);
             if (!waterMesh) {
                 waterMesh = new THREE.Mesh(waterGeometry);
                 scene.add(waterMesh);
             }
            waterMesh.material = new THREE.MeshPhongMaterial({
                color: 0x3366ff, transparent: true, opacity: 0.8,
                specular: 0x111111, shininess: 50, side: THREE.DoubleSide
            });
        }
    );

    const waterMaterial = new THREE.MeshPhongMaterial({
        color: 0x3366ff, map: waterTexture, transparent: true, opacity: 0.8,
        specular: 0x6699ff, shininess: 100, side: THREE.DoubleSide,
        envMap: scene.environment, reflectivity: 0.3
    });

    waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.position.y = waterHeight;
    waterMesh.isWater = true; // Mark water mesh
    scene.add(waterMesh);
    startWaterAnimation(waterMesh);
}

/**
 * startWaterAnimation - Animates the water surface
 * (Function remains the same)
 */
function startWaterAnimation(waterMesh) {
    const geometry = waterMesh.geometry;
    if (!geometry.attributes.position) return;
    const vertexCount = geometry.attributes.position.count;
    const positions = geometry.attributes.position.array;
    const originalPositions = positions.slice();
    const amplitude = 0.15;
    const frequency = 0.1;
    const timeScale = 0.4;
    let animationFrameId = null;

    function animateWater() {
        if (!waterMesh || !waterMesh.parent) {
             if (animationFrameId) cancelAnimationFrame(animationFrameId);
             return;
        }
        const time = performance.now() * 0.001 * timeScale;
        for (let i = 0; i < vertexCount; i++) {
            const x = originalPositions[i * 3];
            const z = originalPositions[i * 3 + 2];
            positions[i * 3 + 1] = originalPositions[i * 3 + 1] +
                amplitude * Math.sin(x * frequency + time) *
                Math.cos(z * frequency + time * 0.5);
        }
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
        animationFrameId = requestAnimationFrame(animateWater);
    }
    animateWater();
}


/**
 * createSafetyFloor - Creates a flat floor below the terrain
 * (Function remains the same)
 */
function createSafetyFloor(yPosition) {
  const floorSize = 1000;
  const floorThickness = 1;
  const floorShape = new CANNON.Box(new CANNON.Vec3(floorSize/2, floorThickness/2, floorSize/2));
  const floorBody = new CANNON.Body({ mass: 0, material: wallMaterial });
  floorBody.addShape(floorShape);
  floorBody.position.set(0, yPosition, 0);
  floorBody.isSafetyFloor = true; // Mark floor body
  world.addBody(floorBody);
  const floorGeometry = new THREE.BoxGeometry(floorSize, floorThickness, floorSize);
  const floorMaterial = new THREE.MeshBasicMaterial({
    color: 0x1a1a2a, transparent: true, opacity: 0.5
  });
  const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
  floorMesh.position.set(0, yPosition, 0);
  floorMesh.isSafetyFloor = true; // Mark floor mesh
  scene.add(floorMesh);
}

/**
 * updateWater - Updates the water animation (can be called in animate loop)
 * (Function remains the same)
 */
export function updateWater(deltaTime) {
  // Main animation is handled by startWaterAnimation's requestAnimationFrame loop
}

/**
 * findNearestColumn - Find the nearest column to a position
 * (Function remains the same)
 */
export function findNearestColumn(x, z) {
  if (terrainColumns.length === 0) return null;
  let nearestColumn = null;
  let minDistanceSq = Infinity;
  for (const column of terrainColumns) {
    const dx = column.x - x;
    const dz = column.z - z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < minDistanceSq) {
      minDistanceSq = distanceSq;
      nearestColumn = column;
    }
  }
  return nearestColumn;
}

/**
 * findJumpableColumns - Find columns within jumping distance
 * (Function remains the same)
 */
export function findJumpableColumns(x, z, maxDistance, maxHeightDiff) {
  const currentColumn = findNearestColumn(x, z);
  if (!currentColumn) return [];
  const maxDistanceSq = maxDistance * maxDistance;
  return terrainColumns.filter(column => {
    if (column === currentColumn) return false;
    const dx = column.x - x;
    const dz = column.z - z;
    const distanceSq = dx * dx + dz * dz;
    const heightDiff = Math.abs(column.height - currentColumn.height);
    return distanceSq <= maxDistanceSq && heightDiff <= maxHeightDiff;
  });
}

// Keep original functions for compatibility if they exist
export function initTerrain() {
    console.warn("initTerrain() called, but initBlockyTerrain() or initSpacedBlockyTerrain() is recommended.");
    initSpacedBlockyTerrain(10, 10, 3, 18); // Fallback to spaced terrain
}

// Export terrain columns and water-related functions
export { terrainColumns, waterLevel, goalPillarData };
