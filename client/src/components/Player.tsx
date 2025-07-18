/**
 * Player.tsx
 * 
 * Component responsible for rendering and controlling individual player entities:
 * 
 * Key functionality:
 * - Handles 3D character model rendering with appropriate animations
 * - Implements physics-based player movement and collision detection
 * - Manages player state synchronization in multiplayer environment
 * - Processes user input for character control (keyboard/mouse)
 * - Handles different player classes with unique visual appearances
 * - Distinguishes between local player (user-controlled) and remote players
 * 
 * Props:
 * - playerClass: Determines visual appearance and possibly abilities
 * - username: Unique identifier displayed above character
 * - position: Initial spawn coordinates
 * - color: Optional custom color for character
 * - isLocal: Boolean determining if this is the user-controlled player
 * - socketId: Unique network identifier for player synchronization
 * 
 * Technical implementation:
 * - Uses React Three Fiber for 3D rendering within React
 * - Implements Rapier physics for movement and collision
 * - Manages socket.io communication for multiplayer state sync
 * - Handles animation state management for character model
 * 
 * Related files:
 * - GameScene.tsx: Parent component that instantiates players
 * - PlayerUI.tsx: UI overlay for player status information
 * - Server socket handlers: For network state synchronization
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAnimations, Html, Sphere } from '@react-three/drei';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { TextureLoader } from 'three';
import { PlayerData, InputState } from '../generated';
import { 
  getCharacterConfig, 
  getCharacterGameplayConfig,
  getAnimationPath, 
  getAnimationTimeScale, 
  getCurrentAnimationTable,
  CharacterConfig,
  CharacterGameplayConfig,
  CharacterAnimationTable,
  SPAWN_ALTITUDE 
} from '../characterConfigs';
import { GameReadyCallbacks } from '../types/gameReady';
import { triggerHitScreenshake, triggerLandingScreenshake, updateScreenshake, SCREENSHAKE_PRESETS } from '../utils/screenshake';
import { BloodEffectManager } from '../utils/bloodEffect';
import { CoinEffectManager } from '../utils/coinEffect';
import { playBloodSpurtSound } from '../utils/audioUtils';

// Define animation names for reuse
const ANIMATIONS = {
  IDLE: 'idle',
  WALK_FORWARD: 'walk-forward',
  WALK_BACK: 'walk-back',
  WALK_LEFT: 'walk-left',
  WALK_RIGHT: 'walk-right',
  RUN_FORWARD: 'run-forward',
  RUN_BACK: 'run-back',
  RUN_LEFT: 'run-left',
  RUN_RIGHT: 'run-right',
  NINJA_RUN: 'ninja-run', // High-speed sprint animation (activated after 2s of sprint+forward)
  JUMP: 'jump',
  ATTACK: 'attack1',
  ATTACK2: 'attack2', // Combo attack animation
  ATTACK3: 'attack3', // Third combo attack animation
  ATTACK4: 'attack4', // Fourth combo attack animation
  NINJA_ATTACK: 'ninja-run-attack', // Special ninja run attack animation (Sprinting Forward Roll)
  CAST: 'cast',
  DAMAGE: 'damage',
  DEATH: 'death',
  FALLING: 'falling',
  LANDING: 'landing',
  POWERUP: 'powerup', // Sword power-up animation
};

// Note: Movement speeds are now defined per-character in characterConfigs.ts

// --- Client-side Prediction Constants ---
const SERVER_TICK_RATE = 60; // Assuming server runs at 60Hz
const SERVER_TICK_DELTA = 1 / SERVER_TICK_RATE; // Use this for prediction
const POSITION_RECONCILE_THRESHOLD = 0.4;
const ROTATION_RECONCILE_THRESHOLD = 0.1; // Radians
const RECONCILE_LERP_FACTOR = 0.15;

// --- Camera Constants ---
const CAMERA_MODES = {
  FOLLOW: 'follow',  // Default camera following behind player
  ORBITAL: 'orbital' // Orbital camera that rotates around the player
};

// --- Physics Constants ---
const GRAVITY = -120.0; // Very strong gravity for dramatic falling acceleration
const JUMP_FORCE = 20.0; // Higher upward velocity for faster, more responsive jumping
const GROUND_LEVEL = 0.0; // Ground Y position
const TERMINAL_VELOCITY = -80.0; // Higher maximum falling speed for faster descent

interface PlayerProps {
  playerData: PlayerData;
  isLocalPlayer: boolean;
  onRotationChange?: (rotation: THREE.Euler) => void;
  onPositionChange?: (position: THREE.Vector3) => void; // Callback for position updates
  currentInput?: InputState; // Prop to receive current input for local player
  isDebugArrowVisible?: boolean; // Prop to control debug arrow visibility
  isDebugPanelVisible?: boolean; // Prop to control general debug helpers visibility
  gameReadyCallbacks?: GameReadyCallbacks; // Callbacks for GameReady events
  gameReady?: boolean; // Controls when physics should be enabled
  environmentCollisionBoxes?: THREE.Box3[]; // Collision boxes for environment objects
}

export const Player: React.FC<PlayerProps> = ({
  playerData,
  isLocalPlayer,
  onRotationChange,
  onPositionChange, // Destructure position callback
  currentInput, // Receive input state
  isDebugArrowVisible = false, 
  isDebugPanelVisible = false, // Destructure with default false
  gameReadyCallbacks, // Destructure GameReady callbacks
  gameReady = false, // Destructure gameReady state
  environmentCollisionBoxes = [] // Destructure collision boxes with default empty array
}) => {
  const group = useRef<THREE.Group>(null!);
  const { camera } = useThree();
  const dataRef = useRef<PlayerData>(playerData);
  const characterClass = playerData.characterClass || 'Zaqir Mufasa';
  
  // Get character configuration for gameplay context - memoized to prevent unnecessary re-renders
  const characterConfig = useMemo(() => getCharacterConfig(characterClass), [characterClass]);
  const gameplayConfig = useMemo(() => getCharacterGameplayConfig(characterClass), [characterClass]);
  
  // Model management
  const [modelLoaded, setModelLoaded] = useState(false);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [mixer, setMixer] = useState<THREE.AnimationMixer | null>(null);
  const [animations, setAnimations] = useState<Record<string, THREE.AnimationAction>>({});
  const [currentAnimation, setCurrentAnimation] = useState<string>(ANIMATIONS.FALLING);
  const [isModelVisible, setIsModelVisible] = useState<boolean>(false);
  const [physicsEnabled, setPhysicsEnabled] = useState<boolean>(false);
  
  // Attack animation state
  const [isAttacking, setIsAttacking] = useState<boolean>(false);
  const attackTimeoutRef = useRef<number | null>(null);
  
  // Combo system state
  const [lastAttackTime, setLastAttackTime] = useState<number>(0);
  const [comboActive, setComboActive] = useState<boolean>(false);
  const [comboStage, setComboStage] = useState<number>(0); // 0-7 for 8-hit combo (0=none, 1-7=combo stages)
  const [currentAttackIsSword, setCurrentAttackIsSword] = useState<boolean>(false); // Track current attack type
  const COMBO_WINDOW = 2000; // 2 seconds to perform combo (changed from 3 to match requirement)
  
  // Ninja run sprint system state
  const [sprintStartTime, setSprintStartTime] = useState<number>(0);
  const [isNinjaRunActive, setIsNinjaRunActive] = useState<boolean>(false);
  const [lastValidSprintTime, setLastValidSprintTime] = useState<number>(0); // Track last time sprint+forward was valid
  const NINJA_RUN_ACTIVATION_TIME = 1000; // 1 second of sprint+forward to activate ninja run
  const NINJA_RUN_GRACE_PERIOD = 100; // 100ms grace period for brief key releases
  
  // Debug: Track ninja run state changes and sync with server
  useEffect(() => {
    console.log(`🥷 [Ninja Run State] isNinjaRunActive changed to: ${isNinjaRunActive}`);
    
    // Sync ninja run state with server (only for local player)
    if (isLocalPlayer && onPositionChange) {
      // Use the connection from App.tsx to call the server reducer
      const conn = (window as any).spacetimeConnection;
      if (conn && conn.reducers && conn.reducers.setNinjaRunStatus) {
        conn.reducers.setNinjaRunStatus(isNinjaRunActive);
        console.log(`🥷 [Server Sync] Sent ninja run status to server: ${isNinjaRunActive}`);
      } else {
        console.warn(`🥷 [Server Sync] Could not sync ninja run status - connection or reducer not available`);
      }
    }
  }, [isNinjaRunActive, isLocalPlayer]);
  
  // Debug: Character info on mount
  useEffect(() => {
    console.log(`🥷 [Character Debug] Character: ${characterClass}, Is Local Player: ${isLocalPlayer}`);
    console.log(`🥷 [Character Debug] Movement speeds:`, characterConfig.movement);
  }, []);
  
  // Blood effect system
  const bloodEffectManagerRef = useRef<BloodEffectManager | null>(null);
  
  // Coin effect system
  const coinEffectManagerRef = useRef<CoinEffectManager | null>(null);
  
  // Sword equipping system
  const [equippedSword, setEquippedSword] = useState<THREE.Group | null>(null);
  const [rightHandBone, setRightHandBone] = useState<THREE.Bone | null>(null);
  const swordAttachmentRef = useRef<THREE.Group | null>(null);
  
  // Glow effect system for sword equipping
  const [glowMesh, setGlowMesh] = useState<THREE.Mesh | null>(null);
  const glowTimeoutRef = useRef<number | null>(null);
  
  // Create glow effect for character model
  const createGlowEffect = useCallback(() => {
    if (!model || !group.current || glowMesh) return; // Don't create if already exists
    
    // console.log('[Player] ✨ Creating 4-layer expanding glow effect for sword equipping...');
    
    // Get the scene reference (same way blood effects do it)
    const scene = group.current.parent as THREE.Scene;
    if (!scene) {
      console.warn('[Player] ⚠️ No scene found for glow effect');
      return;
    }
    
    // Create a group to hold all 4 glow layers
    const glowGroup = new THREE.Group();
    
    // Define 4 layers with different sizes and opacity levels
    const layers = [
      { radius: 0.8, opacity: 0.6, name: 'innermost' },   // Innermost - least translucent
      { radius: 1.2, opacity: 0.4, name: 'inner' },       // Inner 
      { radius: 1.6, opacity: 0.25, name: 'outer' },      // Outer
      { radius: 2.0, opacity: 0.15, name: 'outermost' }   // Outermost - most translucent
    ];
    
    // Create each layer
    layers.forEach((layer, index) => {
      const glowGeometry = new THREE.SphereGeometry(layer.radius, 32, 32);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: layer.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      
      const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
      glowGroup.add(glowSphere);
      
      // console.log(`[Player] ✨ Created ${layer.name} glow layer (radius: ${layer.radius}, opacity: ${layer.opacity})`);
    });
    
    // Get player's current world position
    const playerWorldPosition = new THREE.Vector3();
    group.current.getWorldPosition(playerWorldPosition);
    
    // Position glow group at player's world position
    glowGroup.position.copy(playerWorldPosition);
    glowGroup.position.y += 1; // Slightly above ground to be more visible
    
    // console.log('[Player] 📍 Player world position:', playerWorldPosition);
    // console.log('[Player] 📍 4-layer glow positioned at:', glowGroup.position);
    
    // Add start time for animation tracking
    (glowGroup as any).startTime = performance.now();
    (glowGroup as any).initialOpacities = layers.map(layer => layer.opacity);
    
    // Add glow group directly to scene
    scene.add(glowGroup);
    setGlowMesh(glowGroup as any); // Store as glowMesh for tracking
    
    // console.log('[Player] ✅ 4-layer expanding glow effect created and added to scene');
    
    // Remove glow after exactly 1 second
    glowTimeoutRef.current = setTimeout(() => {
      // console.log('[Player] ⏰ Removing 4-layer glow effect after 1 second');
      removeGlowEffect();
    }, 1000);
    
  }, [model, glowMesh]);
  
  // Remove glow effect
  const removeGlowEffect = useCallback(() => {
    if (glowMesh && group.current) {
      // console.log('[Player] ✨ Removing 4-layer glow effect...');
      
      // Get scene reference and remove glow group
      const scene = group.current.parent as THREE.Scene;
      if (scene) {
        scene.remove(glowMesh);
        // console.log('[Player] ✅ Glow group removed from scene');
      } else {
        // Fallback: remove from parent if it exists
        if (glowMesh.parent) {
          glowMesh.parent.remove(glowMesh);
          // console.log('[Player] ✅ Glow group removed from parent');
        }
      }
      
      // Dispose of all geometries and materials in the group to prevent memory leaks
      glowMesh.children.forEach((child: THREE.Mesh) => {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material && 'dispose' in child.material) {
          (child.material as THREE.Material).dispose();
        }
      });
      
      setGlowMesh(null);
    }
    
    if (glowTimeoutRef.current) {
      clearTimeout(glowTimeoutRef.current);
      glowTimeoutRef.current = null;
    }
  }, [glowMesh]);
  
  // Cleanup glow effect on unmount
  useEffect(() => {
    return () => {
      if (glowTimeoutRef.current) {
        clearTimeout(glowTimeoutRef.current);
      }
    };
  }, []);
  
  // Power-up animation state - blocks all other animations and movement while active
  const [isPlayingPowerUp, setIsPlayingPowerUp] = useState<boolean>(false);
  const powerUpTimeoutRef = useRef<number | null>(null);
  
  // Movement freeze during power-up
  const [isMovementFrozen, setIsMovementFrozen] = useState<boolean>(false);
  const frozenPositionRef = useRef<THREE.Vector3 | null>(null);
  
  // Immediate race condition protection - ref is updated synchronously
  const isPlayingPowerUpRef = useRef<boolean>(false);
  
  // Derive sword equipped state from equippedSword
  const isSwordEquipped = useMemo(() => !!equippedSword, [equippedSword]);
  
  // Track previous sword state to prevent unnecessary effect triggers
  const prevSwordEquippedRef = useRef<boolean>(false);

  // --- Client Prediction State ---
  // For gameplay, force high altitude spawn on first entrance
  const initialY = SPAWN_ALTITUDE; // Always force high altitude regardless of server
  const localPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(playerData.position.x, initialY, playerData.position.z));
  

  const localRotationRef = useRef<THREE.Euler>(new THREE.Euler(0, 0, 0, 'YXZ')); // Initialize with zero rotation
  const debugArrowRef = useRef<THREE.ArrowHelper | null>(null); // Declare the ref for the debug arrow
  
  // --- Physics State ---
  const velocityY = useRef<number>(0); // Y velocity for gravity and jumping
  const isOnGround = useRef<boolean>(false); // Start in air for high altitude spawn
  const wasJumpPressed = useRef<boolean>(false); // Track jump input to prevent continuous jumping
  const spawnTime = useRef<number>(Date.now()); // Track when player spawned
  
  // --- Attack State ---
  const wasAttackPressed = useRef<boolean>(false); // Track attack input to prevent continuous attacking
  
  // Camera control variables
  const isPointerLocked = useRef(false);
  const zoomLevel = useRef(5);
  const targetZoom = useRef(5);
  
  // Orbital camera variables
  const [cameraMode, setCameraMode] = useState<string>(CAMERA_MODES.FOLLOW);
  const orbitalCameraRef = useRef({
    distance: 8,
    height: 3,
    angle: 0,
    elevation: Math.PI / 6, // Approximately 30 degrees
    autoRotate: false,
    autoRotateSpeed: 0.5,
    lastUpdateTime: Date.now(),
    playerFacingRotation: 0 // Store player's facing direction when entering orbital mode
  });
  
  // Ref to track if animations have been loaded already to prevent multiple loading attempts
  const animationsLoadedRef = useRef(false);

  // --- State variables ---

  // --- Collision Detection ---
  const checkEnvironmentCollision = useCallback((position: THREE.Vector3, radius: number = 1.0): boolean => {
    if (!environmentCollisionBoxes || environmentCollisionBoxes.length === 0) {
      return false; // No collision data yet, allow movement
    }
    
    // Create a simple sphere around the player for collision detection
    const playerSphere = new THREE.Box3(
      new THREE.Vector3(position.x - radius, position.y - radius, position.z - radius),
      new THREE.Vector3(position.x + radius, position.y + radius, position.z + radius)
    );
    
    // Check against all environment collision boxes
    for (const collisionBox of environmentCollisionBoxes) {
      if (playerSphere.intersectsBox(collisionBox)) {
        return true; // Collision detected
      }
    }
    
    return false; // No collision
  }, [environmentCollisionBoxes]);

  // --- Client-Side Movement Calculation (Matches Server Logic *before* Sign Flip) ---
  const calculateClientMovement = useCallback((currentPos: THREE.Vector3, currentRot: THREE.Euler, inputState: InputState, delta: number): THREE.Vector3 => {
    // // console.log(`[Move Calc] cameraMode: ${cameraMode}`); // Suppressed log
    
    // Skip if no movement input
    if (!inputState.forward && !inputState.backward && !inputState.left && !inputState.right) {
      return currentPos;
    }

    let worldMoveVector = new THREE.Vector3();
    
    // Determine movement speed based on ninja run state and sprint
    let speed = characterConfig.movement.walkSpeed; // Default to walk speed
    if (inputState.sprint) {
      if (isNinjaRunActive && inputState.forward) {
        // Use high-speed ninja run speed when ninja run is active and moving forward
        speed = characterConfig.movement.sprintRunSpeed;
        // console.log('🥷 [Ninja Run Speed] Using ninja run speed:', speed, 'vs normal run:', characterConfig.movement.runSpeed);
      } else {
        // Use normal run speed for regular sprinting
        speed = characterConfig.movement.runSpeed;
        // if (isNinjaRunActive) {
        //   console.log('🥷 [Ninja Run Speed] Ninja run active but not moving forward, using run speed:', speed);
        // }
      }
    }
    let rotationYaw = 0;

    // 1. Calculate local movement vector based on WASD
    let localMoveX = 0;
    let localMoveZ = 0;
    if (cameraMode === CAMERA_MODES.ORBITAL) {
        if (inputState.forward) localMoveZ += 1;
        if (inputState.backward) localMoveZ -= 1;
        if (inputState.left) localMoveX += 1;
        if (inputState.right) localMoveX -= 1;
    } else {
        if (inputState.forward) localMoveZ -= 1;
        if (inputState.backward) localMoveZ += 1;
        if (inputState.left) localMoveX -= 1;
        if (inputState.right) localMoveX += 1;
    }
    const localMoveVector = new THREE.Vector3(localMoveX, 0, localMoveZ);

    // Normalize if diagonal movement
    if (localMoveVector.lengthSq() > 1.1) {
      localMoveVector.normalize();
    }

    // 2. Determine which rotation to use based on camera mode
    if (cameraMode === CAMERA_MODES.FOLLOW) {
      // --- FOLLOW MODE: Use current player rotation ---
      rotationYaw = currentRot.y;
    } else {
      // --- ORBITAL MODE: Use fixed rotation from when mode was entered ---
      rotationYaw = orbitalCameraRef.current.playerFacingRotation;
    }

    // 3. Rotate the LOCAL movement vector by the appropriate YAW to get the WORLD direction
    worldMoveVector = localMoveVector.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationYaw);

    // 4. Scale by speed and delta time
    worldMoveVector.multiplyScalar(speed * delta);

    // 5. Calculate the final position based on the raw world movement
    // The server-side sign flip is handled during reconciliation, not prediction.
    const proposedPosition = currentPos.clone().add(worldMoveVector);

    // 6. Check for collision with environment objects
    if (checkEnvironmentCollision(proposedPosition, 1.0)) {
      // Try sliding along walls by testing X and Z movement separately
      const xOnlyPosition = currentPos.clone().add(new THREE.Vector3(worldMoveVector.x, 0, 0));
      const zOnlyPosition = currentPos.clone().add(new THREE.Vector3(0, 0, worldMoveVector.z));
      
      if (!checkEnvironmentCollision(xOnlyPosition, 1.0)) {
        // Can move in X direction only
        return xOnlyPosition;
      } else if (!checkEnvironmentCollision(zOnlyPosition, 1.0)) {
        // Can move in Z direction only
        return zOnlyPosition;
      } else {
        // Can't move at all, stay at current position
        return currentPos;
      }
    }

    return proposedPosition;
  }, [cameraMode, checkEnvironmentCollision, isNinjaRunActive, characterConfig.movement]); // Depend on cameraMode, collision detection, ninja run state, and movement config

  // --- Effect for model loading ---
  useEffect(() => {
    if (!playerData) return; // Guard clause
    
    // Emit initial progress for local player
    if (isLocalPlayer && gameReadyCallbacks) {
      gameReadyCallbacks.onCharacterProgress(0, 'Starting to load character...');
    }
    
    const loader = new FBXLoader();
    const textureLoader = new TextureLoader();

    loader.load(
      characterConfig.modelPath,
      (fbx) => {
        
        // Apply character-specific scaling for gameplay
        fbx.scale.setScalar(gameplayConfig.scale);
        // Ensure proper initial positioning - no underground spawning
        fbx.position.set(0, 0, 0);

        // DEBUG: Dump skeleton information to verify that the model really has a skinned armature and to see bone names.
        const skinnedMeshes: THREE.SkinnedMesh[] = [];
        const regularMeshes: THREE.Mesh[] = [];
        const bones: THREE.Bone[] = [];
        const allObjects: {name: string, type: string}[] = [];
        
        fbx.traverse((child) => {
          allObjects.push({name: child.name || 'Unnamed', type: child.type});
          if (child instanceof THREE.SkinnedMesh) {
            skinnedMeshes.push(child as THREE.SkinnedMesh);
          } else if (child instanceof THREE.Mesh) {
            regularMeshes.push(child as THREE.Mesh);
          } else if (child instanceof THREE.Bone) {
            bones.push(child as THREE.Bone);
          }
        });
        
        // console.log(`%c[Debug] ★ Model structure for ${characterClass}:`, "color: #00bfff");
        // console.log(`%c[Debug]   - SkinnedMesh objects: ${skinnedMeshes.length}`, "color: #00bfff");
        // console.log(`%c[Debug]   - Regular Mesh objects: ${regularMeshes.length}`, "color: #00bfff");
        // console.log(`%c[Debug]   - Bone objects: ${bones.length}`, "color: #00bfff");
        // console.log(`%c[Debug]   - All objects (first 20):`, "color: #00bfff", allObjects.slice(0, 20));
        
        skinnedMeshes.forEach((sm, idx) => {
          // console.log(`%c[Debug]   [${idx}] SkinnedMesh="${sm.name}" bones=${sm.skeleton?.bones.length}` , "color: #00bfff");
          if (sm.skeleton?.bones) {
            // console.log(`%c[Debug]     First 10 bone names:`, "color: #00bfff", sm.skeleton.bones.slice(0, 10).map(b => b.name));
          }
        });
        
        if (skinnedMeshes.length === 0) {
          // console.log(`%c[Debug] ⚠️ NO SKINNED MESHES FOUND! This model is static geometry and cannot be animated.`, "color: #ff0000");
          // console.log(`%c[Debug] ⚠️ You need to re-export from Mixamo with "With Skin" option enabled.`, "color: #ff0000");
        }

        // Process materials for better lighting and shadows
        // console.log(`[Player Model Effect ${playerData.username}] Processing materials for ${characterClass} model`);
        
        fbx.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            // console.log(`[Player Model Effect ${playerData.username}] Found mesh: ${child.name || 'Unnamed'}`);
            // console.log(`[Player Model Effect ${playerData.username}] Material type:`, child.material?.type);
            // console.log(`[Player Model Effect ${playerData.username}] Material:`, child.material);
            
            // Check if material exists and debug its properties
            if (child.material) {
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              // console.log(`[Player Model Effect ${playerData.username}] Found ${materials.length} material(s) for mesh`);
              
              // Process each material
              const newMaterials = materials.map((material: any, index: number) => {
                
                // Convert MeshPhongMaterial to MeshStandardMaterial for better PBR lighting
                if (material.type === 'MeshPhongMaterial' || material.type === 'MeshBasicMaterial' || material.type === 'MeshLambertMaterial') {
                  // console.log(`[Player Model Effect ${playerData.username}] Converting ${material.type} to MeshStandardMaterial for material ${index}`);
                  
                  const newMaterial = new THREE.MeshStandardMaterial({
                    map: material.map,
                    color: material.color || new THREE.Color(1, 1, 1),
                    emissive: material.emissive || new THREE.Color(0, 0, 0),
                    transparent: material.transparent || false,
                    opacity: material.opacity !== undefined ? material.opacity : 1.0,
                    roughness: 0.7,
                    metalness: 0.1,
                  });
                  
                  // Enable skinning for animations
                  (newMaterial as any).skinning = true;
                  return newMaterial;
                } else {
                  // Material is already StandardMaterial, just ensure skinning
                  if ('skinning' in material) {
                    (material as any).skinning = true;
                  }
                  
                  // Fix any color issues
                  if (material.color && material.color.r === 0 && material.color.g === 0 && material.color.b === 0) {
                    // console.log(`[Player Model Effect ${playerData.username}] Material ${index} color is black, setting to white`);
                    material.color.setRGB(1, 1, 1);
                  }
                  
                  return material;
                }
              });
              
              // Apply the processed materials back to the mesh
              child.material = newMaterials.length === 1 ? newMaterials[0] : newMaterials;
              
              // Ensure shadows are enabled
              child.castShadow = true;
              child.receiveShadow = true;
              
              // Force material update
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.needsUpdate = true);
              } else {
                child.material.needsUpdate = true;
              }
              
              // console.log(`[Player Model Effect ${playerData.username}] Configured ${newMaterials.length} material(s) for mesh: ${child.name || 'Unnamed'}`);
            } else {
              console.warn(`[Player Model Effect ${playerData.username}] No material found for mesh: ${child.name || 'Unnamed'}`);
              
              // Create a basic material if none exists
              const defaultMaterial = new THREE.MeshStandardMaterial({
                color: new THREE.Color(0.8, 0.6, 0.4), // Skin-like color
                roughness: 0.7,
                metalness: 0.1,
              });
              (defaultMaterial as any).skinning = true;
              child.material = defaultMaterial;
              child.castShadow = true;
              child.receiveShadow = true;
              
              // console.log(`[Player Model Effect ${playerData.username}] Applied default material to mesh: ${child.name || 'Unnamed'}`);
            }
          }
        });

        setModel(fbx); 
        
        // Emit progress for model loading completion
        if (isLocalPlayer && gameReadyCallbacks) {
          gameReadyCallbacks.onCharacterProgress(50, 'Character model loaded, loading animations...');
        }
        
        if (group.current) {
          group.current.add(fbx);
          // Apply character-specific position adjustment for gameplay
          fbx.position.y = gameplayConfig.yOffset;
          // Hide model initially to prevent T-pose visibility
          fbx.visible = false;
          
          // --- Remove embedded lights safely --- 
          try { 
            // console.log(`[Player Model Effect ${playerData.username}] Traversing loaded FBX to find embedded lights...`);
            const lightsToRemove: THREE.Light[] = [];
            
            // First pass: collect all lights
            fbx.traverse((child) => {
              if (child && child instanceof THREE.Light) { 
                // console.log(`[Player Model Effect ${playerData.username}] --- FOUND EMBEDDED LIGHT --- Name: ${child.name || 'Unnamed'}, Type: ${child.type}`);
                lightsToRemove.push(child);
              }
            });
            
            // Second pass: remove all collected lights
            lightsToRemove.forEach(light => {
              // console.log(`[Player Model Effect ${playerData.username}] Removing light: ${light.name || 'Unnamed'}`);
              light.removeFromParent();
            });
          } catch (traverseError) {
             console.error(`[Player Model Effect ${playerData.username}] Error during fbx.traverse for light removal:`, traverseError);
          }
          // --- END TRAVERSE ATTEMPT --- 

        } 
        
        const newMixer = new THREE.AnimationMixer(fbx);
        setMixer(newMixer);
        setModelLoaded(true);
        
        // Initialize local refs for local player
        if (isLocalPlayer) {
          // Force high altitude spawn for dramatic entrance
          localPositionRef.current.set(playerData.position.x, SPAWN_ALTITUDE, playerData.position.z);
          localRotationRef.current.set(0, playerData.rotation.y, 0, 'YXZ');
          // Reset spawn time when model loads and player position is set
          spawnTime.current = Date.now();
          // console.log(`[CRITICAL] Player spawn INITIALIZED for ${playerData.username} - Server Y=${playerData.position.y.toFixed(1)}, Forced Local Y=${SPAWN_ALTITUDE}`);
          
          // Check if server is sending wrong position
          if (playerData.position.y < SPAWN_ALTITUDE - 100) {
            console.error(`[ERROR] Server sent low Y position: ${playerData.position.y.toFixed(1)} instead of ${SPAWN_ALTITUDE}!`);
          }
        }
        
      },
      (progress) => { /* Optional progress log */ },
      (error: any) => {
        console.error(`[Player Model Effect ${playerData.username}] Error loading model ${characterConfig.modelPath}:`, error);
      }
    );

    // Cleanup for model loading effect
    return () => {
      if (mixer) mixer.stopAllAction();
      if (model && group.current) group.current.remove(model);
      if (attackTimeoutRef.current) {
        clearTimeout(attackTimeoutRef.current);
      }
      // Dispose geometry/material if needed
      setModel(null);
      setMixer(null);
      setModelLoaded(false);
      animationsLoadedRef.current = false;
    };
      }, [characterClass]); // ONLY depend on character class to prevent re-renders

  // New useEffect to load animations when mixer is ready
  useEffect(() => {
    if (mixer && model && !animationsLoadedRef.current) {
      // console.log("Mixer and model are ready, loading animations...");
      animationsLoadedRef.current = true;
      loadAnimations(mixer);
    }
  }, [mixer, model, characterClass]);

  // Enable physics when game is ready and model is visible
  useEffect(() => {
    if (gameReady && isModelVisible && !physicsEnabled) {
      setPhysicsEnabled(true);
      // console.log(`⚡ [PHYSICS] Physics ENABLED for ${playerData.username} - GameReady complete! Starting dramatic fall from Y=${localPositionRef.current.y.toFixed(1)}`);
    }
  }, [gameReady, isModelVisible, physicsEnabled, playerData.username]);

  // Debug: Track when animations state actually updates
  useEffect(() => {
    if (Object.keys(animations).length > 0) {
      // console.log(`🎭 [Animation State] Animations state updated! Available: ${Object.keys(animations).length}`);
      // console.log(`🗡️ [Animation State] Sword animations available:`, Object.keys(animations).filter(key => key.startsWith('sword_')));
      
      // Check specifically for powerup animation
      const powerupAnim = `sword_${ANIMATIONS.POWERUP}`;
      if (animations[powerupAnim]) {
        // console.log(`⚡ [Animation State] Power-up animation '${powerupAnim}' is now available!`);
      }
    } else {
      // console.log(`🎭 [Animation State] Animations state cleared (length: 0)`);
    }
  }, [animations]);

  // Debug: Track power-up state changes
  useEffect(() => {
    // console.log(`⚡ [PowerUp State] isPlayingPowerUp changed to: ${isPlayingPowerUp}`);
  }, [isPlayingPowerUp]);

  // Debug: Track movement freeze state changes
  useEffect(() => {
    // console.log(`🧊 [Movement State] isMovementFrozen changed to: ${isMovementFrozen}`);
  }, [isMovementFrozen]);

  // Debug: Track power-up ref for race condition protection
  useEffect(() => {
    // console.log(`🛡️ [Race Protection Ref] isPlayingPowerUpRef is now: ${isPlayingPowerUpRef.current}`);
  }, [isPlayingPowerUp]); // Track when state changes to see if ref is in sync

  // Function to load animations using character configuration
  const loadAnimations = (mixerInstance: THREE.AnimationMixer) => {
    if (!mixerInstance) {
      console.error("Cannot load animations: mixer is not initialized");
      return;
    }
    
    // console.log(`Loading animations for ${characterClass}...`);
    
    // Load both default and sword animations if they exist
    const config = getCharacterConfig(characterClass);
    const animationPaths: Record<string, string> = {};
    
    // Load default animations
    if (config.animations?.default) {
      Object.entries(config.animations.default).forEach(([key, filename]) => {
        animationPaths[key] = getAnimationPath(characterClass, key, false);
      });
    } else {
      // Fallback to legacy animationTable
      Object.entries(config.animationTable).forEach(([key, filename]) => {
        animationPaths[key] = getAnimationPath(characterClass, key, false);
      });
    }
    
    // Load sword animations if they exist
    if (config.animations?.sword) {
      // console.log(`🗡️ [Debug] Loading sword animations for ${characterClass}:`, config.animations.sword);
      Object.entries(config.animations.sword).forEach(([key, filename]) => {
        const swordKey = `sword_${key}`;
        const animPath = getAnimationPath(characterClass, key, true);
        animationPaths[swordKey] = animPath;
        // console.log(`🗡️ [Debug] Sword animation mapping: ${key} → ${swordKey} → ${animPath}`);
      });
    } else {
      // console.log(`🗡️ [Debug] No sword animations found for ${characterClass}`);
    }
    
    // console.log('Animation paths (all variations):', animationPaths);
    // console.log(`🔍 [Debug] Looking for powerup in paths:`, animationPaths[`sword_${ANIMATIONS.POWERUP}`]);
    
    const loader = new FBXLoader();
    const newAnimations: Record<string, THREE.AnimationAction> = {};
    let loadedCount = 0;
    const totalCount = Object.keys(animationPaths).length;
    
    // console.log(`Will load ${totalCount} animations`);
    
    // Load each animation
    Object.entries(animationPaths).forEach(([name, path]) => {
      // console.log(`Loading animation "${name}" from ${path}`);
      
      // First check if the file exists
      fetch(path)
        .then(response => {
          if (!response.ok) {
            console.error(`❌ Animation file not found: ${path} (${response.status})`);
            loadedCount++;
            checkCompletedLoading();
            return;
          }
          
          // console.log(`✅ Animation file found: ${path}`);
          // File exists, proceed with loading
          loadAnimationFile(name, path, mixerInstance);
        })
        .catch(error => {
          console.error(`❌ Network error checking animation file ${path}:`, error);
          loadedCount++;
          checkCompletedLoading();
        });
    });

    // Function to check if all animations are loaded
    const checkCompletedLoading = () => {
      loadedCount++; // Increment here after load attempt (success or fail)
      if (loadedCount === totalCount) {
        const successCount = Object.keys(newAnimations).length;
        if (successCount === totalCount) {
          // console.log(`✅ All ${totalCount} animations loaded successfully.`);
        } else {
           console.warn(`⚠️ Loaded ${successCount}/${totalCount} animations. Some might be missing.`);
        }
        
        // Store all successfully loaded animations in component state
        setAnimations(newAnimations);
        
        // Debug: log all available animations
        // console.log("Available animations: ", Object.keys(newAnimations).join(", "));
        // console.log(`🎉 [Animation Loading] All animations loaded! Total: ${Object.keys(newAnimations).length}`);
        // console.log(`🗡️ [Animation Loading] Sword animations:`, Object.keys(newAnimations).filter(key => key.startsWith('sword_')).join(", "));
        console.log(`🥷 [Animation Loading] Ninja run animation loaded:`, !!newAnimations[ANIMATIONS.NINJA_RUN]);
        
        // Emit progress for animations loading completion
        if (isLocalPlayer && gameReadyCallbacks) {
          gameReadyCallbacks.onCharacterProgress(75, 'Animations loaded, preparing character...');
        }
        
        // Play falling animation if available for high altitude spawn
        if (newAnimations['falling']) {
          // Use setTimeout to ensure state update has propagated and mixer is ready
          setTimeout(() => {
             if (animationsLoadedRef.current) { // Check if still relevant
                 // console.log('Playing initial falling animation for high altitude spawn');
                 // Use the local newAnimations reference to be sure it's available
                 const fallingAction = newAnimations['falling'];
                 fallingAction.reset()
                           .setEffectiveTimeScale(1)
                           .setEffectiveWeight(1)
                           .fadeIn(0.3)
                           .play();
                 setCurrentAnimation('falling');
                 
                 // Make model visible IMMEDIATELY for dramatic high-altitude entrance
                 if (model && model.visible !== undefined) {
                   model.visible = true;
                   setIsModelVisible(true);
                   // Physics will be enabled when gameReady becomes true
                   // console.log(`🎬 [CRITICAL] Model NOW VISIBLE for ${playerData.username} at Y=${localPositionRef.current.y.toFixed(1)} - waiting for game ready to enable physics`);
                   
                   // Ensure we're in falling animation state for server animation override protection
                   if (localPositionRef.current.y > 20) {
                     // console.log(`🔄 [FALLING] Ensuring falling animation is active for high altitude spawn`);
                     setCurrentAnimation(ANIMATIONS.FALLING);
                   }
                   
                   // Emit character ready event for local player
                   if (isLocalPlayer && gameReadyCallbacks) {
                     // Ensure character is at spawn altitude when becoming ready
                     localPositionRef.current.y = SPAWN_ALTITUDE;
                     velocityY.current = 0; // Reset velocity for clean falling start
                     isOnGround.current = false; // Ensure falling state
                     
                     // console.log(`🚀 [CharacterReady] Character ready at Y=${SPAWN_ALTITUDE}, velocityY=${velocityY.current}, onGround=${isOnGround.current}`);
                     
                     gameReadyCallbacks.onCharacterProgress(100, 'Character is falling and ready!');
                     gameReadyCallbacks.onCharacterReady();
                   }
                 }
             }
          }, 0); // No delay - show model immediately for dramatic high-altitude entrance
        } else if (newAnimations['idle']) {
          // Fallback to idle if falling animation is not available
          setTimeout(() => {
             if (animationsLoadedRef.current) {
                 // console.log('Falling animation not found, playing initial idle animation as fallback');
                 const idleAction = newAnimations['idle'];
                 idleAction.reset()
                           .setEffectiveTimeScale(1)
                           .setEffectiveWeight(1)
                           .fadeIn(0.3)
                           .play();
                 setCurrentAnimation('idle');
                 
                 if (model && model.visible !== undefined) {
                   model.visible = true;
                   setIsModelVisible(true);
                   // Physics will be enabled when gameReady becomes true  
                   // console.log(`[Player] Model now visible for ${playerData.username} with idle animation playing (fallback) - waiting for game ready`);
                   
                   // Emit character ready event for local player (fallback case)
                   if (isLocalPlayer && gameReadyCallbacks) {
                     // Ensure character is at spawn altitude when becoming ready (even in fallback)
                     localPositionRef.current.y = SPAWN_ALTITUDE;
                     velocityY.current = 0; // Reset velocity for clean falling start
                     isOnGround.current = false; // Ensure falling state
                     
                     // console.log(`🚀 [CharacterReady-Fallback] Character ready at Y=${SPAWN_ALTITUDE}, velocityY=${velocityY.current}, onGround=${isOnGround.current}`);
                     
                     gameReadyCallbacks.onCharacterProgress(100, 'Character is ready (idle fallback)!');
                     gameReadyCallbacks.onCharacterReady();
                   }
                 }
             }
          }, 1500);
        } else {
          console.error('Neither falling nor idle animations found among loaded animations! Player might not animate initially.');
        }
      }
    };

    // Function to load an animation file
    const loadAnimationFile = (name: string, path: string, mixerInstance: THREE.AnimationMixer) => {
      if (!mixerInstance) {
        console.error(`Cannot load animation ${name}: mixer is not initialized`);
        // loadedCount is incremented in checkCompletedLoading call below
        checkCompletedLoading();
        return;
      }
      
      loader.load(
        path,
        (animFbx) => {
          try {
            if (!animFbx.animations || animFbx.animations.length === 0) {
              console.error(`No animations found in ${path}`);
              checkCompletedLoading(); // Call completion even on error
              return;
            }
            
            const clip = animFbx.animations[0];

            // DEBUG: List the first few track names so we can compare them to the bone names above.
            // console.log("%c[Debug] Track names in clip (first 20):", "color: #ff9900", clip.tracks.slice(0, 20).map(t => t.name));
            
            // Try to find hierarchy and parent bone
            let rootBoneName = '';
            animFbx.traverse((obj) => {
              if (obj.type === 'Bone' && !rootBoneName && obj.parent && obj.parent.type === 'Object3D') {
                rootBoneName = obj.name;
                // // console.log(`Found potential root bone for anim ${name}: ${rootBoneName}`);
              }
            });
            
            // Apply name to the clip
            clip.name = name;
            
            // Retarget the clip if needed
            const retargetedClip = retargetClip(clip, path);
            
            // Make sure we're in place (remove root motion)
            makeAnimationInPlace(retargetedClip);
            
            const action = mixerInstance.clipAction(retargetedClip);
            newAnimations[name] = action;
            
            // Set loop mode based on animation type
            const shouldLoop = (
              name === 'idle' ||
              name.startsWith('walk-') ||
              name.startsWith('run-') ||
              name === 'ninja-run' || // Ninja run should loop continuously
              name.includes('_idle') ||
              name.includes('_walk-') ||
              name.includes('_run-') ||
              name.includes('_ninja-run') // Sword version should also loop
            );
            
            // Special handling for power-up animation (should play once)
            const isPowerup = name.includes('powerup') || name.includes('_powerup');
            
            if (shouldLoop && !isPowerup) {
              action.setLoop(THREE.LoopRepeat, Infinity);
              // console.log(`🔄 [Loop Debug] Set ${name} to LOOP (infinite)`);
            } else {
              action.setLoop(THREE.LoopOnce, 1);
              action.clampWhenFinished = true;
              // console.log(`🔄 [Loop Debug] Set ${name} to ONCE (single)`);
            }
            
            // console.log(`✅ Animation "${name}" processed and ready.`);
          } catch (e) {
            console.error(`Error processing animation ${name}:`, e);
          }
          
          checkCompletedLoading(); // Call completion after processing
        },
        (progress) => {
          // Optional: Log animation loading progress for larger files
          // if (progress.total > 1000000) { // Only for large files
          //   // console.log(`Loading ${name}: ${Math.round(progress.loaded / progress.total * 100)}%`);
          // }
        },
        (error: any) => {
          console.error(`Error loading animation ${name} from ${path}: ${error.message || 'Unknown error'}`);
          checkCompletedLoading(); // Call completion even on error
        }
      );
    };
  };

  // Improve root motion removal function
  const makeAnimationInPlace = (clip: THREE.AnimationClip) => {
    // console.log(`🛠️ Making animation "${clip.name}" in-place`);
    
    const tracks = clip.tracks;
    const positionTracks = tracks.filter(track => track.name.endsWith('.position'));
    const rotationTracks = tracks.filter(track => track.name.endsWith('.rotation'));
    
    if (positionTracks.length === 0) {
      // console.log(`⚠️ No position tracks found in "${clip.name}"`);
    } else {
      // Find root track (try common names)
      let rootPositionTrack = positionTracks.find(track => 
        track.name.toLowerCase().includes('hips') || 
        track.name.toLowerCase().includes('root') || 
        track.name.toLowerCase().includes('armature')
      ) || positionTracks[0];
      
      // console.log(`Using root position track: ${rootPositionTrack?.name}`);
      
      // Remove X/Z translation from root (keep Y for jumps)
      if (rootPositionTrack instanceof THREE.VectorKeyframeTrack) {
        const values = rootPositionTrack.values;
        for (let i = 0; i < values.length; i += 3) {
          values[i] = 0;     // Remove X
          // Remove Y for Zaqir Mufasa due to tiny scale amplifying movements
          if (characterClass === 'Zaqir Mufasa') {
            values[i + 1] = 0; // Remove Y to prevent floating
          }
          // values[i + 1] = 0; // Keep Y for other characters
          values[i + 2] = 0; // Remove Z
        }
      }
      
      // Optionally remove root rotation if causing issues
      let rootRotationTrack = rotationTracks.find(track => 
        track.name.toLowerCase().includes('hips') || 
        track.name.toLowerCase().includes('root') || 
        track.name.toLowerCase().includes('armature')
      );
      
      if (rootRotationTrack instanceof THREE.QuaternionKeyframeTrack) {
        const values = rootRotationTrack.values;
        for (let i = 0; i < values.length; i += 4) {
          // Reset to identity quaternion (no rotation)
          values[i] = 0;
          values[i + 1] = 0;
          values[i + 2] = 0;
          values[i + 3] = 1;
        }
      }
    }
  };

  // Add a retargetClip function after makeAnimationInPlace
  const retargetClip = (clip: THREE.AnimationClip, sourceModelPath: string) => {
    if (!model) {
      console.warn("Cannot retarget: model not loaded");
      return clip;
    }
    
    // // console.log(`Retargeting animation "${clip.name}" from ${sourceModelPath}`);
    
    // Get source file basename (without extension)
    const sourceFileName = sourceModelPath.split('/').pop()?.split('.')[0] || '';
    const targetFileName = characterConfig.modelPath.split('/').pop()?.split('.')[0] || '';
    
    if (sourceFileName === targetFileName) {
      // // console.log(`Source and target models are the same (${sourceFileName}), no retargeting needed`);
      return clip;
    }
    
    // // console.log(`Retargeting from "${sourceFileName}" to "${targetFileName}"`);
    
    // Create a new animation clip
    const newTracks: THREE.KeyframeTrack[] = [];
    
    // Process each track to replace bone names if needed
    clip.tracks.forEach(track => {
      // The track name format is usually "boneName.property"
      const trackNameParts = track.name.split('.');
      if (trackNameParts.length < 2) {
        // console.warn(`Strange track name format: ${track.name}`);
        newTracks.push(track);
        return;
      }
      
      const boneName = trackNameParts[0];
      const property = trackNameParts.slice(1).join('.');
      
      // Try to find corresponding bone in target model
      // Check if we need any bone name mappings from source to target
      let targetBoneName = boneName;
      
      // ** Bone Name Mapping (Example) **
      // If source uses "bip01_" prefix and target uses "mixamorig", map them:
      // if (boneName.startsWith('bip01_')) {
      //   targetBoneName = boneName.replace('bip01_', 'mixamorig');
      // }
      // Add other mappings as needed based on model skeletons
      
      // Add the fixed track
      const newTrackName = `${targetBoneName}.${property}`;
      
      // Only create new track if the name needs to change
      if (newTrackName !== track.name) {
        // // console.log(`Remapping track: ${track.name} → ${newTrackName}`);
        
        // Create a new track with same data but new name
        let newTrack: THREE.KeyframeTrack;
        
        if (track instanceof THREE.QuaternionKeyframeTrack) {
          newTrack = new THREE.QuaternionKeyframeTrack(
            newTrackName,
            Array.from(track.times),
            Array.from(track.values)
          );
        } else if (track instanceof THREE.VectorKeyframeTrack) {
          newTrack = new THREE.VectorKeyframeTrack(
            newTrackName,
            Array.from(track.times),
            Array.from(track.values)
          );
        } else {
          // Fallback for NumberKeyframeTrack or others
          newTrack = new THREE.KeyframeTrack(
            newTrackName,
            Array.from(track.times),
            Array.from(track.values)
          );
        }
        
        newTracks.push(newTrack);
      } else {
        newTracks.push(track); // No change needed, push original track
      }
    });
    
    // Create a new animation clip with the fixed tracks
    return new THREE.AnimationClip(
      clip.name,
      clip.duration,
      newTracks,
      clip.blendMode
    );
  };

  // Update playAnimation to have better logging and sword support
  const playAnimation = useCallback((name: string, crossfadeDuration = 0.3) => {
    // console.log(`🎬 playAnimation called with: ${name} (sword equipped: ${isSwordEquipped})`);
    if (name === ANIMATIONS.NINJA_RUN) {
      console.log('🥷 [Ninja Run Animation] playAnimation called for NINJA RUN!');
    }
    
    if (!mixer) {
      // console.log(`❌ playAnimation: No mixer available`);
      return;
    }
    
    // Choose the appropriate animation based on sword state
    let actualAnimationName = name;
    let timeScaleIsSword = false;
    
    if (isSwordEquipped) {
      const swordAnimationName = `sword_${name}`;
      if (animations[swordAnimationName]) {
        actualAnimationName = swordAnimationName;
        timeScaleIsSword = true;
        // console.log(`⚔️ Using sword animation: ${swordAnimationName}`);
      } else {
        // console.log(`⚠️ Sword animation ${swordAnimationName} not found, falling back to default: ${name}`);
      }
    }
    
    if (!animations[actualAnimationName]) {
      console.warn(`⚠️ Animation not found: ${actualAnimationName}`);
      // console.log("Available animations:", Object.keys(animations).join(", "));
      // Fallback to idle if requested animation is missing
      if (name !== ANIMATIONS.IDLE && animations[ANIMATIONS.IDLE]) {
        // console.log(`🔄 Falling back to ${ANIMATIONS.IDLE}`);
        actualAnimationName = ANIMATIONS.IDLE;
        timeScaleIsSword = false;
      } else {
         // console.log(`❌ Cannot play requested or fallback idle`);
         return; // Cannot play requested or fallback idle
      }
    }
    
    // console.log(`🎯 Playing animation: ${actualAnimationName} (crossfade: ${crossfadeDuration}s)`);
    
    const targetAction = animations[actualAnimationName];
    const currentAction = animations[currentAnimation];
    
    if (currentAction && currentAction !== targetAction) {
      // console.log(`🔄 Fading out previous animation: ${currentAnimation}`);
      currentAction.fadeOut(crossfadeDuration);
    }
    
    // console.log(`▶️ Starting animation: ${actualAnimationName}`);
    
    // Get character-specific animation time scale with sword awareness
    const timeScale = getAnimationTimeScale(characterClass, name, timeScaleIsSword);
    
    targetAction.reset()
                .setEffectiveTimeScale(timeScale)
                .setEffectiveWeight(1)
                .fadeIn(crossfadeDuration)
                .play();
                
    setCurrentAnimation(actualAnimationName);
  }, [animations, currentAnimation, mixer, isSwordEquipped, characterClass]); // Add sword state to dependencies

  // --- NEW Effect: Explicitly set shadow props when model is loaded ---
  useEffect(() => {
    if (model && group.current) {
      // console.log(`[Player Shadow Effect ${playerData.username}] Model loaded, traversing group to set shadow props on meshes.`);
      group.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Explicitly set both cast and receive, although cast is the primary goal here
          child.castShadow = true;
          child.receiveShadow = true; 
        }
      });
    }
  }, [model]); // Run this effect whenever the model state changes

  // --- Server State Reconciliation --- -> Now handled within useFrame
  // useEffect(() => {
  //   if (!isLocalPlayer || !modelLoaded) return; 

  //   // Update internal ref used by useFrame
  //   dataRef.current = playerData;

  // }, [playerData, isLocalPlayer, modelLoaded]);

  // Set up pointer lock for camera control if local player
  useEffect(() => {
    if (!isLocalPlayer) return;
    
    const handlePointerLockChange = () => {
      isPointerLocked.current = document.pointerLockElement === document.body;
      // Add cursor style changes to match legacy implementation
      if (isPointerLocked.current) {
        document.body.classList.add('cursor-locked');
      } else {
        document.body.classList.remove('cursor-locked');
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isPointerLocked.current || !isLocalPlayer) return;
      
      if (cameraMode === CAMERA_MODES.FOLLOW) {
        // Update LOCAL rotation ref based on mouse movement for player rotation
        const sensitivity = 0.003;
        localRotationRef.current.y -= e.movementX * sensitivity;
        
        // Keep angle within [-PI, PI] for consistency
        localRotationRef.current.y = THREE.MathUtils.euclideanModulo(localRotationRef.current.y + Math.PI, 2 * Math.PI) - Math.PI;

        // Call the rotation change callback if provided (using local ref)
        if (onRotationChange) {
          onRotationChange(localRotationRef.current);
        }
      } else if (cameraMode === CAMERA_MODES.ORBITAL) {
        // In orbital mode, mouse movement controls the camera angle around the player
        const orbital = orbitalCameraRef.current;
        const sensitivity = 0.005;
        
        // X movement rotates camera around player
        orbital.angle -= e.movementX * sensitivity;
        
        // Y movement controls camera elevation/height
        orbital.elevation += e.movementY * sensitivity;
        
        // Clamp elevation between reasonable limits (15° to 85°)
        orbital.elevation = Math.max(Math.PI / 12, Math.min(Math.PI / 2.1, orbital.elevation));
      }
    };
    
    const handleMouseWheel = (e: WheelEvent) => {
      if (!isLocalPlayer) return;
      
      if (cameraMode === CAMERA_MODES.FOLLOW) {
        // Follow camera zoom
        const zoomSpeed = 0.8; // Match legacy zoom speed
        const zoomChange = Math.sign(e.deltaY) * zoomSpeed;
        const minZoom = 2.0; // Closest zoom
        const maxZoom = 12.0; // Furthest zoom allowed
        targetZoom.current = Math.max(minZoom, Math.min(maxZoom, zoomLevel.current + zoomChange));
      } else if (cameraMode === CAMERA_MODES.ORBITAL) {
        // Orbital camera zoom
        const orbital = orbitalCameraRef.current;
        const zoomSpeed = 0.5;
        const zoomChange = Math.sign(e.deltaY) * zoomSpeed;
        
        // Adjust orbital distance
        orbital.distance = Math.max(3, Math.min(20, orbital.distance + zoomChange));
      }
    };
    
    // Request pointer lock on click
    const handleCanvasClick = () => {
      if (!isPointerLocked.current) {
        document.body.requestPointerLock();
      }
    };
    
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('wheel', handleMouseWheel);
    document.addEventListener('click', handleCanvasClick);
    
    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('wheel', handleMouseWheel);
      document.removeEventListener('click', handleCanvasClick);
    };
  }, [isLocalPlayer, onRotationChange, cameraMode]);

  // Handle one-time animation completion
  useEffect(() => {
    // Explicitly wrap hook body
    {
      if (
        mixer &&
        animations[currentAnimation] &&
        (currentAnimation === ANIMATIONS.JUMP ||
         currentAnimation === ANIMATIONS.ATTACK ||
         currentAnimation === ANIMATIONS.CAST ||
         currentAnimation.startsWith('sword_') ||
         currentAnimation === ANIMATIONS.ATTACK2 ||
         currentAnimation === ANIMATIONS.ATTACK3 ||
         currentAnimation === ANIMATIONS.ATTACK4 ||
         currentAnimation === ANIMATIONS.NINJA_ATTACK)
      ) {
        const action = animations[currentAnimation];
        
        // Ensure action exists and has a clip
        if (!action || !action.getClip()) return;
        
        const duration = action.getClip().duration;
        
        // Define the listener function
        const onFinished = (event: any) => {
          // Only act if the finished action is the one we are tracking
          if (event.action === action) {
             // console.log(`Animation finished: ${currentAnimation}. Checking for movement input before transitioning.`);
             
             // Check if player is currently moving to determine appropriate animation
             if (isLocalPlayer && currentInput) {
               const { forward, backward, left, right, sprint } = currentInput;
               const isMoving = forward || backward || left || right;
               
               if (isMoving) {
                 // Player is still moving, determine appropriate movement animation
                 let direction = 'forward';
                 
                 // Determine primary direction
                 if (forward && !backward) {
                   direction = 'forward';
                 } else if (backward && !forward) {
                   direction = 'back';
                 } else if (left && !right) {
                   direction = 'left';
                 } else if (right && !left) {
                   direction = 'right';
                 } else if (forward && left) {
                   direction = 'left';
                 } else if (forward && right) {
                   direction = 'right';
                 } else if (backward && left) {
                   direction = 'left';
                 } else if (backward && right) {
                   direction = 'right';
                 }
                 
                 // Choose movement type based on sprint state
                 const moveType = sprint ? 'run' : 'walk';
                 const movementAnimation = `${moveType}-${direction}`;
                 
                 // console.log(`Player is moving after attack, transitioning to: ${movementAnimation}`);
                 playAnimation(movementAnimation, 0.1);
               } else {
                 // Player is not moving, transition to idle
                 // console.log(`Player is not moving after attack, transitioning to idle`);
                 playAnimation(ANIMATIONS.IDLE, 0.1);
               }
             } else {
               // Fallback to idle for non-local players or when no input available
               playAnimation(ANIMATIONS.IDLE, 0.1);
             }
             
             mixer.removeEventListener('finished', onFinished); // Remove listener
          }
        };
        
        // Add the listener
        mixer.addEventListener('finished', onFinished);

        // Cleanup function to remove listener if component unmounts or animation changes
        return () => {
          if (mixer) {
            mixer.removeEventListener('finished', onFinished);
          }
        };
      }
    }
  }, [currentAnimation, animations, mixer, playAnimation, isLocalPlayer, currentInput]); // Added currentInput dependency

  // --- Handle Camera Toggle ---
  const toggleCameraMode = useCallback(() => {
    const newMode = cameraMode === CAMERA_MODES.FOLLOW ? CAMERA_MODES.ORBITAL : CAMERA_MODES.FOLLOW;
    setCameraMode(newMode);
    
    // Store player's facing direction when entering orbital mode
    if (newMode === CAMERA_MODES.ORBITAL) {
      // Use the current reconciled rotation from the ref
      orbitalCameraRef.current.playerFacingRotation = localRotationRef.current.y;
      // Set the initial orbital angle to match the player's facing direction
      orbitalCameraRef.current.angle = localRotationRef.current.y;
      // Reset elevation to a default value for a consistent starting view
      orbitalCameraRef.current.elevation = Math.PI / 6;
    }
  }, [cameraMode]); // localRotationRef is not a state/prop, so not needed here

  // Set up keyboard handlers for camera toggling
  useEffect(() => {
    if (!isLocalPlayer) return;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      // Toggle camera mode on 'C' key press
      if (event.code === 'KeyC' && !event.repeat) { // Check for !event.repeat
        toggleCameraMode();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLocalPlayer, toggleCameraMode]);

  // Update the useFrame hook to handle both camera modes and reconciliation
  useFrame((state, delta) => {
    {
      const dt = Math.min(delta, 1 / 30);

      // Initialize blood effect manager if not already done
      if (!bloodEffectManagerRef.current && group.current?.parent) {
        bloodEffectManagerRef.current = new BloodEffectManager(group.current.parent as THREE.Scene);
        // console.log(`[Player] 🩸 Blood effect manager initialized`);
      }

      // Initialize coin effect manager if not already done
      if (!coinEffectManagerRef.current && group.current?.parent) {
        coinEffectManagerRef.current = new CoinEffectManager(group.current.parent as THREE.Scene);
        coinEffectManagerRef.current.loadCoinModel().catch(console.error);
        // console.log(`[Player] 🪙 Coin effect manager initialized`);
      }

      // Update blood effects
      if (bloodEffectManagerRef.current) {
        bloodEffectManagerRef.current.update(delta);
      }

      // Update coin effects and check for collection
      if (coinEffectManagerRef.current && playerData && group.current) {
        coinEffectManagerRef.current.update(delta);
        
        // Check for coin collection by local player
        if (isLocalPlayer) {
          const playerPosition = group.current.position;
          const collectedCoins = coinEffectManagerRef.current.checkCollisions(playerPosition);
          
          if (collectedCoins > 0 && gameReadyCallbacks?.onCoinCollected) {
            gameReadyCallbacks.onCoinCollected(collectedCoins);
          }
        }
      }

      // Update screenshake effect (only for local player)
      if (isLocalPlayer) {
        updateScreenshake(camera, delta);
      }

      // Update glow effect animation if active
      if (glowMesh && group.current) {
        const currentTime = performance.now();
        const startTime = (glowMesh as any).startTime || currentTime;
        const elapsed = (currentTime - startTime) / 1000; // Convert to seconds
        const progress = Math.min(elapsed / 1.0, 1.0); // Progress from 0 to 1 over 1 second
        
        // Expanding animation - scale increases over time
        const expansionFactor = 1.0 + progress * 2.0; // Expand to 3x original size
        glowMesh.scale.set(expansionFactor, expansionFactor, expansionFactor);
        
        // Fade-out animation - opacity decreases over time
        const fadeOpacity = 1.0 - progress; // Fade from 1.0 to 0.0
        
        // Update each layer's opacity
        const initialOpacities = (glowMesh as any).initialOpacities || [0.6, 0.4, 0.25, 0.15];
        glowMesh.children.forEach((child: THREE.Mesh, index: number) => {
          if (child.material && 'opacity' in child.material) {
            const material = child.material as THREE.MeshBasicMaterial;
            material.opacity = initialOpacities[index] * fadeOpacity;
          }
        });
        
        // Keep glow positioned at player's current world location
        const playerWorldPosition = new THREE.Vector3();
        group.current.getWorldPosition(playerWorldPosition);
        glowMesh.position.copy(playerWorldPosition);
        glowMesh.position.y += 1; // Keep it slightly above ground
      }

      // Update latest server data ref for local player
      if (isLocalPlayer) {
          dataRef.current = playerData;
          

      }

      if (group.current && modelLoaded) {
        if (isLocalPlayer && currentInput) {
          // --- LOCAL PLAYER PREDICTION & RECONCILIATION --- 

          // 1. Calculate predicted position based on current input, rotation, and SERVER_TICK_DELTA
          // Handle ninja run sprint timing
          const currentTime = Date.now();
          
          // Check if sprint+forward is being held
          if (currentInput.sprint && currentInput.forward && !currentInput.backward && !currentInput.left && !currentInput.right) {
            // Sprint+forward is active - update last valid time and continue timing
            setLastValidSprintTime(currentTime);
            
            if (sprintStartTime === 0) {
              // Start timing ninja run activation
              setSprintStartTime(currentTime);
              console.log('🥷 [Ninja Run] Started sprint+forward timing');
            } else if (!isNinjaRunActive && (currentTime - sprintStartTime) >= NINJA_RUN_ACTIVATION_TIME) {
              // Activate ninja run after 2 seconds
              setIsNinjaRunActive(true);
              console.log('🥷 [Ninja Run] NINJA RUN ACTIVATED! High-speed sprint engaged.');
              console.log('🥷 [Ninja Run] Character:', characterClass);
              console.log('🥷 [Ninja Run] Available animations:', Object.keys(animations));
              console.log('🥷 [Ninja Run] Ninja run animation available:', !!animations[ANIMATIONS.NINJA_RUN]);
            } else if (!isNinjaRunActive) {
              // Still timing - show progress
              const elapsed = currentTime - sprintStartTime;
              if (elapsed % 250 < 50) { // Log every 250ms (with 50ms tolerance) for faster feedback
                console.log(`🥷 [Ninja Run] Sprint timing: ${elapsed}ms / ${NINJA_RUN_ACTIVATION_TIME}ms`);
              }
            }
          } else {
            // Sprint+forward combo is broken - check grace period before resetting
            const timeSinceLastValid = currentTime - lastValidSprintTime;
            
            if (isNinjaRunActive && timeSinceLastValid > NINJA_RUN_GRACE_PERIOD) {
              // Ninja run was active but grace period expired - deactivate
              setIsNinjaRunActive(false);
              setSprintStartTime(0);
              console.log(`🥷 [Ninja Run] Ninja run deactivated after ${timeSinceLastValid}ms grace period`);
              console.log('🥷 [Ninja Run] Input state:', {
                sprint: currentInput.sprint,
                forward: currentInput.forward,
                backward: currentInput.backward,
                left: currentInput.left,
                right: currentInput.right
              });
            } else if (!isNinjaRunActive && sprintStartTime !== 0 && timeSinceLastValid > NINJA_RUN_GRACE_PERIOD) {
              // Was building up to ninja run but grace period expired - reset
              setSprintStartTime(0);
              console.log(`🥷 [Ninja Run] Sprint timing reset after ${timeSinceLastValid}ms grace period`);
              console.log('🥷 [Ninja Run] Input state:', {
                sprint: currentInput.sprint,
                forward: currentInput.forward,
                backward: currentInput.backward,
                left: currentInput.left,
                right: currentInput.right
              });
            }
            // If within grace period, don't reset anything - just wait
          }

          // Only update horizontal position when physics is enabled and movement is not frozen
          if (!isMovementFrozen) {
            const predictedPosition = calculateClientMovement(
              localPositionRef.current,
              localRotationRef.current, // Pass current local rotation; function internally selects based on mode
              currentInput,
              SERVER_TICK_DELTA // Use FIXED delta for prediction to match server
            );
            
            // Update position - horizontal movement always allowed, Y is handled by physics separately
            localPositionRef.current.x = predictedPosition.x;
            localPositionRef.current.z = predictedPosition.z;
          } else {
            // console.log(`🧊 [Movement Frozen] Skipping movement calculation during power-up`);
            
            // Enforce frozen position (preserve Y for physics, but lock X/Z)
            if (frozenPositionRef.current) {
              const prevX = localPositionRef.current.x;
              const prevZ = localPositionRef.current.z;
              localPositionRef.current.x = frozenPositionRef.current.x;
              localPositionRef.current.z = frozenPositionRef.current.z;
              
              // Debug log only if position was actually changing
              if (Math.abs(prevX - frozenPositionRef.current.x) > 0.01 || Math.abs(prevZ - frozenPositionRef.current.z) > 0.01) {
                // console.log(`🧊 [Position Enforced] Reset from (${prevX.toFixed(2)}, ${prevZ.toFixed(2)}) to frozen position (${frozenPositionRef.current.x.toFixed(2)}, ${frozenPositionRef.current.z.toFixed(2)})`);
              }
              // Don't lock Y - allow gravity/physics to continue
            }
          }
          // Y position is NOT updated here - it's handled by physics below
          if (!physicsEnabled) {
            // SAFETY: Ensure Y position stays at spawn altitude until physics is enabled
            localPositionRef.current.y = SPAWN_ALTITUDE;
          }
          
          // 1.5. Apply gravity and jumping physics
          const currentY = localPositionRef.current.y;
          
          // Handle jumping input (only trigger once per press) - only when physics enabled and not frozen
          if (physicsEnabled && !isMovementFrozen && currentInput.jump && !wasJumpPressed.current && isOnGround.current) {
            velocityY.current = JUMP_FORCE;
            isOnGround.current = false;
            wasJumpPressed.current = true;
          } else if (!currentInput.jump) {
            wasJumpPressed.current = false;
          }
          
          // Handle attack input (allow restarting attacks for faster combat + three-attack combo system) - only when not frozen
          if (!isMovementFrozen && currentInput.attack && !wasAttackPressed.current) {
            wasAttackPressed.current = true;
            
            const currentTime = Date.now();
            const timeSinceLastAttack = currentTime - lastAttackTime;
            
            // Determine which attack to play based on combo stage and timing (8-hit combo)
            let attackAnimation = ANIMATIONS.ATTACK;
            let isComboAttack = false;
            let comboDescription = 'FIRST';
            let attackIsSword = false; // Track if this specific attack should be sword or melee
            
            // Special case: If ninja run is active, use the special ninja attack animation
            if (isNinjaRunActive) {
              console.log(`🥷 [Ninja Attack] Using Sprinting Forward Roll during ninja run!`);
              attackAnimation = ANIMATIONS.NINJA_ATTACK;
              isComboAttack = false; // Special attacks don't participate in combo system
              comboDescription = 'NINJA SPRINTING FORWARD ROLL';
              attackIsSword = false; // Ninja attacks are always melee
              
              // Reset combo system when using ninja attack
              setComboActive(false);
              setComboStage(0);
            } else {
            
            // console.log(`🔍 [DEBUG] Initial state - comboStage: ${comboStage}, comboActive: ${comboActive}, timeSinceLastAttack: ${timeSinceLastAttack}, isSwordEquipped: ${isSwordEquipped}`);
            
            if (comboActive && timeSinceLastAttack <= COMBO_WINDOW) {
              isComboAttack = true;
              if (comboStage === 1) {
                attackAnimation = ANIMATIONS.ATTACK;  // Repeat attack1 for melee
                comboDescription = 'SECOND';
              } else if (comboStage === 2) {
                attackAnimation = ANIMATIONS.ATTACK2; // Sword attack2
                comboDescription = 'THIRD';
              } else if (comboStage === 3) {
                attackAnimation = ANIMATIONS.ATTACK2; // Repeat attack2 for melee
                comboDescription = 'FOURTH';
              } else if (comboStage === 4) {
                attackAnimation = ANIMATIONS.ATTACK3; // Sword attack3
                comboDescription = 'FIFTH';
              } else if (comboStage === 5) {
                attackAnimation = ANIMATIONS.ATTACK3; // Repeat attack3 for melee
                comboDescription = 'SIXTH';
              } else if (comboStage === 6) {
                attackAnimation = ANIMATIONS.ATTACK4; // Sword attack4
                comboDescription = 'SEVENTH';
              } else if (comboStage === 7) {
                attackAnimation = ANIMATIONS.ATTACK4; // Repeat attack4 for melee
                comboDescription = 'EIGHTH';
              }
            }
            
            // console.log(`🔍 [DEBUG] After combo logic - attackAnimation: ${attackAnimation}, isComboAttack: ${isComboAttack}, comboDescription: ${comboDescription}`);
            
            // For sword-equipped characters, alternate between sword and melee attacks
            if (isSwordEquipped) {
              // Even stages (0,2,4,6): Sword attacks
              // Odd stages (1,3,5,7): Melee attacks
              if (comboStage % 2 === 0) {
                attackIsSword = true;
                comboDescription += ' SWORD';
              } else {
                attackIsSword = false;
                comboDescription += ' MELEE';
              }
            } else {
              // Not sword equipped: all attacks are melee
              attackIsSword = false;
              comboDescription += ' MELEE';
            }
            
            }
            
            // console.log(`🔍 [DEBUG] After sword/melee logic - attackIsSword: ${attackIsSword}, final comboDescription: ${comboDescription}`);
            
            // console.log(`[Player] ⚔️ ${comboDescription} Attack triggered - Combo Stage: ${comboStage}, Attack is Sword: ${attackIsSword}, Sword Equipped: ${isSwordEquipped}, Time since last: ${timeSinceLastAttack}ms`);
            
            // If already attacking, restart the attack sequence
            if (isAttacking) {
              // console.log(`[Player] 🔄 Restarting attack sequence while already attacking`);
            }
            
            setIsAttacking(true);
            setLastAttackTime(currentTime);
            setCurrentAttackIsSword(attackIsSword); // Set the current attack type
            
            // Expose attack info globally for zombie system
            (window as any).currentPlayerAttackInfo = {
              isSword: attackIsSword,
              comboStage: comboStage,
              attackAnimation: attackAnimation,
              timestamp: currentTime
            };
            // Legacy support
            (window as any).currentPlayerAttackIsSword = attackIsSword;
            
            // Update combo state for next attack (8-hit combo system)
            // console.log(`🔍 [DEBUG] Before combo update - comboStage: ${comboStage}, comboActive: ${comboActive}`);
            
            if (comboStage === 0 || timeSinceLastAttack > COMBO_WINDOW) {
              // First attack or combo window expired - start new combo chain
              setComboActive(true);
              setComboStage(1); // Next attack will be stage 1
              // console.log(`[Player] 👊 First attack, combo window opened for stage 1`);
            } else if (comboStage === 1) {
              setComboStage(2);
              // console.log(`[Player] 🥊 Stage 1 → Stage 2`);
            } else if (comboStage === 2) {
              setComboStage(3);
              // console.log(`[Player] 💥 Stage 2 → Stage 3`);
            } else if (comboStage === 3) {
              setComboStage(4);
              // console.log(`[Player] 🔥 Stage 3 → Stage 4`);
            } else if (comboStage === 4) {
              setComboStage(5);
              // console.log(`[Player] ⚡ Stage 4 → Stage 5`);
            } else if (comboStage === 5) {
              setComboStage(6);
              // console.log(`[Player] 🌟 Stage 5 → Stage 6`);
            } else if (comboStage === 6) {
              setComboStage(7);
              // console.log(`[Player] 💫 Stage 6 → Stage 7`);
            } else if (comboStage === 7) {
              // Eighth attack - reset combo chain
              setComboActive(false);
              setComboStage(0);
              // console.log(`[Player] 🎆 STAGE 7 COMPLETE! 8-HIT ULTIMATE COMBO FINISHED!`);
            }
            
            // console.log(`🔍 [DEBUG] After combo update - new comboStage will be: ${comboStage === 0 || timeSinceLastAttack > COMBO_WINDOW ? 1 : comboStage < 7 ? comboStage + 1 : 0}`);
            
            // Clear any existing attack timeout to restart sequence
            if (attackTimeoutRef.current) {
              clearTimeout(attackTimeoutRef.current);
              // console.log(`[Player] ⏰ Cleared previous attack timeout`);
            }
            
            // Play appropriate attack animation (restart animation)
            // Handle sword vs melee animation selection manually for alternating combos
            // console.log(`🔍 [DEBUG] Animation selection - isSwordEquipped: ${isSwordEquipped}, attackIsSword: ${attackIsSword}, attackAnimation: ${attackAnimation}`);
            // console.log(`🔍 [DEBUG] Available animations: ${Object.keys(animations).join(', ')}`);
            
            if (isSwordEquipped) {
              if (attackIsSword) {
                // Play sword animation
                const swordAnimationName = `sword_${attackAnimation}`;
                // console.log(`⚔️ [SWORD PATH] Attempting to play SWORD animation: ${swordAnimationName}`);
                // console.log(`🔍 [DEBUG] Sword animation exists: ${!!animations[swordAnimationName]}`);
                
                if (animations[swordAnimationName]) {
                  const targetAction = animations[swordAnimationName];
                  const currentAction = animations[currentAnimation];
                  
                  // console.log(`🔍 [DEBUG] Playing sword animation ${swordAnimationName}, current: ${currentAnimation}`);
                  
                  if (currentAction && currentAction !== targetAction) {
                    currentAction.fadeOut(0.1);
                  }
                  
                  // Get sword time scale
                  const timeScale = getAnimationTimeScale(characterClass, attackAnimation, true);
                  // console.log(`🔍 [DEBUG] Sword timeScale: ${timeScale}`);
                  
                  targetAction.reset()
                              .setEffectiveTimeScale(timeScale)
                              .setEffectiveWeight(1)
                              .fadeIn(0.1)
                              .play();
                              
                  setCurrentAnimation(swordAnimationName);
                  // console.log(`✅ [SWORD] Successfully playing ${swordAnimationName}`);
                } else {
                  console.warn(`⚠️ Sword animation ${swordAnimationName} not found, falling back to melee`);
                  // Fallback to melee animation
                  const meleeAnimationName = attackAnimation;
                  const targetAction = animations[meleeAnimationName];
                  const timeScale = getAnimationTimeScale(characterClass, attackAnimation, false);
                  
                  targetAction.reset()
                              .setEffectiveTimeScale(timeScale)
                              .setEffectiveWeight(1)
                              .fadeIn(0.1)
                              .play();
                              
                  setCurrentAnimation(meleeAnimationName);
                }
              } else {
                // Play melee animation even though sword is equipped
                const meleeAnimationName = attackAnimation;
                // console.log(`🥊 [MELEE PATH] Attempting to play MELEE animation: ${meleeAnimationName} (sword equipped but melee attack)`);
                // console.log(`🔍 [DEBUG] Melee animation exists: ${!!animations[meleeAnimationName]}`);
                
                if (animations[meleeAnimationName]) {
                  const targetAction = animations[meleeAnimationName];
                  const currentAction = animations[currentAnimation];
                  
                  // console.log(`🔍 [DEBUG] Playing melee animation ${meleeAnimationName}, current: ${currentAnimation}`);
                  
                  if (currentAction && currentAction !== targetAction) {
                    currentAction.fadeOut(0.1);
                    // console.log(`🔍 [DEBUG] Fading out current animation: ${currentAnimation}`);
                  }
                  
                  // Get melee time scale (not sword time scale)
                  const timeScale = getAnimationTimeScale(characterClass, attackAnimation, false);
                  // console.log(`🔍 [DEBUG] Melee timeScale: ${timeScale}`);
                  
                  targetAction.reset()
                              .setEffectiveTimeScale(timeScale)
                              .setEffectiveWeight(1)
                              .fadeIn(0.1)
                              .play();
                              
                  setCurrentAnimation(meleeAnimationName);
                  // console.log(`✅ [MELEE] Successfully playing ${meleeAnimationName}`);
                } else {
                  console.warn(`⚠️ Melee animation ${meleeAnimationName} not found`);
                  // console.log(`🔍 [DEBUG] Available keys: ${Object.keys(animations)}`);
                }
              }
            } else {
              // No sword equipped: use normal playAnimation (all melee)
              // console.log(`🥊 [NO SWORD] Playing normal MELEE animation: ${attackAnimation} (no sword equipped)`);
              playAnimation(attackAnimation, 0.1); // Quick crossfade for responsiveness
            }
            
            // Schedule zombie hit detection after animation starts
            setTimeout(() => {
              // Check for zombie attacks using global function
              if ((window as any).checkZombieAttack) {
                const hitZombies = (window as any).checkZombieAttack(
                  localPositionRef.current, 
                  localRotationRef.current, 
                  attackIsSword // Pass whether this is a sword attack
                );
                
                if (hitZombies.length > 0) {
                  // console.log(`[Player] ⚔️ Attack successful! Hit ${hitZombies.length} zombie(s) with ${attackIsSword ? 'SWORD' : 'MELEE'} attack`);
                  
                  // Play blood spurt sound effect
                  playBloodSpurtSound();
                  
                  // Trigger screenshake effect for impact feedback based on attack type
                  let shakeIntensity = SCREENSHAKE_PRESETS.LIGHT;
                  if (comboDescription === 'SECOND') {
                    shakeIntensity = SCREENSHAKE_PRESETS.LIGHT;
                  } else if (comboDescription === 'THIRD') {
                    shakeIntensity = SCREENSHAKE_PRESETS.LIGHT;
                  } else if (comboDescription === 'FOURTH') {
                    shakeIntensity = SCREENSHAKE_PRESETS.LIGHT; // Ultimate finisher
                  }
                  triggerHitScreenshake(camera, shakeIntensity);
                  // console.log(`[Player] 📳 Screenshake triggered - ${comboDescription} attack intensity`);
                  
                  // Trigger blood spurt effects for each hit zombie
                  if (bloodEffectManagerRef.current) {
                    hitZombies.forEach((zombie: any) => {
                      if (zombie.position) {
                        const bloodPosition = new THREE.Vector3(
                          zombie.position.x,
                          zombie.position.y + 1.0, // Slightly above zombie center
                          zombie.position.z
                        );
                        bloodEffectManagerRef.current!.createBloodSpurt(bloodPosition);
                        // console.log(`[Player] 🩸 Blood spurt created at zombie position`);
                      }
                    });
                  }

                  // Trigger coin effects for each hit zombie
                  if (coinEffectManagerRef.current && group.current) {
                    const playerPosition = group.current.position;
                    hitZombies.forEach((zombie: any) => {
                      if (zombie.position) {
                        const coinPosition = new THREE.Vector3(
                          zombie.position.x,
                          zombie.position.y + 0.5, // Slightly above zombie center, lower than blood
                          zombie.position.z
                        );
                        coinEffectManagerRef.current!.createCoin(coinPosition, playerPosition);
                        // console.log(`[Player] 🪙 Coin created at zombie position with flyaway physics`);
                      }
                    });
                  }
                }
              }
            }, 300); // 300ms delay to let attack animation play
            
            // Complete the attack after full animation duration
            attackTimeoutRef.current = setTimeout(() => {
              setIsAttacking(false);
              setCurrentAttackIsSword(false); // Clear attack type
              // Clear global attack state
              (window as any).currentPlayerAttackInfo = {
                isSword: false,
                comboStage: 0,
                attackAnimation: null,
                timestamp: 0
              };
              (window as any).currentPlayerAttackIsSword = false; // Legacy support
              attackTimeoutRef.current = null;
              // console.log(`[Player] 🏁 Attack animation completed`);
              
              // Clear combo after timeout if no next attack is made
              if (comboStage > 0) {
                setTimeout(() => {
                  const timeNow = Date.now();
                  if (timeNow - lastAttackTime >= COMBO_WINDOW) {
                    setComboActive(false);
                    setComboStage(0);
                    // console.log(`[Player] ⏱️ 8-hit combo window expired, reset to normal attacks`);
                  }
                }, COMBO_WINDOW);
              }
            }, 1000); // 1 second for full attack animation to complete
            
          } else if (!currentInput.attack) {
            wasAttackPressed.current = false;
          }
          
          // Apply gravity only when physics is enabled to prevent falling before model is ready
          if (!isOnGround.current && physicsEnabled) {
            velocityY.current += GRAVITY * dt; // Use frame delta for smooth physics
            velocityY.current = Math.max(velocityY.current, TERMINAL_VELOCITY); // Clamp to terminal velocity
            
            // Debug physics when falling from high altitude
            if (localPositionRef.current.y > 120) {
              // console.log(`🌊 [Physics] Y=${localPositionRef.current.y.toFixed(1)}, velocityY=${velocityY.current.toFixed(2)}, dt=${dt.toFixed(4)}, onGround=${isOnGround.current}, physicsEnabled=${physicsEnabled}`);
            }
          }
          
          // Update Y position with velocity only when physics is enabled
          if (physicsEnabled) {
            localPositionRef.current.y += velocityY.current * dt;
          }
          
          // Ground collision detection only when physics is enabled
          if (physicsEnabled && localPositionRef.current.y <= GROUND_LEVEL) {
            // Store the altitude we fell from before collision correction
            const fallHeight = Math.max(SPAWN_ALTITUDE - GROUND_LEVEL, localPositionRef.current.y + Math.abs(velocityY.current) * dt);
            
            localPositionRef.current.y = GROUND_LEVEL;
            velocityY.current = 0;
            const wasInAir = !isOnGround.current;
            isOnGround.current = true;
            
            // If just landed from falling, play landing animation and trigger screenshake
            if (wasInAir && currentAnimation === ANIMATIONS.FALLING) {
              // console.log(`🎯 [LANDING] ${playerData.username} hit the ground after falling from Y=${fallHeight.toFixed(1)} - playing landing animation`);
              playAnimation(ANIMATIONS.LANDING, 0.3);
              
              // Trigger landing screenshake for dramatic impact
              triggerLandingScreenshake(camera, SCREENSHAKE_PRESETS.HEAVY);
              // console.log(`[Player] 📳 Landing screenshake triggered after falling from Y=${fallHeight.toFixed(1)}`);
              
              // After landing animation, transition to idle
              setTimeout(() => {
                if (isOnGround.current && !currentInput?.forward && !currentInput?.backward && 
                    !currentInput?.left && !currentInput?.right) {
                  // console.log(`🏃 [IDLE] ${playerData.username} transitioning from landing to idle`);
                  playAnimation(ANIMATIONS.IDLE, 0.3);
                }
              }, 1000); // Landing animation duration
            }
          }

          // 2. RECONCILIATION (Position)
          const serverPosition = new THREE.Vector3(dataRef.current.position.x, dataRef.current.position.y, dataRef.current.position.z);
          
          // Only allow reconciliation when physics is enabled, model is ready, and movement is not frozen
          const allowReconciliation = physicsEnabled && isModelVisible && !isMovementFrozen;
          
          if (allowReconciliation) {
            // Compare local (unflipped) prediction with an unflipped version of the server state
            const unflippedServerPosition = serverPosition.clone();
            unflippedServerPosition.x *= -1; // Undo server flip for comparison
            unflippedServerPosition.z *= -1; // Undo server flip for comparison

            // Calculate horizontal position error only (exclude Y for physics)
            const localHorizontal = new THREE.Vector3(localPositionRef.current.x, 0, localPositionRef.current.z);
            const serverHorizontal = new THREE.Vector3(unflippedServerPosition.x, 0, unflippedServerPosition.z);
            const horizontalError = localHorizontal.distanceTo(serverHorizontal);
            
            // Don't reconcile at all if character is still falling from high altitude
            const isStillFalling = currentAnimation === ANIMATIONS.FALLING && localPositionRef.current.y > 20;
            
            // Check if player is currently in air (not on ground) to avoid Y reconciliation during jumping/falling
            const isInAir = !isOnGround.current || Math.abs(velocityY.current) > 0.1;
            
            if (horizontalError > POSITION_RECONCILE_THRESHOLD && !isStillFalling) {
              // Only reconcile when not falling from altitude
              if (cameraMode !== CAMERA_MODES.ORBITAL) {
                  // Only reconcile X and Z coordinates, preserve Y for physics
                  // ALWAYS only reconcile horizontal position (X/Z), never Y - let client physics handle Y entirely
                  localPositionRef.current.x = THREE.MathUtils.lerp(localPositionRef.current.x, serverPosition.x, RECONCILE_LERP_FACTOR);
                  localPositionRef.current.z = THREE.MathUtils.lerp(localPositionRef.current.z, serverPosition.z, RECONCILE_LERP_FACTOR);
                  
              }
            } else if (isStillFalling && localPositionRef.current.y > 120) {
              // ...
            }
            // During falling, skip reconciliation entirely to allow physics to work
          } else if (isMovementFrozen) {
            // console.log(`🧊 [Movement Frozen] Skipping server reconciliation during power-up`);
          } else {
            // During initial spawn period before physics is enabled - no reconciliation needed
            // FORCE character to stay at spawn altitude until physics is enabled
            localPositionRef.current.y = SPAWN_ALTITUDE;
          }

          // 2.5 RECONCILIATION (Rotation) 
          const serverRotation = new THREE.Euler(0, dataRef.current.rotation.y, 0, 'YXZ');
          const reconcileTargetQuat = new THREE.Quaternion().setFromEuler(serverRotation);
          const currentQuat = new THREE.Quaternion().setFromEuler(localRotationRef.current);
          const rotationError = currentQuat.angleTo(reconcileTargetQuat);
          
          // Don't reconcile rotation during falling to prevent camera jitter
          const isStillFalling = currentAnimation === ANIMATIONS.FALLING && localPositionRef.current.y > 20;
          
          if (rotationError > ROTATION_RECONCILE_THRESHOLD && !isStillFalling) {
              currentQuat.slerp(reconcileTargetQuat, RECONCILE_LERP_FACTOR);
              localRotationRef.current.setFromQuaternion(currentQuat, 'YXZ');
              // console.log(`🔄 [Rotation Reconcile] Applied rotation reconciliation - error: ${rotationError.toFixed(3)}`);
          } else if (isStillFalling) {
              // console.log(`🚫 [Rotation Reconcile] Skipping rotation reconciliation during falling - Y=${localPositionRef.current.y.toFixed(1)}`);
          }

          // 3. Apply potentially reconciled predicted position AND reconciled local rotation directly to the model group
          // Always update position to ensure model follows player state
          group.current.position.copy(localPositionRef.current);

          // 3.5. Send updated position to App for server sync (skip during initial falling sequence and power-up)
          // Only skip during the dramatic high-altitude falling to preserve the entrance effect, and during power-up to prevent conflicts
          const isHighAltitudeFalling = currentAnimation === ANIMATIONS.FALLING && localPositionRef.current.y > 20;
          if (onPositionChange && physicsEnabled && isModelVisible && !isHighAltitudeFalling && !isMovementFrozen) {
            onPositionChange(localPositionRef.current);
          } else if (isMovementFrozen) {
            // console.log(`🧊 [Movement Frozen] Skipping position sync to server during power-up`);
          }
          // --- Visual Rotation Logic --- 
          let targetVisualYaw = localRotationRef.current.y; // Default: Face camera/mouse direction

          if (cameraMode === CAMERA_MODES.FOLLOW) {
              const { forward, backward, left, right } = currentInput;
              const isMovingDiagonally = (forward || backward) && (left || right);

              if (isMovingDiagonally) {
                  let localMoveX = 0;
                  let localMoveZ = 0;
                  if (forward) localMoveZ -= 1;
                  if (backward) localMoveZ += 1;
                  if (left) localMoveX -= 1;
                  if (right) localMoveX += 1;
                  const localMoveVector = new THREE.Vector3(localMoveX, 0, localMoveZ).normalize(); 
                  const cameraYaw = localRotationRef.current.y;
                  const worldMoveDirection = localMoveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);

                  // Calculate the base target yaw
                  targetVisualYaw = Math.atan2(worldMoveDirection.x, worldMoveDirection.z);

                  // --- Reverse yaw ONLY for FORWARD diagonal movement ---
                  if (forward && !backward) { // Check if primary movement is forward
                      targetVisualYaw += Math.PI; // Add 180 degrees
                  }
                  // --- End reversal --- 
              }
          } else { // ORBITAL MODE
              // --- Apply diagonal rotation logic similar to FOLLOW mode --- 
              const { forward, backward, left, right } = currentInput;
              const isMovingDiagonally = (forward || backward) && (left || right);

              if (isMovingDiagonally) {
                  // Calculate local movement vector (Orbital mapping: W=+z, S=-z, A=+x, D=-x)
                  let localMoveX = 0;
                  let localMoveZ = 0;
                  if (forward) localMoveZ += 1;
                  if (backward) localMoveZ -= 1; // Corrected backward direction for orbital local
                  if (left) localMoveX += 1; // Corrected left direction for orbital local
                  if (right) localMoveX -= 1; // Corrected right direction for orbital local
                  const localMoveVector = new THREE.Vector3(localMoveX, 0, localMoveZ).normalize();

                  // Rotate local movement by the FIXED orbital yaw to get world direction
                  const fixedOrbitalYaw = orbitalCameraRef.current.playerFacingRotation;
                  const worldMoveDirection = localMoveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), fixedOrbitalYaw);

                  // Calculate base target yaw
                  targetVisualYaw = Math.atan2(worldMoveDirection.x, worldMoveDirection.z);

                  // --- RE-ADD Condition: Reverse yaw ONLY for FORWARD diagonal movement --- 
                  if (!forward && backward) { 
                      targetVisualYaw += Math.PI; // Add 180 degrees
                  }
                  // --- End conditional reversal --- 
                  
              } else {
                   // If not moving diagonally, face the fixed rotation
                   targetVisualYaw = orbitalCameraRef.current.playerFacingRotation;
              }
              // --- End diagonal rotation logic for ORBITAL ---
          }

          // --- Apply Rotation using Slerp --- 
          const targetVisualRotation = new THREE.Euler(0, targetVisualYaw, 0, 'YXZ');
          const targetVisualQuat = new THREE.Quaternion().setFromEuler(targetVisualRotation);
          
          // Interpolate the group's quaternion towards the target
          group.current.quaternion.slerp(targetVisualQuat, Math.min(1, dt * 10)); 

          // FIX: Sync logical rotation ref with the slerped visual quaternion.
          // This ensures the camera position calculation uses the same rotation as the visible model, eliminating jitter.
          // IMPORTANT: Only sync when there's actual visual rotation change to avoid feedback loops during falling
          const hasMovementInput = currentInput.forward || currentInput.backward || currentInput.left || currentInput.right;
          if (hasMovementInput) {
            localRotationRef.current.setFromQuaternion(group.current.quaternion, 'YXZ');
          }

          // --- DEBUG: Draw/Update Directional Arrow (Conditional) ---
          const scene = group.current?.parent; // Get scene reference
          if (isDebugArrowVisible && scene) { // Only proceed if prop is true and scene exists
            const playerWorldPos = group.current.position;
            const playerWorldRotY = group.current.rotation.y; 
            const forwardDirection = new THREE.Vector3(Math.sin(playerWorldRotY), 0, Math.cos(playerWorldRotY)).normalize();
            const arrowLength = 3;
            const arrowColor = 0xff0000;

            if (debugArrowRef.current) {
              // Update existing arrow
              debugArrowRef.current.position.copy(playerWorldPos).add(new THREE.Vector3(0, 0.5, 0)); // Adjust origin height
              debugArrowRef.current.setDirection(forwardDirection);
              // Ensure it's visible if it was hidden
              debugArrowRef.current.visible = true; 
            } else {
              // Create new arrow
              debugArrowRef.current = new THREE.ArrowHelper(
                forwardDirection,
                playerWorldPos.clone().add(new THREE.Vector3(0, 0.5, 0)), // Adjust origin height
                arrowLength,
                arrowColor
              );
              debugArrowRef.current.userData.isDebugArrow = true; // Mark for potential future identification
              scene.add(debugArrowRef.current);
              // console.log("[Debug Arrow] Created arrow."); // Log creation
            }
          } else {
            // Remove arrow if it exists and shouldn't be visible
            if (debugArrowRef.current && debugArrowRef.current.parent) {
               // console.log("[Debug Arrow] Removing arrow (prop is false or no scene)."); // Log removal
               debugArrowRef.current.parent.remove(debugArrowRef.current);
               debugArrowRef.current = null;
            }
          }
          // --- END DEBUG ---

        } else { // Not the local player anymore or initially
          // If this instance stops being the local player OR debug visibility is off, ensure arrow is removed
          if (debugArrowRef.current && debugArrowRef.current.parent) {
               // console.log("[Debug Arrow] Removing arrow (not local player)."); // Log removal
               debugArrowRef.current.parent.remove(debugArrowRef.current);
               debugArrowRef.current = null;
          }
          // --- REMOTE PLAYER INTERPOLATION --- 
          const serverPosition = new THREE.Vector3(playerData.position.x, playerData.position.y, playerData.position.z);
          const targetRotation = new THREE.Euler(0, playerData.rotation.y, 0, 'YXZ');

          // Interpolate position smoothly
          group.current.position.lerp(serverPosition, Math.min(1, dt * 10));

          // Interpolate rotation smoothly (using quaternions for better slerp)
          group.current.quaternion.slerp(
            new THREE.Quaternion().setFromEuler(targetRotation),
            Math.min(1, dt * 8)
          );
        }
      }

      // --- CAMERA UPDATE (Local Player Only) ---
      if (isLocalPlayer && group.current) {
        // Smooth zoom interpolation for follow camera
        if (cameraMode === CAMERA_MODES.FOLLOW) {
          zoomLevel.current += (targetZoom.current - zoomLevel.current) * Math.min(1, dt * 6);
        }

        // Get reconciled player position and rotation for camera
        const playerPosition = localPositionRef.current; 
        // Use the reconciled localRotationRef for camera calculations
        const playerRotationY = localRotationRef.current.y; 

        if (cameraMode === CAMERA_MODES.FOLLOW) {
          // --- FOLLOW CAMERA MODE --- 
          // Special close camera during falling animation for cinematic effect
          const isFalling = currentAnimation === ANIMATIONS.FALLING && playerPosition.y > 10;
          const cameraHeight = isFalling ? 2.0 : 3.0; // Lower when falling to get closer
          const currentDistance = isFalling ? 3.0 : zoomLevel.current; // Much closer when falling

          // Calculate camera position based on player rotation and distance
          const targetPosition = new THREE.Vector3(
            playerPosition.x - Math.sin(playerRotationY) * currentDistance,
            playerPosition.y + cameraHeight,
            playerPosition.z - Math.cos(playerRotationY) * currentDistance 
          );

          // HACK: During falling, skip lerp entirely for perfectly smooth camera movement
          if (isFalling) {
            // Direct position assignment for zero jitter during fall
            camera.position.copy(targetPosition);
          } else {
            // Normal lerp for regular gameplay
            const cameraDamping = 12;
            camera.position.lerp(targetPosition, Math.min(1, dt * cameraDamping));
          }

          // Make camera look at a point slightly above the player's base
          // During falling, look directly at the character center for better view of animation
          const lookHeight = isFalling ? 1.0 : 1.8; // Look at character center when falling
          const lookTarget = playerPosition.clone().add(new THREE.Vector3(0, lookHeight, 0));
          camera.lookAt(lookTarget);
        } else if (cameraMode === CAMERA_MODES.ORBITAL) {
          // --- ORBITAL CAMERA MODE ---
          const orbital = orbitalCameraRef.current;
          
          // Special close orbital during falling animation
          const isFalling = currentAnimation === ANIMATIONS.FALLING && playerPosition.y > 10;
          const orbitalDistance = isFalling ? 4.0 : orbital.distance; // Much closer when falling
          
          // Calculate orbital camera position using spherical coordinates
          const horizontalDistance = orbitalDistance * Math.cos(orbital.elevation);
          const height = orbitalDistance * Math.sin(orbital.elevation);
          
          // Use orbital.angle for camera rotation, playerPosition for center
          const orbitX = playerPosition.x + Math.sin(orbital.angle) * horizontalDistance;
          const orbitY = playerPosition.y + height; // This follows player Y position closely
          const orbitZ = playerPosition.z + Math.cos(orbital.angle) * horizontalDistance;
          
          // Set camera position based on orbital calculations
          const targetPosition = new THREE.Vector3(orbitX, orbitY, orbitZ);
          
          // HACK: During falling, skip lerp entirely for perfectly smooth camera movement
          if (isFalling) {
            // Direct position assignment for zero jitter during fall
            camera.position.copy(targetPosition);
          } else {
            // Normal lerp for regular gameplay
            const cameraDamping = 8;
            camera.position.lerp(targetPosition, Math.min(1, dt * cameraDamping));
          }
          
          // Look at player - focused on character center during falling
          const lookHeight = isFalling ? 1.0 : 1.5; // Center focus when falling
          const lookTarget = playerPosition.clone().add(new THREE.Vector3(0, lookHeight, 0)); 
          camera.lookAt(lookTarget);
        }
      }

      // --- Update Animation Mixer ---
      if (mixer) {
        mixer.update(dt); // Mixer still uses actual frame delta (dt)
      }
    }
  });

  // --- Animation Triggering based on Server State ---
  useEffect(() => {
    // Explicitly wrap hook body
    {
      // Only update animations if mixer and animations exist
      if (!mixer || Object.keys(animations).length === 0) {
        // console.log(`🔄 Animation trigger skipped: mixer=${!!mixer}, animations=${Object.keys(animations).length}`);
        return;
      }

      const serverAnim = playerData.currentAnimation;

      // Don't allow server to override falling animation during high altitude descent (LOCAL PLAYER ONLY)
      const isHighAltitudeFalling = isLocalPlayer && currentAnimation === ANIMATIONS.FALLING && localPositionRef.current.y > 20;

      // Check BOTH state and ref for immediate protection against race conditions
      const isCurrentlyInPowerUp = isPlayingPowerUp || isPlayingPowerUpRef.current;
      
      // Check if ninja run should override server animation (LOCAL PLAYER ONLY)
      let finalAnimation = serverAnim;
      if (isLocalPlayer && isNinjaRunActive && (serverAnim === ANIMATIONS.RUN_FORWARD || serverAnim === 'sword_run-forward')) {
        // Override server's run-forward animation with ninja run when ninja run is active
        finalAnimation = ANIMATIONS.NINJA_RUN;
        console.log(`🥷 [Ninja Run Animation] Overriding server animation '${serverAnim}' with ninja run`);
        console.log(`🥷 [Ninja Run Animation] Ninja run animation key: ${ANIMATIONS.NINJA_RUN}`);
        console.log(`🥷 [Ninja Run Animation] Animation exists:`, !!animations[ANIMATIONS.NINJA_RUN]);
      } else if (isLocalPlayer && isNinjaRunActive) {
        console.log(`🥷 [Ninja Run Animation] Ninja run active but server animation is '${serverAnim}', not overriding`);
      }
      
      // console.log(`🎯 [Anim Check] Received ServerAnim: ${serverAnim}, Final Anim: ${finalAnimation}, Current LocalAnim: ${currentAnimation}, High Alt Falling: ${isHighAltitudeFalling}, Is Attacking: ${isAttacking}, Is Playing PowerUp: ${isPlayingPowerUp}, PowerUp Ref: ${isPlayingPowerUpRef.current}, Is Available: ${!!animations[finalAnimation]}`);

      // Play animation if it's different and available, but not during high altitude falling, local attacks, or power-up
      if (isHighAltitudeFalling) {
        // console.log(`🚫 [Anim Block] Ignoring server animation '${serverAnim}' during high altitude falling at Y=${localPositionRef.current.y.toFixed(1)} (LOCAL PLAYER ONLY)`);
      } else if (isLocalPlayer && isAttacking) {
        // console.log(`🚫 [Anim Block] Ignoring server animation '${serverAnim}' during local attack animation (LOCAL PLAYER ONLY)`);
      } else if (isLocalPlayer && isCurrentlyInPowerUp) {
        // console.log(`🚫 [Anim Block] Ignoring server animation '${finalAnimation}' during sword power-up animation (LOCAL PLAYER ONLY) - State: ${isPlayingPowerUp}, Ref: ${isPlayingPowerUpRef.current}`);
      } else if (finalAnimation && finalAnimation !== currentAnimation && animations[finalAnimation]) {
         // console.log(`🎬 [Anim Play] Playing animation: ${finalAnimation} (original server: ${serverAnim})`);
         if (finalAnimation === ANIMATIONS.NINJA_RUN) {
           console.log('🥷 [Ninja Run Animation] PLAYING NINJA RUN ANIMATION!');
         }
        try {
          playAnimation(finalAnimation, 0.2);
        } catch (error) {
          console.error(`❌ [Anim Error] Error playing animation ${finalAnimation}:`, error);
          // Attempt to fallback to idle if error occurs and not already idle
          if (animations['idle'] && currentAnimation !== 'idle') {
            playAnimation('idle', 0.2);
          }
        }
      } else if (finalAnimation && !animations[finalAnimation]) {
         console.warn(`⚠️ [Anim Warn] Animation not available: ${finalAnimation} (original server: ${serverAnim}). Available: ${Object.keys(animations).join(', ')}`);
      }
    }
  }, [playerData.currentAnimation, animations, mixer, playAnimation, currentAnimation, isAttacking, isPlayingPowerUp, isNinjaRunActive]); // Dependencies include things that trigger animation changes

  // Cleanup effects on unmount
  useEffect(() => {
    return () => {
      if (bloodEffectManagerRef.current) {
        bloodEffectManagerRef.current.cleanup();
        // console.log(`[Player] 🧹 Blood effect manager cleaned up on unmount`);
      }
      if (coinEffectManagerRef.current) {
        coinEffectManagerRef.current.cleanup();
        // console.log(`[Player] 🧹 Coin effect manager cleaned up on unmount`);
      }
      if (powerUpTimeoutRef.current) {
        clearTimeout(powerUpTimeoutRef.current);
        // console.log(`[Player] 🧹 Power-up timeout cleared on unmount`);
      }
    };
  }, []);

  // Cleanup power-up timeout when sword is unequipped
  useEffect(() => {
    if (!equippedSword && powerUpTimeoutRef.current) {
      clearTimeout(powerUpTimeoutRef.current);
      powerUpTimeoutRef.current = null;
      setIsPlayingPowerUp(false);
      setIsMovementFrozen(false);
      isPlayingPowerUpRef.current = false; // Clear race condition protection
      frozenPositionRef.current = null; // Clear frozen position
      // console.log(`[Player] 🧹 Power-up timeout cleared and movement unfrozen due to sword unequip`);
    }
  }, [equippedSword]);

  // Function to find the right hand bone in the skeleton
  const findRightHandBone = useCallback((model: THREE.Group): THREE.Bone | null => {
    let foundBone: THREE.Bone | null = null;
    
    // console.log(`[Player] 🔍 Starting bone search for ${characterClass}...`);
    
    model.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh && child.skeleton) {
        const bones = child.skeleton.bones;
        // console.log(`[Player] 🦴 Found skeleton with ${bones.length} bones`);
        
        // Debug: List all bone names first
        // console.log(`[Player] 🦴 All available bones:`, bones.map(b => b.name));
        
        // Search for right hand bone - prioritize actual hand bones over forearm
        const rightHandPatterns = [
          // Highest priority - actual hand bones
          'righthand', 'right_hand', 'hand_r', 'handr', 'r_hand',
          'mixamorig:righthand', 'mixamorig:right_hand', 'mixamorig:hand_r',
          'bip01_r_hand', 'bip01_hand_r', 'bone_hand_r', 'hand.r',
          // Lower priority - wrist/forearm bones (only if no hand found)
          'rightwrist', 'right_wrist', 'wrist_r', 'r_wrist',
          'mixamorig:rightwrist', 'mixamorig:right_wrist', 'mixamorig:wrist_r'
        ];
        
        // console.log(`[Player] 🔍 Searching with hand-priority patterns:`, rightHandPatterns);
        
        for (const bone of bones) {
          const boneName = bone.name.toLowerCase().replace(/[\s_\-\.]/g, '');
          
          for (const pattern of rightHandPatterns) {
            const patternClean = pattern.toLowerCase().replace(/[\s_\-\.]/g, '');
            if (boneName.includes(patternClean) || boneName === patternClean) {
              // console.log(`[Player] ✋ Found right hand bone: "${bone.name}" (matched pattern: ${pattern})`);
              foundBone = bone;
              return; // Stop traversing once found
            }
          }
        }
        
        // Only try forearm as last resort if no hand/wrist found
        if (!foundBone) {
          // console.log(`[Player] 🔍 No hand/wrist found, trying forearm as fallback...`);
          const forearmPatterns = [
            'rightforearm', 'right_forearm', 'forearm_r', 'forearmr', 'r_forearm',
            'mixamorig:rightforearm', 'mixamorig:right_forearm', 'mixamorig:forearm_r'
          ];
          
          for (const bone of bones) {
            const boneName = bone.name.toLowerCase().replace(/[\s_\-\.]/g, '');
            
            for (const pattern of forearmPatterns) {
              const patternClean = pattern.toLowerCase().replace(/[\s_\-\.]/g, '');
              if (boneName.includes(patternClean) || boneName === patternClean) {
                // console.log(`[Player] ✋ Found forearm bone as fallback: "${bone.name}"`);
                foundBone = bone;
                break;
              }
            }
            if (foundBone) break;
          }
        }
      }
    });
    
    if (!foundBone) {
      console.warn(`[Player] ⚠️ No suitable hand/wrist/forearm bone found in skeleton for ${characterClass}`);
    } else {
      // console.log(`[Player] ✅ Final selected bone: "${foundBone.name}"`);
    }
    
    return foundBone;
  }, [characterClass]);

  // Function to equip sword to right hand
  const equipSword = useCallback((swordModel: THREE.Group, swordPosition: THREE.Vector3) => {
    if (!model || !rightHandBone) {
      console.warn('[Player] ⚔️ Cannot equip sword: missing model or right hand bone');
      // console.log('[Player] 🔍 Debug - model exists:', !!model);
      // console.log('[Player] 🔍 Debug - rightHandBone exists:', !!rightHandBone);
      return;
    }
    
    // Prevent multiple attachments
    if (equippedSword) {
      // console.log('[Player] ⚔️ Sword already equipped, skipping...');
      return;
    }
    
    // console.log('[Player] ⚔️ Equipping sword to right hand bone:', rightHandBone.name);
    // console.log('[Player] 🔍 Debug - Bone world position:', rightHandBone.getWorldPosition(new THREE.Vector3()));
    
        // Calculate scale relative to character for proper sword sizing
    const characterScale = gameplayConfig.scale;
    const swordScale = 1 / characterScale; // Scale relative to character size
    // console.log('[Player] 📏 Character scale:', characterScale, 'Sword scale multiplier:', swordScale);
    
    // Move the original sword model to the hand bone
    // console.log('[Player] 🗡️ Attaching sword to hand bone...');
    if (swordModel.parent) {
      swordModel.parent.remove(swordModel); // Remove from its current parent
    }
    
    // Configure sword properties for hand attachment
    swordModel.scale.setScalar(2.5 * swordScale); // Much bigger sword (increased from 1.5 to 3.0)
    swordModel.position.set(0, 25, 3); // Position forward and up from hand bone (hilt at hand level)
    swordModel.rotation.set(Math.PI / 2, 0, 0); // Orient sword pointing forward from hand
    
    // console.log(`🗡️ [Debug] Sword equipped with scale: ${3.0 * swordScale}, final scale: ${swordModel.scale.x}`);
    // console.log(`🗡️ [Debug] Character scale: ${characterScale}, swordScale multiplier: ${swordScale}`);
    
    // Restore sword's natural materials (remove red debug color)
    swordModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.visible = true;
        child.castShadow = true;
        child.receiveShadow = true;
        // Keep original materials - don't override them
      }
    });
    
    rightHandBone.add(swordModel);
    // console.log('[Player] ✅ Sword attached to hand bone with natural materials');
    
    // Store reference
    setEquippedSword(swordModel);
    swordAttachmentRef.current = swordModel;
    
    // Trigger visual glow effect for 1 second
    createGlowEffect();
    
    // console.log('[Player] ✅ Sword equipped and ready! Playing power-up animation...');
    // console.log(`🔍 [Debug] Available animations:`, Object.keys(animations));
    // console.log(`🔍 [Debug] Looking for powerup animation: ${ANIMATIONS.POWERUP}`);
    // console.log(`🔍 [Debug] isAttacking state: ${isAttacking}`);
    // console.log(`🔍 [Debug] equippedSword state: ${!!equippedSword}`);
    // console.log(`🔍 [Debug] swordModel provided: ${!!swordModel}`);
    // console.log(`🔍 [Debug] swordPosition: (${swordPosition.x.toFixed(2)}, ${swordPosition.y.toFixed(2)}, ${swordPosition.z.toFixed(2)})`);
    
    // IMMEDIATE race condition protection - set ref synchronously
    isPlayingPowerUpRef.current = true;
    // console.log(`🛡️ [Race Protection] Set isPlayingPowerUpRef to true immediately`);
    
    // Move player to sword position immediately and freeze there (X/Z only, keep player on ground)
    const swordGroundPosition = new THREE.Vector3(
      swordPosition.x, 
      localPositionRef.current.y, // Keep current Y position (stay on ground level)
      swordPosition.z
    );
    localPositionRef.current.x = swordGroundPosition.x;
    localPositionRef.current.z = swordGroundPosition.z;
    // Don't change Y - let player stay at current ground level
    
    frozenPositionRef.current = swordGroundPosition.clone();
    // console.log(`🧊 [Sword Position] Moved player to sword X/Z location (${swordGroundPosition.x.toFixed(2)}, ${swordGroundPosition.z.toFixed(2)}) and froze, keeping ground Y=${localPositionRef.current.y.toFixed(2)}`);
    
    // Use a short delay to ensure state has updated and try playing power-up animation
    setTimeout(() => {
      // console.log(`🔍 [Debug] Delayed check - Available animations:`, Object.keys(animations));
      // console.log(`🔍 [Debug] Delayed check - isAttacking: ${isAttacking}`);
      // console.log(`🔍 [Debug] Delayed check - equippedSword: ${!!equippedSword}`);
      
      const swordPowerupAnimation = `sword_${ANIMATIONS.POWERUP}`;
      // console.log(`🔍 [Debug] Looking for sword powerup animation: ${swordPowerupAnimation}`);
      // console.log(`🔍 [Debug] Animation exists: ${!!animations[swordPowerupAnimation]}`);
      
      if (animations[swordPowerupAnimation] && !isAttacking && Object.keys(animations).length > 0) {
        // console.log('[Player] ⚡ Playing sword power-up animation - ENTERING POWER-UP MODE');
        
                      // Enter power-up mode - blocks all other animations and movement
              setIsPlayingPowerUp(true);
              setIsMovementFrozen(true);
              
              // Position already set in equipSword function to sword location  
              // console.log(`🧊 [Movement Frozen] Position already locked at sword location - polling path`);
        
        // Position already set in equipSword function to sword location
        // console.log(`🧊 [Movement Frozen] Position already locked at sword location`);
        
        const powerupAction = animations[swordPowerupAnimation];
        const currentAction = animations[currentAnimation];
        
        if (currentAction) {
          currentAction.fadeOut(0.1); // Faster fade out to start power-up immediately
        }
        
        // Get sword time scale for powerup
        const timeScale = getAnimationTimeScale(characterClass, ANIMATIONS.POWERUP, true);
        
        powerupAction.reset()
                     .setEffectiveTimeScale(timeScale)
                     .setEffectiveWeight(1)
                     .setLoop(THREE.LoopOnce, 1)
                     .clampWhenFinished = true;
        powerupAction.fadeIn(0.1).play(); // Faster fade in to start power-up immediately
        
        setCurrentAnimation(swordPowerupAnimation);
        
        // Use a fixed 1-second duration for clean power-up timing
        const powerUpDuration = 1000; // 1 second
        
        // Clear any existing power-up timeout
        if (powerUpTimeoutRef.current) {
          clearTimeout(powerUpTimeoutRef.current);
        }
        
        // console.log(`[Player] ⚡ Power-up will last for ${powerUpDuration}ms`);
        
        powerUpTimeoutRef.current = setTimeout(() => {
          // console.log('[Player] ⚡ Power-up duration complete - EXITING POWER-UP MODE');
          
          // Exit power-up mode and unfreeze movement
          setIsPlayingPowerUp(false);
          setIsMovementFrozen(false);
          isPlayingPowerUpRef.current = false; // Clear race condition protection
          frozenPositionRef.current = null; // Clear frozen position
          powerUpTimeoutRef.current = null;
          
          // console.log('[Player] 🧊 Movement unfrozen - player can move again');
          // console.log(`🛡️ [Race Protection] Cleared isPlayingPowerUpRef`);
          
          // Small delay to let state clear before transitioning
          setTimeout(() => {
            // console.log('[Player] ⚡ Power-up complete - allowing normal animation flow to resume');
            
            // Check if sword is still equipped and handle animation transition
            if (swordAttachmentRef.current) {
              // Resume with server animation state to prevent conflicts
              const serverAnim = playerData.currentAnimation;
              if (serverAnim && animations[serverAnim]) {
                // console.log(`[Player] ⚡ Resuming with server animation: ${serverAnim}`);
                playAnimation(serverAnim, 0.3);
              } else {
                // console.log('[Player] ⚡ Falling back to sword idle');
                playAnimation(ANIMATIONS.IDLE, 0.3);
              }
            }
          }, 50); // Small delay to ensure state has updated
        }, powerUpDuration); // Fixed 1-second duration
      } else {
        // Fallback if power-up animation isn't available
        if (!animations[swordPowerupAnimation]) {
          // console.log(`[Player] ⚠️ Power-up animation '${swordPowerupAnimation}' not found in animations object`);
          // console.log(`[Player] 🔍 Available sword animations:`, Object.keys(animations).filter(key => key.startsWith('sword_')));
          // console.log(`[Player] 🔍 Total animations available:`, Object.keys(animations).length);
        }
        if (isAttacking) {
          // console.log(`[Player] ⚠️ Cannot play power-up animation because isAttacking = ${isAttacking}`);
        }
        if (Object.keys(animations).length === 0) {
          // console.log(`[Player] ⚠️ No animations loaded yet, setting up polling for power-up animation...`);
          
          // Poll for animations to be ready with multiple retries
          let retryCount = 0;
          const maxRetries = 10; // Try for up to 5 seconds (500ms * 10)
          
          const pollForAnimations = () => {
            retryCount++;
            // console.log(`[Player] 🔄 Polling attempt ${retryCount}/${maxRetries} for animations...`);
            // console.log(`[Player] 🔍 Current animations count: ${Object.keys(animations).length}`);
            
            if (animations[swordPowerupAnimation] && swordAttachmentRef.current) {
              // console.log('[Player] 🎬 Power-up animation now available! Playing... - ENTERING POWER-UP MODE');
              
              // Enter power-up mode - blocks all other animations and movement
              setIsPlayingPowerUp(true);
              setIsMovementFrozen(true);
              
              // Store current position to freeze at
              frozenPositionRef.current = localPositionRef.current.clone();
              // console.log(`🧊 [Movement Frozen] Position locked at (${frozenPositionRef.current.x.toFixed(2)}, ${frozenPositionRef.current.y.toFixed(2)}, ${frozenPositionRef.current.z.toFixed(2)}) - polling path`);
              
              // Retry the power-up animation
              const powerupAction = animations[swordPowerupAnimation];
              const currentAction = animations[currentAnimation];
              
              if (currentAction) {
                currentAction.fadeOut(0.1); // Faster fade out
              }
              
              const timeScale = getAnimationTimeScale(characterClass, ANIMATIONS.POWERUP, true);
              
              powerupAction.reset()
                           .setEffectiveTimeScale(timeScale)
                           .setEffectiveWeight(1)
                           .setLoop(THREE.LoopOnce, 1)
                           .clampWhenFinished = true;
              powerupAction.fadeIn(0.1).play(); // Faster fade in
              
              setCurrentAnimation(swordPowerupAnimation);
              
              // Use fixed 1-second duration for consistency
              const powerUpDuration = 1000; // 1 second
              
              // Clear any existing power-up timeout
              if (powerUpTimeoutRef.current) {
                clearTimeout(powerUpTimeoutRef.current);
              }
              
              // console.log(`[Player] ⚡ Power-up (polling path) will last for ${powerUpDuration}ms`);
              
              powerUpTimeoutRef.current = setTimeout(() => {
                // console.log('[Player] ⚡ Power-up duration complete (polling path) - EXITING POWER-UP MODE');
                
                // Exit power-up mode and unfreeze movement
                setIsPlayingPowerUp(false);
                setIsMovementFrozen(false);
                isPlayingPowerUpRef.current = false; // Clear race condition protection
                frozenPositionRef.current = null; // Clear frozen position
                powerUpTimeoutRef.current = null;
                
                // console.log('[Player] 🧊 Movement unfrozen (polling path) - player can move again');
                // console.log(`🛡️ [Race Protection] Cleared isPlayingPowerUpRef (polling path)`);
                
                // Small delay to let power-up state clear
                setTimeout(() => {
                  if (swordAttachmentRef.current) {
                    // console.log('[Player] ⚡ Power-up complete (polling) - allowing normal animation flow to resume');
                    
                    // Resume with server animation state instead of forcing idle
                    const serverAnim = playerData.currentAnimation;
                    if (serverAnim && animations[serverAnim]) {
                      // console.log(`[Player] ⚡ Resuming with server animation (polling): ${serverAnim}`);
                      playAnimation(serverAnim, 0.3);
                    } else {
                      // console.log('[Player] ⚡ Falling back to sword idle (polling)');
                      playAnimation(ANIMATIONS.IDLE, 0.3);
                    }
                  }
                }, 50);
              }, powerUpDuration); // Fixed 1-second duration
              
            } else if (retryCount < maxRetries && swordAttachmentRef.current) {
              // Keep trying
              // console.log(`[Player] ⏳ Animations not ready yet, retrying in 500ms... (${retryCount}/${maxRetries})`);
              setTimeout(pollForAnimations, 500);
            } else {
              // Give up and fall back to sword idle
              // console.log('[Player] ⚠️ Max retries reached or sword no longer equipped, falling back to sword idle');
              if (swordAttachmentRef.current) {
                playAnimation(ANIMATIONS.IDLE, 0.3);
              }
            }
          };
          
          // Start polling
          setTimeout(pollForAnimations, 500);
          return; // Don't play idle yet, wait for polling
        }
        // console.log('[Player] ⚠️ Power-up animation not found or blocked, switching directly to sword idle');
        playAnimation(ANIMATIONS.IDLE, 0.3);
      }
    }, 100); // Short delay to ensure state updates have propagated
  }, [model, rightHandBone, equippedSword, animations, isAttacking, currentAnimation, playAnimation, getAnimationTimeScale, characterClass, gameplayConfig.scale, ANIMATIONS.POWERUP, ANIMATIONS.IDLE, setIsPlayingPowerUp, setIsMovementFrozen, playerData.currentAnimation, localPositionRef]);

  // Function to unequip sword
  const unequipSword = useCallback(() => {
    if (equippedSword && rightHandBone) {
      rightHandBone.remove(equippedSword);
      setEquippedSword(null);
      swordAttachmentRef.current = null;
      // console.log('[Player] ⚔️ Sword unequipped! Animation system will switch back to default animations.');
    }
    
    // Clean up any active glow effect
    removeGlowEffect();
  }, [rightHandBone, equippedSword, removeGlowEffect]);

  // Find right hand bone when model loads
  useEffect(() => {
    if (model && isLocalPlayer) {
      const bone = findRightHandBone(model);
      setRightHandBone(bone);
    }
  }, [model, isLocalPlayer, findRightHandBone]);

  // Handle animation switching when sword is equipped/unequipped (but not during combat or power-up)
  useEffect(() => {
    // Check BOTH state and ref for immediate protection against race conditions
    const isCurrentlyInPowerUp = isPlayingPowerUp || isPlayingPowerUpRef.current;
    
    // Only run if sword state actually changed and we're not attacking or in power-up mode
    if (prevSwordEquippedRef.current !== isSwordEquipped && 
        mixer && Object.keys(animations).length > 0 && currentAnimation && !isAttacking && !isCurrentlyInPowerUp) {
      
      // Don't switch animations if we're currently playing power-up
      if (currentAnimation === `sword_${ANIMATIONS.POWERUP}`) {
        // console.log(`🗡️ Sword state changed but skipping animation switch - currently in power-up animation`);
        prevSwordEquippedRef.current = isSwordEquipped; // Update the ref but don't switch
        return;
      }
      
      // Extract the base animation name (remove sword_ prefix if present)
      const baseAnimationName = currentAnimation.startsWith('sword_') 
        ? currentAnimation.replace('sword_', '') 
        : currentAnimation;
      
      // console.log(`🗡️ Sword state ACTUALLY changed (${prevSwordEquippedRef.current} → ${isSwordEquipped}), switching from ${currentAnimation} to appropriate variant of ${baseAnimationName}`);
      
      // Play the appropriate variant of the current animation
      playAnimation(baseAnimationName, 0.2); // Quick crossfade for smooth transition
    }
    
    // Update the previous state
    prevSwordEquippedRef.current = isSwordEquipped;
  }, [isSwordEquipped, mixer, animations, currentAnimation, isAttacking, isPlayingPowerUp, playAnimation]); // All dependencies needed for the effect

  // Initialize global attack state
  useEffect(() => {
    if (isLocalPlayer) {
      (window as any).currentPlayerAttackInfo = {
        isSword: false,
        comboStage: 0,
        attackAnimation: null,
        timestamp: 0
      };
      (window as any).currentPlayerAttackIsSword = false;
      // console.log(`[Player] 🌐 Initialized global attack state for zombie system`);
    }
  }, [isLocalPlayer]);

  // Expose sword equipping/unequipping functions for external use
  useEffect(() => {
    if (isLocalPlayer && gameReadyCallbacks) {
      // Add sword equipping capability to game ready callbacks
      gameReadyCallbacks.onSwordCollected = equipSword;
      // Also expose unequip for testing (could be useful for dev tools)
      (gameReadyCallbacks as any).onSwordUnequipped = unequipSword;
    }
  }, [isLocalPlayer, gameReadyCallbacks, equipSword, unequipSword]);

  return (
    <group ref={group} castShadow>
      {/* Debug Marker Sphere */}
      <Sphere 
        args={[0.1, 16, 16]} 
        position={[0, -0.5, 0]} 
        visible={isDebugPanelVisible} 
      >
        <meshBasicMaterial color="red" wireframe /> 
      </Sphere>

      {/* Model added dynamically */}
      {/* Name tag */}
      {model && (
        <Html position={[0, 2.4, 0]} center distanceFactor={10} style={{ zIndex: 10 }}>
            <div className="nametag">
            <div className="nametag-text">{playerData.username}</div>
            <div className="nametag-class">{(playerData as any).xHandle || ''}</div>
            </div>
        </Html>
      )}
    </group>
  );
}; 