/**
 * WeaponPanel.tsx
 * 
 * UI panel that displays the player's current weapon state:
 * - Shows fists icon for unarmed mode
 * - Shows sword icon for sword mode (only after sword is obtained)
 * - Highlights current weapon with green border
 */

import React from 'react';

interface WeaponPanelProps {
  currentWeapon: 'UNARMED' | 'SWORD';
  hasSword: boolean; // Whether the player has obtained a sword
}

export const WeaponPanel: React.FC<WeaponPanelProps> = ({ 
  currentWeapon, 
  hasSword 
}) => {
  const iconSize = 35;
  const borderWidth = 2;

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: '8px',
    padding: '8px',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    zIndex: 1400,
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(6px)'
  };

  const iconStyle: React.CSSProperties = {
    width: iconSize,
    height: iconSize,
    borderRadius: '6px',
    transition: 'all 0.3s ease',
    cursor: 'default',
    display: 'block'
  };

  const getIconBorder = (weaponType: 'UNARMED' | 'SWORD'): React.CSSProperties => {
    const isActive = currentWeapon === weaponType;
    return {
      border: isActive 
        ? `${borderWidth}px solid #00ff00` 
        : `${borderWidth}px solid transparent`,
      boxShadow: isActive 
        ? '0 0 6px rgba(0, 255, 0, 0.6)' 
        : 'none'
    };
  };

  return (
    <div style={panelStyle}>
      {/* Fists Icon - Always Present */}
      <div style={{ position: 'relative' }}>
        <img
          src="/fists.png"
          alt="Unarmed"
          style={{
            ...iconStyle,
            ...getIconBorder('UNARMED')
          }}
          onError={(e) => {
            // Fallback if image doesn't exist
            (e.target as HTMLImageElement).style.display = 'none';
            console.warn('Fists icon not found at /fists.png');
          }}
        />
        {/* Fallback text if image fails to load */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: iconSize,
            height: iconSize,
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(100, 100, 100, 0.8)',
            borderRadius: '6px',
            color: 'white',
            fontSize: '18px',
            ...getIconBorder('UNARMED')
          }}
          className="fists-fallback"
        >
          👊
        </div>
      </div>

      {/* Sword Icon - Only Show if Player Has Obtained Sword */}
      {hasSword && (
        <div style={{ position: 'relative' }}>
          <img
            src="/sword.png"
            alt="Sword"
            style={{
              ...iconStyle,
              ...getIconBorder('SWORD')
            }}
            onError={(e) => {
              // Fallback if image doesn't exist
              (e.target as HTMLImageElement).style.display = 'none';
              console.warn('Sword icon not found at /sword.png');
            }}
          />
          {/* Fallback text if image fails to load */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: iconSize,
              height: iconSize,
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(100, 100, 100, 0.8)',
              borderRadius: '6px',
              color: 'white',
              fontSize: '18px',
              ...getIconBorder('SWORD')
            }}
            className="sword-fallback"
          >
            ⚔️
          </div>
        </div>
      )}
    </div>
  );
};

// Add CSS for fallback handling
const style = document.createElement('style');
style.textContent = `
  img[src="/fists.png"]:not([style*="display: none"]) + .fists-fallback {
    display: none !important;
  }
  img[src="/fists.png"][style*="display: none"] + .fists-fallback {
    display: flex !important;
  }
  img[src="/sword.png"]:not([style*="display: none"]) + .sword-fallback {
    display: none !important;
  }
  img[src="/sword.png"][style*="display: none"] + .sword-fallback {
    display: flex !important;
  }
`;
document.head.appendChild(style); 