/**
 * ComboCounter.tsx
 * 
 * UI component that displays the player's zombie hit combo count:
 * 
 * Key functionality:
 * - Shows combo count when player hits 2+ zombies within 2 seconds of each other
 * - Displays "COMBO! x{count}" text above the player's name tag
 * - Shows named combo underneath the counter for combos 2-12+ with specific names
 * - Appears when second zombie is hit, fades after 1 second
 * - Uses game-themed fonts matching the kill counter
 * - Includes shaking animation for the number
 * 
 * Props:
 * - comboCount: Number of consecutive zombie hits
 * - playerRef: Reference to the local player's 3D object for positioning
 * 
 * Technical implementation:
 * - Uses React Three Fiber Html for rendering in 3D space
 * - Positioned above player character using useFrame for tracking
 * - CSS animations for shake effect and fade transitions
 * - Only visible when comboCount >= 2
 */

import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { PlayerData } from '../generated';

interface ComboCounterProps {
  comboCount: number;
  localPlayer: PlayerData | null;
}

// Combo names dictionary
const COMBO_NAMES: Record<number, string> = {
  2: 'BACK TO BACK',
  3: 'TRIPLE STRIKE',
  4: 'AGILITY',
  5: 'RAMPAGE',
  6: 'NINJA AGILITY',
  7: 'LUCKY SEVEN',
  8: 'PRECISION ASASSIN',
  9: 'SERIAL KILLER',
  10: 'INSANITY STRIKE',
  11: 'SNAKE EYES',
  12: 'ULTRA STRIKER'
};

// Function to get combo name
const getComboName = (count: number): string => {
  if (count >= 13) {
    return 'ABSOLUTE DESTRUCTION';
  }
  return COMBO_NAMES[count] || '';
};

export const ComboCounter: React.FC<ComboCounterProps> = ({
  comboCount,
  localPlayer
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [displayCount, setDisplayCount] = useState(0);
  const positionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 4, 0)); // Start above player

  // Show/hide logic based on combo count
  useEffect(() => {
    if (comboCount >= 2) {
      setDisplayCount(comboCount);
      setIsVisible(true);
      
      // Hide after 4 seconds (increased from 2 seconds)
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 4000);
      
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [comboCount]);

  // Track player position and update combo counter position
  useFrame(() => {
    if (localPlayer && isVisible) {
      // Position combo counter above player (lower than before, closer to name tag)
      positionRef.current.set(
        localPlayer.position.x,
        localPlayer.position.y + 2.8, // 2.8 units above player (closer to name tag)
        localPlayer.position.z
      );
    }
  });

  // Don't render if not visible
  if (!isVisible || comboCount < 2) {
    return null;
  }

  const comboName = getComboName(displayCount);

  return (
    <Html
      position={[positionRef.current.x, positionRef.current.y, positionRef.current.z]}
      center
      style={{
        pointerEvents: 'none',
        userSelect: 'none'
      }}
    >
      <div 
        className={`combo-counter ${isVisible ? 'combo-visible' : 'combo-hidden'}`}
        style={{
          textAlign: 'center',
          whiteSpace: 'nowrap'
        }}
      >
        <div>
          <span className="combo-text">COMBO </span>
          <span className="combo-number">x{displayCount}</span>
        </div>
        {comboName && (
          <div 
            className="combo-name"
            style={{
              fontFamily: 'HorrorTheater, serif',
              fontSize: '24px',
              color: 'black',
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(255, 0, 0, 0.8)',
              marginTop: '5px'
            }}
          >
            {comboName}
          </div>
        )}
      </div>
    </Html>
  );
}; 