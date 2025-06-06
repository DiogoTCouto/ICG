// physics.js
// Increased gravity significantly for faster falling.
// Set player-wall friction to zero to reduce getting stuck on terrain edges.
// FURTHER REFINED: Re-introduced small friction and zero restitution for player-wall.

// 1) Create the physics world
import * as THREE from 'three';
import * as CANNON from 'cannon-es'; // Use cannon-es for ES module support

const world = new CANNON.World();
world.gravity.set(0, -40, 0); // Increased gravity further (try -20, -25, or -30)
world.broadphase = new CANNON.NaiveBroadphase(); // Simple broadphase
world.solver.iterations = 15; // Keep solver iterations reasonable
world.allowSleep = true; // Allow bodies to sleep

// 2) Define Materials
const ballMaterial = new CANNON.Material("ballMaterial");
const wallMaterial = new CANNON.Material("wallMaterial"); // For terrain, walls, pillars
const cupcakeMaterial = new CANNON.Material("cupcakeMaterial");
const playerMaterial = new CANNON.Material("playerMaterial");

// 3) Define Contact Materials (friction, restitution/bounciness)

// Player interaction with terrain/walls
const playerToWallContact = new CANNON.ContactMaterial(playerMaterial, wallMaterial, {
  friction: 0.00005,      // << INCREASED: Add a little friction to prevent gliding
  restitution: 0.0    // << DECREASED: Set bounciness to zero
});
world.addContactMaterial(playerToWallContact);

// Ball interaction with terrain/walls
const ballToWallContact = new CANNON.ContactMaterial(ballMaterial, wallMaterial, {
  friction: 0.4,      // Moderate friction for balls
  restitution: 0.4    // Some bounciness for balls
});
world.addContactMaterial(ballToWallContact);

// Ball interaction with player
const ballToPlayerContact = new CANNON.ContactMaterial(ballMaterial, playerMaterial, {
  friction: 0.1,      // Low friction when ball hits player
  restitution: 0.5    // Ball bounces off player moderately
});
world.addContactMaterial(ballToPlayerContact);

// Cupcake interaction (optional, if needed)
const cupcakeToWallContact = new CANNON.ContactMaterial(cupcakeMaterial, wallMaterial, {
    friction: 0.5,      // Cupcakes might stick more
    restitution: 0.1
});
world.addContactMaterial(cupcakeToWallContact);

const playerToCupcakeContact = new CANNON.ContactMaterial(playerMaterial, cupcakeMaterial, {
    friction: 1.0,      // High friction (player might 'pick up' by touching?) - Adjust as needed
    restitution: 0.0
});
world.addContactMaterial(playerToCupcakeContact);


// Export materials and world
export { world, ballMaterial, wallMaterial, cupcakeMaterial, playerMaterial };