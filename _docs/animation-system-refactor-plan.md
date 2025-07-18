### Technical Plan: Animation System Refactor

**Objective:** Address two critical bugs in the player animation system with minimal, targeted code changes:
1.  **Animation Interruption:** High-priority actions (like attacks) are prematurely cut short by low-priority state updates from the server (like walking).
2.  **T-Pose Flashing:** The character model briefly flashes into a T-pose when transitioning between certain animations, especially after an attack or taking damage.

This plan outlines a careful refactoring strategy that preserves all existing combat and movement functionality while creating a more robust and predictable animation system.

---

### Part 1: Root Cause Synthesis

The two bugs stem from separate but related issues in the animation state management within `client/src/components/Player.tsx`.

1.  **Interruption Cause:** The client unconditionally plays whatever animation is dictated by the server's `playerData.currentAnimation` state. There is no client-side logic to protect a high-priority, in-progress animation (like a combo attack) from being overridden by a low-priority, yet more recent, server state update (like `walk-forward`). This creates a race condition where an attack is interrupted by a movement animation.

2.  **T-Pose Cause:** The T-pose flash is caused by a "gap" in animation control. The current system uses an `onFinished` event listener to trigger a new animation state. This listener calls `playAnimation`, which uses separate `fadeOut()` and `fadeIn()` calls. This creates a brief moment where no single animation has full weight in the mixer, causing the model to revert to its default T-pose. `clampWhenFinished` is set on one-shot animations, but its effect is nullified by the immediate, non-atomic transition logic.

---

### Part 2: Refactoring Strategy

We will implement two key changes to solve these issues. This approach is designed to be minimal and avoids broad refactoring of the combat or movement logic.

#### Step 1: Implement an Animation Priority System

This will solve the animation interruption bug. We will introduce a numerical priority for each animation, allowing the system to intelligently ignore low-priority updates.

**File to Modify:** `client/src/characterConfigs.ts`

**Action:**
1.  Define and export a new constant `ANIMATION_PRIORITIES`. This map will assign a numerical priority to base animation states. This centralizes configuration and keeps it out of the component logic.

    ```typescript
    // In client/src/characterConfigs.ts

    export const ANIMATION_PRIORITIES: Record<string, number> = {
      // Highest priority
      death: 100,
      powerup: 95, // Sword power-up is very high priority
      damage: 90,
      cast: 80,
      attack4: 78, // Combo finishers have higher priority
      attack3: 77,
      attack2: 76,
      attack1: 75,
      'ninja-run-attack': 74,
      jump: 70,
      falling: 65,
      landing: 60,
      // Lowest priority for override
      'ninja-run': 30,
      'run-forward': 20,
      'run-back': 20,
      'run-left': 20,
      'run-right': 20,
      'walk-forward': 10,
      'walk-back': 10,
      'walk-left': 10,
      'walk-right': 10,
      idle: 0,
    };
    ```

#### Step 2: Refactor `playAnimation` to be Atomic and Priority-Aware

This change, targeting the `playAnimation` function in `client/src/components/Player.tsx`, will solve both the T-pose flash and implement the priority system.

**File to Modify:** `client/src/components/Player.tsx`

**Actions:**
1.  **Import `ANIMATION_PRIORITIES`**.
2.  **Refactor the `playAnimation` function.**
    *   **Add Priority Check:** The function must first compare the priority of the requested animation to the one currently playing. It should only proceed if the new animation's priority is greater than or equal to the current one. This is the guard that prevents interruptions.
    *   **Use `crossFadeTo`:** Replace the separate `fadeOut()` and `fadeIn()` calls with a single, atomic call to `currentAction.crossFadeTo(targetAction, duration)`. This eliminates the transition gap that causes the T-pose flash.

    ```typescript
    // New, refactored playAnimation function in client/src/components/Player.tsx

    import { ANIMATION_PRIORITIES } from '../characterConfigs'; // Import the priorities

    const playAnimation = useCallback((name: string, crossfadeDuration = 0.3) => {
      if (!mixer || Object.keys(animations).length === 0) return;
    
      let actualAnimationName = name;
      let timeScaleIsSword = false;
    
      if (isSwordEquipped) {
        const swordAnimationName = `sword_${name}`;
        if (animations[swordAnimationName]) {
          actualAnimationName = swordAnimationName;
          timeScaleIsSword = true;
        }
      }
    
      if (!animations[actualAnimationName]) {
        if (name !== ANIMATIONS.IDLE && animations[ANIMATIONS.IDLE]) {
          actualAnimationName = ANIMATIONS.IDLE;
          timeScaleIsSword = false;
        } else {
          return;
        }
      }

      const baseNewName = name; // e.g., 'attack1'
      const baseCurrentName = currentAnimation.replace('sword_', ''); // e.g., 'idle'

      const newPriority = ANIMATION_PRIORITIES[baseNewName] ?? 0;
      const currentPriority = ANIMATION_PRIORITIES[baseCurrentName] ?? 0;

      // PRIORITY CHECK: Only play if new priority is higher or equal, or if transitioning to idle.
      if (newPriority < currentPriority && baseNewName !== ANIMATIONS.IDLE) {
        // console.log(`🚫 Animation blocked: ${name} (p:${newPriority}) has lower priority than ${currentAnimation} (p:${currentPriority})`);
        return;
      }
      
      const targetAction = animations[actualAnimationName];
      const currentAction = animations[currentAnimation];

      if (currentAction && currentAction !== targetAction) {
        // ATOMIC TRANSITION: Use crossFadeTo to prevent T-pose flash.
        currentAction.crossFadeTo(targetAction, crossfadeDuration);
      }
      
      const timeScale = getAnimationTimeScale(characterClass, name, timeScaleIsSword);
      targetAction.setEffectiveTimeScale(timeScale)
                  .setEffectiveWeight(1)
                  .play();
                      
      setCurrentAnimation(actualAnimationName);
    }, [animations, currentAnimation, mixer, isSwordEquipped, characterClass]);
    ```

#### Step 3: Remove the Redundant `onFinished` Event Listener

This final change simplifies the code and allows the priority system and `clampWhenFinished` to work as intended.

**File to Modify:** `client/src/components/Player.tsx`

**Action:**
1.  **Delete the `useEffect` hook** that adds a `mixer.addEventListener('finished', ...)` listener (currently located around lines 1368-1442). This entire hook is now obsolete and counterproductive.

---

### How This Preserves Existing Functionality

This plan is carefully constructed to be a surgical fix, not a rewrite.

*   **Combat Logic is Untouched:** The combo system in `useFrame`, which tracks `comboStage` and calls `playAnimation`, does not need to be changed. The refactored `playAnimation` now correctly *protects* these combos from being interrupted.
*   **Movement Logic is Untouched:** The client-side prediction and server reconciliation for position and rotation are not affected. When the player stops moving, the server state will update to `idle`. The client will call `playAnimation('idle')`, which will correctly transition from a walk/run animation because `idle` has the lowest priority and the transition from a higher priority (walk) to a lower one is allowed.
*   **`clampWhenFinished` Now Works:** With the `onFinished` listener gone, `clampWhenFinished = true` (which is already set on one-shot animations during loading) will now correctly hold the final frame of an attack animation. The `useFrame` loop will naturally detect that the attack state is over and call `playAnimation('idle')` on the next frame, and `crossFadeTo` will ensure a seamless blend from that held pose to the new idle animation. 