// wincondition.js
// Handles identifying the goal pillar and creating its visual marker.

import * as THREE from 'three'; // Required for Vector3
import { createGlowingMaterial } from './scene.js'; // Needed for the goal marker visual
import * as CANNON from 'cannon-es'; // Import CANNON for physics

/**
 * Identifies the goal pillar based on criteria (e.g., the last one created)
 * and marks its physics body.
 * @param {Array} terrainColumns - Array of all created terrain column data objects.
 * @returns {object | null} The columnData object for the designated goal pillar, or null if none found.
 */
function setupGoalPillar(terrainColumns) {
  if (!terrainColumns || terrainColumns.length === 0) {
    console.warn("Cannot set up goal pillar: terrainColumns array is empty.");
    return null;
  }

  // --- Goal Pillar Selection Logic ---
  // Currently selecting the *last* pillar created as the goal.
  // This could be changed to select based on coordinates, distance, etc.
  const goalIndex = terrainColumns.length - 1;
  const goalData = terrainColumns[goalIndex];
  // ---

  if (goalData && goalData.body) {
    goalData.body.isGoal = true; // Mark the physics body
    console.log(`Goal pillar identified (index: ${goalIndex}). Body marked with isGoal=true.`);
    return goalData; // Return the data for the goal pillar
  } else {
    console.warn("Could not find a valid goal pillar body to mark.");
    return null;
  }
}

/**
 * Creates a simple visual marker for the goal pillar.
 * @param {THREE.Vector3} position - The position for the marker (top center of the goal pillar).
 * @param {THREE.Scene} scene - The scene to add the marker to.
 * @returns {THREE.Mesh} The marker mesh.
 */
function createGoalMarker(position, scene) {
    const markerHeight = 200; // Height of the marker beam
    const markerRadius = 0.4; // Radius of the marker
    const geometry = new THREE.CylinderGeometry(markerRadius, markerRadius, markerHeight, 16);

    // Use a bright, unlit material that's always visible
    // Using MeshBasicMaterial as createGlowingMaterial might not be available here
    // If createGlowingMaterial is needed, it should be imported from scene.js

    
    const material = createGlowingMaterial(0xffff00, 1.0); // Yellow glow
    material.depthWrite = false;
    material.transparent = true;
    material.opacity = 0.9;
    

    const marker = new THREE.Mesh(geometry, material);

    // Position it slightly above the pillar's top center
    marker.position.copy(position);
    marker.position.y += markerHeight / 2 + 0.1; // Place base slightly above pillar top
    marker.name = "GoalMarker";

    if (scene) {
        scene.add(marker); // Add directly to the provided scene
    } else {
        console.error("Scene object not provided to createGoalMarker.");
    }

    return marker;
}

export { setupGoalPillar, createGoalMarker };
