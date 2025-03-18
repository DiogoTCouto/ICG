// terrain.js
import { scene } from './scene.js';
import { world, wallMaterial } from './physics.js';
import { createNoise2D } from 'https://unpkg.com/simplex-noise@4.0.1/dist/esm/simplex-noise.js';

const noise2D = createNoise2D();

const terrainColumns = [];

// Store the lowest points for water placement
let lowestPoint = Infinity;
let waterLevel = 0;
let waterMesh = null;

// Create two types of triangular prisms for perfect tessellation
function createTriangularColumnMesh(columnSize, height, color, isUpsideDown = false) {
  const radius = columnSize / 2;
  const radialSegments = 3;

  const geometry = new THREE.CylinderGeometry(radius, radius, height, radialSegments);
  TH
  if (isUpsideDown) {
    geometry.rotateY(Math.PI / 6);
  } else {
    geometry.rotateY(-Math.PI / 6);
  }
  
  const textureLoader = new THREE.TextureLoader();
  const dirtTexture = textureLoader.load(
    'assets/Ground_texture.jpeg',
    (texture) => {
      console.log("Ground texture loaded successfully.");
      texture.encoding = THREE.sRGBEncoding;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, height / columnSize);
    },
    undefined,
    (error) => {
      console.error("Error loading ground texture:", error);
    }
  );
  
  const material = new THREE.MeshPhongMaterial({ 
    color: color,
    map: dirtTexture,
    flatShading: true
  });
  
  return new THREE.Mesh(geometry, material);
}

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
  
  return body;
}

/**
 * Creates a terrain of perfectly tessellated triangular columns
 * @param {number} rows - Number of rows in the grid
 * @param {number} cols - Number of columns in the grid
 * @param {number} columnSize - Size of each column
 * @param {number} maxHeight - Maximum height of columns
 */
export function initBlockyTerrain(rows, cols, columnSize, maxHeight) {
  terrainColumns.length = 0;
  
  lowestPoint = Infinity;
  
  const noiseScale = 0.1;
  const heightScale = maxHeight * 0.7;
  const baseHeight = maxHeight * 0.3;
  
  const lowColor = new THREE.Color(0xbbbbbb);
  const midColor = new THREE.Color(0xffffff);
  const highColor = new THREE.Color(0x88aaff);
  
  const width = columnSize;
  const height = width * Math.sqrt(3) / 2;
  
  const xOffset = width / 2;
  const zOffset = height / 2;
  
  const bufferSize = 4;
  
  for (let row = -bufferSize; row < rows + bufferSize; row++) {
    for (let col = -bufferSize; col < cols + bufferSize; col++) {
      const xPos = col * width;
      const zPos = row * height;
      
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
        
        const mesh = createTriangularColumnMesh(columnSize, columnHeight, color.getHex(), isUpsideDown);
        mesh.position.set(triangleX, columnHeight * 0.5, triangleZ);
        scene.add(mesh);
        
        const body = createTriangularColumnBody(columnSize, columnHeight, isUpsideDown);
        body.position.set(triangleX, columnHeight * 0.5, triangleZ);
        world.addBody(body);
        body.isTerrain = true;

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
  
  createSafetyFloor(-30);
  
  waterLevel = lowestPoint + 0.5;
  
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
  if (waterMesh) {
    scene.remove(waterMesh);
  }
  
  const bufferSize = 5;
  const waterSize = Math.max(rows, cols) * columnSize * 2 + bufferSize * 2;
  
  const waterGeometry = new THREE.PlaneGeometry(waterSize, waterSize, 32, 32);
  
  waterGeometry.rotateX(-Math.PI / 2);
  
  const textureLoader = new THREE.TextureLoader();
  const waterTexture = textureLoader.load(
    'assets/water-003.jpg',
    (texture) => {
      console.log("Water texture loaded successfully.");
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(10, 10);
    },
    undefined,
    (error) => {
      console.error("Error loading water texture:", error);
    }
  );
  
  const waterMaterial = new THREE.MeshPhongMaterial({
    color: 0x3366ff,
    map: waterTexture,
    transparent: true,
    opacity: 0.8,
    specular: 0xffffff,
    shininess: 100,
    side: THREE.DoubleSide
  });
  
  waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
  waterMesh.position.y = waterHeight;
  scene.add(waterMesh);
  
  startWaterAnimation(waterMesh);
}

/**
 * startWaterAnimation - Animates the water surface with gentle waves
 * @param {THREE.Mesh} waterMesh - The water mesh to animate
 */
function startWaterAnimation(waterMesh) {
  const vertexCount = waterMesh.geometry.attributes.position.count;
  const positions = waterMesh.geometry.attributes.position.array;
  const originalPositions = positions.slice();
  
  const amplitude = 0.2;
  const frequency = 0.2;
  const timeScale = 0.5;
  
  function animateWater() {
    const time = performance.now() * 0.001 * timeScale;
    
    for (let i = 0; i < vertexCount; i++) {
      const x = originalPositions[i * 3];
      const z = originalPositions[i * 3 + 2];
      
      positions[i * 3 + 1] = originalPositions[i * 3 + 1] + 
        amplitude * Math.sin(x * frequency + time) * 
        Math.cos(z * frequency + time * 0.5);
    }
    
    waterMesh.geometry.attributes.position.needsUpdate = true;
    
    requestAnimationFrame(animateWater);
  }
  
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
  terrainColumns.length = 0;
  
  lowestPoint = Infinity;
  
  const noiseScale = 0.1;
  const heightScale = maxHeight * 0.7;
  const baseHeight = maxHeight * 0.3;
  
  const lowColor = new THREE.Color(0xbbbbbb);
  const midColor = new THREE.Color(0xffffff);
  const highColor = new THREE.Color(0x88aaff);
  
  const width = columnSize * spacing;
  const height = width * Math.sqrt(3) / 2;
  
  const xOffset = width / 2;
  const zOffset = height / 2;
  
  const bufferSize = 4;
  
  for (let row = -bufferSize; row < rows + bufferSize; row++) {
    for (let col = -bufferSize; col < cols + bufferSize; col++) {
      const xPos = col * width * 1.2;
      const zPos = row * height * 1.2;
      
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
        
        const mesh = createTriangularColumnMesh(columnSize, columnHeight, color.getHex(), isUpsideDown);
        mesh.position.set(triangleX, columnHeight * 0.5, triangleZ);
        scene.add(mesh);
        
        const body = createTriangularColumnBody(columnSize, columnHeight, isUpsideDown);
        body.position.set(triangleX, columnHeight * 0.5, triangleZ);
        world.addBody(body);
        body.isTerrain = true;

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
  
  createSafetyFloor(-30);
  
  waterLevel = lowestPoint + 1.5;
  
  addWater(waterLevel, rows, cols, columnSize * spacing * 1.2);
}


/**
 * createSafetyFloor - Creates a flat floor below the terrain to catch falling players
 * @param {number} yPosition - The y-coordinate for the floor
 */
function createSafetyFloor(yPosition) {
  const floorSize = 1000;
  const floorThickness = 1;
  
  const floorShape = new CANNON.Box(new CANNON.Vec3(floorSize/2, floorThickness/2, floorSize/2));
  const floorBody = new CANNON.Body({ mass: 0 });
  floorBody.addShape(floorShape);
  floorBody.position.set(0, yPosition, 0);
  world.addBody(floorBody);
  
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
    const distance = Math.sqrt(
      Math.pow(column.x - x, 2) + 
      Math.pow(column.z - z, 2)
    );
    
    const heightDiff = Math.abs(column.height - currentColumn.height);
    
    return distance > 0 && 
           distance <= maxDistance && 
           heightDiff <= maxHeightDiff;
  });
}

// Keep original functions for compatibility
export function initTerrain() {
  const width = 50;
  const depth = 50;
  const amplitude = 5;
  const frequency = 4;
  const elementSize = 1;

  const data = generateNoiseData(width, depth, amplitude, frequency);

  const terrainBody = createNoiseTerrainBody(data, elementSize);
  world.addBody(terrainBody);

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

  const loader = new THREE.TextureLoader();
  const groundTexture = loader.load(
    'assets/Ground_texture.jpeg',
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