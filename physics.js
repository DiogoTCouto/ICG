// physics.js

// 1) Create the physics world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 20;
world.allowSleep = true;



const ballMaterial = new CANNON.Material("ballMaterial");
const wallMaterial = new CANNON.Material("wallMaterial");
const cupcakeMaterial = new CANNON.Material("cupcakeMaterial");
const playerMaterial = new CANNON.Material("playerMaterial");

const ballToWallContact = new CANNON.ContactMaterial(ballMaterial, wallMaterial, {
  friction: 0.1,
  restitution: 0.4  // Bounciness
});
world.addContactMaterial(ballToWallContact);

const ballToPlayerContact = new CANNON.ContactMaterial(ballMaterial, playerMaterial, {
  friction: 0.2,
  restitution: 0.7 
});
world.addContactMaterial(ballToPlayerContact);

export { world, ballMaterial, wallMaterial, cupcakeMaterial, playerMaterial };
