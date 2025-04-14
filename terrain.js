// terrain.js
import { scene } from './scene.js';
import { world, wallMaterial } from './physics.js';
import { createNoise2D } from 'https://unpkg.com/simplex-noise@4.0.1/dist/esm/simplex-noise.js';

// Create a 2D noise function for more natural-looking terrain
const noise2D = createNoise2D();

// Store terrain column data for collision detection and movement
const terrainColumns = [];

// Store the lowest points for water placement
let lowestPoint = Infinity;
let waterLevel = 0;
let waterMesh = null;

// Create two types of triangular prisms for perfect tessellation
function createTriangularColumnMesh(columnSize, height, color, isUpsideDown = false) {
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
  
  // Load dirt texture
  const textureLoader = new THREE.TextureLoader();
  const dirtTexture = textureLoader.load(
    'assets/Ground_texture.jpeg',
    (texture) => {
      console.log("Ground texture loaded successfully.");
      texture.encoding = THREE.sRGBEncoding;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, height / columnSize); // Adjust texture repeat based on height
    },
    undefined,
    (error) => {
      console.error("Error loading ground texture:", error);
    }
  );
  
  const material = new THREE.MeshPhongMaterial({ 
    color: color,
    map: dirtTexture,
    flatShading: true // Add flat shading for more distinct triangles
  });
  
  return new THREE.Mesh(geometry, material);
}

function createTriangularColumnBody(columnSize, height, isUpsideDown = false) {
  const radius = columnSize / 2;
  const radialSegments = 3;

  const shape = new CANNON.Cylinder(radius, radius, height, radialSegments);

  // Y up + rotate to align with the mesh
  const q = new CANNON.Quaternion();
  if (isUpsideDown) {
    q.setFromEuler(Math.PI * 0.5, 0, Math.PI / 6);
  } else {
    q.setFromEuler(Math.PI * 0.5, 0, -Math.PI / 6);
  }

  const body = new CANNON.Body({ mass: 0, material: wallMaterial });
  body.addShape(shape, new CANNON.Vec3(0, 0, 0), q);
  body.type = CANNON.Body.STATIC;
  
  return body;
}

/**
 * initBlockyTerrain - Creates a terrain of perfectly tessellated triangular columns
 * @param {number} rows - Number of rows in the grid
 * @param {number} cols - Number of columns in the grid
 * @param {number} columnSize - Size of each column
 * @param {number} maxHeight - Maximum height of columns
 */
export function initBlockyTerrain(rows, cols, columnSize, maxHeight) {
  // Clear previous terrain data
  terrainColumns.length = 0;
  
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
  
  // Calculate spacing for a proper triangular tessellation
  const width = columnSize;
  const height = width * Math.sqrt(3) / 2; // Triangle height (for equilateral triangle)
  
  // Calculate the x and z offsets for a perfect tessellation
  const xOffset = width / 2;
  const zOffset = height / 2;
  
  // Create a grid with buffer around edges (to avoid gaps)
  const bufferSize = 4;
  
  // Loop through rows and columns to create triangular grid
  for (let row = -bufferSize; row < rows + bufferSize; row++) {
    for (let col = -bufferSize; col < cols + bufferSize; col++) {
      // Calculate positions for both triangle types in each cell
      const xPos = col * width;
      const zPos = row * height;
      
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
        
        // Create mesh
        const mesh = createTriangularColumnMesh(columnSize, columnHeight, color.getHex(), isUpsideDown);
        mesh.position.set(triangleX, columnHeight * 0.5, triangleZ);
        scene.add(mesh);
        
        // Create physics body
        const body = createTriangularColumnBody(columnSize, columnHeight, isUpsideDown);
        body.position.set(triangleX, columnHeight * 0.5, triangleZ);
        world.addBody(body);
        body.isTerrain = true; // Mark terrain bodies for collision detection

        // Store column data for collision detection and player movement
        terrainColumns.push({
          x: triangleX,
          z: triangleZ,
          height: columnHeight,
          radius: columnSize / 2,
          isUpsideDown: isUpsideDown
        });
      }
    }
  }
  
  // Add an additional layer of flat terrain below to catch falling players
  createSafetyFloor(-30);
  
  // Calculate water level (slightly above the lowest point)
  waterLevel = lowestPoint + 0.5; // 0.5 units above lowest point
  
  // Add water plane
  addWater(waterLevel, rows, cols, columnSize);
}

/**
 * addWater - Creates a water plane at specified height
 * @param {number} waterHeight - Water surface height
 * @param {number} rows - Number of terrain rows
 * @param {number} cols - Number of terrain columns
 * @param {number} columnSize - Size of terrain columns
 */
function addWater(waterHeight, rows, cols, columnSize) {
  // Remove existing water if any
  if (waterMesh) {
    scene.remove(waterMesh);
  }
  
  // Create a large water plane that covers the terrain
  const bufferSize = 5; // Extra space around terrain
  const waterSize = Math.max(rows, cols) * columnSize * 2 + bufferSize * 2;
  
  // Create water geometry with more segments for better wave animation
  const waterGeometry = new THREE.PlaneGeometry(waterSize, waterSize, 32, 32);
  
  // Rotate to be horizontal
  waterGeometry.rotateX(-Math.PI / 2);
  
  // Load water texture
  const textureLoader = new THREE.TextureLoader();
  const waterTexture = textureLoader.load(
    'ICG/assets/water-003.jpg', // You'll need to add this texture to your assets
    (texture) => {
      console.log("Water texture loaded successfully.");
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(10, 10); // Repeat the texture for larger water surface
    },
    undefined,
    (error) => {
      console.error("Error loading water texture:", error);
      // If texture fails to load, use a basic blue material
    }
  );
  
  // Create water material with transparency and reflectivity
  const waterMaterial = new THREE.MeshPhongMaterial({
    color: 0x3366ff,
    map: waterTexture,
    transparent: true,
    opacity: 0.8,
    specular: 0xffffff,
    shininess: 100,
    side: THREE.DoubleSide
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
  const vertexCount = waterMesh.geometry.attributes.position.count;
  const positions = waterMesh.geometry.attributes.position.array;
  const originalPositions = positions.slice(); // Make a copy of the original positions
  
  // Variables for wave animation
  const amplitude = 0.2; // Height of waves
  const frequency = 0.2; // Frequency of waves
  const timeScale = 0.5; // Speed of animation
  
  // Animation function
  function animateWater() {
    // Get current time for animation
    const time = performance.now() * 0.001 * timeScale;
    
    // Update each vertex position to create wave effect
    for (let i = 0; i < vertexCount; i++) {
      const x = originalPositions[i * 3];
      const z = originalPositions[i * 3 + 2];
      
      // Only modify Y position (index + 1) to create waves
      positions[i * 3 + 1] = originalPositions[i * 3 + 1] + 
        amplitude * Math.sin(x * frequency + time) * 
        Math.cos(z * frequency + time * 0.5);
    }
    
    // Update geometry with new positions
    waterMesh.geometry.attributes.position.needsUpdate = true;
    
    // Request next animation frame
    requestAnimationFrame(animateWater);
  }
  
  // Start animation
  animateWater();
}


/**
 * initSpacedBlockyTerrain - Creates terrain with increased spacing between pillars
 * @param {number} rows - Number of rows in the grid
 * @param {number} cols - Number of columns in the grid
 * @param {number} columnSize - Size of each column
 * @param {number} maxHeight - Maximum height of columns
 * @param {number} spacing - Additional spacing between columns
 */
export function initSpacedBlockyTerrain(rows, cols, columnSize, maxHeight, spacing = 2) {
  // Clear previous terrain data
  terrainColumns.length = 0;
  
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
  
  // Calculate spacing for a proper triangular tessellation with additional space
  const width = columnSize * spacing;
  const height = width * Math.sqrt(3) / 2;
  
  // Calculate the x and z offsets for tessellation
  const xOffset = width / 2;
  const zOffset = height / 2;
  
  // Create a grid with buffer around edges
  const bufferSize = 4;
  
  // Loop through rows and columns to create triangular grid
  for (let row = -bufferSize; row < rows + bufferSize; row++) {
    for (let col = -bufferSize; col < cols + bufferSize; col++) {
      // Calculate positions with increased spacing
      const xPos = col * width * 1.2; // Add 20% extra space horizontally
      const zPos = row * height * 1.2; // Add 20% extra space vertically
      
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
        
        // Create mesh
        const mesh = createTriangularColumnMesh(columnSize, columnHeight, color.getHex(), isUpsideDown);
        mesh.position.set(triangleX, columnHeight * 0.5, triangleZ);
        scene.add(mesh);
        
        // Create physics body
        const body = createTriangularColumnBody(columnSize, columnHeight, isUpsideDown);
        body.position.set(triangleX, columnHeight * 0.5, triangleZ);
        world.addBody(body);
        body.isTerrain = true; // Mark terrain bodies for collision detection

        // Store column data for collision detection and player movement
        terrainColumns.push({
          x: triangleX,
          z: triangleZ,
          height: columnHeight,
          radius: columnSize / 2,
          isUpsideDown: isUpsideDown
        });
      }
    }
  }
  
  // Add an additional layer of flat terrain below to catch falling players
  createSafetyFloor(-30);
  
  // Calculate water level (slightly above the lowest point)
  waterLevel = lowestPoint + 1.5; // 1.5 units above lowest point - higher water level
  
  // Add water plane
  addWater(waterLevel, rows, cols, columnSize * spacing * 1.2);
}


/**
 * createSafetyFloor - Creates a flat floor below the terrain to catch falling players
 * @param {number} yPosition - The y-coordinate for the floor
 */
function createSafetyFloor(yPosition) {
  // Create a large flat floor
  const floorSize = 1000;
  const floorThickness = 1;
  
  // Create physics body
  const floorShape = new CANNON.Box(new CANNON.Vec3(floorSize/2, floorThickness/2, floorSize/2));
  const floorBody = new CANNON.Body({ mass: 0 });
  floorBody.addShape(floorShape);
  floorBody.position.set(0, yPosition, 0);
  world.addBody(floorBody);
  
  // Create mesh (invisible)
  const floorGeometry = new THREE.BoxGeometry(floorSize, floorThickness, floorSize);
  const floorMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x333333,
    transparent: true,
    opacity: 0.3
  });
  const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
  floorMesh.position.set(0, yPosition, 0);
  scene.add(floorMesh);
}

/**
 * updateWater - Updates the water animation (can be called in animate loop)
 * @param {number} deltaTime - Time since last frame
 */
export function updateWater(deltaTime) {
  if (waterMesh) {
    // You can add additional water animation logic here if needed
    // The main animation is handled by the startWaterAnimation function
  }
}

/**
 * findNearestColumn - Find the nearest column to a position
 * @param {number} x - x position
 * @param {number} z - z position
 * @returns {Object} The nearest column with its data
 */
export function findNearestColumn(x, z) {
  let nearestColumn = null;
  let minDistance = Infinity;
  
  for (const column of terrainColumns) {
    const distance = Math.sqrt(
      Math.pow(column.x - x, 2) + 
      Math.pow(column.z - z, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestColumn = column;
    }
  }
  
  return nearestColumn;
}

/**
 * findJumpableColumns - Find columns within jumping distance of a position
 * @param {number} x - x position
 * @param {number} z - z position
 * @param {number} maxDistance - Maximum jumping distance
 * @param {number} maxHeightDiff - Maximum height difference allowed
 * @returns {Array} Array of columns within jumping distance
 */
export function findJumpableColumns(x, z, maxDistance, maxHeightDiff) {
  const currentColumn = findNearestColumn(x, z);
  if (!currentColumn) return [];
  
  return terrainColumns.filter(column => {
    // Calculate distance
    const distance = Math.sqrt(
      Math.pow(column.x - x, 2) + 
      Math.pow(column.z - z, 2)
    );
    
    // Calculate height difference
    const heightDiff = Math.abs(column.height - currentColumn.height);
    
    // Return true if within jumpable distance and height
    return distance > 0 && // Not the same column
           distance <= maxDistance && // Within jump distance
           heightDiff <= maxHeightDiff; // Not too high/low
  });
}

// Keep original functions for compatibility
export function initTerrain() {
  const width = 50;
  const depth = 50;
  const amplitude = 5;
  const frequency = 4;
  const elementSize = 1;

  // 1) Generate data
  const data = generateNoiseData(width, depth, amplitude, frequency);

  // 2) Cannon body
  const terrainBody = createNoiseTerrainBody(data, elementSize);
  world.addBody(terrainBody);

  // 3) Three mesh
  const terrainMesh = createNoiseTerrainMesh(data, elementSize, 0x88aa88);
  scene.add(terrainMesh);
}

// Supporting functions from your original code
function generateNoiseData(width, depth, amplitude, frequency) {
  const data = [];
  for (let x = 0; x < width; x++) {
    data[x] = [];
    for (let z = 0; z < depth; z++) {
      const nx = x / width - 0.5;
      const nz = z / depth - 0.5;
      const e = noise2D(nx * frequency, nz * frequency);
      data[x][z] = e * amplitude;
    }
  }
  return data;
}

function createNoiseTerrainBody(data, elementSize) {
  const shape = new CANNON.Heightfield(data, {
    elementSize: elementSize
  });

  const terrainBody = new CANNON.Body({ mass: 0 });
  terrainBody.addShape(shape);
  terrainBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  terrainBody.position.set(0, 0, 0);
  terrainBody.type = CANNON.Body.STATIC;
  terrainBody.updateMassProperties();
  return terrainBody;
}

function createNoiseTerrainMesh(data, elementSize, color = 0x88aa88) {
  const width = data.length;
  const depth = data[0].length;

  const geometry = new THREE.PlaneGeometry(
    width * elementSize,
    depth * elementSize,
    width - 1,
    depth - 1
  );

  geometry.rotateX(-Math.PI / 2);

  const pos = geometry.attributes.position;
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      const index = x * depth + z;
      pos.setY(index, data[x][z]);
    }
  }
  geometry.computeVertexNormals();

  // Load and apply the ground asset texture with debugging callbacks
  const loader = new THREE.TextureLoader();
  const groundTexture = loader.load(
    'ICG/assets/Ground_texture.jpeg',
    (texture) => {
      console.log("Ground texture loaded successfully.");
      texture.encoding = THREE.sRGBEncoding;
    },
    undefined,
    (error) => {
      console.error("Error loading ground texture:", error);
    }
  );
  groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(width * 0.1, depth * 0.1);

  const mat = new THREE.MeshPhongMaterial({
    color, 
    map: groundTexture
  });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(0, 0, 0);

  return mesh;
}

// Export terrain columns and water-related functions
export { terrainColumns, waterLevel };
