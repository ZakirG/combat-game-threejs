/**
 * MaxComboCounter.tsx
 * 
 * UI component that displays the player's maximum zombie combo count:
 * 
 * Key functionality:
 * - Shows highest combo count achieved by the player
 * - Positioned underneath the kill counter in the top left corner
 * - Styled to match the kill counter with same fonts and effects
 * - Animated scaling effect when max combo count increments
 * 
 * Props:
 * - maxComboCount: Highest number of consecutive zombie hits achieved
 * 
 * Technical implementation:
 * - Uses fixed positioning below kill counter
 * - Same styling as kill counter for consistency
 * - CSS transition-based scaling animation on increment
 * - Label uses HorrorTheater font, number uses Arial font
 */

import React, { useState, useEffect } from 'react';

interface MaxComboCounterProps {
  maxComboCount: number;
}

export const MaxComboCounter: React.FC<MaxComboCounterProps> = ({ maxComboCount }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevMaxComboCount, setPrevMaxComboCount] = useState(maxComboCount);

  // Trigger animation when max combo count increases
  useEffect(() => {
    if (maxComboCount > prevMaxComboCount) {
      setIsAnimating(true);
      
      // Reset animation after a short duration
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 300); // Animation duration in milliseconds
      
      return () => clearTimeout(timer);
    }
    setPrevMaxComboCount(maxComboCount);
  }, [maxComboCount, prevMaxComboCount]);

  return (
    <div
      style={{
        position: 'fixed',
        top: '50px', // Positioned below kill counter (20px + ~30px for kill counter height)
        left: '20px',
        color: 'black',
        fontSize: '24px',
        fontWeight: 'bold',
        zIndex: 1100, // Higher than other UI elements
        userSelect: 'none',
        pointerEvents: 'none', // Don't interfere with game controls
        textShadow: '2px 2px 4px rgba(255, 0, 0, 0.8)' // Red drop shadow
      }}
    >
      <span style={{ fontFamily: 'HorrorTheater, serif' }}>MAX COMBO </span>
      <span 
        style={{ 
          fontFamily: 'Arial, sans-serif',
          display: 'inline-block',
          transform: isAnimating ? 'scale(1.5)' : 'scale(1)',
          transition: 'transform 0.15s cubic-bezier(0.68, -0.55, 0.265, 1.55)', // Bounce-like easing
          transformOrigin: 'center'
        }}
      > 
        &nbsp; {maxComboCount}
      </span>
    </div>
  );
}; 