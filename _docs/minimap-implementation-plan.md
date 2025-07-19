# Mini-Map System Implementation Plan

## 1. Overview

This document outlines the plan to implement a Grand Theft Auto (GTA)-style mini-map in the bottom-left corner of the game's UI. The mini-map will provide players with situational awareness by displaying their position and the relative locations of nearby enemies (zombies) in real-time.

## 2. Feature Requirements

1.  **Display**: A circular mini-map will be persistently displayed in the bottom-left of the screen.
2.  **Appearance**:
    *   The map background will be a solid, dark gray color.
    *   It will have a distinct border to separate it from the game world.
3.  **Player Marker**:
    *   The player is always positioned at the exact center of the mini-map.
    *   The player's marker will be a triangular arrow, always pointing "up" to represent the player's forward direction.
4.  **Enemy Markers**:
    *   Zombies within a certain vicinity of the player will be displayed as red dots on the map.
5.  **Rotation and Scaling**:
    *   The content of the map (i.e., the zombie dots) will rotate as the player rotates their view. The player's forward direction in the game world corresponds to the "up" direction on the mini-map.
    *   The distance of zombie dots from the center of the map will be a scaled representation of their actual distance in the game world.
    *   Zombies that are far away will not appear on the map.

## 3. Architecture Analysis

This feature is entirely client-side and will be implemented as a new React UI component.

*   **`client/src/App.tsx`**: This is the main component that manages the connection to SpacetimeDB and holds the global game state, including the list of all players and zombies. It will be the source of truth for the data required by the mini-map.
*   **`client/src/components/PlayerUI.tsx`**: This component serves as a container for various UI/HUD elements like the `CoinCounter` and `ComboCounter`. It is the ideal location to render the new `MiniMap` component.
*   **`client/src/components/ZombieManager.tsx`**: This component manages the state and rendering of zombies in the 3D scene. The mini-map will need access to the same zombie data.

We will create a new, self-contained component for the mini-map logic and rendering.

*   **`client/src/components/MiniMap.tsx` (New File)**: This component will receive player and zombie data as props and handle all the logic for calculating positions, rotation, and rendering the final 2D map.

## 4. Implementation Plan

### Phase 1: Component Scaffolding and Integration

1.  **Create `MiniMap.tsx`**:
    *   Create a new file at `client/src/components/MiniMap.tsx`.
    *   Define its props interface:
        ```typescript
        interface MiniMapProps {
          localPlayer: PlayerData | null;
          zombies: Map<number, ZombieData>; // Assuming ZombieData type exists
          mapSize?: number; // e.g., 150px
          mapScale?: number; // world units to pixels
        }
        ```
2.  **Integrate into `PlayerUI.tsx`**:
    *   Modify `PlayerUI.tsx` to import and render the `<MiniMap />` component.
3.  **State Propagation from `App.tsx`**:
    *   In `App.tsx`, ensure that the `localPlayer` object and the `zombies` map are passed down as props to `PlayerUI.tsx`, which will then forward them to `MiniMap.tsx`.

### Phase 2: Core Map Logic

This phase will take place entirely within `MiniMap.tsx`.

1.  **Player and Zombie Data**:
    *   The component will receive the local player's data (including `position` and `rotation`) and a list/map of all active zombies (with their `position`).
2.  **Coordinate Transformation Logic**:
    *   For each zombie, calculate its position vector relative to the player: `relativePos = zombiePos - playerPos`.
    *   Filter out zombies beyond a maximum distance (`maxDistance`).
    *   Extract the player's yaw (Y-axis rotation) from the `player.rotation` quaternion.
    *   Apply an inverse rotation to the zombie's `relativePos` vector to align it with the mini-map's coordinate system, where the player's forward direction is "up".
3.  **Rendering**:
    *   Use React's `useMemo` hook to re-calculate the positions of zombie dots only when player or zombie data changes.
    *   Render the zombie dots as `<div>` elements with `position: absolute`. Their `top` and `left` CSS properties will be calculated based on the transformed and scaled coordinates.

### Phase 3: Styling with CSS

1.  **Map Container**:
    *   Style the main `div` to be circular (`border-radius: 50%`).
    *   Set a fixed size (`width`, `height`), a `darkgray` background, and a border.
    *   Use `position: fixed` or `absolute` to place it in the bottom-left corner of the viewport.
    *   Set `overflow: hidden` to ensure markers outside the circle are not visible.
2.  **Player Marker**:
    *   Create a `div` or `img` for the player arrow.
    *   Position it in the absolute center of the map container.
    *   Style it as an upward-pointing triangle.
3.  **Zombie Dots**:
    *   Style the zombie `div`s as small, red circles (`border-radius: 50%`).

## 5. Coordinate System and Rotation Mathematics

The core challenge is converting 3D world coordinates to 2D map coordinates relative to the player's orientation.

1.  **Player's Orientation**: We need the player's yaw (rotation around the Y-axis). This can be extracted from the player's quaternion:
    ```typescript
    import * as THREE from 'three';
    const euler = new THREE.Euler().setFromQuaternion(player.rotation, 'YXZ');
    const playerYaw = euler.y;
    ```
2.  **Relative Position**: For a zombie at `zombiePos` and a player at `playerPos`:
    ```typescript
    const relativePos = new THREE.Vector3().subVectors(zombiePos, playerPos);
    ```
3.  **Rotation Calculation**: To align the map so the player's view is "up", we must rotate the relative zombie positions by the *negative* of the player's yaw.
    *   Let `(dx, dz)` be the horizontal components of `relativePos`.
    *   Let `theta = -playerYaw`.
    *   The new coordinates on the map's 2D plane `(mapX, mapY)` will be:
        *   `mapX = dx * cos(theta) - dz * sin(theta)`
        *   `mapY = dx * sin(theta) + dz * cos(theta)`

4.  **Final Screen Position**: The CSS `top` and `left` values for a zombie dot within the map container (`mapSize` x `mapSize`) are:
    ```typescript
    const mapCenterX = mapSize / 2;
    const mapCenterY = mapSize / 2;

    const dotLeft = mapCenterX + mapX * mapScale;
    const dotTop = mapCenterY - mapY * mapScale; // Subtract because screen Y is inverted
    ```

## 6. Testing Strategy

1.  **Component-Level**:
    *   The coordinate transformation logic can be tested with mock data to ensure correctness for various rotations and positions.
2.  **Manual/E2E**:
    *   Verify the mini-map appears correctly in the bottom-left corner.
    *   Walk around the world and confirm the map remains static while the player marker stays centered.
    *   Rotate the player character and camera, and verify the zombie dots rotate correctly around the player marker.
    *   Move towards and away from zombies to check that scaling is correct and that they appear/disappear at the vicinity threshold.
    *   Confirm that performance is not negatively impacted. 