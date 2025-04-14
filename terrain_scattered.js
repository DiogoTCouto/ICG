// terrain_scattered.js
// This version includes more spacing between pillars and a designated goal pillar.
// Goal marker height increased significantly.
import * as THREE from 'three'; // Import THREE namespace for Vector3 etc.
import { scene, createGlowingMaterial } from './scene.js'; // Import scene and createGlowingMaterial
import { world, wallMaterial } from './physics.js';
import { createNoise2D } from 'https://unpkg.com/simplex-noise@4.0.1/dist/esm/simplex-noise.js';

// Create a 2D noise function for more natural-looking terrain
const noise2D = createNoise2D();

// Store terrain column data for collision detection and movement
const terrainColumns = [];
let goalPillarData = null; // To store info about the goal pillar { mesh, body, position }

// Store the lowest points for water placement
let lowestPoint = Infinity;
let waterLevel = 0;
let waterMesh = null;

// --- Helper Functions for Pillar Creation ---

/**
 * Creates the visual mesh for a triangular column.
 * @param {number} columnSize - Base size of the column.
 * @param {number} height - Height of the column.
 * @param {number} color - Hex color for the material.
 * @param {boolean} isUpsideDown - Orientation of the triangle.
 * @param {boolean} isGoal - Flag to indicate if this is the goal pillar.
 * @returns {THREE.Mesh} The created mesh.
 */
function createTriangularColumnMesh(columnSize, height, color, isUpsideDown = false, isGoal = false) {
    // Use a triangular prism (hexagonal cylinder with 3 sides)
    const radius = columnSize / 2;
    const radialSegments = 3;

    const geometry = new THREE.CylinderGeometry(radius, radius, height, radialSegments);

    // Rotate differently based on triangle orientation
    if (isUpsideDown) {
        geometry.rotateY(Math.PI / 6); // Rotate "upside-down" triangles
    } else {
        geometry.rotateY(-Math.PI / 6); // Rotate standard triangles
    }

    let material;
    if (isGoal) {
        // Use a glowing material for the goal pillar
        material = createGlowingMaterial(0x00ff00, 1.5); // Bright green glow
        material.emissiveIntensity = 1.0; // Make it visibly glow
    } else {
        // Load dirt texture for regular pillars
        const textureLoader = new THREE.TextureLoader();
        const dirtTexture = textureLoader.load(
            'ICG/assets/Ground_texture.jpeg',
            (texture) => {
                // console.log("Ground texture loaded successfully."); // Optional log
                texture.encoding = THREE.sRGBEncoding;
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(1, height / columnSize); // Adjust texture repeat based on height
            },
            undefined,
            (error) => {
                console.error("Error loading ground texture:", error);
            }
        );

        material = new THREE.MeshPhongMaterial({
            color: color,
            map: dirtTexture,
            flatShading: true // Add flat shading for more distinct triangles
        });
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true; // Pillars should cast shadows
    mesh.receiveShadow = true; // Pillars can receive shadows
    return mesh;
}

/**
 * Creates the physics body for a triangular column.
 * @param {number} columnSize - Base size of the column.
 * @param {number} height - Height of the column.
 * @param {boolean} isUpsideDown - Orientation of the triangle.
 * @returns {CANNON.Body} The created physics body.
 */
function createTriangularColumnBody(columnSize, height, isUpsideDown = false) {
    const radius = columnSize / 2;
    const radialSegments = 3;

    // Use a Cylinder shape for physics approximation
    const shape = new CANNON.Cylinder(radius, radius, height, radialSegments);

    // Y up + rotate to align with the mesh
    const q = new CANNON.Quaternion();
    if (isUpsideDown) {
        q.setFromEuler(Math.PI * 0.5, 0, Math.PI / 6);
    } else {
        q.setFromEuler(Math.PI * 0.5, 0, -Math.PI / 6);
    }

    const body = new CANNON.Body({ mass: 0, material: wallMaterial }); // Static pillars
    body.addShape(shape, new CANNON.Vec3(0, 0, 0), q);
    body.type = CANNON.Body.STATIC;
    body.isTerrain = true; // Mark terrain bodies for collision detection

    return body;
}

/**
 * Creates a simple visual marker for the goal pillar.
 * @param {THREE.Vector3} position - The position to place the marker (usually top of goal pillar).
 * @returns {THREE.Mesh} The marker mesh.
 */
function createGoalMarker(position) {
    // *** Increased marker height ***
    const markerHeight = 20; // Height of the marker beam (increased from 5)
    const markerRadius = 0.4; // Slightly thicker radius
    const geometry = new THREE.CylinderGeometry(markerRadius, markerRadius, markerHeight, 16);
    // Use a bright, unlit material that's always visible
    const material = new THREE.MeshBasicMaterial({
        color: 0xffff00, // Bright yellow
        transparent: true,
        opacity: 0.9, // Slightly less transparent
        depthWrite: false // Render on top of other things slightly
    });
    const marker = new THREE.Mesh(geometry, material);
    // Position it slightly above the pillar's top center
    marker.position.copy(position);
    marker.position.y += markerHeight / 2 + 0.1; // Place base slightly above pillar top
    marker.name = "GoalMarker"; // Name for identification if needed
    scene.add(marker);
    return marker;
}


// --- Terrain Generation Functions ---

/**
 * initSpacedBlockyTerrain - Creates terrain with increased spacing and a designated goal pillar.
 * @param {number} rows - Number of rows in the grid.
 * @param {number} cols - Number of columns in the grid.
 * @param {number} columnSize - Size of each column base.
 * @param {number} maxHeight - Maximum height variation of columns.
 * @param {number} spacingFactor - Multiplier for spacing (e.g., 1.5 = 50% more space). Default: 1.8
 */
export function initSpacedBlockyTerrain(rows, cols, columnSize, maxHeight, spacingFactor = 1.8) {
    // Clear previous terrain data
    terrainColumns.length = 0;
    goalPillarData = null; // Reset goal pillar

    // Reset lowest point tracking
    lowestPoint = Infinity;

    // Use simplex noise to generate more natural terrain
    const noiseScale = 0.08; // Slightly adjusted noise scale
    const heightScale = maxHeight * 0.7; // Scale factor for height
    const baseHeight = maxHeight * 0.3; // Minimum height

    // Colors for gradient based on height
    const lowColor = new THREE.Color(0xbbbbbb);  // Gray for low areas
    const midColor = new THREE.Color(0xffffff);  // White for mid areas
    const highColor = new THREE.Color(0x88aaff); // Light blue for high areas

    // Calculate spacing for a proper triangular tessellation with additional space
    const baseWidth = columnSize * spacingFactor;
    const baseHeightSpacing = baseWidth * Math.sqrt(3) / 2; // Triangle height for spacing

    // Calculate the x and z offsets for tessellation
    const xOffset = baseWidth / 2;
    const zOffset = baseHeightSpacing / 2;

    // Create a grid
    const bufferSize = 2;

    // Determine goal pillar coordinates
    const goalRow = rows - 1 - bufferSize;
    const goalCol = cols - 1 - bufferSize;
    let goalPillarIndex = -1;
    let currentPillarIndex = 0;

    console.log(`Attempting to place goal near row ${goalRow}, col ${goalCol}`);

    // Loop through rows and columns to create triangular grid
    for (let row = -bufferSize; row < rows + bufferSize; row++) {
        for (let col = -bufferSize; col < cols + bufferSize; col++) {
            // Calculate base positions with increased spacing
            const xPos = col * baseWidth;
            const zPos = row * baseHeightSpacing;

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
                const normalizedNoise = (noiseValue + 1) * 0.5;
                const columnHeight = normalizedNoise * heightScale + baseHeight;

                // Track lowest point for water placement
                lowestPoint = Math.min(lowestPoint, columnHeight);

                // Calculate color based on height
                const heightRatio = (columnHeight - baseHeight) / heightScale;
                let color;
                if (heightRatio < 0.5) {
                    color = lowColor.clone().lerp(midColor, heightRatio * 2);
                } else {
                    color = midColor.clone().lerp(highColor, (heightRatio - 0.5) * 2);
                }

                // Check if this pillar should be the goal pillar
                const isDesignatedGoal = (row === goalRow && col === goalCol && triangleType === 0);
                if (isDesignatedGoal) {
                    goalPillarIndex = currentPillarIndex;
                    console.log(`Designated Goal Pillar at index ${goalPillarIndex} (Row: ${row}, Col: ${col})`);
                }

                // Create mesh (pass isGoal flag)
                const mesh = createTriangularColumnMesh(columnSize, columnHeight, color.getHex(), isUpsideDown, isDesignatedGoal);
                mesh.position.set(triangleX, columnHeight * 0.5, triangleZ);
                scene.add(mesh);

                // Create physics body
                const body = createTriangularColumnBody(columnSize, columnHeight, isUpsideDown);
                body.position.set(triangleX, columnHeight * 0.5, triangleZ);
                world.addBody(body);

                // Store column data
                terrainColumns.push({
                    x: triangleX,
                    z: triangleZ,
                    height: columnHeight,
                    radius: columnSize / 2,
                    isUpsideDown: isUpsideDown,
                    mesh: mesh,
                    body: body
                });

                currentPillarIndex++;
            }
        }
    }

    // After generating all pillars, finalize the goal pillar
    if (goalPillarIndex !== -1 && goalPillarIndex < terrainColumns.length) {
        const goalData = terrainColumns[goalPillarIndex];
        goalPillarData = {
            mesh: goalData.mesh,
            body: goalData.body,
            position: new THREE.Vector3(goalData.x, goalData.height, goalData.z)
        };
        // Add a visual marker on top of the goal pillar
        const markerPosition = new THREE.Vector3(goalData.x, goalData.height / 2, goalData.z);
        markerPosition.y += goalData.height / 2;
        createGoalMarker(markerPosition);
        console.log("Goal Pillar successfully created and marked.");
    } else {
        console.warn("Could not designate a goal pillar. Check goalRow/goalCol logic.");
        // Fallback: Designate the last pillar as the goal
        if (terrainColumns.length > 0) {
             const lastPillarIndex = terrainColumns.length - 1;
             const goalData = terrainColumns[lastPillarIndex];
             goalPillarData = {
                 mesh: goalData.mesh, // Placeholder, will be replaced
                 body: goalData.body,
                 position: new THREE.Vector3(goalData.x, goalData.height, goalData.z)
             };
             // Remake the last pillar's mesh with goal material and add marker
             scene.remove(goalData.mesh); // Remove old mesh
             const newGoalMesh = createTriangularColumnMesh(columnSize, goalData.height, 0, goalData.isUpsideDown, true);
             newGoalMesh.position.copy(goalData.body.position);
             scene.add(newGoalMesh);
             goalData.mesh = newGoalMesh; // Update reference in terrainColumns
             goalPillarData.mesh = newGoalMesh; // Update reference in goalPillarData

             const markerPosition = new THREE.Vector3(goalData.x, goalData.height, goalData.z);
             createGoalMarker(markerPosition);
             console.log("Designated the last pillar as the goal pillar as fallback.");
        }
    }

    // Add safety floor
    createSafetyFloor(-30);

    // Calculate water level
    waterLevel = lowestPoint + 1.0;

    // Add water plane
    const terrainSpan = Math.max(rows, cols) * baseWidth;
    addWater(waterLevel, terrainSpan * 1.5);
}


/**
 * addWater - Creates a water plane at specified height
 * @param {number} waterHeight - Water surface height
 * @param {number} waterSize - Diameter of the water plane
 */
function addWater(waterHeight, waterSize) {
    // Remove existing water if any
    if (waterMesh) {
        scene.remove(waterMesh);
        if (waterMesh.geometry) waterMesh.geometry.dispose();
        if (waterMesh.material) waterMesh.material.dispose();
        waterMesh = null;
    }

    // Create water geometry
    const waterGeometry = new THREE.PlaneGeometry(waterSize, waterSize, 32, 32);
    waterGeometry.rotateX(-Math.PI / 2);

    // Load water texture
    const textureLoader = new THREE.TextureLoader();
    const waterTexture = textureLoader.load(
        'ICG/assets/water-003.jpg',
        (texture) => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(waterSize / 20, waterSize / 20);
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

    // Create water material
    const waterMaterial = new THREE.MeshPhongMaterial({
        color: 0x3366ff, map: waterTexture, transparent: true, opacity: 0.8,
        specular: 0x6699ff, shininess: 100, side: THREE.DoubleSide,
        envMap: scene.environment, reflectivity: 0.3
    });

    // Create water mesh
    waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.position.y = waterHeight;
    scene.add(waterMesh);

    // Add water animation
    startWaterAnimation(waterMesh);
}

/**
 * startWaterAnimation - Animates the water surface with gentle waves
 * @param {THREE.Mesh} waterMesh - The water mesh to animate
 */
function startWaterAnimation(waterMesh) {
    const geometry = waterMesh.geometry;
    if (!geometry.attributes.position) return;

    const vertexCount = geometry.attributes.position.count;
    const positions = geometry.attributes.position.array;
    const originalPositions = positions.slice();

    // Wave parameters
    const amplitude = 0.15;
    const frequency = 0.1;
    const timeScale = 0.4;
    let animationFrameId = null;

    // Animation function
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
 * @param {number} yPosition - The y-coordinate for the floor
 */
function createSafetyFloor(yPosition) {
    const floorSize = 1000;
    const floorThickness = 1;

    // Physics body
    const floorShape = new CANNON.Box(new CANNON.Vec3(floorSize / 2, floorThickness / 2, floorSize / 2));
    const floorBody = new CANNON.Body({ mass: 0, material: wallMaterial });
    floorBody.addShape(floorShape);
    floorBody.position.set(0, yPosition, 0);
    world.addBody(floorBody);

    // Visual mesh
    const floorGeometry = new THREE.BoxGeometry(floorSize, floorThickness, floorSize);
    const floorMaterial = new THREE.MeshBasicMaterial({
        color: 0x1a1a2a, transparent: true, opacity: 0.5
    });
    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.position.set(0, yPosition, 0);
    scene.add(floorMesh);
}

/**
 * updateWater - Can be called in the main loop if further updates are needed.
 * @param {number} deltaTime - Time since last frame.
 */
export function updateWater(deltaTime) {
    // Main animation handled by requestAnimationFrame loop in startWaterAnimation
}

// --- Utility Functions ---

/**
 * findNearestColumn - Find the nearest column to a position (based on stored data)
 * @param {number} x - x position
 * @param {number} z - z position
 * @returns {Object | null} The nearest column data object or null if none exist.
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
 * findJumpableColumns - Find columns within jumping distance (example, not used by default)
 * @param {number} x - x position
 * @param {number} z - z position
 * @param {number} maxDistance - Maximum horizontal jumping distance
 * @param {number} maxHeightDiff - Maximum height difference allowed
 * @returns {Array} Array of column data objects within jumping distance
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

// --- Exports ---
export {
    terrainColumns,
    waterLevel,
    goalPillarData, // Export goal pillar info
};
