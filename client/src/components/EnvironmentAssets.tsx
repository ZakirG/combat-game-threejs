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
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as THREE from 'three';
import { Box } from '@react-three/drei';

// Global Item Animation Configuration -- only for sword + gun, not coins
export const ITEM_ANIMATION_CONFIG = {
  ENABLE_FLOATING: true,        // Toggle to enable/disable up-down bouncing
  ENABLE_ROTATION: true,        // Toggle to enable/disable rotation
  FLOAT_SPEED: 0.3,            // Speed of up-down bouncing (higher = faster)
  ROTATION_SPEED: 0.2,         // Speed of Y-axis rotation (higher = faster)
  FLOAT_AMPLITUDE: 0.2,        // How high/low the items float (bounce distance)
};

// Sword spawn position - single source of truth
export const SWORD_SPAWN_POSITION: [number, number, number] = [25, 0, 35];

// Flamethrower spawn position 
export const FLAMETHROWER_SPAWN_POSITION: [number, number, number] = [-25, 0, 35];

// Cybertruck spawn position 
export const CYBERTRUCK_SPAWN_POSITION: [number, number, number] = [-1, -1.0, -140]; // Lowered further

interface EnvironmentAssetsProps {
  // Player data for sword collision detection
  players?: ReadonlyMap<string, any>;
  localPlayerIdentity?: any;
  onSwordCollected?: (swordModel: THREE.Group, swordPosition: THREE.Vector3) => void;
  onFlamethrowerCollected?: (flamethrowerModel: THREE.Group, flamethrowerPosition: THREE.Vector3) => void;
  onCybertruckCollected?: (cybertruckModel: THREE.Group, cybertruckPosition: THREE.Vector3) => void;
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
  },
  egyptianHouse: {
    path: '/models/environments/desert-house-9/highpoly_egyptian_house_009.fbx',
    textureFolder: '/models/environments/desert-house-9/',
    scale: 5.0, // Made much bigger (5x larger)
    position: [-10.0, 0.0, -20.0] as [number, number, number], // Positioned away from spawn
    rotation: [0, Math.PI * 0.25, 0] as [number, number, number] // 45-degree rotation for visual interest
  }
};

// Rock configuration interface
interface RockConfig {
  position: [number, number, number];
  rotationY: number;
}

interface EnvironmentConfigData {
  rocks: {
    'rock-1': RockConfig[];
    'rock-2': RockConfig[];
    'rock-3': RockConfig[];
  };
}

// Load rock configuration from JSON file
async function loadRockConfiguration(): Promise<EnvironmentConfigData> {
  try {
    const response = await fetch('/environment-config.json');
    if (!response.ok) {
      throw new Error(`Failed to load environment config: ${response.status}`);
    }
    const config = await response.json();
    console.log('[EnvironmentAssets] ✅ Loaded fixed rock configuration from JSON');
    return config;
  } catch (error) {
    console.error('[EnvironmentAssets] ❌ Failed to load rock configuration:', error);
    console.warn('[EnvironmentAssets] 🔄 Falling back to default rock positions');
    
    // Fallback configuration if JSON loading fails
    return {
      rocks: {
        'rock-1': [
          { position: [25.0, 0.0, -30.0], rotationY: 0.5 },
          { position: [-35.0, 0.0, 20.0], rotationY: 1.2 },
          { position: [45.0, 0.0, 35.0], rotationY: 2.8 },
          { position: [-20.0, 0.0, -45.0], rotationY: 4.1 },
          { position: [15.0, 0.0, 55.0], rotationY: 0.9 }
        ],
        'rock-2': [
          { position: [-50.0, 0.0, -15.0], rotationY: 1.8 },
          { position: [30.0, 0.0, -50.0], rotationY: 3.2 },
          { position: [-25.0, 0.0, 40.0], rotationY: 0.3 },
          { position: [55.0, 0.0, -20.0], rotationY: 2.1 },
          { position: [-40.0, 0.0, -35.0], rotationY: 5.0 }
        ],
        'rock-3': []
      }
    };
  }
}

// Individual rock instance component
interface RockInstanceProps {
  modelPath: string;
  position: THREE.Vector3;
  scale: number;
  rotationY?: number; // Y-axis rotation in radians to prevent upside-down rocks
  onBoundingBoxReady?: (id: string, boundingBox: THREE.Box3, worldPosition: THREE.Vector3) => void;
  instanceId?: string;
}

const RockInstance: React.FC<RockInstanceProps> = ({ modelPath, position, scale, rotationY, onBoundingBoxReady, instanceId }) => {
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

  // Set position and rotation (Y-axis only to prevent upside-down rocks)
  useEffect(() => {
    if (group.current) {
      group.current.position.copy(position);
      
      // Only apply Y-axis rotation to keep rocks upright
      group.current.rotation.x = 0; // No X rotation (prevents forward/backward tilt)
      group.current.rotation.y = rotationY ?? 0; // Use provided Y rotation or default to 0
      group.current.rotation.z = 0; // No Z rotation (prevents side tilt)
    }
  }, [position, rotationY]);

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

// FBX environment asset component (for Egyptian house)
interface FBXAssetProps {
  modelPath: string;
  position: [number, number, number];
  scale: number;
  rotation?: [number, number, number];
  name: string;
  textureFolder?: string; // Optional folder path for external textures
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

// FBX asset component for Egyptian house
const FBXAsset: React.FC<FBXAssetProps> = ({ modelPath, position, scale, rotation, name, textureFolder, onBoundingBoxReady }) => {
  const group = useRef<THREE.Group>(null!);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [boundingBox, setBoundingBox] = useState<THREE.Box3 | null>(null);

  // Load external textures if texture folder is provided
  const loadTextures = useCallback(async (textureFolder: string) => {
    const textureLoader = new THREE.TextureLoader();
    const textures: Record<string, THREE.Texture> = {};
    
    try {
      // Egyptian house specific texture files based on actual file names
      // Using stone wall textures as primary since it's likely the main material
      const texturePromises = [
        // Primary stone wall textures
        textureLoader.loadAsync(`${textureFolder}T_stone_wall_bc.png`)
          .then(tex => { 
            textures.diffuse = tex;
            console.log(`[${name}] ✅ Loaded stone wall diffuse texture`);
          })
          .catch(() => console.warn(`[${name}] Stone wall diffuse texture not found`)),
        textureLoader.loadAsync(`${textureFolder}T_stone_wall_n.png`)
          .then(tex => { 
            textures.normal = tex;
            console.log(`[${name}] ✅ Loaded stone wall normal texture`);
          })
          .catch(() => console.warn(`[${name}] Stone wall normal texture not found`)),
        textureLoader.loadAsync(`${textureFolder}T_stone_wall_r.png`)
          .then(tex => { 
            textures.roughness = tex;
            console.log(`[${name}] ✅ Loaded stone wall roughness texture`);
          })
          .catch(() => console.warn(`[${name}] Stone wall roughness texture not found`))
      ];
      
      await Promise.allSettled(texturePromises);
      
      console.log(`[${name}] 🎨 Loaded ${Object.keys(textures).length} stone wall textures for Egyptian house`);
      return Object.keys(textures).length > 0 ? textures : null;
    } catch (error) {
      console.error(`[${name}] ❌ Failed to load textures:`, error);
      return null;
    }
  }, [name]);

  useEffect(() => {
    const loader = new FBXLoader();
    
    loader.load(
      modelPath,
      async (fbx) => {
        const loadedModel = fbx.clone();
        
        // Configure model
        loadedModel.scale.setScalar(scale);
        loadedModel.position.set(0, 0, 0);
        
        // Load external textures if texture folder is provided
        const externalTextures = textureFolder ? await loadTextures(textureFolder) : null;
        
        // Enable shadows and apply textures
        loadedModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            // Apply textures if available
            if (child.material && externalTextures) {
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              const newMaterials = materials.map((material: any) => {
                // Convert to StandardMaterial for better PBR rendering
                if (material.type === 'MeshPhongMaterial' || material.type === 'MeshBasicMaterial' || material.type === 'MeshLambertMaterial') {
                  const newMaterial = new THREE.MeshStandardMaterial({
                    map: externalTextures.diffuse || material.map,
                    normalMap: externalTextures.normal,
                    roughnessMap: externalTextures.roughness,
                    color: material.color || new THREE.Color(1, 1, 1),
                    transparent: material.transparent || false,
                    opacity: material.opacity !== undefined ? material.opacity : 1.0,
                    roughness: 0.7,
                    metalness: 0.1,
                  });
                  return newMaterial;
                } else {
                  // Already StandardMaterial, just apply external textures
                  if (externalTextures.diffuse) material.map = externalTextures.diffuse;
                  if (externalTextures.normal) material.normalMap = externalTextures.normal;
                  if (externalTextures.roughness) material.roughnessMap = externalTextures.roughness;
                  material.needsUpdate = true;
                  return material;
                }
              });
              
              child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
            }
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
        
        // Report bounding box to parent when ready
        if (onBoundingBoxReady) {
          setTimeout(() => {
            const worldPosition = new THREE.Vector3(...position);
            onBoundingBoxReady(name, box, worldPosition);
          }, 50);
        }
      },
      (progress) => {
        console.log(`[EnvironmentAssets] 📊 Loading ${name}: ${Math.round((progress.loaded / progress.total) * 100)}%`);
      },
      (error) => {
        console.error(`[EnvironmentAssets] ❌ Error loading ${name}: ${modelPath}`, error);
      }
    );

    return () => {
      if (model && group.current) {
        group.current.remove(model);
      }
    };
  }, [modelPath, scale, name, textureFolder, loadTextures]);

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
      if (ITEM_ANIMATION_CONFIG.ENABLE_FLOATING) {
        const floatOffset = Math.sin(elapsed * ITEM_ANIMATION_CONFIG.FLOAT_SPEED * Math.PI * 2) * ITEM_ANIMATION_CONFIG.FLOAT_AMPLITUDE;
        swordGroup.current.position.y = position[1] + floatOffset + 1.5; // Hover 1.5 units above ground
      } else {
        swordGroup.current.position.y = position[1] + 1.5; // Static position above ground
      }
      
      // Gentle rotation around Y-axis
      if (ITEM_ANIMATION_CONFIG.ENABLE_ROTATION) {
        swordGroup.current.rotation.y += ITEM_ANIMATION_CONFIG.ROTATION_SPEED * delta;
      }
      
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

// Floating Flamethrower Component
interface FloatingFlamethrowerProps {
  position: [number, number, number];
  onFlamethrowerCollected?: (flamethrowerModel: THREE.Group, flamethrowerPosition: THREE.Vector3) => void; // Callback when flamethrower is collected
  players?: ReadonlyMap<string, any>; // Player data for collision detection
  localPlayerIdentity?: any; // Local player identity for collision detection
}

const FloatingFlamethrower: React.FC<FloatingFlamethrowerProps> = ({ 
  position, 
  onFlamethrowerCollected, 
  players, 
  localPlayerIdentity 
}) => {
  const flamethrowerGroup = useRef<THREE.Group>(null!);
  const glowPillarGroup = useRef<THREE.Group>(null!);
  const [flamethrowerModel, setFlamethrowerModel] = useState<THREE.Group | null>(null);
  const [startTime] = useState(Date.now());
  const [isCollected, setIsCollected] = useState(false);
  
  // Glow pillar properties
  const PILLAR_HEIGHT = 2000; // Infinite pillar extending far up into space
  const PILLAR_RADIUS = 0.4;
  const COLLECTION_RADIUS = 3.0; // Distance for flamethrower collection

  // Load flamethrower model
  useEffect(() => {
    if (isCollected) return; // Don't load if already collected
    
    const loader = new FBXLoader();
    
         loader.load(
       '/models/items/flamethrower.fbx',
      (fbx) => {
        const loadedModel = fbx.clone();
        
        // Scale the flamethrower appropriately (much bigger for visibility)
        loadedModel.scale.setScalar(0.01); // Increased from 2.0 to 4.0
        
        // Orient flamethrower pointing straight up
        loadedModel.rotation.set(0, 0, 0); // 1.57 ≈ π/2 radians = 90 degrees for perfect vertical
        
        // Enable shadows
        loadedModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        if (flamethrowerGroup.current) {
          flamethrowerGroup.current.add(loadedModel);
        }
        
        setFlamethrowerModel(loadedModel);
        // console.log('[EnvironmentAssets] ✨ Floating flamethrower loaded successfully');
      },
      undefined,
      (error) => {
        console.error('[EnvironmentAssets] ❌ Error loading floating flamethrower:', error);
      }
    );

    return () => {
      if (flamethrowerModel && flamethrowerGroup.current) {
        flamethrowerGroup.current.remove(flamethrowerModel);
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
    
    if (flamethrowerGroup.current) {
      flamethrowerGroup.current.position.set(...position);
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
    
    if (flamethrowerGroup.current && flamethrowerModel) {
      // Floating up and down motion
      if (ITEM_ANIMATION_CONFIG.ENABLE_FLOATING) {
        const floatOffset = Math.sin(elapsed * ITEM_ANIMATION_CONFIG.FLOAT_SPEED * Math.PI * 2) * ITEM_ANIMATION_CONFIG.FLOAT_AMPLITUDE;
        flamethrowerGroup.current.position.y = position[1] + floatOffset + 1.5; // Hover 1.5 units above ground
      } else {
        flamethrowerGroup.current.position.y = position[1] + 1.5; // Static position above ground
      }
      
      // Gentle rotation around Y-axis
      if (ITEM_ANIMATION_CONFIG.ENABLE_ROTATION) {
        flamethrowerGroup.current.rotation.y += ITEM_ANIMATION_CONFIG.ROTATION_SPEED * delta;
      }
      
      // Check for player collision (only for local player)
      if (players && localPlayerIdentity && onFlamethrowerCollected) {
        const localPlayer = players.get(localPlayerIdentity.toHexString());
        if (localPlayer) {
          const playerPos = new THREE.Vector3(
            localPlayer.position.x,
            localPlayer.position.y,
            localPlayer.position.z
          );
          const flamethrowerPos = flamethrowerGroup.current.position;
          const distance = playerPos.distanceTo(flamethrowerPos);
          
          if (distance <= COLLECTION_RADIUS) {
            // console.log('[EnvironmentAssets] 🔥 Flamethrower collected by player!');
            setIsCollected(true);
            
            // Create a copy of the flamethrower model for the player
            const flamethrowerCopy = flamethrowerModel.clone();
            onFlamethrowerCollected(flamethrowerCopy, flamethrowerPos.clone());
            
            // Hide the floating flamethrower and pillar
            flamethrowerGroup.current.visible = false;
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
      <group ref={flamethrowerGroup} />
      <group ref={glowPillarGroup} />
    </>
  );
};

// Floating Cybertruck Component with Blue Pillar
interface FloatingCybertruckProps {
  position: [number, number, number];
  onCybertruckCollected?: (cybertruckModel: THREE.Group, cybertruckPosition: THREE.Vector3) => void; // Callback when cybertruck is collected
  players?: ReadonlyMap<string, any>; // Player data for collision detection
  localPlayerIdentity?: any; // Local player identity for collision detection
}

const FloatingCybertruck: React.FC<FloatingCybertruckProps> = ({ 
  position, 
  onCybertruckCollected, 
  players, 
  localPlayerIdentity 
}) => {
  const cybertruckGroup = useRef<THREE.Group>(null!);
  const glowPillarGroup = useRef<THREE.Group>(null!);
  const [cybertruckModel, setCybertruckModel] = useState<THREE.Group | null>(null);
  const [modelCenter, setModelCenter] = useState<THREE.Vector3>(new THREE.Vector3());
  const [startTime] = useState(Date.now());
  const [isCollected, setIsCollected] = useState(false);
  
  // Glow pillar properties
  const PILLAR_HEIGHT = 2000; // Infinite pillar extending far up into space
  const PILLAR_RADIUS = 0.2; // Bigger pillar radius for cybertruck (3x larger than default 0.4)
  const COLLECTION_RADIUS = 5.0; // Distance for cybertruck collection (increased for 6x larger vehicle)

  // Load cybertruck model
  useEffect(() => {
    if (isCollected) return; // Don't load if already collected
    
    const loader = new GLTFLoader();
    
    loader.load(
      '/models/items/cybertruck.glb',
      (gltf) => {
        const loadedModel = gltf.scene.clone();
        
        // Scale the cybertruck appropriately - YOU CAN CHANGE THIS VALUE TO SCALE THE TRUCK
        // Current scale: 6.0 (6x larger than original)
        // For smaller: use 0.5, 0.3, etc.
        // For larger: use 2.0, 3.0, etc.
        loadedModel.scale.setScalar(3.5); // <-- CHANGE THIS TO SCALE THE CYBERTRUCK
        
        // Orient cybertruck (you can adjust rotation here)
        loadedModel.rotation.set(0, 0, 0); // No rotation (facing forward)
        
        // Enable shadows
        loadedModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        if (cybertruckGroup.current) {
          cybertruckGroup.current.add(loadedModel);
        }
        
        // Calculate the center of the cybertruck model for proper pillar alignment
        const boundingBox = new THREE.Box3().setFromObject(loadedModel);
        const center = boundingBox.getCenter(new THREE.Vector3());
        setModelCenter(center);
        
        setCybertruckModel(loadedModel);
        console.log('[EnvironmentAssets] 🚛 Floating cybertruck loaded successfully with scale:', loadedModel.scale.x);
        console.log('[EnvironmentAssets] 🎯 Cybertruck model center offset:', center);
      },
      undefined,
      (error) => {
        console.error('[EnvironmentAssets] ❌ Error loading floating cybertruck:', error);
      }
    );

    return () => {
      if (cybertruckModel && cybertruckGroup.current) {
        cybertruckGroup.current.remove(cybertruckModel);
      }
    };
  }, [isCollected]);

  // Create blue glow pillar with custom radius for cybertruck
  useEffect(() => {
    if (!glowPillarGroup.current || isCollected) return;

    // Clear any existing pillar geometry
    while(glowPillarGroup.current.children.length > 0) {
      glowPillarGroup.current.remove(glowPillarGroup.current.children[0]);
    }

    // Create triple-layer glow effect with blue color using current PILLAR_RADIUS
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
    
    // Deep blue glow materials - same as sword/flamethrower
    const deepBlueColor = 0x4169E1; // Royal blue color
    
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: deepBlueColor,
      transparent: true,
      opacity: 0.04,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false
    });
    
    const middleMaterial = new THREE.MeshBasicMaterial({
      color: deepBlueColor,
      transparent: true,
      opacity: 0.025,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false
    });
    
    const outerMaterial = new THREE.MeshBasicMaterial({
      color: deepBlueColor,
      transparent: true,
      opacity: 0.015,
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
    
    console.log('[EnvironmentAssets] 🔵 Blue glow pillar created for cybertruck with radius:', PILLAR_RADIUS);
  }, [isCollected, PILLAR_RADIUS]); // Added PILLAR_RADIUS as dependency

  // Set initial positions
  useEffect(() => {
    if (isCollected) return;
    
    if (cybertruckGroup.current) {
      cybertruckGroup.current.position.set(...position);
    }
    if (glowPillarGroup.current) {
      // Position pillar at ground level, centered on the cybertruck's actual center
      glowPillarGroup.current.position.set(
        position[0] + modelCenter.x, 
        position[1] + PILLAR_HEIGHT / 2 - 1.0, 
        position[2] + modelCenter.z
      );
    }
  }, [position, isCollected]);

  // Animation loop and collision detection
  useFrame((state, delta) => {
    if (isCollected) return;
    
    const elapsed = (Date.now() - startTime) / 1000;
    
    if (cybertruckGroup.current && cybertruckModel) {
      // Keep cybertruck stationary on the ground (no floating or rotation)
      cybertruckGroup.current.position.y = position[1]; // Place directly on ground level
      
      // Keep pillar centered on the cybertruck's actual center at all times
      if (glowPillarGroup.current) {
        glowPillarGroup.current.position.set(
          cybertruckGroup.current.position.x + modelCenter.x + 1, 
          position[1] + PILLAR_HEIGHT / 2 - 10.0, 
          cybertruckGroup.current.position.z + modelCenter.z + 140 
        );
      }
      
      // Check for player collision (only for local player)
      if (players && localPlayerIdentity && onCybertruckCollected) {
        const localPlayer = players.get(localPlayerIdentity.toHexString());
        if (localPlayer) {
          const playerPos = new THREE.Vector3(
            localPlayer.position.x,
            localPlayer.position.y,
            localPlayer.position.z
          );
          const cybertruckPos = cybertruckGroup.current.position;
          const distance = playerPos.distanceTo(cybertruckPos);
          
          if (distance <= COLLECTION_RADIUS) {
            console.log('[EnvironmentAssets] 🚛 Cybertruck collected by player!');
            setIsCollected(true);
            
            // Create a copy of the cybertruck model for the player
            const cybertruckCopy = cybertruckModel.clone();
            onCybertruckCollected(cybertruckCopy, cybertruckPos.clone());
            
            // Hide the floating cybertruck and pillar
            cybertruckGroup.current.visible = false;
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
      <group ref={cybertruckGroup} />
      <group ref={glowPillarGroup} />
    </>
  );
};


export const EnvironmentAssets: React.FC<EnvironmentAssetsProps> = ({ 
  players, 
  localPlayerIdentity, 
  onSwordCollected,
  onFlamethrowerCollected,
  onCybertruckCollected,
  onCollisionDataReady
}) => {
  const [rockConfig, setRockConfig] = useState<EnvironmentConfigData | null>(null);

  // Load rock configuration on mount
  useEffect(() => {
    loadRockConfiguration().then(config => {
      setRockConfig(config);
      console.log('[EnvironmentAssets] 🗻 Rock configuration loaded:', {
        'rock-1': config.rocks['rock-1'].length,
        'rock-2': config.rocks['rock-2'].length, 
        'rock-3': config.rocks['rock-3'].length
      });
    });
  }, []);

  // Collision data management
  const collisionBoxesRef = useRef<Map<string, THREE.Box3>>(new Map());
  const [collisionDataReady, setCollisionDataReady] = useState(false);

  // Callback for individual assets to report their collision boxes
  const handleAssetBoundingBox = useCallback((id: string, boundingBox: THREE.Box3, worldPosition: THREE.Vector3) => {
    // Transform bounding box to world coordinates
    const worldBoundingBox = boundingBox.clone().translate(worldPosition);
    collisionBoxesRef.current.set(id, worldBoundingBox);
    
    // Check if all collision data is ready
    const expectedAssets = rock1Configs.length + rock2Configs.length + rock3Configs.length + 3; // +3 for arch near sword, statue, and Egyptian house
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

  // Get rock configurations from loaded JSON
  const rock1Configs = rockConfig?.rocks['rock-1'] ?? [];
  const rock2Configs = rockConfig?.rocks['rock-2'] ?? [];
  const rock3Configs = rockConfig?.rocks['rock-3'] ?? [];

  return (
    <group name="environment-assets">
      {/* Rock-1 instances (large rocks) */}
      {rock1Configs.map((config, index) => (
        <RockInstance
          key={`rock-1-${index}`}
          instanceId={`rock-1-${index}`}
          modelPath={ENVIRONMENT_CONFIG.rocks['rock-1'].path}
          position={new THREE.Vector3(...config.position)}
          scale={ENVIRONMENT_CONFIG.rocks['rock-1'].scale}
          rotationY={config.rotationY}
          onBoundingBoxReady={handleAssetBoundingBox}
        />
      ))}

      {/* Rock-2 instances (medium rocks) */}
      {rock2Configs.map((config, index) => (
        <RockInstance
          key={`rock-2-${index}`}
          instanceId={`rock-2-${index}`}
          modelPath={ENVIRONMENT_CONFIG.rocks['rock-2'].path}
          position={new THREE.Vector3(...config.position)}
          scale={ENVIRONMENT_CONFIG.rocks['rock-2'].scale}
          rotationY={config.rotationY}
          onBoundingBoxReady={handleAssetBoundingBox}
        />
      ))}

      {/* Rock-3 instances (small rocks) */}
      {rock3Configs.map((config, index) => (
        <RockInstance
          key={`rock-3-${index}`}
          instanceId={`rock-3-${index}`}
          modelPath={ENVIRONMENT_CONFIG.rocks['rock-3'].path}
          position={new THREE.Vector3(...config.position)}
          scale={ENVIRONMENT_CONFIG.rocks['rock-3'].scale}
          rotationY={config.rotationY}
          onBoundingBoxReady={handleAssetBoundingBox}
        />
      ))}

      {/* Desert Arch (very large, 100 units away) - REMOVED: keeping only the one by the sword */}
      {/* 
      <LargeAsset
        modelPath={ENVIRONMENT_CONFIG.desertArch.path}
        position={ENVIRONMENT_CONFIG.desertArch.position}
        scale={ENVIRONMENT_CONFIG.desertArch.scale}
        rotation={ENVIRONMENT_CONFIG.desertArch.rotation}
        name="Desert Arch"
        onBoundingBoxReady={handleAssetBoundingBox}
      />
      */}

      {/* X-Statue (10x bigger than arch, 1000 units away) */}
      <LargeAsset
        modelPath={ENVIRONMENT_CONFIG.statue.path}
        position={ENVIRONMENT_CONFIG.statue.position}
        scale={ENVIRONMENT_CONFIG.statue.scale}
        rotation={ENVIRONMENT_CONFIG.statue.rotation}
        name="X-Statue"
        onBoundingBoxReady={handleAssetBoundingBox}
      />

      {/* Egyptian House (FBX model) */}
      <FBXAsset
        modelPath={ENVIRONMENT_CONFIG.egyptianHouse.path}
        position={ENVIRONMENT_CONFIG.egyptianHouse.position}
        scale={ENVIRONMENT_CONFIG.egyptianHouse.scale}
        rotation={ENVIRONMENT_CONFIG.egyptianHouse.rotation}
        name="Egyptian House"
        textureFolder={ENVIRONMENT_CONFIG.egyptianHouse.textureFolder}
        onBoundingBoxReady={handleAssetBoundingBox}
      />

      {/* Floating Sword with Light Blue Glow Pillar */}
      <FloatingSword 
        position={SWORD_SPAWN_POSITION} 
        onSwordCollected={onSwordCollected}
        players={players}
        localPlayerIdentity={localPlayerIdentity}
      />

      {/* Floating Flamethrower with Light Blue Glow Pillar */}
      <FloatingFlamethrower 
        position={FLAMETHROWER_SPAWN_POSITION} 
        onFlamethrowerCollected={onFlamethrowerCollected}
        players={players}
        localPlayerIdentity={localPlayerIdentity}
      />

      {/* Floating Cybertruck with Blue Pillar */}
      <FloatingCybertruck 
        position={CYBERTRUCK_SPAWN_POSITION} 
        onCybertruckCollected={onCybertruckCollected}
        players={players}
        localPlayerIdentity={localPlayerIdentity}
      />
    


      {/* Second Desert Arch near the sword - tweak position and rotation for best visual */}
      <LargeAsset
        modelPath={ENVIRONMENT_CONFIG.desertArch.path}
        position={[27, 7, 35]} // X: left/right, Y: up/down, Z: forward/back
        scale={15.0} // Adjust size (current: 15.0, try 10.0-25.0)
        rotation={[0, Math.PI * 0.2, 0]} // Y rotation: 0=forward, 0.5=90°, 1.0=180°
        name="Desert Arch (Near Sword)"
        onBoundingBoxReady={handleAssetBoundingBox}
      />
    </group>
  );
}; 