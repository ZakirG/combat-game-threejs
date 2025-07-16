/**
 * EnvironmentAssets.tsx
 * 
 * Component that manages environment decoration assets:
 * - Rock models (rock-1.glb, rock-2.glb, rock-3.glb) with random placement
 * - Desert arch (desert-arch.glb) positioned far from spawn
 * - X-statue (x-statue.glb) positioned very far from spawn
 * 
 * Features:
 * - Random positioning for rocks within defined bounds
 * - Scaled models according to specifications
 * - Shadow casting and receiving
 * - Performance-optimized loading
 */

import React, { useRef, useEffect, useState } from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { Box } from '@react-three/drei';

interface EnvironmentAssetsProps {
  // No props needed for now - all configuration is internal
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
}

const RockInstance: React.FC<RockInstanceProps> = ({ modelPath, position, scale, rotation }) => {
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
        console.log(`[EnvironmentAssets] Loaded rock model: ${modelPath} at scale ${scale}`);
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
}

const LargeAsset: React.FC<LargeAssetProps> = ({ modelPath, position, scale, rotation, name }) => {
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
        console.log(`[EnvironmentAssets] ✅ Loaded ${name}: ${modelPath} at scale ${scale}, position [${position.join(', ')}]`);
        console.log(`[EnvironmentAssets] ${name} bounding box:`, box);
      },
      (progress) => {
        if (name === 'X-Statue') {
          console.log(`[EnvironmentAssets] 📊 Loading ${name}: ${Math.round((progress.loaded / progress.total) * 100)}%`);
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

export const EnvironmentAssets: React.FC<EnvironmentAssetsProps> = () => {
  const [rockPositions] = useState<THREE.Vector3[]>(() => {
    // Generate positions once when component mounts
    const totalRocks = ENVIRONMENT_CONFIG.rocks['rock-1'].count + 
                      ENVIRONMENT_CONFIG.rocks['rock-2'].count + 
                      ENVIRONMENT_CONFIG.rocks['rock-3'].count;
    return generateRockPositions(totalRocks);
  });

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
          modelPath={ENVIRONMENT_CONFIG.rocks['rock-1'].path}
          position={position}
          scale={ENVIRONMENT_CONFIG.rocks['rock-1'].scale}
        />
      ))}

      {/* Rock-2 instances (normal size) */}
      {rock2Positions.map((position, index) => (
        <RockInstance
          key={`rock-2-${index}`}
          modelPath={ENVIRONMENT_CONFIG.rocks['rock-2'].path}
          position={position}
          scale={ENVIRONMENT_CONFIG.rocks['rock-2'].scale}
        />
      ))}

      {/* Rock-3 instances (normal size) */}
      {rock3Positions.map((position, index) => (
        <RockInstance
          key={`rock-3-${index}`}
          modelPath={ENVIRONMENT_CONFIG.rocks['rock-3'].path}
          position={position}
          scale={ENVIRONMENT_CONFIG.rocks['rock-3'].scale}
        />
      ))}

      {/* Desert Arch (very large, 100 units away) */}
      <LargeAsset
        modelPath={ENVIRONMENT_CONFIG.desertArch.path}
        position={ENVIRONMENT_CONFIG.desertArch.position}
        scale={ENVIRONMENT_CONFIG.desertArch.scale}
        rotation={ENVIRONMENT_CONFIG.desertArch.rotation}
        name="Desert Arch"
      />

      {/* X-Statue (10x bigger than arch, 1000 units away) */}
      <LargeAsset
        modelPath={ENVIRONMENT_CONFIG.statue.path}
        position={ENVIRONMENT_CONFIG.statue.position}
        scale={ENVIRONMENT_CONFIG.statue.scale}
        rotation={ENVIRONMENT_CONFIG.statue.rotation}
        name="X-Statue"
      />
    </group>
  );
}; 