# Enemy NPC Technical Implementation

Technical documentation for the client-side zombie AI system. All enemy logic is client-side only with no server representation.

## Core Components

### ZombieManager.tsx - Main Controller

**Resource Context System:**
```typescript
interface ZombieResources {
  model: THREE.Group | null;
  animationClips: Record<string, THREE.AnimationClip>;
  isLoaded: boolean;
}
const ZombieResourceContext = createContext<ZombieResources>()
```

**Configuration Constants:**
```typescript
const SPAWN_SETTINGS = {
  MIN_DISTANCE_FROM_PLAYERS: 12,
  MAX_DISTANCE_FROM_PLAYERS: 35, 
  WORLD_SIZE: 60,
  MAX_SPAWN_ATTEMPTS: 50,
  FALLBACK_EDGE_DISTANCE: 0.4
};

const KNOCKBACK_CONFIG = {
  ATTACK_RANGE: 4.0,
  FACING_LENIENCY: 0.3,
  FORCE: 90.0,
  HEIGHT: 24.0,
  GRAVITY: -60.0,
  DECAY: 0.96,
  MAX_KILLS_AT_A_TIME: 1
};
```

**Key State Variables:**
- `zombieInstancesRef`: `Map<string, { positionRef, triggerDeath }>` - Registry for attack detection
- `deadZombies`: `Set<string>` - Tracks removed zombies
- `killCount`: Respawn trigger counter (resets every 3 kills)
- `totalKillCount`: UI display counter (never resets)
- `currentLoadingIndex`: Sequential loading control

**Attack Detection Logic:**
```typescript
const checkPlayerAttack = (playerPosition: THREE.Vector3, playerRotation: THREE.Euler, attackRange = 4.0) => {
  const forwardDirection = new THREE.Vector3(0, 0, 1).applyEuler(playerRotation);
  
  for (const [zombieId, zombieData] of zombieInstancesRef.current) {
    const distance = playerPosition.distanceTo(zombiePos);
    if (distance <= attackRange) {
      const directionToZombie = new THREE.Vector3().subVectors(zombiePos, playerPosition).normalize();
      const dot = forwardDirection.dot(directionToZombie);
      if (dot > KNOCKBACK_CONFIG.FACING_LENIENCY) {
        // Valid hit - trigger death with knockback
        zombieData.triggerDeath(directionToZombie);
      }
    }
  }
}
```

### ZombieBrain.tsx - AI Decision Engine

**Core Function:**
```typescript
export function makeZombieDecision(
  zombiePosition: THREE.Vector3,
  players: ReadonlyMap<string, PlayerData>,
  zombieState?: ZombieState
): ZombieDecision
```

**Decision Interface:**
```typescript
interface ZombieDecision {
  action: 'idle' | 'chase' | 'attack' | 'wander' | 'rotate' | 'scream';
  duration: number;
  animation: string;
  speed: number;
  targetPosition?: THREE.Vector3;
  targetRotation?: number;
}
```

**State Tracking:**
```typescript
interface ZombieState {
  mode: 'idle' | 'pursuing' | 'attacking' | 'wandering';
  targetPlayerId?: string;
  lastDecisionTime?: number;
  currentTargetPosition?: THREE.Vector3;
  rotationStartTime?: number;
  targetRotation?: number;
}
```

**Key Constants:**
```typescript
const DISTANCE_TO_PLAYER_BEFORE_CHASING = 17.0;
export const STRIKING_DISTANCE = 2.0;
```

**Decision Logic Flow:**
1. `findClosestPlayer()` - Uses horizontal distance only (`y=0` for both positions)
2. If player within `DISTANCE_TO_PLAYER_BEFORE_CHASING`:
   - If within `STRIKING_DISTANCE`: Attack sequence
   - Else: Chase/scream sequence
3. If no nearby players: 30% chance wander, else idle

**Attack Sequence Timing:**
- Rotation phase: 500ms
- Attack animation: 1000ms  
- Total sequence: 1500ms before returning to chase

### Individual Zombie Instance Logic

**Core State Variables:**
```typescript
const [currentDecision, setCurrentDecision] = useState<ZombieDecision | null>(null);
const [decisionTimer, setDecisionTimer] = useState<number>(0);
const zombieStateRef = useRef<ZombieState>({ mode: 'idle' });
const zombiePosition = useRef<THREE.Vector3>(new THREE.Vector3(...position));
const zombieRotation = useRef<THREE.Euler>(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
```

**AI Update Loop in useFrame:**
```typescript
const updateAdvancedAI = (delta: number) => {
  setDecisionTimer(prev => prev + delta);
  
  if (!currentDecision || decisionTimer >= (currentDecision.duration / 1000)) {
    const newDecision = makeZombieDecision(zombiePosition.current, players, zombieStateRef.current);
    setCurrentDecision(newDecision);
    setDecisionTimer(0);
    
    if (newDecision.animation !== currentAnimation) {
      playZombieAnimation(newDecision.animation);
    }
  }
  
  if (currentDecision) {
    executeBehavior(currentDecision, zombiePosition, zombieRotation, delta);
  }
}
```

**Movement Execution:**
```typescript
const executeBehavior = (decision: ZombieDecision, zombiePosition, zombieRotation, delta) => {
  switch (decision.action) {
    case 'chase':
    case 'wander':
      if (decision.targetPosition) {
        const direction = new THREE.Vector3().subVectors(decision.targetPosition, zombiePosition.current);
        const distanceToTarget = direction.length();
        
        if (decision.action === 'wander' || distanceToTarget > STRIKING_DISTANCE) {
          direction.normalize();
          const moveAmount = direction.multiplyScalar(decision.speed * delta);
          zombiePosition.current.add(moveAmount);
        }
        
        if (direction.length() > 0) {
          const targetRotation = Math.atan2(direction.x, direction.z);
          zombieRotation.current.y = targetRotation;
        }
      }
      break;
      
    case 'rotate':
    case 'scream':
      // Smooth rotation implementation
      break;
      
    case 'attack':
      // Face target without movement
      break;
  }
}
```

**Death Physics:**
```typescript
const triggerDeath = (knockbackDirection: THREE.Vector3) => {
  const normalizedDirection = knockbackDirection.clone().normalize();
  knockbackVelocity.current.set(
    normalizedDirection.x * KNOCKBACK_CONFIG.FORCE,
    KNOCKBACK_CONFIG.HEIGHT,
    normalizedDirection.z * KNOCKBACK_CONFIG.FORCE
  );
  
  // In useFrame:
  knockbackVelocity.current.y += KNOCKBACK_CONFIG.GRAVITY * delta;
  zombiePosition.current.add(knockbackVelocity.current.clone().multiplyScalar(delta));
  knockbackVelocity.current.x *= KNOCKBACK_CONFIG.DECAY;
  knockbackVelocity.current.z *= KNOCKBACK_CONFIG.DECAY;
}
```

## Animation System

**Animation Constants:**
```typescript
export const ZOMBIE_ANIMATIONS = {
  IDLE: 'idle',
  SCREAM: 'scream', 
  WALKING: 'walking',
  RUNNING: 'running',
  ATTACK: 'attack',
  DEATH: 'death'
};
```

**Animation Paths:**
```typescript
const animationPaths: Record<string, string> = {
  [ZOMBIE_ANIMATIONS.IDLE]: '/models/zombie-2-converted/Zombie Walk.glb',
  [ZOMBIE_ANIMATIONS.SCREAM]: '/models/zombie-2-converted/Zombie Scream.glb',
  [ZOMBIE_ANIMATIONS.WALKING]: '/models/zombie-2-converted/Zombie Walk.glb',
  [ZOMBIE_ANIMATIONS.RUNNING]: '/models/zombie-2-converted/Zombie Running.glb',
  [ZOMBIE_ANIMATIONS.ATTACK]: '/models/zombie-2-converted/Zombie Punching.glb',
  [ZOMBIE_ANIMATIONS.DEATH]: '/models/zombie-2-converted/Zombie Death.glb'
};
```

**Root Motion Removal:**
```typescript
const makeZombieAnimationInPlace = (clip: THREE.AnimationClip) => {
  const positionTracks = clip.tracks.filter(track => track.name.endsWith('.position'));
  const rootPositionTrack = positionTracks.find(track => 
    track.name.toLowerCase().includes('hips') || 
    track.name.toLowerCase().includes('root')
  );
  
  if (rootPositionTrack instanceof THREE.VectorKeyframeTrack) {
    const values = rootPositionTrack.values;
    for (let i = 0; i < values.length; i += 3) {
      values[i] = 0;     // Remove X movement
      values[i + 2] = 0; // Remove Z movement
    }
  }
}
```

## Spawning Algorithm

**Position Generation:**
```typescript
const generateSafeZombiePosition = (players, minDistance, maxAttempts = 50) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let x: number, z: number;
    
    if (players.size > 0 && Math.random() < 0.8) { // 80% circular spawning
      const nearestPlayer = Array.from(players.values())[0];
      const playerPos = new THREE.Vector3(nearestPlayer.position.x, 0, nearestPlayer.position.z);
      
      const angle = Math.random() * Math.PI * 2;
      const distance = minDistance + Math.random() * (maxDistance - minDistance);
      const noiseX = (Math.random() - 0.5) * 6;
      const noiseZ = (Math.random() - 0.5) * 6;
      
      x = playerPos.x + Math.cos(angle) * distance + noiseX;
      z = playerPos.z + Math.sin(angle) * distance + noiseZ;
    } else { // 20% random positioning
      x = (Math.random() - 0.5) * SPAWN_SETTINGS.WORLD_SIZE;
      z = (Math.random() - 0.5) * SPAWN_SETTINGS.WORLD_SIZE;
    }
    
    // Validate against all players
    const candidatePos = new THREE.Vector3(x, 0, z);
    let validPosition = true;
    for (const player of players.values()) {
      const playerPos = new THREE.Vector3(player.position.x, 0, player.position.z);
      const distance = candidatePos.distanceTo(playerPos);
      if (distance < minDistance || distance > maxDistance) {
        validPosition = false;
        break;
      }
    }
    
    if (validPosition) return [x, 0, z];
  }
  
  // Fallback positioning logic...
}
```

## Performance Optimization

**Sequential Loading:**
- `LOADING_DELAY = 300ms` between zombie spawns
- `currentLoadingIndex` controls which zombie loads next
- `onLoadComplete()` callback advances index

**Resource Sharing:**
- Single model load in `ZombieResourceContext`
- Shared `animationClips` across all instances
- Individual `AnimationMixer` per zombie
- Model cloning via `gltf.scene` for each instance

**Memory Management:**
- Dead zombies removed from `zombieInstancesRef`
- Fade sequence with opacity animation before cleanup
- `setDeadZombies()` prevents re-rendering removed zombies

## Integration Points

**Global Attack Function:**
- Exposed on `window.checkZombieAttack` for Player components
- Called from Player.tsx attack input handling
- Returns array of hit zombie data for feedback

**GameReady System:**
- `gameReadyCallbacks.onZombieProgress()` for loading feedback
- `gameReadyCallbacks.onZombiesReady()` when complete
- Progress calculation: `20% + (loadedCount/totalCount) * 80%`

**Kill Counter Integration:**
- `onKillCountChange(totalKillCount)` callback to parent
- Respawn trigger every 3 kills via `killCount % 3 === 0`
- Spawns 3 new zombies with 1-second delay for dramatic effect 