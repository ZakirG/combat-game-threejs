/**
 * LoadingScreen.tsx
 * 
 * Simple loading screen displayed after clicking "Join the Map":
 * 
 * Key functionality:
 * - Shows while character model and zombie models are loading
 * - Clean minimal design with animated loading bar
 * - Flash-game style loading bar with animated stripes
 * - Displays overall progress
 * - Hides once GameReady event is triggered
 * 
 * Props:
 * - isVisible: Controls loading screen visibility
 * - characterProgress: Progress of character model loading (0-100)
 * - zombieProgress: Progress of zombie spawning (0-100)
 */

import React, { useState, useEffect } from 'react';

interface LoadingScreenProps {
  isVisible: boolean;
  characterProgress: number; // 0-100
  zombieProgress: number; // 0-100
  characterStatus: string;
  zombieStatus: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  isVisible,
  characterProgress,
  zombieProgress,
}) => {
  const [dots, setDots] = useState('');

  // Animate the dots
  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  const overallProgress = Math.round((characterProgress + zombieProgress) / 2);

  const styles = {
    overlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundImage: 'url(/papyrus-texture-3.webp)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      zIndex: 2000,
    },
    panel: {
      backgroundColor: 'rgba(245, 245, 220, 0.9)',
      border: '2px solid #8B4513',
      borderRadius: '8px',
      padding: '40px',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: '30px',
      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4)',
      minWidth: '400px',
    },
    loadingText: {
      fontFamily: 'KnightsQuest, serif',
      fontSize: '32px',
      color: '#2F1B14',
      fontWeight: 'bold' as const,
      textShadow: '1px 1px 2px rgba(139, 69, 19, 0.3)',
      marginBottom: '0px',
      letterSpacing: '2px',
    },
    progressContainer: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: '15px',
      width: '100%',
    },
    progressBarContainer: {
      width: '100%',
      height: '32px',
      backgroundColor: '#654321',
      borderRadius: '16px',
      overflow: 'hidden' as const,
      border: '2px solid #8B4513',
      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
    },
    progressBar: {
      height: '100%',
      width: `${overallProgress}%`,
      background: 'linear-gradient(90deg, #00d4ff, #0099cc, #00d4ff)',
      backgroundSize: '40px 100%',
      borderRadius: '14px',
      position: 'relative' as const,
      overflow: 'hidden' as const,
      animation: 'progressFlow 2s linear infinite',
      transition: 'width 0.3s ease-out',
    },
    progressStripes: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 8px, transparent 8px, transparent 16px)',
      animation: 'stripeMove 1s linear infinite',
    },
    progressText: {
      fontFamily: 'Newrocker, serif',
      fontSize: '16px',
      color: '#5D4037',
      fontWeight: 'bold' as const,
      textAlign: 'center' as const,
    }
  };

  return (
    <>
      <div style={styles.overlay}>
        <div style={styles.panel}>
          <div style={styles.loadingText}>Loading{dots}</div>
          <div style={styles.progressContainer}>
            <div style={styles.progressBarContainer}>
              <div style={styles.progressBar}>
                <div style={styles.progressStripes} />
              </div>
            </div>
            <div style={styles.progressText}>
              {overallProgress}% Complete
            </div>
          </div>
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes progressFlow {
          0% {
            background-position: 0% 0%;
          }
          100% {
            background-position: 100% 0%;
          }
        }
        
        @keyframes stripeMove {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 32px 0;
          }
        }
      `}</style>
    </>
  );
}; 