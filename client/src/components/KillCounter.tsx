/**
 * KillCounter.tsx
 * 
 * UI component that displays the player's zombie kill count:
 * 
 * Key functionality:
 * - Shows current kill count in the top left corner of the screen
 * - Styled to match the game's medieval fantasy theme
 * - Includes zombie skull icon for visual context
 * - Position: fixed top-left to not interfere with gameplay
 * 
 * Props:
 * - killCount: Number of zombies killed by the player
 * 
 * Technical implementation:
 * - Uses fixed positioning in top-left corner
 * - Semi-transparent background for visibility
 * - Game-themed fonts and styling
 * - Simple numeric counter with icon
 */

import React from 'react';

interface KillCounterProps {
  killCount: number;
}

export const KillCounter: React.FC<KillCounterProps> = ({ killCount }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
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
      <span style={{ fontFamily: 'HorrorTheater, serif' }}>Kill Counter </span>
      <span style={{ fontFamily: 'Arial, sans-serif' }}> &nbsp; {killCount}</span>
    </div>
  );
}; 