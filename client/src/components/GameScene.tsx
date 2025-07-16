/**
 * GameScene.tsx
 * 
 * Core component that manages the 3D multiplayer game environment:
 * 
 * Key functionality:
 * - Acts as the primary container for all 3D game elements
 * - Manages the game world environment (terrain, lighting, physics)
 * - Instantiates and coordinates player entities
 * - Handles multiplayer synchronization across clients
 * - Manages game state and lifecycle (start, join, disconnect)
 * - Maintains socket connections for real-time gameplay
 * 
 * Props:
 * - username: The local player's display name
 * - playerClass: The selected character class for the local player
 * - roomId: Unique identifier for the multiplayer game session
 * - onDisconnect: Callback function when player disconnects from game
 * 
 * Technical implementation:
 * - Uses React Three Fiber (R3F) for 3D rendering within React
 * - Implements physics system with Rapier for realistic interactions
 * - Manages socket.io connections for multiplayer state synchronization
 * - Handles dynamic loading and instantiation of 3D assets
 * 
 * Related files:
 * - Player.tsx: Individual player entity component
 * - JoinGameDialog.tsx: UI for joining a game session
 * - PlayerUI.tsx: In-game user interface elements
 * - Socket handlers for network communication
 */

import React, { useRef, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Box, Plane, Grid, Environment, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { DirectionalLightHelper, CameraHelper } from 'three'; // Import the helper
// Import generated types
import { PlayerData, InputState } from '../generated';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { Player } from './Player';
import { ZombieManager } from './ZombieManager';
import { ControlsPanel } from './ControlsPanel';
import { EnvironmentAssets } from './EnvironmentAssets';
import { GameReadyCallbacks } from '../types/gameReady';

interface GameSceneProps {
  players: ReadonlyMap<string, PlayerData>; // Receive the map
  localPlayerIdentity: Identity | null;
  onPlayerRotation?: (rotation: THREE.Euler) => void; // Optional callback for player rotation
  onPlayerPosition?: (position: THREE.Vector3) => void; // Optional callback for player position
  currentInputRef?: React.MutableRefObject<InputState>; // Add input state ref prop
  isDebugPanelVisible?: boolean; // Prop to indicate if the debug panel is visible
  showControlsPanel?: boolean; // Whether to display the ControlsPanel
  gameReadyCallbacks?: GameReadyCallbacks; // Callbacks for GameReady events
  gameReady?: boolean; // Whether the game is fully ready
  onKillCountChange?: (killCount: number) => void; // Callback for kill count changes
}

// Textured Floor Component
const TexturedFloor: React.FC = () => {
  const texture = useTexture('/environments/SandG_001.jpg');
  const { gl } = useThree();
  
  // Configure texture for seamless tiling with improved filtering
  useMemo(() => {
    if (texture) {
      // Basic wrapping settings
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(200, 200); // High repeat for massive floor size to maintain texture scale
      
      // Improved texture filtering for seamless blending
      texture.minFilter = THREE.LinearMipMapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      
      // Enable anisotropic filtering for better quality at oblique angles
      texture.anisotropy = gl.capabilities.getMaxAnisotropy();
      
      // Ensure mipmaps are generated for proper scaling
      texture.generateMipmaps = true;
      
      texture.needsUpdate = true;
    }
  }, [texture, gl]);

  return (
    <Plane 
      args={[4000, 4000]} 
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[0, -0.001, 0]} 
      receiveShadow={true} 
    >
      <meshStandardMaterial map={texture} />
    </Plane>
  );
};

export const GameScene: React.FC<GameSceneProps> = ({ 
  players, 
  localPlayerIdentity,
  onPlayerRotation,
  onPlayerPosition, // Destructure position callback
  currentInputRef, // Receive input state ref
  isDebugPanelVisible = false, // Destructure the new prop
  showControlsPanel = false,
  gameReadyCallbacks, // Destructure GameReady callbacks
  gameReady = false, // Destructure gameReady state
  onKillCountChange // Destructure kill count callback
}) => {
  // Ref for the main directional light
  const directionalLightRef = useRef<THREE.DirectionalLight>(null!); 

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas 
        camera={{ position: [0, 5010, 20], fov: 60 }} 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }} 
        shadows // Enable shadows
      >
      {/* Remove solid color background */}
      {/* <color attach="background" args={['#add8e6']} /> */}
      
      {/* HDR Environment Background */}
      <Environment files="/environments/cape_hill_4k.exr" background />

      {/* Ambient light for general scene illumination */}
      <ambientLight intensity={0.5} />
      
      {/* Main directional light with improved shadow settings */}
      <directionalLight 
        ref={directionalLightRef} // Assign ref
        position={[15, 20, 10]} 
        intensity={2.5} 
        castShadow 
        shadow-mapSize-width={2048} // Increased resolution
        shadow-mapSize-height={2048} // Increased resolution
        shadow-bias={-0.0001} // Made bias less negative (closer to 0)
        shadow-camera-left={-30} // Wider frustum
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={0.1} // Closer near plane
        shadow-camera-far={100} // Further far plane
      />

      {/* Conditionally render Light and Shadow Camera Helpers */}
      {isDebugPanelVisible && directionalLightRef.current && (
        <>
          <primitive object={new DirectionalLightHelper(directionalLightRef.current, 5)} />
          {/* Add CameraHelper for the shadow camera */}
          <primitive object={new CameraHelper(directionalLightRef.current.shadow.camera)} /> 
        </>
      )}
      
      {/* Textured Floor with Sand Dune Pattern */}
      <TexturedFloor />

      {/* Environment Assets (rocks, arch, statue) */}
      <EnvironmentAssets />

      {/* Render Players */}
      {Array.from(players.values()).map((player) => {
        const isLocal = localPlayerIdentity?.toHexString() === player.identity.toHexString();
        return (
          <Player 
            key={player.identity.toHexString()} 
            playerData={player}
            isLocalPlayer={isLocal}
            onRotationChange={isLocal ? onPlayerRotation : undefined}
            onPositionChange={isLocal ? onPlayerPosition : undefined} // Pass position callback
            currentInput={isLocal ? currentInputRef?.current : undefined}
            isDebugArrowVisible={isLocal ? isDebugPanelVisible : false} // Pass down arrow visibility
            isDebugPanelVisible={isDebugPanelVisible} // Pass down general debug visibility
            gameReadyCallbacks={isLocal ? gameReadyCallbacks : undefined} // Only pass to local player
            gameReady={gameReady} // Pass gameReady state to control physics timing
          />
        );
      })}

      {/* Render Optimized Zombie Manager */}
      <ZombieManager 
        zombieCount={10}
        players={players}
        isDebugVisible={isDebugPanelVisible}
        minSpawnDistance={12} // Minimum 12 units from any player (matches SPAWN_SETTINGS)
        gameReadyCallbacks={gameReadyCallbacks} // Pass GameReady callbacks
        onKillCountChange={onKillCountChange} // Pass kill count callback
      />

      {/* Remove OrbitControls as we're using our own camera controls */}
    </Canvas>
    
    {/* Controls Panel is rendered only after the player has joined the game */}
    {showControlsPanel && <ControlsPanel autoShowOnLoad={true} gameReady={gameReady} />}
    </div>
  );
};
