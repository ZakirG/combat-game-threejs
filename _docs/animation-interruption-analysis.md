The user is experiencing premature animation interruptions, particularly with sword attacks. Based on the initial file analysis, the issue likely stems from a conflict between client-side animation playback and server-side state updates. I will now conduct a deep dive into the relevant parts of the codebase to formulate a detailed analysis and propose solutions.

### Analysis of the Animation System

1.  **Client-Side Animation Control (`client/src/components/Player.tsx`)**

    *   **Animation State:** The `Player` component manages the active animation using the `currentAnimation` state and the `playAnimation` function. This function is responsible for fading out the previous animation and fading in the new one.
    *   **Animation Triggers:** Animations are primarily triggered by player input (for the local player) and by state updates from the server (for remote players).
    *   **Attack Logic:** The `handleAttack` function initiates attack animations. It includes a combo system that sequences through `attack1`, `attack2`, etc. A timeout (`attackTimeoutRef`) is used to return the player to an idle state after an attack, but this only seems to apply if the animation doesn't have a `'finished'` event handler.
    *   **Sword Animations:** The `playAnimation` function correctly attempts to play sword-specific animations (e.g., `sword_attack1`) when `isSwordEquipped` is true. This is handled by checking for the existence of animations prefixed with `sword_`.
    *   **`useEffect` for Animation Completion:** A critical `useEffect` hook listens for the `'finished'` event on the animation mixer. When a non-looping animation (like an attack) completes, this hook is responsible for transitioning the player back to an appropriate idle or movement animation.

2.  **Server-Side State (`server/src/player_logic.rs` and `server/src/lib.rs`)**

    *   **Server-Authoritative State:** The server maintains the canonical state for each player in the `player` table, which includes `position`, `rotation`, and `current_animation`.
    *   **Input Processing:** The `update_player_input` reducer in `lib.rs` calls `update_input_state` in `player_logic.rs`.
    *   **Animation State Echo:** The server logic in `update_input_state` currently takes the `client_animation` string sent from the client and directly sets it as the new `player.current_animation`. The server is essentially echoing back the animation state that the client reports. It does not perform its own determination of what the animation should be.
    *   **State Updates:** The server continuously broadcasts updates to the `player` table to all clients.

3.  **Synchronization and the Source of Interruption**

    The core problem arises from the way server state updates are handled on the client, particularly for the **local player**.

    *   In `Player.tsx`, the `useFrame` hook continuously runs. Inside this hook, there's logic that reconciles the client's predicted state with the authoritative state received from the server (`playerData`).
    *   The animation logic for the **local player** is driven by their direct input. When you press the attack button, `handleAttack` is called, and `playAnimation('attack1')` is executed immediately.
    *   Simultaneously, the client is sending its input state (including that an attack was initiated) to the server. The server processes this, updates the `player` table, and broadcasts the new state back to all clients.
    *   Here is the race condition: The local client has already started playing the attack animation. A fraction of a second later, an update for the *local player's own data* comes back from the server.
    *   The `useFrame` logic for **remote players** (and likely for the local player as well, through state reconciliation) checks the `playerData.current_animation` field from the server and forces the animation to match.
    *   If the player was moving when they attacked, the server might process the movement part of the input first and set the `current_animation` to `walk-forward` or `run-forward`. When this update reaches the client, it will interrupt the attack animation that just started and force the character back into a movement animation.

    Specifically, the interruption happens because there is no mechanism to protect a client-side animation from being overridden by a server state update. The client should be allowed to finish its current high-priority animation (like an attack or a jump) before being forced into a new state by the server.

### Instances of Animation Interruption

The primary point of interruption is within the `useFrame` hook in `client/src/components/Player.tsx`, where the component reacts to incoming `playerData` from the server.

```typescript
// Inside useFrame in client/src/components/Player.tsx

// For Remote Players (and likely affecting the local player through reconciliation):
if (!isLocalPlayer) {
    // ... position and rotation interpolation ...

    // THIS IS THE INTERRUPTION POINT:
    if (playerData.current_animation && playerData.current_animation !== currentAnimation) {
        playAnimation(playerData.current_animation);
    }
}
```

Anytime the `playerData.current_animation` from the server differs from the animation the client is currently playing, the `playAnimation` function is called, causing the current animation to be cut short. This affects attack animations most noticeably because they are long, non-looping actions that are easily interrupted by the more frequent state updates related to movement.

When holding a sword, the problem is exacerbated because the player is likely trying to perform multi-stage combos. Each button press in the combo initiates a new attack animation, creating more opportunities for a conflicting server state update to arrive and interrupt the sequence.

### Suggestions for a Fix

To resolve this, you need to introduce a client-side "animation lock" or a priority system that prevents low-priority animations (like idle/walk/run) from interrupting high-priority, non-looping animations (like attack/cast/jump/death).

Here are two potential approaches:

**Suggestion 1: Implement a Client-Side Animation Lock**

1.  **Introduce a new state variable**, for example, `isAnimationLocked`, initialized to `false`.
2.  When a high-priority, non-looping animation is played (e.g., in `handleAttack`), set `isAnimationLocked` to `true`.
3.  In the `useEffect` hook that listens for the `'finished'` event, set `isAnimationLocked` back to `false` when the animation completes.
4.  Modify the logic that handles server updates in `useFrame`. Before calling `playAnimation` based on the server's `current_animation`, check if `isAnimationLocked` is `true`. If it is, ignore the server's requested animation and let the current one finish.

    ```typescript
    // In Player.tsx, inside useFrame
    if (!isLocalPlayer) {
        // ...

        // Check for animation lock before changing animation
        if (!isAnimationLocked && playerData.current_animation && playerData.current_animation !== currentAnimation) {
            playAnimation(playerData.current_animation);
        }
    }
    ```

**Suggestion 2: Create an Animation Priority System**

This is a more robust, long-term solution.

1.  **Define Animation Priorities:** Create an object or map that assigns a numerical priority to each animation.
    *   `DEATH`: 100 (highest)
    *   `DAMAGE`: 90
    *   `ATTACK`/`CAST`: 80
    *   `JUMP`/`FALLING`/`LANDING`: 70
    *   `RUN`: 20
    *   `WALK`: 10
    *   `IDLE`: 0 (lowest)

2.  **Modify `playAnimation`:** When `playAnimation` is called, it should compare the priority of the requested animation with the priority of the `currentAnimation`.
3.  The new animation should only play if its priority is greater than or equal to the current one. If an attack (`priority 80`) is playing, a walk update from the server (`priority 10`) would be ignored.
4.  The `useEffect` for the `'finished'` event would still be responsible for transitioning back to `IDLE` (priority 0), which would then allow any other animation to play.

Both suggestions focus on making the client-side animation system more intelligent and less susceptible to being prematurely overridden by server updates, which is the root cause of the issue. I will await your feedback before proceeding. 