// physics.js

// const groundShape = new CANNON.Plane();
// const groundBody = new CANNON.Body({ mass: 0 });
// groundBody.addShape(groundShape);
// // Rotate to match the Three.js ground orientation
// groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
// world.addBody(groundBody);

const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 20;
world.allowSleep = true;

// 2) Create a static ground plane


export { world, wallMaterial };
