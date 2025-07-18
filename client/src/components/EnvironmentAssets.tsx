/**
 * EnvironmentAssets.tsx
 * 
 * Component that manages environment decoration assets:
 * - Rock models (rock-1.glb, rock-2.glb, rock-3.glb) with random placement
 * - Desert arch (desert-arch.glb) positioned far from spawn
 * - X-statue (x-statue.glb) positioned very far from spawn
 * - Floating sword with light blue glow pillar
 * 
 * Features:
 * - Random positioning for rocks within defined bounds
 * - Scaled models according to specifications
 * - Shadow casting and receiving
 * - Performance-optimized loading
 * - Animated floating sword with magical light blue glow effect
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { Box } from '@react-three/drei';

// Sword spawn position - single source of truth
export const SWORD_SPAWN_POSITION: [number, number, number] = [25, 0, 35];

interface EnvironmentAssetsProps {
  // Player data for sword collision detection
  players?: ReadonlyMap<string, any>;
  localPlayerIdentity?: any;
  onSwordCollected?: (swordModel: THREE.Group, swordPosition: THREE.Vector3) => void;
  // Callback to provide collision data to parent components
  onCollisionDataReady?: (collisionBoxes: THREE.Box3[]) => void;
}

// Configuration for environment assets
// NOTE: X-Statue moved closer (500 units) and elevated (Y=20) for better visibility
// Original request was 1000 units away, but that may be too far to see
const ENVIRONMENT_CONFIG = {
  rocks: {
    'rock-1': {
      path: '/environments/rock-1.glb',
      scale: 7.0, // 4x bigger again (4.0 * 4 = 16.0)
      count: 5,
      baseScale: 1.0
    },
    'rock-2': {
      path: '/environments/rock-2.glb',
      scale: 2.0, // 4x bigger (1.0 * 4 = 4.0)
      count: 5,
      baseScale: 1.0
    },
    'rock-3': {
      path: '/environments/rock-3.glb',
      scale: 1.0, // Hidden - not instantiated
      count: 0, // No instances created
      baseScale: 1.0
    }
  },
  desertArch: {
    path: '/environments/desert-arch.glb',
    scale: 20.0, 
    position: [40.0, 10, 150.0] as [number, number, number], // 60% closer (100 * 0.4 = 40 units from spawn)
    rotation: [0, Math.PI * 0.25, 0] as [number, number, number] // 45-degree rotation for visual interest
  },
  statue: {
    path: '/environments/x-statue.glb',
    scale: 120.0, // Much larger scale to ensure visibility (increased from 50.0)
    position: [0.0, 70.0, 700.0] as [number, number, number], // Raised much higher in the air (was Y=20)
    rotation: [0, 0, 0.01] as [number, number, number] // 90-degree rotation
  }
};

// Spawn area configuration for rocks
const ROCK_SPAWN_CONFIG = {
  minDistance: 15.0, // Minimum distance from origin (spawn area)
  maxDistance: 80.0, // Maximum distance from origin
  minDistanceBetweenRocks: 8.0, // Minimum distance between rock instances
  groundLevel: 0.0 // Y position for all rocks
};

// Generate random positions for rocks, ensuring they don't overlap
function generateRockPositions(totalRocks: number): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  const maxAttempts = 100; // Prevent infinite loops

  for (let i = 0; i < totalRocks; i++) {
    let attempts = 0;
    let validPosition = false;
    let newPosition: THREE.Vector3;

    do {
      // Generate random position within ring area (avoiding spawn center)
      const angle = Math.random() * Math.PI * 2;
      const distance = ROCK_SPAWN_CONFIG.minDistance + 
                      Math.random() * (ROCK_SPAWN_CONFIG.maxDistance - ROCK_SPAWN_CONFIG.minDistance);
      
      newPosition = new THREE.Vector3(
        Math.cos(angle) * distance,
        ROCK_SPAWN_CONFIG.groundLevel,
        Math.sin(angle) * distance
      );

      // Check if position is far enough from existing rocks
      validPosition = positions.every(existingPos => 
        newPosition.distanceTo(existingPos) >= ROCK_SPAWN_CONFIG.minDistanceBetweenRocks
      );

      attempts++;
    } while (!validPosition && attempts < maxAttempts);

    if (validPosition) {
      positions.push(newPosition);
    } else {
      console.warn(`[EnvironmentAssets] Could not find valid position for rock ${i + 1}`);
    }
  }

  return positions;
}

// Individual rock instance component
interface RockInstanceProps {
  modelPath: string;
  position: THREE.Vector3;
  scale: number;
  rotation?: THREE.Euler;
  onBoundingBoxReady?: (id: string, boundingBox: THREE.Box3, worldPosition: THREE.Vector3) => void;
  instanceId?: string;
}

const RockInstance: React.FC<RockInstanceProps> = ({ modelPath, position, scale, rotation, onBoundingBoxReady, instanceId }) => {
  const group = useRef<THREE.Group>(null!);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [boundingBox, setBoundingBox] = useState<THREE.Box3 | null>(null);

  useEffect(() => {
    const loader = new GLTFLoader();
    
    loader.load(
      modelPath,
      (gltf) => {
        const loadedModel = gltf.scene.clone();
        
        // Configure model
        loadedModel.scale.setScalar(scale);
        loadedModel.position.set(0, 0, 0); // Position will be set by group
        
        // Enable shadows
        loadedModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        if (group.current) {
          group.current.add(loadedModel);
        }
        
        // Calculate bounding box for collision
        const box = new THREE.Box3().setFromObject(loadedModel);
        setBoundingBox(box);
        
        setModel(loadedModel);
        // console.log(`[EnvironmentAssets] Loaded rock model: ${modelPath} at scale ${scale}`);
        
        // Report bounding box to parent when ready
        if (onBoundingBoxReady && instanceId) {
          // Position will be set in the next useEffect, so delay reporting slightly
          setTimeout(() => {
            onBoundingBoxReady(instanceId, box, position);
          }, 50);
        }
      },
      undefined,
      (error) => {
        console.error(`[EnvironmentAssets] Error loading rock model: ${modelPath}`, error);
      }
    );

    return () => {
      if (model && group.current) {
        group.current.remove(model);
      }
    };
  }, [modelPath, scale]);

  // Set position and rotation
  useEffect(() => {
    if (group.current) {
      group.current.position.copy(position);
      if (rotation) {
        group.current.rotation.copy(rotation);
      } else {
        // Random rotation on all axes for natural rock placement
        group.current.rotation.x = Math.random() * Math.PI * 2;
        group.current.rotation.y = Math.random() * Math.PI * 2;
        group.current.rotation.z = Math.random() * Math.PI * 2;
      }
    }
  }, [position, rotation]);

  return (
    <group ref={group}>
      {/* Invisible collision box */}
      {boundingBox && (
        <Box
          args={[
            boundingBox.max.x - boundingBox.min.x,
            boundingBox.max.y - boundingBox.min.y,
            boundingBox.max.z - boundingBox.min.z
          ]}
          position={[
            (boundingBox.max.x + boundingBox.min.x) / 2,
            (boundingBox.max.y + boundingBox.min.y) / 2,
            (boundingBox.max.z + boundingBox.min.z) / 2
          ]}
          visible={false} // Invisible collision box
        >
          <meshBasicMaterial transparent opacity={0} />
        </Box>
      )}
    </group>
  );
};

// Large environment asset component (arch and statue)
interface LargeAssetProps {
  modelPath: string;
  position: [number, number, number];
  scale: number;
  rotation?: [number, number, number];
  name: string;
  onBoundingBoxReady?: (id: string, boundingBox: THREE.Box3, worldPosition: THREE.Vector3) => void;
}

const LargeAsset: React.FC<LargeAssetProps> = ({ modelPath, position, scale, rotation, name, onBoundingBoxReady }) => {
  const group = useRef<THREE.Group>(null!);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [boundingBox, setBoundingBox] = useState<THREE.Box3 | null>(null);

  useEffect(() => {
    const loader = new GLTFLoader();
    
    loader.load(
      modelPath,
      (gltf) => {
        const loadedModel = gltf.scene.clone();
        
        // Configure model
        loadedModel.scale.setScalar(scale);
        loadedModel.position.set(0, 0, 0);
        
        // Enable shadows
        loadedModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        if (group.current) {
          group.current.add(loadedModel);
        }
        
        // Calculate bounding box for collision
        const box = new THREE.Box3().setFromObject(loadedModel);
        setBoundingBox(box);
        
        setModel(loadedModel);
        // console.log(`[EnvironmentAssets] ✅ Loaded ${name}: ${modelPath} at scale ${scale}, position [${position.join(', ')}]`);
        // console.log(`[EnvironmentAssets] ${name} bounding box:`, box);
        
        // Report bounding box to parent when ready
        if (onBoundingBoxReady) {
          setTimeout(() => {
            const worldPosition = new THREE.Vector3(...position);
            onBoundingBoxReady(name, box, worldPosition);
          }, 50);
        }
      },
      (progress) => {
        if (name === 'X-Statue') {
          // console.log(`[EnvironmentAssets] 📊 Loading ${name}: ${Math.round((progress.loaded / progress.total) * 100)}%`);
        }
      },
      (error) => {
        console.error(`[EnvironmentAssets] ❌ Error loading ${name}: ${modelPath}`, error);
        if (name === 'X-Statue') {
          console.error(`[EnvironmentAssets] 🗿 X-Statue failed to load! Check if file exists at: public${modelPath}`);
        }
      }
    );

    return () => {
      if (model && group.current) {
        group.current.remove(model);
      }
    };
  }, [modelPath, scale, name]);

  // Set position and rotation
  useEffect(() => {
    if (group.current) {
      group.current.position.set(...position);
      if (rotation) {
        group.current.rotation.set(...rotation);
      }
    }
  }, [position, rotation]);

  return (
    <group ref={group}>
      {/* Invisible collision box */}
      {boundingBox && (
        <Box
          args={[
            boundingBox.max.x - boundingBox.min.x,
            boundingBox.max.y - boundingBox.min.y,
            boundingBox.max.z - boundingBox.min.z
          ]}
          position={[
            (boundingBox.max.x + boundingBox.min.x) / 2,
            (boundingBox.max.y + boundingBox.min.y) / 2,
            (boundingBox.max.z + boundingBox.min.z) / 2
          ]}
          visible={false} // Invisible collision box
        >
          <meshBasicMaterial transparent opacity={0} />
        </Box>
      )}
    </group>
  );
};

// Floating Sword Component with Light Blue Glow Pillar
interface FloatingSwordProps {
  position: [number, number, number];
  onSwordCollected?: (swordModel: THREE.Group, swordPosition: THREE.Vector3) => void; // Callback when sword is collected
  players?: ReadonlyMap<string, any>; // Player data for collision detection
  localPlayerIdentity?: any; // Local player identity for collision detection
}

const FloatingSword: React.FC<FloatingSwordProps> = ({ 
  position, 
  onSwordCollected, 
  players, 
  localPlayerIdentity 
}) => {
  const swordGroup = useRef<THREE.Group>(null!);
  const glowPillarGroup = useRef<THREE.Group>(null!);
  const [swordModel, setSwordModel] = useState<THREE.Group | null>(null);
  const [startTime] = useState(Date.now());
  const [isCollected, setIsCollected] = useState(false);
  
  // Glow pillar properties
  const PILLAR_HEIGHT = 2000; // Infinite pillar extending far up into space
  const PILLAR_RADIUS = 0.4;
  const FLOAT_AMPLITUDE = 0.2;
  const FLOAT_SPEED = 0.3;
  const ROTATION_SPEED = 0.2;
  const COLLECTION_RADIUS = 3.0; // Distance for sword collection

  // Load sword model
  useEffect(() => {
    if (isCollected) return; // Don't load if already collected
    
    const loader = new GLTFLoader();
    
    loader.load(
      '/models/items/fantasy_sword_3.glb',
      (gltf) => {
        const loadedModel = gltf.scene.clone();
        
        // Scale the sword appropriately (much bigger for visibility)
        loadedModel.scale.setScalar(3.0); // Increased from 2.0 to 4.0
        
        // Orient sword pointing straight up
        loadedModel.rotation.set(1.57, 0, 0); // 1.57 ≈ π/2 radians = 90 degrees for perfect vertical
        
        // Enable shadows
        loadedModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        if (swordGroup.current) {
          swordGroup.current.add(loadedModel);
        }
        
        setSwordModel(loadedModel);
        // console.log('[EnvironmentAssets] ✨ Floating sword loaded successfully');
      },
      undefined,
      (error) => {
        console.error('[EnvironmentAssets] ❌ Error loading floating sword:', error);
      }
    );

    return () => {
      if (swordModel && swordGroup.current) {
        swordGroup.current.remove(swordModel);
      }
    };
  }, [isCollected]);

  // Create light blue glow pillar
  useEffect(() => {
    if (!glowPillarGroup.current || isCollected) return;

    // Create triple-layer glow effect with light blue color
    const pillarGeometry = new THREE.CylinderGeometry(
      PILLAR_RADIUS, 
      PILLAR_RADIUS, 
      PILLAR_HEIGHT, 
      8, 
      1, 
      true
    );
    
    const middleGlowGeometry = new THREE.CylinderGeometry(
      PILLAR_RADIUS * 1.5, 
      PILLAR_RADIUS * 1.5, 
      PILLAR_HEIGHT, 
      8, 
      1, 
      true
    );
    
    const outerGlowGeometry = new THREE.CylinderGeometry(
      PILLAR_RADIUS * 2.0, 
      PILLAR_RADIUS * 2.0, 
      PILLAR_HEIGHT, 
      8, 
      1, 
      true
    );
    
    // Deep blue glow materials - much more translucent
    const deepBlueColor = 0x4169E1; // Royal blue color for better blue tint
    
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: deepBlueColor,
      transparent: true,
      opacity: 0.04, // Much more translucent (was 0.15)
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false
    });
    
    const middleMaterial = new THREE.MeshBasicMaterial({
      color: deepBlueColor,
      transparent: true,
      opacity: 0.025, // Much more translucent (was 0.1)
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false
    });
    
    const outerMaterial = new THREE.MeshBasicMaterial({
      color: deepBlueColor,
      transparent: true,
      opacity: 0.015, // Much more translucent (was 0.06)
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false
    });
    
    // Create glow layers
    const innerGlow = new THREE.Mesh(pillarGeometry, innerMaterial);
    const middleGlow = new THREE.Mesh(middleGlowGeometry, middleMaterial);
    const outerGlow = new THREE.Mesh(outerGlowGeometry, outerMaterial);
    
    glowPillarGroup.current.add(innerGlow);
    glowPillarGroup.current.add(middleGlow);
    glowPillarGroup.current.add(outerGlow);
    
    // console.log('[EnvironmentAssets] 🔵 Light blue glow pillar created');
  }, [isCollected]);

  // Set initial positions
  useEffect(() => {
    if (isCollected) return;
    
    if (swordGroup.current) {
      swordGroup.current.position.set(...position);
    }
    if (glowPillarGroup.current) {
      // Position pillar at ground level
      glowPillarGroup.current.position.set(
        position[0], 
        position[1] + PILLAR_HEIGHT / 2 - 1.0, 
        position[2]
      );
    }
  }, [position, isCollected]);

  // Animation loop and collision detection
  useFrame((state, delta) => {
    if (isCollected) return;
    
    const elapsed = (Date.now() - startTime) / 1000;
    
    if (swordGroup.current && swordModel) {
      // Floating up and down motion
      const floatOffset = Math.sin(elapsed * FLOAT_SPEED * Math.PI * 2) * FLOAT_AMPLITUDE;
      swordGroup.current.position.y = position[1] + floatOffset + 1.5; // Hover 1.5 units above ground
      
      // Gentle rotation around Y-axis
      swordGroup.current.rotation.y += ROTATION_SPEED * delta;
      
      // Check for player collision (only for local player)
      if (players && localPlayerIdentity && onSwordCollected) {
        const localPlayer = players.get(localPlayerIdentity.toHexString());
        if (localPlayer) {
          const playerPos = new THREE.Vector3(
            localPlayer.position.x,
            localPlayer.position.y,
            localPlayer.position.z
          );
          const swordPos = swordGroup.current.position;
          const distance = playerPos.distanceTo(swordPos);
          
          if (distance <= COLLECTION_RADIUS) {
            // console.log('[EnvironmentAssets] ⚔️ Sword collected by player!');
            setIsCollected(true);
            
            // Create a copy of the sword model for the player
            const swordCopy = swordModel.clone();
            onSwordCollected(swordCopy, swordPos.clone());
            
            // Hide the floating sword and pillar
            swordGroup.current.visible = false;
            glowPillarGroup.current.visible = false;
          }
        }
      }
    }
  });

  if (isCollected) {
    return null; // Don't render anything if collected
  }

  return (
    <>
      <group ref={swordGroup} />
      <group ref={glowPillarGroup} />
    </>
  );
};

export const EnvironmentAssets: React.FC<EnvironmentAssetsProps> = ({ 
  players, 
  localPlayerIdentity, 
  onSwordCollected,
  onCollisionDataReady
}) => {
  const [rockPositions] = useState<THREE.Vector3[]>(() => {
    // Generate positions once when component mounts
    const totalRocks = ENVIRONMENT_CONFIG.rocks['rock-1'].count + 
                      ENVIRONMENT_CONFIG.rocks['rock-2'].count + 
                      ENVIRONMENT_CONFIG.rocks['rock-3'].count;
    return generateRockPositions(totalRocks);
  });

  // Collision data management
  const collisionBoxesRef = useRef<Map<string, THREE.Box3>>(new Map());
  const [collisionDataReady, setCollisionDataReady] = useState(false);

  // Callback for individual assets to report their collision boxes
  const handleAssetBoundingBox = useCallback((id: string, boundingBox: THREE.Box3, worldPosition: THREE.Vector3) => {
    // Transform bounding box to world coordinates
    const worldBoundingBox = boundingBox.clone().translate(worldPosition);
    collisionBoxesRef.current.set(id, worldBoundingBox);
    
    // Check if all collision data is ready
    const expectedAssets = rock1Positions.length + rock2Positions.length + rock3Positions.length + 2; // +2 for arch and statue
    if (collisionBoxesRef.current.size >= expectedAssets && !collisionDataReady) {
      setCollisionDataReady(true);
      // console.log(`[EnvironmentAssets] 🧱 All ${collisionBoxesRef.current.size} collision boxes ready!`);
    }
  }, [collisionDataReady]);

  // Notify parent when collision data is ready
  useEffect(() => {
    if (collisionDataReady && onCollisionDataReady) {
      const allCollisionBoxes = Array.from(collisionBoxesRef.current.values());
      onCollisionDataReady(allCollisionBoxes);
      // console.log(`[EnvironmentAssets] 📡 Sent ${allCollisionBoxes.length} collision boxes to parent`);
    }
  }, [collisionDataReady, onCollisionDataReady]);

  // Split positions for different rock types
  const rock1Positions = rockPositions.slice(0, ENVIRONMENT_CONFIG.rocks['rock-1'].count);
  const rock2Positions = rockPositions.slice(
    ENVIRONMENT_CONFIG.rocks['rock-1'].count, 
    ENVIRONMENT_CONFIG.rocks['rock-1'].count + ENVIRONMENT_CONFIG.rocks['rock-2'].count
  );
  const rock3Positions = rockPositions.slice(
    ENVIRONMENT_CONFIG.rocks['rock-1'].count + ENVIRONMENT_CONFIG.rocks['rock-2'].count
  );

  return (
    <group name="environment-assets">
      {/* Rock-1 instances (4x bigger) */}
      {rock1Positions.map((position, index) => (
        <RockInstance
          key={`rock-1-${index}`}
          instanceId={`rock-1-${index}`}
          modelPath={ENVIRONMENT_CONFIG.rocks['rock-1'].path}
          position={position}
          scale={ENVIRONMENT_CONFIG.rocks['rock-1'].scale}
          onBoundingBoxReady={handleAssetBoundingBox}
        />
      ))}

      {/* Rock-2 instances (normal size) */}
      {rock2Positions.map((position, index) => (
        <RockInstance
          key={`rock-2-${index}`}
          instanceId={`rock-2-${index}`}
          modelPath={ENVIRONMENT_CONFIG.rocks['rock-2'].path}
          position={position}
          scale={ENVIRONMENT_CONFIG.rocks['rock-2'].scale}
          onBoundingBoxReady={handleAssetBoundingBox}
        />
      ))}

      {/* Rock-3 instances (normal size) */}
      {rock3Positions.map((position, index) => (
        <RockInstance
          key={`rock-3-${index}`}
          instanceId={`rock-3-${index}`}
          modelPath={ENVIRONMENT_CONFIG.rocks['rock-3'].path}
          position={position}
          scale={ENVIRONMENT_CONFIG.rocks['rock-3'].scale}
          onBoundingBoxReady={handleAssetBoundingBox}
        />
      ))}

      {/* Desert Arch (very large, 100 units away) */}
      <LargeAsset
        modelPath={ENVIRONMENT_CONFIG.desertArch.path}
        position={ENVIRONMENT_CONFIG.desertArch.position}
        scale={ENVIRONMENT_CONFIG.desertArch.scale}
        rotation={ENVIRONMENT_CONFIG.desertArch.rotation}
        name="Desert Arch"
        onBoundingBoxReady={handleAssetBoundingBox}
      />

      {/* X-Statue (10x bigger than arch, 1000 units away) */}
      <LargeAsset
        modelPath={ENVIRONMENT_CONFIG.statue.path}
        position={ENVIRONMENT_CONFIG.statue.position}
        scale={ENVIRONMENT_CONFIG.statue.scale}
        rotation={ENVIRONMENT_CONFIG.statue.rotation}
        name="X-Statue"
        onBoundingBoxReady={handleAssetBoundingBox}
      />

      {/* Floating Sword with Light Blue Glow Pillar */}
      <FloatingSword 
        position={SWORD_SPAWN_POSITION} 
        onSwordCollected={onSwordCollected}
        players={players}
        localPlayerIdentity={localPlayerIdentity}
      />

      {/* Second Desert Arch near the sword - tweak position and rotation for best visual */}
      <LargeAsset
        modelPath={ENVIRONMENT_CONFIG.desertArch.path}
        position={[23, 7, 35]} // X: left/right, Y: up/down, Z: forward/back
        scale={15.0} // Adjust size (current: 15.0, try 10.0-25.0)
        rotation={[0, Math.PI * 0.75, 0]} // Y rotation: 0=forward, 0.5=90°, 1.0=180°
        name="Desert Arch (Near Sword)"
        onBoundingBoxReady={handleAssetBoundingBox}
      />
    </group>
  );
}; 