/**
 * Screenshake utility for adding impact effects to the game
 * 
 * Provides functions to trigger camera shake effects when zombies are hit,
 * making attacks feel more powerful and impactful.
 */

import * as THREE from 'three';

export interface ScreenshakeConfig {
  intensity: number;     // How strong the shake is (units)
  duration: number;      // How long the shake lasts (ms)
  frequency: number;     // How fast the shake oscillates (Hz)
  decay: number;         // How quickly the shake fades (0-1)
}

// Default screenshake settings
const DEFAULT_CONFIG: ScreenshakeConfig = {
  intensity: 0.07,       // Moderate shake
  duration: 60,         // 300ms shake
  frequency: 0.3,        // 4.3Hz oscillation (30/7 = slower movement)
  decay: 0.95            // Quick fade
};

// Screenshake state
let isShaking = false;
let shakeStartTime = 0;
let shakeConfig: ScreenshakeConfig = { ...DEFAULT_CONFIG };
let originalCameraPosition: THREE.Vector3 | null = null;

/**
 * Triggers a screenshake effect
 * @param camera - The Three.js camera to shake
 * @param config - Optional configuration for the shake
 */
export function triggerScreenshake(camera: THREE.Camera, config?: Partial<ScreenshakeConfig>) {
  // Merge with default config
  shakeConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Store original camera position if not already shaking
  if (!isShaking && camera.position) {
    originalCameraPosition = camera.position.clone();
  }
  
  // Start the shake
  isShaking = true;
  shakeStartTime = Date.now();
  
  console.log(`[Screenshake] Triggered with intensity: ${shakeConfig.intensity}, duration: ${shakeConfig.duration}ms`);
}

/**
 * Updates the screenshake effect (call this in your render loop)
 * @param camera - The Three.js camera to update
 * @param deltaTime - Time since last frame (seconds)
 */
export function updateScreenshake(camera: THREE.Camera, deltaTime: number) {
  if (!isShaking || !originalCameraPosition) return;
  
  const currentTime = Date.now();
  const elapsed = currentTime - shakeStartTime;
  
  // Check if shake duration has expired
  if (elapsed >= shakeConfig.duration) {
    // End the shake, restore original position
    camera.position.copy(originalCameraPosition);
    isShaking = false;
    originalCameraPosition = null;
    return;
  }
  
  // Calculate shake progress (0 to 1)
  const progress = elapsed / shakeConfig.duration;
  
  // Calculate current intensity with decay
  const currentIntensity = shakeConfig.intensity * Math.pow(shakeConfig.decay, elapsed / 100);
  
  // Generate random shake offset
  const time = elapsed / 1000; // Convert to seconds
  const shakeX = Math.sin(time * shakeConfig.frequency * 2 * Math.PI) * currentIntensity * (Math.random() - 0.5) * 2;
  const shakeY = Math.cos(time * shakeConfig.frequency * 2 * Math.PI) * currentIntensity * (Math.random() - 0.5) * 2;
  const shakeZ = Math.sin(time * shakeConfig.frequency * 1.5 * Math.PI) * currentIntensity * (Math.random() - 0.5) * 2;
  
  // Apply shake offset to camera
  camera.position.copy(originalCameraPosition);
  camera.position.add(new THREE.Vector3(shakeX, shakeY, shakeZ));
}

/**
 * Stops any active screenshake and restores camera position
 * @param camera - The Three.js camera to restore
 */
export function stopScreenshake(camera: THREE.Camera) {
  if (isShaking && originalCameraPosition) {
    camera.position.copy(originalCameraPosition);
  }
  
  isShaking = false;
  originalCameraPosition = null;
}

/**
 * Checks if screenshake is currently active
 */
export function isScreenshakeActive(): boolean {
  return isShaking;
}

// Preset configurations for different impact types
export const SCREENSHAKE_PRESETS = {
  LIGHT: {
    intensity: 0.08,
    duration: 200,
    frequency: 3.6,        // 25/7 = slower movement
    decay: 0.96
  },
  MEDIUM: {
    intensity: 0.15,
    duration: 300,
    frequency: 4.3,        // 30/7 = slower movement
    decay: 0.95
  },
  HEAVY: {
    intensity: 0.25,
    duration: 500,
    frequency: 5.0,        // 35/7 = slower movement
    decay: 0.93
  },
  COMBO: {
    intensity: 0.20,
    duration: 400,
    frequency: 5.7,        // 40/7 = slower movement
    decay: 0.94
  }
}; 