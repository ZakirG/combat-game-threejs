/**
 * Vibe Coding Starter Pack: 3D Multiplayer - App.tsx
 * 
 * Main application component that orchestrates the entire multiplayer experience.
 * This file serves as the central hub for:
 * 
 * 1. SpacetimeDB Connection Management:
 *    - Establishes and maintains WebSocket connection
 *    - Handles authentication and identity
 *    - Subscribes to database tables
 *    - Processes real-time updates
 * 
 * 2. Player Input Handling:
 *    - Keyboard and mouse event listeners
 *    - Input state tracking and normalization
 *    - Animation state determination
 *    - Camera/rotation management with pointer lock
 * 
 * 3. Game Loop:
 *    - Sends player input to server at appropriate intervals
 *    - Updates local state based on server responses
 *    - Manages the requestAnimationFrame cycle
 * 
 * 4. UI Management:
 *    - Renders GameScene (3D view)
 *    - Controls DebugPanel visibility
 *    - Manages JoinGameDialog for player registration
 *    - Displays connection status
 * 
 * Extension points:
 *    - Add new input types in currentInputRef and InputState
 *    - Extend determineAnimation for new animation states
 *    - Add new reducers calls for game features (see handleCastSpellInput)
 *    - Modify game loop timing or prediction logic
 * 
 * Related files:
 *    - components/GameScene.tsx: 3D rendering with Three.js
 *    - components/Player.tsx: Character model and animation
 *    - components/DebugPanel.tsx: Developer tools and state inspection
 *    - generated/: Auto-generated TypeScript bindings from the server
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import './App.css';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import * as moduleBindings from './generated';
import { DebugPanel } from './components/DebugPanel';
import { GameScene } from './components/GameScene';
import { JoinGameDialog } from './components/JoinGameDialog';
import { LoadingScreen } from './components/LoadingScreen';
import * as THREE from 'three';
import { PlayerUI } from './components/PlayerUI';
import { KillCounter } from './components/KillCounter';
import { MaxComboCounter } from './components/MaxComboCounter';
import CoinCounter from './components/CoinCounter';
import { GameReadyState, GameReadyCallbacks, isGameReady } from './types/gameReady';

// Type Aliases
type DbConnection = moduleBindings.DbConnection;
type EventContext = moduleBindings.EventContext;
type ErrorContext = moduleBindings.ErrorContext;
type PlayerData = moduleBindings.PlayerData;
type InputState = moduleBindings.InputState;
// ... other types ...

let conn: DbConnection | null = null;

function App() {
  const [connected, setConnected] = useState(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [statusMessage, setStatusMessage] = useState("Connecting...");
  const [players, setPlayers] = useState<ReadonlyMap<string, PlayerData>>(new Map());
  const [localPlayer, setLocalPlayer] = useState<PlayerData | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [isDebugPanelExpanded, setIsDebugPanelExpanded] = useState(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false); // State for pointer lock status
  const [hasJoinedGame, setHasJoinedGame] = useState(false); // Track when user clicks "Join the Map"
  
  // --- GameReady State ---
  const [gameReadyState, setGameReadyState] = useState<GameReadyState>({
    isCharacterReady: false,
    isZombiesReady: false,
    characterProgress: 0,
    zombieProgress: 0,
    characterStatus: 'Waiting to start...',
    zombieStatus: 'Waiting to spawn...'
  });
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [gameFullyReady, setGameFullyReady] = useState(false);
  
  // --- Kill Counter State ---
  const [totalKillCount, setTotalKillCount] = useState<number>(0);
  
  // --- Coin Counter State ---
  const [totalCoinCount, setTotalCoinCount] = useState<number>(0);

  // --- Combo Counter State ---
  const [comboCount, setComboCount] = useState<number>(0);
  const [lastHitTime, setLastHitTime] = useState<number>(0);
  const [maxComboCount, setMaxComboCount] = useState<number>(0);

  // --- Zombie Attack Effects State ---
  const [showZombieAttackFlash, setShowZombieAttackFlash] = useState<boolean>(false);
  const [shouldTriggerHitAnimation, setShouldTriggerHitAnimation] = useState<boolean>(false);

  // --- Ref for current input state ---
  const currentInputRef = useRef<InputState>({
    forward: false, backward: false, left: false, right: false,
    sprint: false, jump: false, attack: false, castSpell: false,
    sequence: 0,
  });
  const lastSentInputState = useRef<Partial<InputState>>({});
  const animationFrameIdRef = useRef<number | null>(null); // For game loop

  // New import for handling player rotation data
  const playerRotationRef = useRef<THREE.Euler>(new THREE.Euler(0, 0, 0, 'YXZ'));
  const playerPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 90, 0)); // Initialize with spawn altitude

  // --- Kill Count Callback ---
  const handleKillCountChange = useCallback((killCount: number) => {
    setTotalKillCount(killCount);
  }, []);
  
  // --- Coin Collection Callback ---
  const handleCoinCollected = useCallback((coinCount: number) => {
    setTotalCoinCount(prev => prev + coinCount);
  }, []);
  
    // --- Combo Counter Logic ---
  const handleZombieHit = useCallback(() => {
    const currentTime = Date.now();
    
    setLastHitTime(prevLastHitTime => {
      const timeSinceLastHit = currentTime - prevLastHitTime;
    
      // If less than 2 seconds since last hit, continue combo
      if (timeSinceLastHit <= 2000 && prevLastHitTime > 0) {
        setComboCount(prev => {
          const newCombo = prev + 1;
          // Update max combo if this is a new record
          setMaxComboCount(current => Math.max(current, newCombo));
          return newCombo;
        });
      } else {
        // Start new combo
        setComboCount(1);
        // Update max combo if needed (for the case where max is 0)
        setMaxComboCount(current => Math.max(current, 1));
      }
      
      return currentTime;
    });
  }, []);

  // --- Zombie Attack Player Logic ---
  const handleZombieAttackPlayer = useCallback((targetPlayerId: string) => {
    // Only trigger effects if the attack targets the local player
    if (!identity || targetPlayerId !== identity.toHexString()) {
      return; // Not the local player, ignore
    }
    
    console.log('[ZombieAttack] Local player hit by zombie!');
    
    // Trigger screen flash
    setShowZombieAttackFlash(true);
    
    // Trigger hit animation for local player
    setShouldTriggerHitAnimation(true);
    
    // Reset flash after animation completes
    setTimeout(() => {
      setShowZombieAttackFlash(false);
    }, 500); // Match CSS animation duration
    
    // Reset hit animation trigger after a short delay
    setTimeout(() => {
      setShouldTriggerHitAnimation(false);
    }, 100); // Short delay to allow Player component to detect the trigger
  }, [identity]);

  // Reset combo count after 2 seconds of no hits
  useEffect(() => {
    if (lastHitTime === 0) return; // Don't start timer if no hits yet
    
    const timeoutId = setTimeout(() => {
      setComboCount(0);
    }, 2000);
    
    return () => clearTimeout(timeoutId);
  }, [lastHitTime]);
  
  // --- GameReady Callbacks ---
  const gameReadyCallbacks: GameReadyCallbacks = {
    onCharacterReady: () => {
      setGameReadyState(prev => {
        const newState = { ...prev, isCharacterReady: true, characterProgress: 100, characterStatus: 'Character ready!' };
        if (isGameReady(newState)) {
          setGameFullyReady(true);
          setShowLoadingScreen(false);
        }
        return newState;
      });
    },
    onZombiesReady: () => {
      setGameReadyState(prev => {
        const newState = { ...prev, isZombiesReady: true, zombieProgress: 100, zombieStatus: 'All enemies spawned!' };
        if (isGameReady(newState)) {
          setGameFullyReady(true);
          setShowLoadingScreen(false);
        }
        return newState;
      });
    },
    onCharacterProgress: (progress: number, status: string) => {
      setGameReadyState(prev => ({ ...prev, characterProgress: progress, characterStatus: status }));
    },
    onZombieProgress: (progress: number, status: string) => {
      setGameReadyState(prev => ({ ...prev, zombieProgress: progress, zombieStatus: status }));
    },
    onCoinCollected: handleCoinCollected
  };

  // --- Moved Table Callbacks/Subscription Functions Up ---
  const registerTableCallbacks = useCallback(() => {
    if (!conn) return;
    // console.log("Registering table callbacks...");

    conn.db.player.onInsert((_ctx: EventContext, player: PlayerData) => {
        // console.log("Player inserted (callback):", player.identity.toHexString());
        setPlayers((prev: ReadonlyMap<string, PlayerData>) => new Map(prev).set(player.identity.toHexString(), player));
        if (identity && player.identity.toHexString() === identity.toHexString()) {
            setLocalPlayer(player);
            setStatusMessage(`Registered as ${player.username}`);
        }
    });

    conn.db.player.onUpdate((_ctx: EventContext, _oldPlayer: PlayerData, newPlayer: PlayerData) => {
        setPlayers((prev: ReadonlyMap<string, PlayerData>) => {
            const newMap = new Map(prev);
            newMap.set(newPlayer.identity.toHexString(), newPlayer);
            return newMap;
        });
        if (identity && newPlayer.identity.toHexString() === identity.toHexString()) {
            setLocalPlayer(newPlayer);
        }
    });

    conn.db.player.onDelete((_ctx: EventContext, player: PlayerData) => {
        // console.log("Player deleted (callback):", player.identity.toHexString());
        setPlayers((prev: ReadonlyMap<string, PlayerData>) => {
            const newMap = new Map(prev);
            newMap.delete(player.identity.toHexString());
            return newMap;
        });
        if (identity && player.identity.toHexString() === identity.toHexString()) {
            setLocalPlayer(null);
            setStatusMessage("Local player deleted!");
        }
    });
    // console.log("Table callbacks registered.");
  }, [identity]); // Keep identity dependency

  const onSubscriptionApplied = useCallback(() => {
     // console.log("Subscription applied successfully.");
     setPlayers((prev: ReadonlyMap<string, PlayerData>) => {
         if (prev.size === 0 && conn) {
             const currentPlayers = new Map<string, PlayerData>();
             for (const player of conn.db.player.iter()) {
                 currentPlayers.set(player.identity.toHexString(), player);
                 if (identity && player.identity.toHexString() === identity.toHexString()) {
                     setLocalPlayer(player);
                 }
             }
             return currentPlayers;
         }
         return prev;
     });
  }, [identity]); // Keep identity dependency

  const onSubscriptionError = useCallback((error: any) => {
      console.error("Subscription error:", error);
      setStatusMessage(`Subscription Error: ${error?.message || error}`);
  }, []);

  const subscribeToTables = useCallback(() => {
    if (!conn) return;
    // console.log("Subscribing to tables...");
    const subscription = conn.subscriptionBuilder();
    subscription.subscribe("SELECT * FROM player");
    subscription.onApplied(onSubscriptionApplied);
    subscription.onError(onSubscriptionError);
  }, [identity, onSubscriptionApplied, onSubscriptionError]); // Add dependencies

  // --- Event Handlers ---
  const handleDelegatedClick = useCallback((event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest('.interactive-button');
      if (button) {
          event.preventDefault();
          // console.log(`[CLIENT] Button click detected: ${button.getAttribute('data-action')}`);
          // Generic button handler without specific attack functionality
      }
  }, []);

  // --- Input State Management ---
  const keyMap: { [key: string]: keyof Omit<InputState, 'sequence' | 'castSpell'> } = {
      KeyW: 'forward', KeyS: 'backward', KeyA: 'left', KeyD: 'right',
      ShiftLeft: 'sprint', Space: 'jump',
  };

  // Handle special keys not in the main input state
  const handleSpecialKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Tab') {
      event.preventDefault(); // Prevent default tab behavior
      // console.log(`🎹 SPECIAL KEY: Tab -> Toggle Debug Panel`);
      setIsDebugPanelExpanded((prev: boolean) => {
        // console.log(`🎹 ✅ Debug panel toggled: ${prev} -> ${!prev}`);
        return !prev;
      });
    } else if (event.code === 'Escape') {
      // console.log(`🎹 SPECIAL KEY: Escape -> Unlock mouse pointer`);
      if (document.pointerLockElement) {
        document.exitPointerLock();
        // console.log(`🎹 ✅ Pointer lock released`);
      } else {
        // console.log(`🎹 ⚠️ Pointer lock was not active`);
      }
    }
  }, []);

  // Prevent right-click context menu
  const handleContextMenu = useCallback((event: MouseEvent) => {
    event.preventDefault();
    // console.log(`🖱️ RIGHT-CLICK CONTEXT MENU PREVENTED`);
  }, []);

  const determineAnimation = useCallback((input: InputState): string => {
    
    
    if (input.attack) {
      // console.log(`🎬 ✅ Animation result: 'attack1' (attack input active)`);
      return 'attack1';
    }
    if (input.castSpell) {
      // console.log(`🎬 ✅ Animation result: 'cast' (castSpell input active)`);
      return 'cast';
    }
    if (input.jump) {
      // console.log(`🎬 ✅ Animation result: 'jump' (jump input active)`);
      return 'jump';
    }
    
    // Determine animation based on movement keys
    const { forward, backward, left, right, sprint } = input;
    const isMoving = forward || backward || left || right;
    
    if (!isMoving) {
      // console.log(`🎬 ✅ Animation result: 'idle' (no movement input)`);
      return 'idle';
    }
    
    // Improved direction determination with priority handling
    // This matches legacy implementation better
    let direction = 'forward';
    
    // Primary direction determination - match legacy player.js logic
    if (forward && !backward) {
      direction = 'forward';
    } else if (backward && !forward) {
      direction = 'back';
    } else if (left && !right) {
      direction = 'left';
    } else if (right && !left) {
      direction = 'right';
    } else if (forward && left) {
      // Handle diagonal movement by choosing dominant direction
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
    
    // Generate final animation name
    const animationName = `${moveType}-${direction}`;
    
    // console.log(`🎬 ✅ Animation result: '${animationName}' (movement: ${moveType}, direction: ${direction})`);
    return animationName;
  }, []);

  const sendInput = useCallback((currentInputState: InputState) => {
    if (!conn || !identity || !connected) return; // Check connection status too
    
    // Use local client position for multiplayer sync
    const currentPosition = {
      x: playerPositionRef.current.x,
      y: playerPositionRef.current.y, // Send actual client Y position (falling, jumping)
      z: playerPositionRef.current.z
    };
    
    // Now using the playerRotationRef for more accurate rotation tracking
    const currentRotation = {
      x: playerRotationRef.current.x,
      y: playerRotationRef.current.y,
      z: playerRotationRef.current.z
    };
    
    // Determine animation from input state
    const currentAnimation = determineAnimation(currentInputState);

    let changed = false;
    for (const key in currentInputState) {
        if (currentInputState[key as keyof InputState] !== lastSentInputState.current[key as keyof InputState]) {
            changed = true;
            break;
        }
    }

    if (changed || currentInputState.sequence !== lastSentInputState.current.sequence) {
       
        conn.reducers.updatePlayerInput(currentInputState, currentPosition, currentRotation, currentAnimation);
        lastSentInputState.current = { ...currentInputState };
    }
  }, [identity, localPlayer, connected, determineAnimation]);

  // Add player rotation handler
  const handlePlayerRotation = useCallback((rotation: THREE.Euler) => {
    // Update our stored rotation whenever the player rotates (from mouse movements)
    playerRotationRef.current.copy(rotation);
  }, []);

  // Add player position handler
  const handlePlayerPosition = useCallback((position: THREE.Vector3) => {
    // Update our stored position with the client's local physics position
    playerPositionRef.current.copy(position);
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
      if (event.repeat) return; 
      
      // First handle special keys
      handleSpecialKeyDown(event);
      
      // Then handle regular input keys
      const action = keyMap[event.code];
      if (action) {
          // console.log(`🎹 KEY DOWN: ${event.code} -> ${action} (was: ${currentInputRef.current[action]})`);
          if (!currentInputRef.current[action]) { 
             currentInputRef.current[action] = true;
             // console.log(`🎹 ✅ ${action} activated`);
          }
      } else {
          // Log unmapped keys for debugging (but skip special keys we already handled)
          if (!['Tab', 'Escape'].includes(event.code)) {
            // console.log(`🎹 ❓ UNMAPPED KEY DOWN: ${event.code}`);
          }
      }
  }, [handleSpecialKeyDown]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
      const action = keyMap[event.code];
      if (action) {
          // console.log(`🎹 KEY UP: ${event.code} -> ${action} (was: ${currentInputRef.current[action]})`);
          if (currentInputRef.current[action]) { 
              currentInputRef.current[action] = false;
              // console.log(`🎹 ❌ ${action} deactivated`);
          }
      } else {
          // Log unmapped keys for debugging
          // console.log(`🎹 ❓ UNMAPPED KEY UP: ${event.code}`);
      }
  }, []);

  const handleMouseDown = useCallback((event: MouseEvent) => {
      // console.log(`🖱️ MOUSE DOWN: Button ${event.button} (${event.button === 0 ? 'LEFT' : event.button === 1 ? 'MIDDLE' : event.button === 2 ? 'RIGHT' : 'OTHER'})`);
      
      if (event.button === 0) { // Left click
           // console.log(`🖱️ LEFT CLICK: attack (was: ${currentInputRef.current.attack})`);
           if (!currentInputRef.current.attack) {
               currentInputRef.current.attack = true;
               // console.log(`🖱️ ✅ attack activated`);
           }
      } else if (event.button === 2) { // Right click
           // console.log(`🖱️ RIGHT CLICK: castSpell (was: ${currentInputRef.current.castSpell})`);
           if (!currentInputRef.current.castSpell) {
               currentInputRef.current.castSpell = true;
               // console.log(`🖱️ ✅ castSpell activated`);
           }
      }
  }, []);

  const handleMouseUp = useCallback((event: MouseEvent) => {
      // console.log(`🖱️ MOUSE UP: Button ${event.button} (${event.button === 0 ? 'LEFT' : event.button === 1 ? 'MIDDLE' : event.button === 2 ? 'RIGHT' : 'OTHER'})`);
      
      if (event.button === 0) { // Left click
           // console.log(`🖱️ LEFT RELEASE: attack (was: ${currentInputRef.current.attack})`);
           if (currentInputRef.current.attack) {
               currentInputRef.current.attack = false;
               // console.log(`🖱️ ❌ attack deactivated`);
           }
      } else if (event.button === 2) { // Right click
           // console.log(`🖱️ RIGHT RELEASE: castSpell (was: ${currentInputRef.current.castSpell})`);
           if (currentInputRef.current.castSpell) {
               currentInputRef.current.castSpell = false;
               // console.log(`🖱️ ❌ castSpell deactivated`);
           }
      }
  }, []);

  // Add mouse move handler with pointer lock for rotation
  const handleMouseMove = useCallback((event: MouseEvent) => {
    // Only rotate if we have pointer lock
    if (document.pointerLockElement === document.body) {
      const sensitivity = 0.002;
      
      // Log significant mouse movements for debugging (threshold to avoid spam)
      if (Math.abs(event.movementX) > 5 || Math.abs(event.movementY) > 5) {
        // console.log(`🖱️ MOUSE MOVE: dx=${event.movementX}, dy=${event.movementY} (sensitivity: ${sensitivity})`);
      }
      
      // Update the Euler rotation with mouse movement
      const oldRotationY = playerRotationRef.current.y;
      const oldRotationX = playerRotationRef.current.x;
      
      playerRotationRef.current.y -= event.movementX * sensitivity;
      
      // Clamp vertical rotation (looking up/down) to prevent flipping
      playerRotationRef.current.x = Math.max(
        -Math.PI / 2.5, 
        Math.min(Math.PI / 2.5, playerRotationRef.current.x - event.movementY * sensitivity)
      );
      
      // Log rotation changes for significant movements
      if (Math.abs(event.movementX) > 10 || Math.abs(event.movementY) > 10) {
        // console.log(`🖱️ ROTATION UPDATE: Y ${oldRotationY.toFixed(3)} -> ${playerRotationRef.current.y.toFixed(3)}, X ${oldRotationX.toFixed(3)} -> ${playerRotationRef.current.x.toFixed(3)}`);
      }
    } else {
      // Log when trying to move mouse without pointer lock
      if (Math.abs(event.movementX) > 0 || Math.abs(event.movementY) > 0) {
        // console.log(`🖱️ ⚠️ MOUSE MOVE WITHOUT POINTER LOCK: dx=${event.movementX}, dy=${event.movementY}`);
      }
    }
  }, []);

  // --- Listener Setup/Removal Functions ---
  const handlePointerLockChange = useCallback(() => {
    setIsPointerLocked(document.pointerLockElement === document.body);
    // console.log("Pointer Lock Changed: ", document.pointerLockElement === document.body);
  }, []);

  const setupInputListeners = useCallback(() => {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mousemove', handleMouseMove); // Add mouse move listener
      window.addEventListener('contextmenu', handleContextMenu); // Prevent right-click menu
      document.addEventListener('pointerlockchange', handlePointerLockChange); // Listen for lock changes
      // console.log("🎮 Input listeners added: keyboard, mouse, context menu, pointer lock");
  }, [handleKeyDown, handleKeyUp, handleMouseDown, handleMouseUp, handleMouseMove, handleContextMenu, handlePointerLockChange]);

  const removeInputListeners = useCallback(() => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove); // Remove mouse move listener
      window.removeEventListener('contextmenu', handleContextMenu); // Remove context menu listener
      document.removeEventListener('pointerlockchange', handlePointerLockChange); // Remove listener
      // console.log("🎮 Input listeners removed: keyboard, mouse, context menu, pointer lock");
  }, [handleKeyDown, handleKeyUp, handleMouseDown, handleMouseUp, handleMouseMove, handleContextMenu, handlePointerLockChange]);

  const setupDelegatedListeners = useCallback(() => {
      document.body.addEventListener('click', handleDelegatedClick, true);
      // console.log("Delegated listener added to body.");
  }, [handleDelegatedClick]);

  const removeDelegatedListeners = useCallback(() => {
      document.body.removeEventListener('click', handleDelegatedClick, true);
      // console.log("Delegated listener removed from body.");
  }, [handleDelegatedClick]);

  // --- Game Loop Effect ---
  useEffect(() => {
      const gameLoop = () => {
          if (!connected || !conn || !identity) {
              if (animationFrameIdRef.current) {
                  cancelAnimationFrame(animationFrameIdRef.current);
                  animationFrameIdRef.current = null;
              }
              return;
          }
          currentInputRef.current.sequence += 1;
          sendInput(currentInputRef.current);
          animationFrameIdRef.current = requestAnimationFrame(gameLoop);
      };

      if (connected && !animationFrameIdRef.current) {
          // console.log("[CLIENT] Starting game loop.");
          animationFrameIdRef.current = requestAnimationFrame(gameLoop);
      }

      return () => {
          if (animationFrameIdRef.current) {
              // console.log("[CLIENT] Stopping game loop.");
              cancelAnimationFrame(animationFrameIdRef.current);
              animationFrameIdRef.current = null;
          }
      };
  }, [connected, conn, identity, sendInput]);

  // --- Connection Effect Hook ---
  useEffect(() => {
    // console.log("Running Connection Effect Hook...");
    if (conn) {
        // console.log("Connection already established, skipping setup.");
         if (connected) {
             setupInputListeners();
             setupDelegatedListeners();
         }
        return;
    }

    const dbHost = "localhost:5555";
    const dbName = "vibe-multiplayer";

    // console.log(`Connecting to SpacetimeDB at ${dbHost}, database: ${dbName}...`);

    const onConnect = (connection: DbConnection, id: Identity, _token: string) => {
      // console.log("Connected!");
      conn = connection;
      (window as any).spacetimeConnection = connection; // Expose connection globally for components
      setIdentity(id);
      setConnected(true);
      setStatusMessage(`Connected as ${id.toHexString().substring(0, 8)}...`);
      subscribeToTables();
      registerTableCallbacks();
      setupInputListeners();
      setupDelegatedListeners();
      setShowJoinDialog(true);
    };

    const onDisconnect = (_ctx: ErrorContext, reason?: Error | null) => {
      const reasonStr = reason ? reason.message : "No reason given";
      // console.log("onDisconnect triggered:", reasonStr);
      setStatusMessage(`Disconnected: ${reasonStr}`);
      conn = null;
      (window as any).spacetimeConnection = null; // Clean up global connection
      setIdentity(null);
      setConnected(false);
      setPlayers(new Map());
      setLocalPlayer(null);
    };

    moduleBindings.DbConnection.builder()
      .withUri(`ws://${dbHost}`)
      .withModuleName(dbName)
      .onConnect(onConnect)
      .onDisconnect(onDisconnect)
      .build();

    return () => {
      // console.log("Cleaning up connection effect - removing listeners.");
      removeInputListeners();
      removeDelegatedListeners();
    };
  }, []);

  // --- handleJoinGame ---
  const handleJoinGame = (username: string, characterClass: string, xHandle?: string) => {
    if (!conn) {
        console.error("Cannot join game, not connected.");
        return;
    }
    // console.log(`Registering as ${username} (${characterClass}) with X handle: ${xHandle || 'none'}...`);
    
    // Hide join dialog first to start cleanup
    setShowJoinDialog(false);
    
    // Add delay to allow WebGL context cleanup before starting game
    setTimeout(() => {
      // console.log('[WebGL Cleanup] Delay complete, starting game initialization...');
      
      // Reset GameReady state and show loading screen
      setGameReadyState({
        isCharacterReady: false,
        isZombiesReady: false,
        characterProgress: 0,
        zombieProgress: 0,
        characterStatus: 'Starting character load...',
        zombieStatus: 'Preparing to spawn enemies...'
      });
      setGameFullyReady(false);
      setShowLoadingScreen(true);
      
      // @ts-ignore - Temporary fix until TypeScript bindings are regenerated
      conn.reducers.registerPlayer(username, characterClass, xHandle || null);
      setHasJoinedGame(true); // Set state to true after successful join
    }, 100); // 100ms delay to allow WebGL context cleanup
  };

  // --- Render Logic ---
  return (
    <div className="App" style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {showJoinDialog && <JoinGameDialog onJoin={handleJoinGame} />}
      
      {/* Loading Screen - shown after joining until game is ready */}
      <LoadingScreen 
        isVisible={showLoadingScreen}
        characterProgress={gameReadyState.characterProgress}
        zombieProgress={gameReadyState.zombieProgress}
        characterStatus={gameReadyState.characterStatus}
        zombieStatus={gameReadyState.zombieStatus}
      />
      
      {/* Conditionally render DebugPanel based on connection status */} 
      {/* Visibility controlled internally, expansion controlled by state */}
      {connected && (
          <DebugPanel 
            statusMessage={statusMessage}
            localPlayer={localPlayer}
            identity={identity}
            playerMap={players}
            expanded={isDebugPanelExpanded}
            onToggleExpanded={() => setIsDebugPanelExpanded((prev: boolean) => !prev)}
            isPointerLocked={isPointerLocked} // Pass pointer lock state down
          />
      )}

      {/* Render GameScene and PlayerUI - show once player has joined, not waiting for gameFullyReady */}
      {connected && hasJoinedGame && (
        <>
          <GameScene 
            players={players} 
            localPlayerIdentity={identity} 
            onPlayerRotation={handlePlayerRotation}
            onPlayerPosition={handlePlayerPosition} // Pass position callback
            currentInputRef={currentInputRef}
            isDebugPanelVisible={isDebugPanelExpanded}
            showControlsPanel={gameFullyReady} // Pass gameFullyReady instead of hasJoinedGame
            gameReadyCallbacks={gameReadyCallbacks} // Pass callbacks to GameScene
            gameReady={gameFullyReady} // Pass gameReady state to control ControlsPanel timing
            onKillCountChange={handleKillCountChange} // Pass kill count callback
            onZombieHit={handleZombieHit} // Pass zombie hit callback
            onZombieAttackPlayer={handleZombieAttackPlayer} // Pass zombie attack player callback
            shouldTriggerHitAnimation={shouldTriggerHitAnimation} // Pass hit animation trigger
            comboCount={comboCount} // Pass combo count for display
          />
          {localPlayer && <PlayerUI playerData={localPlayer} />}
          
          {/* Zombie Attack Flash Effect */}
          {showZombieAttackFlash && (
            <div className="damage-overlay zombie-attack-flash" />
          )}
          
          {/* Kill Counter - always show when game is active */}
          <KillCounter killCount={totalKillCount} />
        <MaxComboCounter maxComboCount={maxComboCount} />
          {/* Coin Counter - always show when game is active */}
          <CoinCounter coinCount={totalCoinCount} />
        </>
      )}

      {/* Show status when not connected */} 
      {!connected && (
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100%'}}><h1>{statusMessage}</h1></div>
      )}
    </div>
  );
}

export default App;
