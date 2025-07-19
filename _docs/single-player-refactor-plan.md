### Single-Player Refactor: Implementation Plan

This document outlines the plan to refactor the 3D multiplayer game into a single-player, client-only application. The primary goal is to completely remove the SpacetimeDB server dependency and migrate all game logic to the client.

**Guiding Principles:**

*   **No Regressions:** All existing features (player movement, animation, combat, UI) must be preserved.
*   **Minimal Disruption:** Changes should be localized and predictable, following the existing component structure.
*   **Maintainability:** The resulting client-only codebase should be clean and easy to understand.

---

### Phase 1: Decoupling from SpacetimeDB

This phase focuses on removing all code related to the SpacetimeDB connection, tables, reducers, and subscriptions.

#### **1.1. Isolate Server Directory**

The entire `server/` directory will no longer be actively used by the client application.

*   **Action:** To prevent accidental usage during the refactor, the `server/` directory will be ignored. We will not modify its contents, ensuring it remains as a backup.
*   **Rationale:** All server-side logic will be migrated to the client. Keeping the server code untouched provides a safe fallback.

#### **1.2. Uninstall SpacetimeDB Dependencies**

All npm packages related to SpacetimeDB should be uninstalled from the client.

*   **Action:** In the `client/` directory, run `npm uninstall @clockworklabs/spacetimedb-sdk`. This will update `package.json` and `package-lock.json`.
*   **Rationale:** These packages are no longer needed without a server connection.

#### **1.3. Clean Up `App.tsx`**

`App.tsx` is the central hub for server communication. A significant portion of its code will be removed or refactored.

*   **State Management:**
    *   Remove `connected`, `identity`, and `statusMessage` states. They are irrelevant without a server connection.
    *   The `players` map will be simplified to hold only the single local player. It can be replaced with a single `localPlayer` state object.
*   **Connection Logic:**
    *   Delete the entire `useEffect` hook responsible for establishing the SpacetimeDB connection (`moduleBindings.DbConnection.builder()`).
    *   Remove all functions related to table callbacks and subscriptions: `registerTableCallbacks`, `onSubscriptionApplied`, `onSubscriptionError`, `subscribeToTables`.
    -  Delete the global `conn` variable.
*   **Reducer Calls:**
    *   Remove all calls to `conn.reducers.*`. This includes `updatePlayerInput` and `registerPlayer`. This logic will be replaced by direct function calls in the client.
*   **Generated Bindings:**
    *   The `client/src/generated/` directory and its contents will no longer be used.
    *   **Action:** Remove the import statement `import * as moduleBindings from './generated';` from `App.tsx`.
    *   **Action:** Remove all type aliases that reference `moduleBindings` (e.g., `DbConnection`, `EventContext`, `PlayerData`).

---

### Phase 2: Client-Side Game Logic Migration

This phase involves re-implementing the server-side logic directly within the client.

#### **2.1. Re-implement Data Structures**

The data structures previously defined in Rust (`common.rs` and `lib.rs`) must be recreated as TypeScript interfaces or types.

*   **Action:** Create a new file `client/src/types/game.ts`.
*   **Action:** In `game.ts`, define TypeScript interfaces for `Vector3`, `InputState`, and `PlayerData`. These definitions should mirror the fields from the Rust structs.
    *   `PlayerData` will be the primary state object for the player.
*   **Rationale:** Provides clear, type-safe data structures for the client-side logic.

#### **2.2. Port Player Logic**

The core game logic from `server/src/player_logic.rs` needs to be translated from Rust to TypeScript.

*   **Action:** Create a new file `client/src/utils/playerLogic.ts`.
*   **Action:** Port the `calculate_new_position` function to TypeScript. This function is responsible for all player movement calculations. The logic should be adapted to use TypeScript's `Math` functions and the new `Vector3` interface.
*   **Action:** Port the `update_input_state` function. This will become the core of the client's game loop update. It will take the player's current state and input, and return the updated state.
*   **Rationale:** This centralizes the core player state and movement logic, making it easy to manage and update.

#### **2.3. Implement a Client-Side Game Loop**

The game loop in `App.tsx` previously sent data to the server. It will now be responsible for directly updating the game state.

*   **Action:** In `App.tsx`, modify the `gameLoop` function inside the `useEffect` hook.
*   **Inside the loop:**
    1.  Read the current input from `currentInputRef`.
    2.  Call the newly ported `update_input_state` function from `playerLogic.ts`.
    3.  Pass the current `localPlayer` state and the `currentInputRef` to this function.
    4.  The function will return a new player state.
    5.  Update the `localPlayer` state using `setLocalPlayer` with the new state.
*   **Rationale:** This creates a self-contained, client-only game loop that drives all player updates.

#### **2.4. Handle Player Initialization**

The `register_player` reducer logic needs to be replicated on the client to initialize the player's state.

*   **Action:** In `App.tsx`, modify the `handleJoinGame` function.
*   **Instead of calling a reducer:**
    1.  When `handleJoinGame` is called, create a new `PlayerData` object.
    2.  Populate it with default values for health, mana, position, etc., similar to the logic in the old `register_player` reducer.
    3.  Use the username and character class passed to the function.
    4.  Set this new object as the `localPlayer` state.
*   **Rationale:** This replaces the server-side player registration with a client-side initialization process.

---

### Phase 3: Component and UI Refactoring

This phase focuses on updating the React components to work with the new client-only state management.

#### **3.1. Refactor `GameScene.tsx` and `Player.tsx`**

These components currently receive a `players` map. They will need to be updated to handle a single `localPlayer` object.

*   **`GameScene.tsx`:**
    *   Modify its props to accept `localPlayer: PlayerData | null` instead of a map of players.
    *   The logic that iterates over the `players` map to render multiple characters will be simplified to render only the single `Player` component for the `localPlayer`.
*   **`Player.tsx`:**
    *   This component will now only be used for the local player. The logic for distinguishing between local and remote players can be removed.
*   **Rationale:** Simplifies the rendering logic to fit the single-player model.

#### **3.2. Update UI Components**

Components like `DebugPanel.tsx`