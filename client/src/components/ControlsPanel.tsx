/**
 * ControlsPanel.tsx
 * 
 * Non-intrusive controls panel for gameplay:
 * - Controller icon button in top-right
 * - Hover to show controls modal
 * - Auto-shows for 7 seconds on game load
 * - Transparent overlay that doesn't block gameplay
 */

import React, { useState, useEffect } from 'react';

interface ControlsPanelProps {
  autoShowOnLoad?: boolean; // Whether to auto-show when component mounts
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  autoShowOnLoad = true
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [autoShowComplete, setAutoShowComplete] = useState(false);

  // Auto-show logic for 7 seconds when game loads
  useEffect(() => {
    if (autoShowOnLoad && !autoShowComplete) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setAutoShowComplete(true);
      }, 15000);

      return () => clearTimeout(timer);
    }
  }, [autoShowOnLoad, autoShowComplete]);

  // Handle hover states
  const handleMouseEnter = () => {
    setIsHovered(true);
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    // Only hide if auto-show is complete
    if (autoShowComplete) {
      setIsVisible(false);
    }
  };

  const controlsData = [
    { key: 'WASD', action: 'Move' },
    { key: 'Shift', action: 'Sprint' },
    { key: 'Space', action: 'Jump' },
    { key: 'Mouse', action: 'Look Around' },
    { key: 'Left Click', action: 'Attack' },
    { key: 'Right Click', action: 'Cast Spell' },
    { key: 'ESC', action: 'Unlock Mouse' },
    { key: 'Tab', action: 'Debug Panel' }
  ];

  return (
    <div 
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        pointerEvents: 'auto'
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Controller Icon Button */}
      <div
        style={{
          width: '50px',
          height: '50px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          transition: 'all 0.3s ease',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          ...(isHovered && {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderColor: 'rgba(255, 255, 255, 0.5)',
            transform: 'scale(1.05)'
          })
        }}
      >
        {/* Controller Icon (using Unicode gamepad symbol) */}
        <div
          style={{
            fontSize: '24px',
            color: 'white',
            fontWeight: 'bold',
            userSelect: 'none'
          }}
        >
          🎮
        </div>
      </div>

      {/* Controls Modal */}
      <div
        style={{
          position: 'absolute',
          top: '60px',
          right: '0',
          width: '240px',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          borderRadius: '12px',
          padding: '12px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          opacity: isVisible ? 1 : 0,
          visibility: isVisible ? 'visible' : 'hidden',
          transform: isVisible ? 'translateY(0)' : 'translateY(-10px)',
          transition: 'all 0.4s ease',
          backdropFilter: 'blur(8px)',
          pointerEvents: isVisible ? 'auto' : 'none'
        }}
      >
        {/* Header */}
        <div
          style={{
            color: 'white',
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '8px',
            textAlign: 'center',
            fontFamily: 'Newrocker, serif',
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
          }}
        >
          Game Controls
        </div>

        {/* Controls List */}
        <div style={{ marginBottom: '8px' }}>
          {controlsData.map((control, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
                padding: '3px 0'
              }}
            >
              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  padding: '2px 6px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: 'white',
                  minWidth: '70px',
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
              >
                {control.key}
              </div>
              <div
                style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: '12px',
                  fontFamily: 'Arial, sans-serif',
                  marginLeft: '8px',
                  flex: 1
                }}
              >
                {control.action}
              </div>
            </div>
          ))}
        </div>

        {/* Auto-hide indicator (only shown during initial auto-show) */}
        {isVisible && !autoShowComplete && (
          <div
            style={{
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '10px',
              fontStyle: 'italic',
              marginTop: '6px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              paddingTop: '6px'
            }}
          >
            This panel will auto-hide in a few seconds
          </div>
        )}

        {/* Hover instruction (only shown after auto-show) */}
        {autoShowComplete && (
          <div
            style={{
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '10px',
              fontStyle: 'italic',
              marginTop: '6px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              paddingTop: '6px'
            }}
          >
            Hover the controller icon to show controls
          </div>
        )}
      </div>
    </div>
  );
}; 