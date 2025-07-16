/**
 * Audio Utilities
 * 
 * Simple audio system for playing sound effects in the game.
 * Provides volume control and sound loading functionality.
 */

// Configurable volume settings - easy to adjust
export const AUDIO_VOLUMES = {
  BLOOD_SPURT: 0, // Adjust this value to change blood spurt sound volume (0.0 to 1.0)
  MASTER: 1.0,      // Master volume multiplier
};

/**
 * Plays a sound effect from the public folder
 * @param soundPath - Path to sound file relative to public folder (e.g., 'blood-spurt-sound-short.mp3')
 * @param volume - Volume level (0.0 to 1.0), will be multiplied by master volume
 */
export function playSound(soundPath: string, volume: number = 1.0): void {
  try {
    const audio = new Audio(`/${soundPath}`);
    audio.volume = Math.min(1.0, Math.max(0.0, volume * AUDIO_VOLUMES.MASTER));
    
    // Play the sound
    const playPromise = audio.play();
    
    // Handle play promise (required for some browsers)
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log(`[Audio] 🔊 Playing sound: ${soundPath} at volume ${audio.volume.toFixed(2)}`);
        })
        .catch(error => {
          console.warn(`[Audio] ⚠️ Failed to play sound: ${soundPath}`, error);
        });
    }
  } catch (error) {
    console.error(`[Audio] ❌ Error loading sound: ${soundPath}`, error);
  }
}

/**
 * Plays the blood spurt sound effect
 */
export function playBloodSpurtSound(): void {
  playSound('blood-spurt-sound-short.mp3', AUDIO_VOLUMES.BLOOD_SPURT);
}

/**
 * Updates the blood spurt volume (useful for runtime adjustments)
 * @param newVolume - New volume level (0.0 to 1.0)
 */
export function setBloodSpurtVolume(newVolume: number): void {
  AUDIO_VOLUMES.BLOOD_SPURT = Math.min(1.0, Math.max(0.0, newVolume));
  console.log(`[Audio] 🔊 Blood spurt volume set to: ${AUDIO_VOLUMES.BLOOD_SPURT}`);
}

/**
 * Updates the master volume (affects all sounds)
 * @param newVolume - New master volume level (0.0 to 1.0)
 */
export function setMasterVolume(newVolume: number): void {
  AUDIO_VOLUMES.MASTER = Math.min(1.0, Math.max(0.0, newVolume));
  console.log(`[Audio] 🔊 Master volume set to: ${AUDIO_VOLUMES.MASTER}`);
} 