/**
 * Blood Effect System
 * 
 * Creates particle-based blood spurt effects when zombies are hit.
 * The blood explosion appears at the zombie's position but doesn't move with the zombie.
 * 
 * Features:
 * - Particle-based blood spurts with random directions
 * - Gravity simulation for realistic falling blood
 * - Fade-out animation over time
 * - Dark brownish-red blood color
 * - Cleanup when animation completes
 * - Global toggle to enable/disable effects
 */

// GLOBAL TOGGLE - Set to false to disable all blood effects
export const BLOOD_EFFECTS_ENABLED = true;

import * as THREE from 'three';

interface BloodSpurtConfig {
  particleCount: number;
  size: number;
  color: number;
  fadeSpeed: number;
  initialSpeed: number;
  gravity: number;
  duration: number;
}

const DEFAULT_CONFIG: BloodSpurtConfig = {
  particleCount: 120, // 1.5x more particles (80 * 1.5 = 120)
  size: 0.06, // Back to bigger particles
  color: 0x8B0000, // Darker red (was dark brownish-red)
  fadeSpeed: 2.0,
  initialSpeed: 2.5,
  gravity: 10.0,
  duration: 2.0
};

interface ActiveBloodSpurt {
  points: THREE.Points;
  velocities: THREE.Vector3[];
  startTime: number;
  config: BloodSpurtConfig;
}

class BloodEffectManager {
  private scene: THREE.Scene;
  private activeSpurts: ActiveBloodSpurt[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Creates a blood spurt effect at the specified position
   */
  createBloodSpurt(position: THREE.Vector3, config: Partial<BloodSpurtConfig> = {}): void {
    // Check global toggle - early return if disabled
    if (!BLOOD_EFFECTS_ENABLED) {
      console.log(`[BloodEffect] 🩸 Blood effects disabled globally - skipping spurt creation`);
      return;
    }
    
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    
    // Create three separate particle systems for different colors
    const colors = [
      { color: 0xFF0000, name: 'bright red', count: Math.floor(finalConfig.particleCount * 0.4) }, // 40% bright red
      { color: 0x8B0000, name: 'dark red', count: Math.floor(finalConfig.particleCount * 0.35) }, // 35% dark red
      { color: 0x8B4513, name: 'brown', count: Math.floor(finalConfig.particleCount * 0.25) } // 25% brown
    ];

    colors.forEach((colorConfig, index) => {
      // Create particle geometry for this color
      const positions = new Float32Array(colorConfig.count * 3);
      const velocities: THREE.Vector3[] = [];

      // Initialize particles at the impact position with random velocities
      for (let i = 0; i < colorConfig.count; i++) {
        // Start all particles at the same position
        positions[i * 3 + 0] = position.x;
        positions[i * 3 + 1] = position.y;
        positions[i * 3 + 2] = position.z;

        // Create random velocity for each particle
        const angle = Math.random() * Math.PI * 2; // Random horizontal angle
        const elevation = Math.random() * Math.PI * 0.3; // Slight upward angle (0-54 degrees)
        const speed = Math.random() * finalConfig.initialSpeed + 1;

        velocities.push(new THREE.Vector3(
          Math.cos(angle) * Math.cos(elevation) * speed,
          Math.sin(elevation) * speed + Math.random() * 2, // Add some upward velocity
          Math.sin(angle) * Math.cos(elevation) * speed
        ));
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      // Create material for blood particles with specific color
      const material = new THREE.PointsMaterial({
        size: finalConfig.size,
        color: colorConfig.color, // Use specific color for this particle system
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
        blending: THREE.NormalBlending,
        sizeAttenuation: true
      });

      // Create points object
      const bloodSpurt = new THREE.Points(geometry, material);
      this.scene.add(bloodSpurt);

      // Add to active spurts for animation
      this.activeSpurts.push({
        points: bloodSpurt,
        velocities,
        startTime: Date.now(),
        config: finalConfig
      });

      console.log(`[BloodEffect] 🩸 ${colorConfig.name} blood spurt created with ${colorConfig.count} particles`);
    });

    console.log(`[BloodEffect] 🩸 Total blood spurt created at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}) with ${finalConfig.particleCount} particles`);
  }

  /**
   * Updates all active blood spurts - call this in your render loop
   */
  update(deltaTime: number): void {
    const currentTime = Date.now();

    // Update each active spurt
    for (let i = this.activeSpurts.length - 1; i >= 0; i--) {
      const spurt = this.activeSpurts[i];
      const elapsed = (currentTime - spurt.startTime) / 1000; // Convert to seconds

      // Check if spurt should be removed
      if (elapsed >= spurt.config.duration) {
        this.removeSpurt(i);
        continue;
      }

      // Update particle positions
      const positions = spurt.points.geometry.attributes.position.array as Float32Array;
      
      for (let j = 0; j < spurt.velocities.length; j++) {
        const velocity = spurt.velocities[j];
        
        // Update position based on velocity
        positions[j * 3 + 0] += velocity.x * deltaTime;
        positions[j * 3 + 1] += velocity.y * deltaTime;
        positions[j * 3 + 2] += velocity.z * deltaTime;

        // Apply gravity
        velocity.y -= spurt.config.gravity * deltaTime;
      }

      // Update opacity (fade out over time)
      const fadeProgress = elapsed / spurt.config.duration;
      (spurt.points.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - fadeProgress * spurt.config.fadeSpeed);

      // Mark geometry as needing update
      spurt.points.geometry.attributes.position.needsUpdate = true;
    }
  }

  /**
   * Removes a blood spurt from the scene and active list
   */
  private removeSpurt(index: number): void {
    const spurt = this.activeSpurts[index];
    this.scene.remove(spurt.points);
    spurt.points.geometry.dispose();
    (spurt.points.material as THREE.Material).dispose();
    this.activeSpurts.splice(index, 1);
    console.log(`[BloodEffect] 🧹 Blood spurt cleaned up (${this.activeSpurts.length} remaining)`);
  }

  /**
   * Clean up all active blood spurts
   */
  cleanup(): void {
    while (this.activeSpurts.length > 0) {
      this.removeSpurt(0);
    }
  }

  /**
   * Get the number of active blood spurts
   */
  getActiveSpurtCount(): number {
    return this.activeSpurts.length;
  }
}

// Export the manager class and configuration interface
export { BloodEffectManager, type BloodSpurtConfig };

// Utility function to create a blood effect at a specific position
export function createBloodSpurtAt(
  scene: THREE.Scene, 
  position: THREE.Vector3, 
  config?: Partial<BloodSpurtConfig>
): void {
  // Check global toggle - early return if disabled
  if (!BLOOD_EFFECTS_ENABLED) {
    console.log(`[BloodEffect] 🩸 Blood effects disabled globally - skipping utility spurt creation`);
    return;
  }
  
  const manager = new BloodEffectManager(scene);
  manager.createBloodSpurt(position, config);
} 