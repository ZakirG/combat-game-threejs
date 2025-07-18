/**
 * Character3DPreview.tsx
 * 
 * 3D character preview component for the character selection screen.
 * Displays a rotating 3D model of the selected character with animation sequences.
 * 
 * Key functionality:
 * - Loads character model based on character configuration
 * - Plays animation sequences: victory -> idle -> attack1 -> attack2 -> idle (loop)
 * - Shows loading spinner while model loads
 * - Auto-rotates the character for better viewing
 * 
 * Props:
 * - characterName: Name of the character to preview
 * - className: Optional CSS class for styling
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { TextureLoader } from 'three';
import { getCharacterConfig, getCharacterPreviewConfig, getAnimationPath, getAnimationTimeScale } from '../characterConfigs';

// Character-specific texture configurations
const CHARACTER_TEXTURES: Record<string, { folder: string; hasTextures: boolean }> = {
  'Zaqir Mufasa': {
    folder: '/models/zaqir-1/',
    hasTextures: false // Use embedded textures like in main game - external textures cause issues
  },
  'Grok Ani': {
    folder: '/models/grok-ani/',
    hasTextures: false // Use embedded textures like in main game - external textures cause issues
  },
  'Grok Rudi': {
    folder: '/models/grok-rudi/',
    hasTextures: false // Uses embedded textures
  }
};

// Animation sequence states
enum PreviewState {
  LOADING = 'loading',
  VICTORY = 'victory',
  IDLE = 'idle',
  ATTACK1 = 'attack1',
  ATTACK2 = 'attack2',
  ATTACK3 = 'attack3',
  ATTACK4 = 'attack4',
  IDLE_LOOP = 'idle_loop'
}

interface Character3DModelProps {
  characterName: string;
  onLoadComplete?: () => void;
  onLoadError?: (error: any) => void;
}

// Internal 3D model component
const Character3DModel: React.FC<Character3DModelProps> = ({
  characterName,
  onLoadComplete,
  onLoadError
}) => {
  const group = useRef<THREE.Group>(null!);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [mixer, setMixer] = useState<THREE.AnimationMixer | null>(null);
  const [animations, setAnimations] = useState<Record<string, THREE.AnimationAction>>({});
  const [currentState, setCurrentState] = useState<PreviewState>(PreviewState.LOADING);
  const [stateTimer, setStateTimer] = useState<number>(0);
  const [isModelVisible, setIsModelVisible] = useState<boolean>(false);
  
  const characterConfig = useMemo(() => getCharacterConfig(characterName), [characterName]);
  const previewConfig = useMemo(() => getCharacterPreviewConfig(characterName), [characterName]);
  const textureConfig = CHARACTER_TEXTURES[characterName];
  
  // Static straight-on view - facing camera
  const staticRotationY = 0; // Face directly at camera
  
  // Load external textures for specific characters
  const loadCharacterTextures = useCallback(async (characterName: string) => {
    const config = CHARACTER_TEXTURES[characterName];
    if (!config || !config.hasTextures) {
      return null;
    }
    
    const textureLoader = new TextureLoader();
    const textures: Record<string, THREE.Texture> = {};
    
          try {
        // Load all available textures based on character
        const texturePromises = [];
        
        if (characterName === 'Zaqir Mufasa') {
          // console.log(`[Character3DPreview] Loading Zaqir textures from ${config.folder}`);
          texturePromises.push(
            textureLoader.loadAsync(`${config.folder}texture_diffuse.png`)
              .then(tex => { 
                textures.diffuse = tex;
                // console.log(`[Character3DPreview] Loaded diffuse texture for Zaqir`);
              })
              .catch(err => console.warn(`[Character3DPreview] Failed to load diffuse:`, err)),
            textureLoader.loadAsync(`${config.folder}texture_normal.png`)
              .then(tex => { 
                textures.normal = tex;
                // console.log(`[Character3DPreview] Loaded normal texture for Zaqir`);
              })
              .catch(err => console.warn(`[Character3DPreview] Failed to load normal:`, err)),
            textureLoader.loadAsync(`${config.folder}texture_roughness.png`)
              .then(tex => { 
                textures.roughness = tex;
                // console.log(`[Character3DPreview] Loaded roughness texture for Zaqir`);
              })
              .catch(err => console.warn(`[Character3DPreview] Failed to load roughness:`, err)),
            textureLoader.loadAsync(`${config.folder}texture_metallic.png`)
              .then(tex => { 
                textures.metallic = tex;
                // console.log(`[Character3DPreview] Loaded metallic texture for Zaqir`);
              })
              .catch(err => console.warn(`[Character3DPreview] Failed to load metallic:`, err))
          );
        } else if (characterName === 'Grok Ani') {
          // console.log(`[Character3DPreview] Loading Grok Ani texture from ${config.folder}`);
          texturePromises.push(
            textureLoader.loadAsync(`${config.folder}Gothic_Elegance_0715203917_texture.png`)
              .then(tex => { 
                textures.diffuse = tex;
                // console.log(`[Character3DPreview] Loaded diffuse texture for Grok Ani`);
              })
              .catch(err => console.warn(`[Character3DPreview] Failed to load Grok Ani texture:`, err))
          );
        }
        
        await Promise.allSettled(texturePromises);
        // console.log(`[Character3DPreview] Texture loading complete for ${characterName}. Loaded ${Object.keys(textures).length} textures:`, Object.keys(textures));
        return Object.keys(textures).length > 0 ? textures : null;
      } catch (error) {
        console.error(`[Character3DPreview] Failed to load textures for ${characterName}:`, error);
        return null;
      }
  }, []);
  
  // Load character model and animations
  useEffect(() => {
    if (!characterName) return;
    
    // console.log(`[Character3DPreview] Loading character: ${characterName}`);
    setCurrentState(PreviewState.LOADING);
    setStateTimer(0);
    
    const loader = new FBXLoader();
    
    // Load main model
    loader.load(
      characterConfig.modelPath,
      (fbx) => {
        // console.log(`[Character3DPreview] Model loaded for ${characterName}`);
        // console.log(`[Character3DPreview] Model scale: ${characterConfig.scale}, yOffset: ${characterConfig.yOffset}`);
        
        // Calculate bounding box for debugging
        const bbox = new THREE.Box3().setFromObject(fbx);
        // console.log(`[Character3DPreview] Model bounding box:`, bbox);
        
        // Apply character-specific scaling and positioning for preview
        fbx.scale.setScalar(previewConfig.scale);
        // Push character DOWN to prevent floating up
        fbx.position.set(0, previewConfig.yOffset - 0.5, 0); // Extra downward offset to prevent floating
        
        // console.log(`[Character3DPreview] Model positioned at:`, fbx.position);
        // console.log(`[Character3DPreview] Model scaled to:`, fbx.scale);
        
        // Load external textures if needed
        const processModelWithTextures = async () => {
          const externalTextures = await loadCharacterTextures(characterName);
          
          // Process materials for better preview lighting
          fbx.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              
              // Process materials like in main game - preserve embedded textures, only convert when necessary
              if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                const newMaterials = materials.map((material: any, index: number) => {
                  
                  
                  // Convert MeshPhongMaterial to MeshStandardMaterial for better PBR lighting (like main game)
                  if (material.type === 'MeshPhongMaterial' || material.type === 'MeshBasicMaterial' || material.type === 'MeshLambertMaterial') {
                    // console.log(`[Character3DPreview] Converting ${material.type} to MeshStandardMaterial for material ${index}`);
                    
                    const newMaterial = new THREE.MeshStandardMaterial({
                      map: externalTextures?.diffuse || material.map, // Use embedded map if no external textures
                      normalMap: externalTextures?.normal,
                      roughnessMap: externalTextures?.roughness,
                      metalnessMap: externalTextures?.metallic,
                      color: material.color || new THREE.Color(1, 1, 1),
                      emissive: new THREE.Color(0, 0, 0), // Remove emissive, rely on environment and direct lights
                      transparent: material.transparent || false,
                      opacity: material.opacity !== undefined ? material.opacity : 1.0,
                      roughness: 0.7,
                      metalness: 0.1,
                    });
                    
                    // Enable skinning for animations
                    (newMaterial as any).skinning = true;
                    return newMaterial;
                  } else {
                    // Material is already StandardMaterial, just ensure skinning and fix any issues
                    if ('skinning' in material) {
                      (material as any).skinning = true;
                    }
                    
                    // Fix any color issues (like main game)
                    if (material.color && material.color.r === 0 && material.color.g === 0 && material.color.b === 0) {
                      // console.log(`[Character3DPreview] Material ${index} color is black, setting to white`);
                      material.color.setRGB(1, 1, 1);
                    }
                    
                    return material;
                  }
                });
                
                child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
                
                // Force material update
                if (Array.isArray(child.material)) {
                  child.material.forEach(mat => mat.needsUpdate = true);
                } else {
                  child.material.needsUpdate = true;
                }
              }
            }
          });
        };
        
        // Process materials asynchronously
        processModelWithTextures().then(() => {
          // console.log(`[Character3DPreview] Material processing complete for ${characterName}`);
        }).catch(error => {
          console.error(`[Character3DPreview] Material processing failed:`, error);
        });
        
        if (group.current) {
          // Clear previous model
          group.current.clear();
          group.current.add(fbx);
          // Hide model initially to prevent T-pose visibility
          fbx.visible = false;
        }
        
        setModel(fbx);
        
        // Create animation mixer
        const newMixer = new THREE.AnimationMixer(fbx);
        setMixer(newMixer);
        
        // Load animations
        loadAnimations(newMixer, fbx);
      },
      undefined,
      (error) => {
        console.error(`[Character3DPreview] Error loading model for ${characterName}:`, error);
        console.error(`[Character3DPreview] Model path was: ${characterConfig.modelPath}`);
        if (onLoadError) onLoadError(error);
      }
    );
    
    return () => {
      // console.log(`[Character3DPreview] Cleaning up resources for ${characterName}`);
      
      // Stop all animations
      if (mixer) {
        mixer.stopAllAction();
        mixer.uncacheRoot(mixer.getRoot());
      }
      
      // Clear group and dispose of geometries/materials
      if (group.current) {
        group.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(material => material.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
        group.current.clear();
      }
      
      // Clear model reference
      if (model) {
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(material => material.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
      }
      
      setModel(null);
      setMixer(null);
      setAnimations({});
    };
  }, [characterName, characterConfig]);
  
  // Load character animations
  const loadAnimations = useCallback((mixer: THREE.AnimationMixer, model: THREE.Group) => {
    const animationsToLoad = ['idle', 'attack1', 'attack2', 'attack3', 'attack4']; // Full combo sequence
    const loadedAnimations: Record<string, THREE.AnimationAction> = {};
    let loadedCount = 0;
    
    const checkComplete = () => {
      loadedCount++;
      if (loadedCount >= animationsToLoad.length) {
        setAnimations(loadedAnimations);
        setCurrentState(PreviewState.IDLE);
        setStateTimer(0);
        
        // Start with idle animation before the combo
        if (loadedAnimations['idle']) {
          playAnimation('idle', loadedAnimations);
        } else if (loadedAnimations['attack1']) {
          playAnimation('attack1', loadedAnimations);
        }
        
        // Make model visible after a delay to ensure animation is actually playing
        // Use longer timeout for Grok Ani to prevent T-pose visibility
        const visibilityDelay = characterName === 'Grok Ani' ? 2500 : 1000;
        setTimeout(() => {
          if (model && group.current) {
            model.visible = true;
            setIsModelVisible(true);
            // console.log(`[Character3DPreview] Model now visible for ${characterName} with animation playing (delay: ${visibilityDelay}ms)`);
            
            // Notify parent that model is ready and visible
            if (onLoadComplete) onLoadComplete();
          }
        }, visibilityDelay); // Wait for fadeIn to complete + buffer (longer for Grok Ani)
      }
    };
    
    animationsToLoad.forEach((animName) => {
      const animPath = getAnimationPath(characterName, animName);
      // console.log(`[Character3DPreview] Loading animation "${animName}" from: ${animPath}`);
      
      const loader = new FBXLoader();
      loader.load(
        animPath,
        (animFbx) => {
          if (animFbx.animations && animFbx.animations.length > 0) {
            const clip = animFbx.animations[0].clone();
            clip.name = animName;
            
            // Remove root motion for preview
            const tracks = clip.tracks;
            const positionTracks = tracks.filter(track => track.name.endsWith('.position'));
            
            if (positionTracks.length > 0) {
              const rootPositionTrack = positionTracks.find(track => 
                track.name.toLowerCase().includes('hips') || 
                track.name.toLowerCase().includes('root') || 
                track.name.toLowerCase().includes('armature')
              ) || positionTracks[0];
              
              if (rootPositionTrack instanceof THREE.VectorKeyframeTrack) {
                const values = rootPositionTrack.values;
                for (let i = 0; i < values.length; i += 3) {
                  values[i] = 0;
                  values[i + 2] = 0;
                }
              }
            }
            
            const action = mixer.clipAction(clip);
            const timeScale = getAnimationTimeScale(characterName, animName);
            action.setEffectiveTimeScale(timeScale);
            
            // Set loop mode
            if (animName === 'idle') {
              action.setLoop(THREE.LoopRepeat, Infinity);
            } else {
              action.setLoop(THREE.LoopOnce, 1);
              action.clampWhenFinished = true;
            }
            
            loadedAnimations[animName] = action;
            // console.log(`[Character3DPreview] Animation loaded: ${animName}`);
          }
          
          checkComplete();
        },
        undefined,
        (error) => {
          console.warn(`[Character3DPreview] Could not load animation ${animName}:`, error);
          checkComplete();
        }
      );
    });
  }, [characterConfig, onLoadComplete]);
  
  // Play animation function
  const playAnimation = useCallback((animName: string, anims?: Record<string, THREE.AnimationAction>) => {
    const animationsToUse = anims || animations;
    if (!mixer || !animationsToUse[animName]) {
      console.warn(`[Character3DPreview] Animation not found: ${animName}`);
      return;
    }
    
    // Stop all current animations with quick fade
    Object.values(animationsToUse).forEach(action => {
      action.fadeOut(0.1);
    });
    
    const targetAction = animationsToUse[animName];
    targetAction.reset()
               .setEffectiveWeight(1)
               .fadeIn(0.1)
               .play();
               
    // console.log(`[Character3DPreview] Playing animation: ${animName}`);
  }, [animations, mixer]);
  
  // Animation state machine
  useFrame((state, delta) => {
    if (!mixer || !model) return;
    
    // Update mixer
    mixer.update(delta);
    
    // Set static 3/4 angle view
    if (group.current) {
      group.current.rotation.y = staticRotationY;
    }
    
    // Update state timer
    setStateTimer(prev => prev + delta);
    
    // State machine for animation sequence - starts with idle, then full combo
    switch (currentState) {
      case PreviewState.IDLE:
        // Idle for 2 seconds, then start combo with attack1
        if (stateTimer > 2.0) {
          setCurrentState(PreviewState.ATTACK1);
          setStateTimer(0);
          playAnimation('attack1');
        }
        break;
        
      case PreviewState.ATTACK1:
        // Attack1 animation for 1.5 seconds, then move to attack2
        if (stateTimer > 1.5) {
          setCurrentState(PreviewState.ATTACK2);
          setStateTimer(0);
          playAnimation('attack2');
        }
        break;
        
      case PreviewState.ATTACK2:
        // Attack2 animation for 1.5 seconds, then move to attack3
        if (stateTimer > 1.5) {
          setCurrentState(PreviewState.ATTACK3);
          setStateTimer(0);
          playAnimation('attack3');
        }
        break;
        
      case PreviewState.ATTACK3:
        // Attack3 animation for 1.5 seconds, then move to attack4
        if (stateTimer > 1.5) {
          setCurrentState(PreviewState.ATTACK4);
          setStateTimer(0);
          playAnimation('attack4');
        }
        break;
        
      case PreviewState.ATTACK4:
        // Attack4 animation for 1.5 seconds, then back to idle
        if (stateTimer > 1.5) {
          setCurrentState(PreviewState.IDLE);
          setStateTimer(0);
          playAnimation('idle');
        }
        break;
        
      case PreviewState.VICTORY:
      case PreviewState.IDLE_LOOP:
        // Legacy states - redirect to idle
        setCurrentState(PreviewState.IDLE);
        setStateTimer(0);
        playAnimation('idle');
        break;
    }
  });
  
  return (
    <group ref={group} position={[0, -0.8, 0]}>
      {/* This component's lighting is now managed within the Canvas */}
    </group>
  );
};

interface Character3DPreviewProps {
  characterName: string;
  className?: string;
}

// Helper function to get character-specific background videos (same as JoinGameDialog)
function getCharacterVideo(characterName: string): string {
  const videoMap: Record<string, string> = {
    'Zaqir Mufasa': '/character-select-bg-1.mp4',
    'Grok Ani': '/grok-ani-background.mp4',
    'Grok Rudi': '/grok-rudi-background.mp4'
  };
  return videoMap[characterName] || '/character-select-bg-1.mp4'; // Fallback to default
}

// Helper function to get character images
function getCharacterImage(characterName: string): string {
  const imageMap: Record<string, string> = {
    'Zaqir Mufasa': '/zaqir-mufasa.png',
    'Grok Ani': '/grok-ani.png',
    'Grok Rudi': '/grok-rudi.png'
  };
  return imageMap[characterName] || '/zaqir-mufasa.png'; // Fallback to default
}

// Helper function to get character descriptions
function getCharacterDescription(characterName: string): string {
  const descriptions: Record<string, string> = {
    'Zaqir Mufasa': 'x.com/jaguarsoftio',
    'Grok Ani': 'x.com/grok',
    'Grok Rudi': 'x.com/grok'
  };
  return descriptions[characterName] || 'Skilled fighter';
}

// Helper function to get character-specific profile pictures
function getCharacterProfilePicture(characterName: string): string {
  const profilePictureMap: Record<string, string> = {
    'Zaqir Mufasa': '/profile-zaqir.jpg', // Dummy profile picture file
    'Grok Ani': '/grok-pfp.jpg', // Dummy profile picture file
    'Grok Rudi': '/grok-pfp.jpg'
  };
  return profilePictureMap[characterName] || '/profile-default.png'; // Fallback to default profile pic
}

export const Character3DPreview: React.FC<Character3DPreviewProps> = ({
  characterName,
  className
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const handleLoadComplete = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);
  
  const handleLoadError = useCallback((error: any) => {
    setIsLoading(false);
    setError(error?.message || 'Failed to load character model');
  }, []);
  
  // Reset loading state when character changes
  useEffect(() => {
    setIsLoading(true);
    setError(null);
  }, [characterName]);

  // Cleanup effect for component unmounting
  useEffect(() => {
    return () => {
      // console.log(`[Character3DPreview] Component unmounting for ${characterName}`);
      // React Three Fiber will handle WebGL context cleanup automatically
    };
  }, [characterName]);
  
  return (
    <div className={`character-3d-preview ${className || ''}`} style={{ 
      position: 'relative', 
      width: '100%', 
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
      borderRadius: '12px',
      overflow: 'hidden'
    }}>
      {/* Character-specific background video */}
      <video 
        key={`bg-${characterName}`}
        autoPlay 
        loop 
        muted 
        playsInline
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 1
        }}
      >
        <source src={getCharacterVideo(characterName)} type="video/mp4" />
      </video>
      
      {/* Character Image Placeholder */}
      {isLoading && (
        <img
          src={getCharacterImage(characterName)}
          alt={`${characterName} preview`}
          style={styles.characterImagePlaceholder}
        />
      )}
      
      {/* Character Info Overlay - copied from JoinGameDialog.tsx */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        color: 'white',
        fontFamily: 'Newrocker, serif',
        textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
        zIndex: 15,
        pointerEvents: 'none'
      }}>
        <div style={{
          fontSize: '18px',
          fontWeight: 'bold',
          marginBottom: '4px'
        }}>
          {characterName}
        </div>
        <div style={{
          fontSize: '14px',
          opacity: 0.9,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          justifyContent: 'center'
        }}>
          <img 
            src={getCharacterProfilePicture(characterName)}
            alt={`${characterName} Profile`}
            style={styles.characterProfilePicture}
          />
          {getCharacterDescription(characterName)}
        </div>
      </div>
      
      {/* Coming Soon Overlay for Grok Rudi */}
      {characterName === 'Grok Rudi' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: 'white',
          fontFamily: 'KnightsQuest, serif',
          fontSize: '32px',
          fontWeight: 'bold',
          textShadow: '3px 3px 6px rgba(0, 0, 0, 0.9)',
          zIndex: 25,
          pointerEvents: 'none',
          userSelect: 'none'
        }}>
          COMING SOON
        </div>
      )}
      
      {/* Loading Spinner */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 20,
          color: '#FFFFFF',
          textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(255, 255, 255, 0.4)', // Brighter, semi-transparent white
            borderTop: '4px solid #FFFFFF', // Bright white for the moving part
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0'
          }}></div>
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 20,
          color: '#FFFFFF',
          textAlign: 'center',
          fontFamily: 'Newrocker, serif',
          fontSize: '14px',
          textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)'
        }}>
          <div>⚠️</div>
          <div>Could not load 3D model</div>
        </div>
      )}
      
      {/* 3D Canvas */}
      <Canvas
        key={`preview-${characterName}`} // Force remount on character change
        camera={{ position: [0, 0.2, 2.2], fov: 65 }}
        style={{ 
          position: 'relative',
          width: '100%', 
          height: '100%',
          opacity: isLoading ? 0.3 : 1,
          transition: 'opacity 0.5s ease',
          zIndex: 10,
          filter: 'drop-shadow(0 0 5px white) drop-shadow(0 0 15px white)' // Glowing aura effect
        }}
        gl={{ 
          antialias: true,
          alpha: true,
          premultipliedAlpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.5,
          preserveDrawingBuffer: false,
          powerPreference: "default"
        }}
      >
        {/* No background color - fully transparent */}
        
        {/* Add Environment back for PBR materials but without background */}
        <Environment files="/environments/furstenstein_4k.hdr" background={false} />
        
        {/* Add a balanced lighting setup to supplement the environment map */}
        <ambientLight intensity={1} />
        <directionalLight 
          position={[5, 5, 5]} 
          intensity={1.8} 
          color="#fff5e1" // Add a warm, sunny color
        />
        <directionalLight 
          position={[-3, -3, 2]} 
          intensity={0.8} 
        />

        <Character3DModel
          characterName={characterName}
          onLoadComplete={handleLoadComplete}
          onLoadError={handleLoadError}
        />
        
        {/* Disable controls to prevent user interaction */}
        {/* <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1} /> */}
      </Canvas>
      
      {/* CSS for loading spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  characterImagePlaceholder: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '260px',
    height: '450px',
    objectFit: 'cover',
    zIndex: 5, // Above video, below canvas and UI
    filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 20px rgba(255, 255, 255, 0.6)) drop-shadow(0 0 30px rgba(255, 255, 255, 0.4))',
  },
  characterProfilePicture: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '1px solid grey',
    objectFit: 'cover',
    flexShrink: 0,
  },
};