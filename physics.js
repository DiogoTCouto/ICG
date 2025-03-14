// physics.js

const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);

export { world };
