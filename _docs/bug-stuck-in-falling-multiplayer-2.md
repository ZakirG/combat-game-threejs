Root cause (short version)
-------------------------------------------------
For every `Player` (local and remote) the component:

1.  Starts the model in the **FALLING** animation and stores  
    `localPositionRef.current.y = SPAWN_ALTITUDE` (≈ 90).

2.  Declares a guard that blocks all later animation changes while the
    player is “still falling”:

```ts
const isHighAltitudeFalling =
        currentAnimation === ANIMATIONS.FALLING &&
        localPositionRef.current.y > 20;
…
if (isHighAltitudeFalling) {
    // ignore server-driven animation updates
}
```

3.  •  For the **local** player `localPositionRef` is continuously updated by
       the physics section (`velocityY`, gravity, ground collision, …), so the Y
       value quickly drops below 20, the guard turns false and animations
       resume.  
    •  For every **remote** player `localPositionRef` is **never touched
       again**.  
       The visual mesh is lerped to the ground with

```ts
group.current.position.lerp(serverPosition,…)
```

       but the reference used by the guard is still ≈ 90, therefore  
       `isHighAltitudeFalling` stays *true forever*.  
       All subsequent server animation strings (idle, walk, run, …) are
       ignored, so the remote avatar remains locked in the initial “falling”
       pose.

Step-by-step trace
------------------
1. Remote client A presses keys → `App.tsx/sendInput` sends `update_player_input`
   with the correct `current_animation` (idle / walk / run …).

2. Server writes that string into
   `player.current_animation`.

3. Client B receives the row update:  
   `playerData.currentAnimation` now holds “idle” (or walk/run).

4. `Player.tsx` on client B enters the effect watching
   `playerData.currentAnimation`.

5. Because `isHighAltitudeFalling` is still `true`, the early-exit path is
   taken ⇒ `playAnimation(serverAnim)` is **not** executed.

6. The remote avatar you see in B therefore never exits the falling animation.

Why each client sees the *other* player frozen: both sides run the code path
described above.

Suggestions to fix (no code edits made)
---------------------------------------
Pick one of the following (all are tiny, self-contained changes):

1. **Scope the “high-altitude” guard to the local character only**

```ts
const isHighAltitudeFalling =
      isLocalPlayer &&               // add this check
      currentAnimation === ANIMATIONS.FALLING &&
      localPositionRef.current.y > 20;
```

2. **Update the Y reference for remote players**

Inside the “REMOTE PLAYER INTERPOLATION” block add:

```ts
localPositionRef.current.y = serverPosition.y;
```

3. **Base the guard on the rendered mesh position instead of the stale ref**

```ts
const isHighAltitudeFalling =
      currentAnimation === ANIMATIONS.FALLING &&
      group.current.position.y > 20;   // uses real-time value
```

Any one of these will allow the animation-update effect to play the incoming
server animation, eliminating the “stuck in falling” bug for remote players.