import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Global toggle for coin effects
export const COIN_EFFECTS_ENABLED = true;

interface CoinInstance {
  mesh: THREE.Group;
  glowPillar: THREE.Group;
  startTime: number;
  position: THREE.Vector3;
  baseY: number;
  rotationSpeed: number;
  floatSpeed: number;
  collected: boolean;
  // Flyaway physics
  velocity: THREE.Vector3;
  gravity: number;
  landed: boolean;
}

export class CoinEffectManager {
  private scene: THREE.Scene;
  private coins: CoinInstance[] = [];
  private coinModel: THREE.Group | null = null;
  private readonly COIN_SCALE = 0.3; // Smaller than player
  private readonly FLOAT_AMPLITUDE = 0.5; // How high/low it floats
  private readonly COIN_DURATION = 3000; // 3 seconds before cleanup
  
  // Glow pillar properties
  private readonly PILLAR_HEIGHT = 10; // Height of the magical beam
  private readonly PILLAR_RADIUS = 0.3; // Thin beam radius

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Load the coin model asynchronously, with fallback to simple geometry
   */
  async loadCoinModel() {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync('/models/items/grok-coin.glb');
      this.coinModel = gltf.scene.clone();
      console.log('[CoinEffect] Coin model loaded successfully');
    } catch (error) {
      console.warn('[CoinEffect] Could not load coin model, using fallback geometry:', error.message);
      // Create a simple flat coin geometry as fallback
      const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 16); // Thinner for flat appearance
      const material = new THREE.MeshLambertMaterial({ color: 0xFFD700 }); // Gold color
      const coinMesh = new THREE.Mesh(geometry, material);
      
      this.coinModel = new THREE.Group();
      this.coinModel.add(coinMesh);
      console.log('[CoinEffect] Using fallback coin geometry');
    }
  }

  /**
   * Create a spinning, floating coin at the specified position
   */
  createCoin(position: THREE.Vector3, playerPosition?: THREE.Vector3): void {
    if (!COIN_EFFECTS_ENABLED || !this.coinModel) {
      console.warn('[CoinEffect] Coin effects disabled or model not loaded');
      return;
    }

    // Clone the coin model
    const coinMesh = this.coinModel.clone();
    
    // Scale the coin to be smaller than player
    coinMesh.scale.setScalar(this.COIN_SCALE);
    
    // Position the coin flat on the ground
    coinMesh.position.copy(position);
    coinMesh.position.y = position.y - 0.8; // Place on ground level
    
    // Keep coin lying flat (no rotation needed for flat orientation)
    
    // Create glowing white pillar with triple-layer glow effect
    const pillarGeometry = new THREE.CylinderGeometry(
      this.PILLAR_RADIUS, 
      this.PILLAR_RADIUS, 
      this.PILLAR_HEIGHT, 
      8, // segments
      1, // height segments 
      true // open-ended sides
    );
    
    // Create middle glow layer
    const middleGlowGeometry = new THREE.CylinderGeometry(
      this.PILLAR_RADIUS * 1.5, 
      this.PILLAR_RADIUS * 1.5, 
      this.PILLAR_HEIGHT, 
      8, 
      1, 
      true
    );
    
    // Create outer glow layer (widest, most transparent)
    const outerGlowGeometry = new THREE.CylinderGeometry(
      this.PILLAR_RADIUS * 2.0, 
      this.PILLAR_RADIUS * 2.0, 
      this.PILLAR_HEIGHT, 
      8, 
      1, 
      true
    );
    
    // More transparent materials
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.12, // Reduced from 0.2
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false
    });
    
    const middleMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08, // Reduced from 0.1
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false
    });
    
    const outerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.05, // New third layer
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false
    });
    
    // Create group to hold all three glow layers
    const glowPillar = new THREE.Group();
    const innerGlow = new THREE.Mesh(pillarGeometry, innerMaterial);
    const middleGlow = new THREE.Mesh(middleGlowGeometry, middleMaterial);
    const outerGlow = new THREE.Mesh(outerGlowGeometry, outerMaterial);
    
    glowPillar.add(innerGlow);
    glowPillar.add(middleGlow);
    glowPillar.add(outerGlow);
    
    // Position pillar closer to ground (overcorrecting slightly into ground)
    glowPillar.position.set(
      position.x, 
      position.y + this.PILLAR_HEIGHT / 2 - 1.0, // Lower by 1 unit to get closer to ground
      position.z
    );

    // Add both coin and pillar to scene
    this.scene.add(coinMesh);
    this.scene.add(glowPillar);

    // Calculate flyaway direction (away from player and up)
    let flyawayVelocity = new THREE.Vector3(0, 0, 0);
    if (playerPosition) {
      // Direction from player to coin
      const direction = new THREE.Vector3().subVectors(position, playerPosition).normalize();
      direction.y = 0; // Remove vertical component for horizontal direction
      direction.normalize();
      
      // Add horizontal flyaway (slower than zombie knockback)
      const horizontalSpeed = 2 + Math.random() * 2; // 2-4 units/sec
      flyawayVelocity.x = direction.x * horizontalSpeed;
      flyawayVelocity.z = direction.z * horizontalSpeed;
      
      // Add upward velocity (less than zombie)
      flyawayVelocity.y = 3 + Math.random() * 2; // 3-5 units/sec upward
    }

    // Create coin instance with random properties for variety
    const coinInstance: CoinInstance = {
      mesh: coinMesh,
      glowPillar: glowPillar,
      startTime: Date.now(),
      position: position.clone(),
      baseY: position.y,
      rotationSpeed: 2 + Math.random() * 3, // Random spin speed (2-5 rad/s)
      floatSpeed: 1 + Math.random() * 0.5, // Random float speed
      collected: false,
      // Flyaway physics
      velocity: flyawayVelocity.clone(),
      gravity: -15, // Gravity strength (less than zombie)
      landed: false
    };

    this.coins.push(coinInstance);
    console.log(`[CoinEffect] Coin created at position (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
  }

  /**
   * Update all active coins (call this in render loop)
   */
  update(deltaTime: number): void {
    const currentTime = Date.now();
    
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      const elapsed = currentTime - coin.startTime;
      
      // Remove collected coins
      if (coin.collected) {
        this.scene.remove(coin.mesh);
        this.scene.remove(coin.glowPillar);
        this.coins.splice(i, 1);
        console.log('[CoinEffect] Coin and glow pillar removed after collection');
        continue;
      }
      
      // Update rotation (spinning around Y-axis for flat coins)
      coin.mesh.rotation.y += coin.rotationSpeed * deltaTime;
      
      // Update physics if not yet landed
      if (!coin.landed) {
        // Apply gravity to velocity
        coin.velocity.y += coin.gravity * deltaTime;
        
        // Update position based on velocity
        coin.position.x += coin.velocity.x * deltaTime;
        coin.position.z += coin.velocity.z * deltaTime;
        coin.position.y += coin.velocity.y * deltaTime;
        
        // Check if coin has landed (reached ground level or below)
        if (coin.position.y <= coin.baseY) {
          coin.position.y = coin.baseY;
          coin.velocity.set(0, 0, 0); // Stop movement
          coin.landed = true;
        }
        
        // Update mesh position
        coin.mesh.position.copy(coin.position);
        
        // Update pillar position to stay centered with coin (closer to ground)
        coin.glowPillar.position.set(
          coin.position.x,
          coin.position.y + this.PILLAR_HEIGHT / 2 - 1.0,
          coin.position.z
        );
      } else {
        // Once landed, apply floating motion (up and down)
        const floatOffset = Math.sin((elapsed / 1000) * coin.floatSpeed * Math.PI * 2) * this.FLOAT_AMPLITUDE;
        coin.mesh.position.y = coin.baseY + floatOffset;
        
        // Keep pillar at ground level (don't float with coin, closer to ground)
        coin.glowPillar.position.y = coin.position.y + this.PILLAR_HEIGHT / 2 - 1.0;
      }
    }
  }

  /**
   * Check for coin collection by player and return collected coins
   */
  checkCollisions(playerPosition: THREE.Vector3, collectionRadius: number = 1.5): number {
    let collectedCount = 0;
    
    for (const coin of this.coins) {
      if (!coin.collected) {
        const distance = playerPosition.distanceTo(coin.position);
        if (distance <= collectionRadius) {
          coin.collected = true;
          collectedCount++;
          console.log(`[CoinEffect] Coin collected at distance ${distance.toFixed(2)}`);
        }
      }
    }
    
    return collectedCount;
  }

  /**
   * Clean up all coins
   */
  cleanup(): void {
    this.coins.forEach(coin => {
      this.scene.remove(coin.mesh);
      this.scene.remove(coin.glowPillar);
    });
    this.coins = [];
    console.log('[CoinEffect] All coins and glow pillars cleaned up');
  }

  /**
   * Get the number of active coins
   */
  getActiveCoinsCount(): number {
    return this.coins.length;
  }
}

// Note: Coin model will be loaded on-demand by CoinEffectManager 