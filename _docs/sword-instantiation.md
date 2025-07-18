# Instantiating the Sword Model

This document details how the floating sword (`fantasy_sword_3.glb`) is instantiated in the gameplay scene, focusing on its visual representation, including the model, textures, and the associated glow pillar. The implementation can be found in `client/src/components/EnvironmentAssets.tsx`.

The core of the implementation is within the `FloatingSword` React component.

## Sword Model Loading and Configuration

The sword model is loaded using `GLTFLoader` from `@react-three/drei`.

### Function Call:

`loader.load(path, onLoad, onProgress, onError)`

### Parameters:

-   **`path`**: `string` - The path to the `.glb` model file. In this case, it is hardcoded to `'/models/items/fantasy_sword_3.glb'`.
-   **`onLoad`**: `(gltf: GLTF) => void` - A callback function that executes once the model has been successfully loaded. The `gltf` object contains the loaded scene.
    -   The `gltf.scene` is cloned to create a new instance of the model.
    -   `loadedModel.scale.setScalar(3.0)`: The model is scaled up by a factor of 3 to make it more prominent in the scene.
    -   `loadedModel.rotation.set(1.57, 0, 0)`: The model is rotated 90 degrees (π/2 radians) on the X-axis to make it point vertically upwards.
    -   `loadedModel.traverse(...)`: This function iterates through all the descendants of the model.
        -   If a child is a `THREE.Mesh`, its `castShadow` and `receiveShadow` properties are set to `true` to allow it to interact with the scene's lighting and cast shadows.
-   **`onProgress`**: `(event: ProgressEvent) => void` - (Optional) A callback for tracking loading progress. This is `undefined` in the current implementation.
-   **`onError`**: `(error: ErrorEvent) => void` - (Optional) A callback for handling loading errors. It logs an error to the console if the model fails to load.

The loaded and configured model is then added to a `THREE.Group` referenced by `swordGroup`.

## Glow Pillar Implementation

The glowing pillar effect is achieved by creating three concentric, semi-transparent cylinders that are stacked on top of each other. This gives the illusion of a soft, volumetric light source.

### Geometry:

Three `THREE.CylinderGeometry` objects are created with slightly different radii:

-   **`pillarGeometry`**: The innermost cylinder with a radius of `PILLAR_RADIUS` (0.4 units).
-   **`middleGlowGeometry`**: The middle cylinder with a radius of `PILLAR_RADIUS * 1.5` (0.6 units).
-   **`outerGlowGeometry`**: The outermost cylinder with a radius of `PILLAR_RADIUS * 2.0` (0.8 units).

All cylinders share the same `PILLAR_HEIGHT` (2000 units), making them appear infinitely tall, and are created with 8 segments for a slightly faceted, magical look.

### Materials and Textures:

The glow effect does not use textures. Instead, it relies on `THREE.MeshBasicMaterial` with specific properties to create the appearance of light. Three materials are created, one for each cylinder layer:

-   **`innerMaterial`**, **`middleMaterial`**, **`outerMaterial`**:
    -   **`color`**: `0x4169E1` (a royal blue). This sets the color of the glow.
    -   **`transparent`**: `true`. This is essential for the glow effect, allowing the materials to be see-through.
    -   **`opacity`**: `0.04`, `0.025`, and `0.015` for the inner, middle, and outer layers, respectively. The opacity decreases for the outer layers, creating a soft falloff effect.
    -   **`blending`**: `THREE.AdditiveBlending`. This is a critical property. When objects with this blending mode overlap, their colors are added together, resulting in a brighter, more intense color. This is what creates the "glowing" look where the cylinders overlap.
    -   **`side`**: `THREE.DoubleSide`. This ensures the material is visible from both the inside and outside of the cylinder, which is important for transparent objects.
    -   **`depthWrite`**: `false`. This prevents the transparent pillar from interfering with the depth calculations of other objects in the scene, which can cause rendering artifacts.
    -   **`fog`**: `false`. This prevents the glow pillar from being affected by the scene's fog.

### Meshes:

Three `THREE.Mesh` objects are created by combining the cylinder geometries with their corresponding materials: `innerGlow`, `middleGlow`, and `outerGlow`. These meshes are then added to a `THREE.Group` referenced by `glowPillarGroup`.

## Animation and Positioning

The `useFrame` hook from `@react-three/fiber` is used to animate the sword and its pillar.

-   **Floating Motion**: A sine wave is used to create a smooth up-and-down floating animation.
    -   `const floatOffset = Math.sin(elapsed * FLOAT_SPEED * Math.PI * 2) * FLOAT_AMPLITUDE;`
    -   `swordGroup.current.position.y = position[1] + floatOffset + 1.5;`
-   **Rotation**: The sword is gently rotated around its Y-axis in each frame to make it slowly spin.
    -   `swordGroup.current.rotation.y += ROTATION_SPEED * delta;`

The `glowPillarGroup` is positioned at the sword's base location but is not animated; it remains static to create the effect of a pillar of light emanating from the ground. 