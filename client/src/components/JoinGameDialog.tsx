/**
 * JoinGameDialog.tsx
 * 
 * Entry point component for the multiplayer game experience:
 * 
 * Key functionality:
 * - Provides a UI for player name entry and character selection
 * - Validates user input before allowing game entry
 * - Displays character class options with visual previews
 * - Handles initial connection to the game server
 * - Manages the transition from lobby to active gameplay
 * 
 * Props:
 * - onJoinGame: Callback function that passes player information to parent component
 * - isOpen: Boolean to control dialog visibility
 * - onClose: Function to handle dialog dismissal
 * 
 * Technical implementation:
 * - Uses Chakra UI components for responsive, accessible interface
 * - Implements form validation for player information
 * - Includes character preview displays using Three.js
 * - Manages component state for selection process
 * 
 * Related files:
 * - GameScene.tsx: Main game environment that loads after joining
 * - Player.tsx: Character implementation that uses selected options
 * - PlayerClassPreview.tsx: Visual preview of selectable characters
 */

import React, { useState, Suspense } from 'react';

interface JoinGameDialogProps {
  onJoin: (username: string, characterClass: string) => void;
}

export const JoinGameDialog: React.FC<JoinGameDialogProps> = ({ onJoin }) => {
  const [username, setUsername] = useState('Adventurer');
  const [characterClass, setCharacterClass] = useState('Wizard');
  const [showControls, setShowControls] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const finalUsername = username.trim() || `Player${Math.floor(Math.random() * 1000)}`;
    onJoin(finalUsername, characterClass);
  };

  const handleControlsToggle = () => {
    setShowControls(!showControls);
  };

  return (
    <div style={styles.overlay}>
      <form style={styles.dialog} onSubmit={handleSubmit}>
        <h2 style={styles.title}>Welcome to XCombat</h2>
        <div style={styles.inputGroup}>
          <label htmlFor="username" style={styles.label}>Character Name:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={16} // Limit username length
            style={styles.input}
          />
        </div>
        <div style={styles.inputGroup}>
          <label htmlFor="characterClass" style={styles.label}>Class:</label>
          <select
            id="characterClass"
            value={characterClass}
            onChange={(e) => setCharacterClass(e.target.value)}
            style={styles.select}
          >
            <option value="Wizard">Wizard</option>
            <option value="Paladin">Paladin</option>
            {/* Add more classes later */}
          </select>
        </div>
        <button type="submit" style={styles.button}>Join the Map</button><br/>
        <button type="button" onClick={handleControlsToggle} style={{...styles.button, ...styles.controlsButtonMargin}}>
          Controls
        </button>
      </form>
      
      {/* Controls Modal */}
      {showControls && (
        <div style={styles.overlay}>
          <div style={styles.controlsDialog}>
            <h2 style={styles.title}>Controls</h2>
            <div style={styles.controlsList}>
              <div style={styles.controlItem}>
                <span style={styles.controlKey}>WASD:</span>
                <span style={styles.controlDescription}>Movement</span>
              </div>
              <div style={styles.controlItem}>
                <span style={styles.controlKey}>Shift:</span>
                <span style={styles.controlDescription}>Sprint</span>
              </div>
              <div style={styles.controlItem}>
                <span style={styles.controlKey}>Space:</span>
                <span style={styles.controlDescription}>Jump</span>
              </div>
              <div style={styles.controlItem}>
                <span style={styles.controlKey}>Left Click:</span>
                <span style={styles.controlDescription}>Attack</span>
              </div>
              <div style={styles.controlItem}>
                <span style={styles.controlKey}>Mouse:</span>
                <span style={styles.controlDescription}>Look around</span>
              </div>
              <div style={styles.controlItem}>
                <span style={styles.controlKey}>Mouse Wheel:</span>
                <span style={styles.controlDescription}>Zoom</span>
              </div>
            </div>
            <button onClick={handleControlsToggle} style={styles.button}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
};

// Styles for the dialog
const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 1)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  dialog: {
    backgroundImage: 'url(/papyrus-texture-3.webp)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    padding: '30px',
    borderRadius: '8px',
    border: '3px solid #8B4513',
    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)',
    color: '#2F1B14',
    width: '350px',
    textAlign: 'center',
    fontFamily: 'Newrocker, serif',
  },
  title: {
    fontFamily: 'KnightsQuest, serif',
    fontSize: '38px',
    fontWeight: 'bold',
    marginBottom: '25px',
    color: '#2F1B14',
    textShadow: '1px 1px 2px rgba(139, 69, 19, 0.3)',
  },
  inputGroup: {
    marginBottom: '20px',
    textAlign: 'left',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    color: '#5D4037',
    fontSize: '14px',
    fontFamily: 'Newrocker, serif',
    fontWeight: 'bold',
  },
  input: {
    width: 'calc(100% - 20px)',
    padding: '10px',
    border: '2px solid #8B4513',
    borderRadius: '4px',
    backgroundColor: 'rgba(245, 245, 220, 0.9)',
    color: '#2F1B14',
    fontSize: '16px',
    fontFamily: 'Newrocker, serif',
  },
  select: {
     width: '100%',
     padding: '10px',
     border: '2px solid #8B4513',
     borderRadius: '4px',
     backgroundColor: 'rgba(245, 245, 220, 0.9)',
     color: '#2F1B14',
     fontSize: '16px',
     fontFamily: 'Newrocker, serif',
  },
  button: {
    padding: '12px 25px',
    width: '50%',
    border: '2px solid #654321',
    borderRadius: '4px',
    backgroundImage: 'url(/stone-texture-3.jpg)',
    backgroundSize: '100%',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    color: '#F5F5DC',
    fontSize: '22px',
    // fontFamily: 'Newrocker, serif',
    fontFamily: 'KnightsQuest, serif',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    // textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
  },
  controlsButtonMargin: {
    marginTop: '10px',
  },
  controlsDialog: {
    backgroundImage: 'url(/papyrus-texture-3.webp)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    padding: '30px',
    borderRadius: '8px',
    border: '3px solid #8B4513',
    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)',
    color: '#2F1B14',
    width: '400px',
    textAlign: 'center',
    fontFamily: 'Newrocker, serif',
  },
  controlsList: {
    marginBottom: '25px',
    textAlign: 'left',
  },
  controlItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    padding: '8px 0',
    borderBottom: '1px solid rgba(139, 69, 19, 0.3)',
  },
  controlKey: {
    fontFamily: 'Newrocker, serif',
    fontWeight: 'bold',
    color: '#654321',
    fontSize: '18px',
    minWidth: '100px',
  },
  controlDescription: {
    fontFamily: 'Newrocker, serif',
    color: '#5D4037',
    fontSize: '18px',
    flex: 1,
    textAlign: 'right',
  },
};

// Add hover effect dynamically if needed, or use CSS classes
// button:hover style: { backgroundColor: '#357abd' }
