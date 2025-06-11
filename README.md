# 🎮 Dodge It! - 3D Browser Game

**Interactive 3D platformer** built with Three.js and Cannon-es. Navigate terrain, dodge falling objects, collect cupcakes, reach goals across multiple levels with different player models and day/night cycles.

## 🎯 Core Game Systems

| **🎮 GAMEPLAY & CONTROLS** | **🏗️ TECHNICAL ARCHITECTURE** |
|:---------------------------|:-------------------------------|
| **Players:** Cube, Sphere, Robot models | **Engine:** Three.js + Cannon-es + ES6 Modules |
| **Movement:** Physics jumping, double-jump, coyote-time | **Graphics:** WebGL, dynamic lighting, bloom effects |
| **Camera:** First/Third-person modes | **Physics:** Custom materials, collision detection |
| **Controls:** WASD (move), Space (jump), C (camera), Mouse (look) | **Generation:** Simplex noise terrain, procedural levels |
| | |
| **🌍 LEVELS & ENVIRONMENT** | **📁 PROJECT STRUCTURE** |
| **Level 1:** Daytime terrain with scattered pillars | **Core:** `main.js`, `scene.js`, `physics.js`, `player.js` |
| **Level 2:** Nighttime with lava platforms & lampposts | **Terrain:** `terrain.js`, `terrain_level2.js`, `terrain_scattered.js` |
| **Visuals:** Moving clouds, stars, moon, water system | **Objects:** `ball.js`, `cupcake.js`, `walls.js`, `wincondition.js` |
| **Effects:** Day/night cycle, particle systems, trails | **Interface:** `index.html`, `game.html`, assets/ |
| | |
| **🎪 INTERACTIVE OBJECTS** | **🚀 QUICK START** |
| **Falling Balls:** Standard (60%), Heavy (25%), Glow (15%) | **Try.** `https://diogotcouto.github.io/ICG/index.html` |
| **Collectibles:** Interactive cupcakes with hover effects | **Or 1.** `python -m http.server 8000` |
| **Goal System:** Reach glowing pillars to advance levels | **2.** Open `http://localhost:8000` |
| **Objective:** Navigate → Avoid balls → Collect items → Win! | **Requirements:** Browser + WebGL support |

## 🌟 Technical Implementation & Future

| **🔧 CURRENT FEATURES** | **🚀 FUTURE ENHANCEMENTS** |
|:------------------------|:---------------------------|
| **Architecture:** Modular ES6, event-driven, clean separation | **Multiplayer:** Real-time gameplay, shared worlds |
| **Visual Effects:** Bloom post-processing, dynamic shadows | **Content:** Level editor, user-generated levels |
| **Physics:** Custom materials, realistic collision response | **Features:** Power-ups, special abilities, achievements |
| **Performance:** Object pooling, automatic cleanup, optimization | **Platform:** Mobile support, touch controls, PWA |
| **Generation:** Noise-based terrain, procedural algorithms | **Audio:** 3D spatial sound, dynamic music system |

---
