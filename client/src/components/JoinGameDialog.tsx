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
import { AVAILABLE_CHARACTERS } from '../characterConfigs';
import { Character3DPreview } from './Character3DPreview';

interface JoinGameDialogProps {
  onJoin: (username: string, characterClass: string, xHandle?: string) => void;
}

// Character data generated from configuration
const characters = AVAILABLE_CHARACTERS.map(characterName => ({
  name: characterName,
  image: getCharacterImage(characterName),
  description: getCharacterDescription(characterName)
}));

// Helper function to get character-specific background videos
function getCharacterVideo(characterName: string): string {
  const videoMap: Record<string, string> = {
    'Zaqir Mufasa': '/character-select-bg-1.mp4',
    'Grok Ani': '/grok-ani-background.mp4',
    'Grok Rudi': '/grok-rudi-background.mp4'
  };
  return videoMap[characterName] || '/character-select-bg-1.mp4'; // Fallback to default
}

// Helper function to get character-specific images
function getCharacterImage(characterName: string): string {
  const imageMap: Record<string, string> = {
    'Zaqir Mufasa': '/zaqir-mufasa.png',
    'Grok Ani': '/grok-ani.png',
    'Grok Rudi': '/grok-rudi.png'
  };
  return imageMap[characterName] || '/zaqir-mufasa.png'; // Fallback to default
}

// Helper function to get character descriptions
function getCharacterDescription(characterName: string): string {
  const descriptions: Record<string, string> = {
    'Zaqir Mufasa': 'x.com/jaguarsoftio',
    'Grok Ani': 'x.com/grok',
    'Grok Rudi': 'x.com/grok'
  };
  return descriptions[characterName] || 'Skilled fighter';
}

// Helper function to get character-specific profile pictures
function getCharacterProfilePicture(characterName: string): string {
  const profilePictureMap: Record<string, string> = {
    'Zaqir Mufasa': '/profile-zaqir.jpg', // Dummy profile picture file
    'Grok Ani': '/grok-pfp.jpg', // Dummy profile picture file
    'Grok Rudi': '/grok-pfp.jpg'
  };
  return profilePictureMap[characterName] || '/profile-default.png'; // Fallback to default profile pic
}

export const JoinGameDialog: React.FC<JoinGameDialogProps> = ({ onJoin }) => {
  const [username, setUsername] = useState('X-' + Math.floor(Math.random() * 100000));
  const [xHandle, setXHandle] = useState('');
  const [currentCharacterIndex, setCurrentCharacterIndex] = useState(0);
  const [showControls, setShowControls] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const finalUsername = username.trim() || `Player${Math.floor(Math.random() * 1000)}`;
    const finalXHandle = xHandle.trim() || undefined; // Convert empty string to undefined
    onJoin(finalUsername, characters[currentCharacterIndex].name, finalXHandle);
  };

  const handleControlsToggle = () => {
    setShowControls(!showControls);
  };

  const handlePreviousCharacter = () => {
    setCurrentCharacterIndex((prev) => 
      prev === 0 ? characters.length - 1 : prev - 1
    );
  };

  const handleNextCharacter = () => {
    setCurrentCharacterIndex((prev) => 
      prev === characters.length - 1 ? 0 : prev + 1
    );
  };

  return (
    <div style={styles.overlay}>
      <form style={styles.dialog} onSubmit={handleSubmit}>
        <div style={styles.titleContainer}>
          <h2 style={styles.title}>Welcome to X-Combat</h2>
        </div>
        <img 
            src="/x-statue.png" 
            alt="X Statue" 
            style={styles.statueImage}
          />
        {/* Combined Name and X Handle inputs on same line */}
        <div style={styles.inputGroup}>
          <div style={styles.doubleInputContainer}>
            <div style={styles.inputWithLabel}>
              <div style={styles.labelBox}>Name:</div>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={16} // Limit username length
                style={styles.mergedInput}
              />
            </div>
            <div style={styles.inputWithLabel}>
              <div style={styles.labelBox}>X Handle:</div>
              <input
                type="text"
                id="xhandle"
                value={xHandle}
                onChange={(e) => setXHandle(e.target.value)}
                placeholder="x.com/you"
                maxLength={32} // Limit X handle length
                style={styles.mergedInput}
              />
            </div>
          </div>
        </div>
        <div style={styles.inputGroup}>
          <label id="choose-your-fighter" style={styles.fighterLabel}>CHOOSE YOUR FIGHTER</label>
          <div style={styles.characterCarousel}>
            {/* Character info removed - now shown in 3D preview */}
            
            {/* Navigation and preview containers */}
            <div style={styles.characterNavigationContainer}>
              <button 
                type="button" 
                onClick={handlePreviousCharacter}
                style={styles.carouselArrow}
              >
                ‹
              </button>
              
              {/* Character Image Container */}
              <div style={styles.characterImageContainer}>
                <video 
                  key={characters[currentCharacterIndex].name}
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                  style={styles.characterVideoBackground}
                >
                  <source src={getCharacterVideo(characters[currentCharacterIndex].name)} type="video/mp4" />
                </video>
                <img 
                  src={characters[currentCharacterIndex].image} 
                  alt={characters[currentCharacterIndex].name}
                  style={styles.characterImage}
                />
                
                {/* Character Info Overlay */}
                <div style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  textAlign: 'center',
                  color: 'white',
                  fontFamily: 'Newrocker, serif',
                  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
                  zIndex: 15,
                  pointerEvents: 'none'
                }}>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    marginBottom: '4px'
                  }}>
                    {characters[currentCharacterIndex].name}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    opacity: 0.9,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    justifyContent: 'center'
                  }}>
                    <img 
                      src={getCharacterProfilePicture(characters[currentCharacterIndex].name)}
                      alt={`${characters[currentCharacterIndex].name} Profile`}
                      style={styles.characterProfilePicture}
                    />
                    {characters[currentCharacterIndex].description}
                  </div>
                </div>
              </div>
              
              {/* 3D Model Preview Container */}
              <div style={styles.character3DContainer}>
                <Character3DPreview 
                  characterName={characters[currentCharacterIndex].name}
                />
              </div>
              
              <button 
                type="button" 
                onClick={handleNextCharacter}
                style={styles.carouselArrow}
              >
                ›
              </button>
            </div>
          </div>
        </div>
        <button type="submit" style={styles.button}>Join the Map</button>
        <button type="button" onClick={handleControlsToggle} style={{...styles.button, ...styles.controlsButtonMargin}}>
          Controls
        </button>
      </form>
      
      {/* Controls Modal */}
      {showControls && (
        <div style={{...styles.overlay, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
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
              <div style={styles.controlItem}>
                <span style={styles.controlKey}>C:</span>
                <span style={styles.controlDescription}>Toggle Camera Mode</span>
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
    zIndex: 1000,
  },
  dialog: {
    backgroundImage: 'url(/papyrus-texture-3.webp)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    padding: '0px',
    borderRadius: '0px',
    border: 'none',
    boxShadow: 'none',
    color: '#2F1B14',
    width: '100vw',
    height: '100vh',
    textAlign: 'center',
    fontFamily: 'Newrocker, serif',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: '20px',
    overflow: 'auto',
    paddingBottom: '60px',
    boxSizing: 'border-box',
  },
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    marginBottom: '-40px',
    flexWrap: 'wrap',
  },
  title: {
    fontFamily: 'KnightsQuest, serif',
    fontSize: '38px',
    fontWeight: 'bold',
    marginBottom: '0px',
    color: '#2F1B14',
    textShadow: '1px 1px 2px rgba(139, 69, 19, 0.3)',
  },
  statueImage: {
    position: 'relative',
    top: '15px',
    filter: 'drop-shadow(4px 4px 4px black)',
    width: '60px',
    height: '60px',
    objectFit: 'contain' as const,
  },
  inputGroup: {
    marginBottom: '0px',
    margin: 'auto',
    textAlign: 'left',
    width: '100%',
    maxWidth: '600px',
  },
  label: {
    display: 'block',
    marginBottom: '0px',
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
    marginBottom: '-15px',
    width: '50%',
    maxWidth: '300px',
    border: '2px solid #654321',
    borderRadius: '4px',
    backgroundImage: 'url(/stone-texture-3.jpg)',
    backgroundSize: '100%',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    color: '#F5F5DC',
    fontSize: '22px',
    fontFamily: 'KnightsQuest, serif',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
  },
  controlsButtonMargin: {
    marginTop: '15px',
    marginBottom: '20px',
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
    width: '90%',
    maxWidth: '500px',
    maxHeight: '80vh',
    textAlign: 'center',
    fontFamily: 'Newrocker, serif',
    overflow: 'auto',
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
    minWidth: '120px',
  },
  controlDescription: {
    fontFamily: 'Newrocker, serif',
    color: '#5D4037',
    fontSize: '18px',
    flex: 1,
    textAlign: 'right',
  },
  characterCarousel: {
    position: 'relative',
    backgroundColor: 'rgba(245, 245, 220, 0.9)',
    border: '2px solid #8B4513',
    borderRadius: '8px',
    height: '600px',
    width: '100%',
    maxWidth: '1000px', // Wider to accommodate both preview boxes
    padding: '20px',
  },
  carouselArrow: {
    background: 'none',
    border: 'none',
    color: '#654321',
    fontSize: '40px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    padding: '10px',
    userSelect: 'none',
    minWidth: '60px',
  },

  characterImage: {
    width: '260px',
    height: '450px',
    objectFit: 'cover' as const,
    position: 'relative',
    zIndex: 2,
    filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 20px rgba(255, 255, 255, 0.6)) drop-shadow(0 0 30px rgba(255, 255, 255, 0.4))',
  },
  characterVideoBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    zIndex: 1,
  },
  characterInfo: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    textAlign: 'left',
    gap: '8px',
    zIndex: 10,
  },
  characterName: {
    fontFamily: 'Newrocker, serif',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#2F1B14',
    marginBottom: '5px',
    textShadow: '1px 1px 2px rgba(139, 69, 19, 0.3)',
  },
  characterDescription: {
    fontFamily: 'Newrocker, serif',
    fontSize: '14px',
    color: '#5D4037',
    fontStyle: 'italic',
  },
  characterNavigationContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    height: '100%',
    minHeight: '240px',
  },
  characterImageContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '280px',
    width: '280px',
    height: '450px',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '12px',
    border: '4px solid #8B4513',
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4)',
  },
  character3DContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '280px',
    width: '280px',
    height: '450px',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '12px',
    border: '4px solid #8B4513',
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4)',
    backgroundColor: 'rgba(0, 0, 0, 0.8)', // Dark background for better contrast
  },
  doubleInputContainer: {
    display: 'flex',
    gap: '60px',
    paddingLeft: '40px',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWithLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0px',
    width: '100%',
  },
  inlineLabel: {
    fontFamily: 'Newrocker, serif',
    fontWeight: 'bold',
    color: '#5D4037',
    fontSize: '14px',
  },
  separator: {
    width: '1px',
    height: '20px',
    backgroundColor: '#5D4037',
  },
  inlineInput: {
    flex: 1,
    width: 'calc(100% - 20px)',
    padding: '10px',
    border: '2px solid #8B4513',
    borderRadius: '4px',
    backgroundColor: 'rgba(245, 245, 220, 0.9)',
    color: '#2F1B14',
    fontSize: '16px',
    fontFamily: 'Newrocker, serif',
  },
  labelBox: {
    fontFamily: 'Newrocker, serif',
    fontWeight: 'bold',
    color: '#5D4037',
    fontSize: '14px',
    padding: '10px',
    border: '2px solid #8B4513',
    borderRadius: '4px 0 0 4px',
    backgroundColor: 'rgba(245, 245, 220, 0.9)',
    minWidth: '80px',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mergedInput: {
    flex: 1,
    padding: '10px',
    border: '2px solid #8B4513',
    borderLeft: 'none',
    borderRadius: '0 4px 4px 0',
    backgroundColor: 'rgba(245, 245, 220, 0.9)',
    color: '#2F1B14',
    fontSize: '16px',
    fontFamily: 'Newrocker, serif',
  },
  characterProfilePicture: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '1px solid grey',
    objectFit: 'cover',
    flexShrink: 0, // Prevent shrinking
  },
};

// Add hover effect dynamically if needed, or use CSS classes
// button:hover style: { backgroundColor: '#357abd' }
