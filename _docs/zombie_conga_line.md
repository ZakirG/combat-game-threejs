Of course. I will perform a tactical deep dive into the codebase to analyze the existing systems and formulate a comprehensive implementation plan for the new zombie group. I will not make any code changes at this stage.

My investigation will proceed as follows:

1.  **Analyze the existing zombie architecture:** I will examine both client and server-side code to understand how zombies are currently created, managed, and rendered.
2.  **Investigate server-side logic:** I'll focus on the SpacetimeDB module to understand the data structures (tables) and state management (reducers) for enemies.
3.  **Investigate client-side components:** I'll review the React components responsible for rendering zombies and handling their client-side behavior.
4.  **Formulate a detailed plan:** Based on my findings, I will create a step-by-step plan that outlines the necessary changes on both the server and the client to implement the "conga line" zombie group.

I will begin by listing the contents of the `client/src/components/` and `server/src/` directories to get an initial overview of the relevant files.
Ran tool

I've located `Zombie.tsx`, `ZombieManager.tsx`, and `ZombieBrain.tsx` in `client/src/components/`. Next, I'll check `server/src/` for the server-side logic.
Ran tool
Okay, the server-side logic seems to be contained within `lib.rs`, `player_logic.rs`, and `common.rs`. I see no specific file for zombie logic, which suggests it's likely integrated into `lib.rs` or one of the other files.

Now I will analyze the existing zombie implementation, starting with the client-side components. I'll read through `ZombieManager.tsx`, `Zombie.tsx`, and `ZombieBrain.tsx` to understand how they work together. I'll start with `ZombieManager.tsx`.
Read file: 
My apologies, I made an error in the previous step. I need to specify the lines to read. I will read the entire `ZombieManager.tsx` file to get a complete picture of its functionality.
Read file: client/src/components/ZombieManager.tsx
I have now reviewed `ZombieManager.tsx`.

Here's a summary of my findings:

*   **`ZombieManager`:** This is the main component responsible for the lifecycle of all zombies. It loads the 3D model and animations once and shares them across all instances for performance. It's responsible for spawning zombies, tracking their deaths, and respawning them. It uses a `ZombieResourceContext` to provide shared assets to `ZombieInstance` components. It also exposes a global `checkPlayerAttack` function that the `Player` component calls to detect hits.
*   **`ZombieInstance`:** This component represents a single zombie. It handles its own AI state, movement, animation, and death sequence. Each instance has its own `AnimationMixer`. It uses the `useZombieResources` hook to get the shared model and animations.
*   **Spawning Logic:** `generateSafeZombiePosition` is used to find a suitable location to spawn a new zombie, ensuring it's not too close to or too far from players. New zombies are spawned when the component mounts and when a certain number of zombies are killed (`handleZombieKilled`).
*   **AI:** The `updateAdvancedAI` function in `ZombieInstance` calls `makeZombieDecision` from `ZombieBrain.ts` to decide the zombie's next action (wander, chase, attack, etc.).

Next, I will examine `Zombie.tsx` and `ZombieBrain.tsx`. Since `ZombieBrain.tsx` seems to contain the core AI logic, I'll start there.
Read file: client/src/components/ZombieBrain.tsx
I've analyzed `ZombieBrain.tsx`.

Here are the key takeaways:

*   **`makeZombieDecision`:** This is the core function that determines a zombie's behavior. It's a state machine that transitions between 'idle', 'pursuing', 'attacking', and 'wandering'.
*   **State:** The function can take an optional `ZombieState` object to maintain state between calls, allowing for more complex, multi-step behaviors (like screaming before chasing).
*   **Player Detection:** It uses `findClosestPlayer` to locate the nearest player. If a player is within `DISTANCE_TO_PLAYER_BEFORE_CHASING`, the zombie will start to pursue them.
*   **Attack Logic:** When within `STRIKING_DISTANCE`, the zombie enters an attack sequence: it first rotates to face the player, then performs an attack animation.
*   **Wandering:** If no player is nearby, the zombie has a chance to wander in a random direction. Otherwise, it remains idle.

The logic is client-only. The server is not involved in the zombie AI, it only stores and syncs player and (presumably) zombie state. The zombies are not persisted in the database, they are client-side entities managed by `ZombieManager`. This is a critical piece of information.

Now I will look at `Zombie.tsx`. Since I have already reviewed `ZombieManager.tsx` and `ZombieBrain.tsx`, reading `Zombie.tsx` will complete my understanding of the client-side zombie implementation.
Read file: client/src/components/Zombie.tsx
I've reviewed `Zombie.tsx`. This component appears to be an older or alternative implementation of a zombie.

Here's a comparison with `ZombieManager.tsx` and `ZombieInstance.tsx`:

*   **Standalone vs. Managed:** `Zombie.tsx` is a self-contained component that loads its own model and animations. `ZombieManager.tsx` loads these resources once and provides them to multiple `ZombieInstance` components, which is a much more performant approach for handling many zombies.
*   **AI Logic:** `Zombie.tsx` contains its own AI state machine directly within the component's `useFrame` hook. The `ZombieManager`/`ZombieInstance` duo delegates the AI logic to `ZombieBrain.tsx`, which is a better separation of concerns.
*   **Instantiation:** It appears `Zombie.tsx` is not currently used in the application. `GameScene.tsx` likely instantiates `ZombieManager`, which in turn creates the individual `ZombieInstance`s. I will verify this by checking the contents of `GameScene.tsx`.

Given this, `Zombie.tsx` seems to be deprecated or a remnant of a previous implementation. The current, active zombie system is `ZombieManager`, `ZombieInstance`, and `ZombieBrain`. Therefore, for the new conga line feature, I will focus on modifying this newer system.

Now, I'll examine the server-side code to understand how game state is managed. I'll start with `server/src/lib.rs`, which is the main entry point for the SpacetimeDB module. This will reveal if there are any existing tables or reducers for zombies.
Read file: server/src/lib.rs
The analysis of `server/src/lib.rs` confirms a critical architectural aspect: **there is no server-side logic or state for zombies.**

*   **No Zombie Table:** There are tables for `PlayerData` and `LoggedOutPlayerData`, but nothing for zombies.
*   **No Zombie Reducers:** The reducers (`register_player`, `update_player_input`) are all focused on player actions.
*   **Client-Side Authority:** This confirms that zombies are purely client-side entities. The `ZombieManager` on each client creates and manages its own set of zombies. They are not synchronized across clients, meaning each player sees a different set of zombies.

This has significant implications for the "conga line" feature. To have a synchronized group of zombies that all players can see and interact with, we will need to add server-side state management for them.

### Tactical Deep Dive Summary & Implementation Plan

Based on the deep dive, here is a summary of the current architecture and a plan to implement the synchronized conga line zombie group.

**Current Architecture:**

1.  **Server:** Manages player data (`PlayerData` table) and relays player state changes to all clients. It is completely unaware of zombies.
2.  **Client (`ZombieManager.tsx`):** Each client independently creates, manages, and destroys its own population of zombies. The AI (`ZombieBrain.tsx`) runs locally on each client for its own zombies. There is no shared state for zombies between clients.

**Implementation Plan:**

To create a synchronized zombie group, we need to make them "real" entities on the server. This will involve changes to both the server and the client.

**Phase 1: Server-Side Implementation (Rust)**

1.  **Create a `ZombieData` Table:** In `server/src/lib.rs`, define a new `#[spacetimedb::table]` called `ZombieData`. This table will store the state for each zombie.
    *   **Fields:**
        *   `zombie_id`: A unique identifier (e.g., `u64` with `#[auto_inc]`).
        *   `group_id`: An identifier to associate this zombie with a specific conga line group.
        *   `position`: `Vector3`
        *   `rotation`: `Vector3`
        *   `health`: `i32`
        *   `animation`: `String`
        *   `leader_id`: An optional `u64` that points to the `zombie_id` of the zombie it's following. The first zombie in the line will have this as `None`.
        *   `target_player_identity`: An optional `Identity` of the player the leader is chasing.

2.  **Create a `ZombieGroup` Table:** Also in `lib.rs`, define a `#[spacetimedb::table]` called `ZombieGroup`. This will track the state of each conga line group.
    *   **Fields:**
        *   `group_id`: A unique identifier.
        *   `leader_zombie_id`: The `zombie_id` of the current leader of the group.
        *   `is_wiped`: A boolean to track if the entire group has been defeated.

3.  **Implement Zombie Spawning Logic:**
    *   Create a new reducer, `spawn_zombie_group`, that creates 6 `ZombieData` entries and one `ZombieGroup` entry.
    *   This reducer will set up the "conga line" hierarchy by setting the `leader_id` for each zombie to point to the one in front of it.
    *   The leader of the line (`leader_id: None`) will be spawned first. The rest will be spawned in a line behind it.
    *   This reducer can be called initially in the `init` function, and then again when a group is wiped.

4.  **Implement Zombie AI Reducer:**
    *   Create a new reducer called `update_zombies`. This will be called periodically from the `game_tick` reducer.
    *   This reducer will iterate through all `ZombieData` entries.
    *   **Leader Logic:** For the leader of each group (where `leader_id` is `None`), it will find the nearest player and update its `position` and `rotation` to move towards that player. The `target_player_identity` will be updated.
    *   **Follower Logic:** For follower zombies, the reducer will update their `position` and `rotation` to follow the `position` of their `leader_id`. A fixed distance should be maintained.

5.  **Implement Zombie Death Logic:**
    *   Create a new reducer, `damage_zombie(zombie_id: u64, damage: i32)`.
    *   When a player attacks, the client will call this reducer.
    *   The reducer will decrease the zombie's health. If health reaches zero, the `ZombieData` entry is deleted.
    *   When a zombie is deleted, we must check if it was a leader. If so, the next zombie in the line becomes the new leader. If the whole group is wiped, the `is_wiped` flag in the `ZombieGroup` table is set to `true`, and after a delay, the `spawn_zombie_group` reducer is called to respawn them.

**Phase 2: Client-Side Implementation (TypeScript/React)**

1.  **Update `ZombieManager.tsx`:**
    *   Subscribe to the new `zombie` table in `subscribeToTables`.
    *   Remove the existing client-side spawning logic. The manager will now simply render zombies based on the data received from the server.
    *   Instead of a `zombieCount` prop, it will get its data from the new `zombie` table subscription.
    *   The `checkPlayerAttack` function will be modified. Instead of killing the zombie directly on the client, it will call the `damage_zombie` reducer on the server.

2.  **Update `ZombieInstance.tsx` and `ZombieBrain.tsx`:**
    *   The client-side AI will be significantly simplified or removed. The `makeZombieDecision` function in `ZombieBrain.tsx` will no longer be needed for this new type of zombie, as the server will dictate its position and animation.
    *   `ZombieInstance` will become a "dumb" component that simply receives props (position, rotation, animation) from `ZombieManager` and renders the model. It will no longer have its own AI state.

3.  **Generate TypeScript Bindings:**
    *   After making the server-side changes, run `spacetime generate` to create the new TypeScript bindings for the `ZombieData` and `ZombieGroup` tables and the new reducers.

This plan establishes a clear path to implementing the requested feature. The most significant change is shifting the authority for zombie state and AI from the client to the server, which is necessary for a shared, multiplayer experience with these new entities. The existing client-side zombie system can remain for the "fodder" zombies, and this new system can coexist with it.

Do you have any questions or would you like me to adjust this plan? I am ready to proceed with the implementation when you are.