// walls.js
import { scene } from './scene.js';
import { world, wallMaterial } from './physics.js';


const wallWidth = 50;
const wallHeight = 5;
const wallThickness = 1;

let backWallBody, frontWallBody, leftWallBody, rightWallBody;




function createWallMesh(width, height, thickness, color = 0x888888) {
  const geometry = new THREE.BoxGeometry(width, height, thickness);
  const material = new THREE.MeshPhongMaterial({ color });
  return new THREE.Mesh(geometry, material);
}

function createWallBody(width, height, thickness) {
  const wallBody = new CANNON.Body({ mass: 0 }); // static
  const halfExtents = new CANNON.Vec3(width / 2, height / 2, thickness / 2);
  const boxShape = new CANNON.Box(halfExtents);
  wallBody.addShape(boxShape);
  return wallBody;
}   

function initWalls() {
  // Back Wall
  const backWallMesh = createWallMesh(wallWidth, wallHeight, wallThickness);
  backWallMesh.position.set(0, wallHeight / 2, -wallWidth / 2);
  scene.add(backWallMesh);

  const backWallBody = createWallBody(wallWidth, wallHeight, wallThickness);
  backWallBody.position.set(0, wallHeight / 2, -wallWidth / 2);
  world.addBody(backWallBody);

  // Front Wall
  const frontWallMesh = createWallMesh(wallWidth, wallHeight, wallThickness);
  frontWallMesh.position.set(0, wallHeight / 2, wallWidth / 2);
  scene.add(frontWallMesh);

  const frontWallBody = createWallBody(wallWidth, wallHeight, wallThickness);
  frontWallBody.position.set(0, wallHeight / 2, wallWidth / 2);
  world.addBody(frontWallBody);

  // Left Wall
  const leftWallMesh = createWallMesh(wallThickness, wallHeight, wallWidth);
  leftWallMesh.position.set(-wallWidth / 2, wallHeight / 2, 0);
  scene.add(leftWallMesh);

  const leftWallBody = createWallBody(wallThickness, wallHeight, wallWidth);
  leftWallBody.position.set(-wallWidth / 2, wallHeight / 2, 0);
  world.addBody(leftWallBody);

  // Right Wall
  const rightWallMesh = createWallMesh(wallThickness, wallHeight, wallWidth);
  rightWallMesh.position.set(wallWidth / 2, wallHeight / 2, 0);
  scene.add(rightWallMesh);

  const rightWallBody = createWallBody(wallThickness, wallHeight, wallWidth);
  rightWallBody.position.set(wallWidth / 2, wallHeight / 2, 0);
  world.addBody(rightWallBody);

}


function createRandomPillar() {
  // 1) Decide random position (x,z), staying inside the arena
  const x = (Math.random() * 40) - 20; 
  const z = (Math.random() * 40) - 20;

  // 2) Randomize the radius and height of the pillar
  const radius = 1 + Math.random() * 1; // e.g. 1 to 2
  const height = 5 + Math.random() * 5; // e.g. 5 to 10

  // 3) Create a Three.js cylinder mesh
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 16);
  const material = new THREE.MeshPhongMaterial({ color: 0x888888 });
  const pillarMesh = new THREE.Mesh(geometry, material);

  pillarMesh.position.set(x, height / 2, z);
  scene.add(pillarMesh);

  const pillarShape = new CANNON.Cylinder(radius, radius, height, 16);

  const pillarBody = new CANNON.Body({
    mass: 0, // static
    material: wallMaterial, 
  });
  pillarBody.addShape(pillarShape);

  const quat = new CANNON.Quaternion();
  quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  pillarBody.shapeOrientations[0] = quat;

  pillarBody.position.set(x, height / 2, z);

  world.addBody(pillarBody);
}

function initRandomPillars(numPillars) {
  for (let i = 0; i < numPillars; i++) {
    createRandomPillar();
  }
}

export { initWalls, initRandomPillars  };
