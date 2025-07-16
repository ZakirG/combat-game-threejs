/**
 * LoadingScreen.tsx
 * 
 * Retro-style loading screen displayed after clicking "Join the Map":
 * 
 * Key functionality:
 * - Shows while character model and zombie models are loading
 * - Maintains same papyrus background as JoinGameDialog
 * - Provides retro flash-game style loading indicators
 * - Displays progress for character and zombie loading
 * - Hides once GameReady event is triggered
 * 
 * Props:
 * - isVisible: Controls loading screen visibility
 * - characterProgress: Progress of character model loading (0-100)
 * - zombieProgress: Progress of zombie spawning (0-100)
 * 
 * Technical implementation:
 * - Uses same background styling as JoinGameDialog
 * - Implements retro loading animations and typography
 * - Provides visual feedback for loading states
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
  characterStatus,
  zombieStatus
}) => {
  const [dots, setDots] = useState('');

  // Animated loading dots
  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  const styles = {
    overlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
      // Same background as JoinGameDialog
      backgroundImage: 'url(/papyrus-texture-3.webp)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    },
    container: {
      backgroundColor: 'rgba(101, 67, 33, 0.95)',
      padding: '60px 80px',
      borderRadius: '20px',
      border: '4px solid #8B4513',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 0 0 2px rgba(255, 215, 0, 0.3)',
      textAlign: 'center' as const,
      minWidth: '500px',
      backdrop: 'blur(10px)',
    },
    title: {
      fontFamily: 'Newrocker, serif',
      fontSize: '48px',
      color: '#FFD700',
      textShadow: '3px 3px 6px rgba(0, 0, 0, 0.8), 0 0 10px rgba(255, 215, 0, 0.3)',
      marginBottom: '40px',
      letterSpacing: '2px',
    },
    subtitle: {
      fontFamily: 'MountainKing, serif',
      fontSize: '24px',
      color: '#DEB887',
      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.7)',
      marginBottom: '30px',
      letterSpacing: '1px',
    },
    progressContainer: {
      marginBottom: '25px',
    },
    progressLabel: {
      fontFamily: 'MountainKing, serif',
      fontSize: '18px',
      color: '#F4E4BC',
      marginBottom: '10px',
      textShadow: '1px 1px 2px rgba(0, 0, 0, 0.7)',
    },
    progressBar: {
      width: '100%',
      height: '20px',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      border: '2px solid #8B4513',
      borderRadius: '10px',
      overflow: 'hidden' as const,
      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.5)',
    },
    progressFill: (progress: number) => ({
      height: '100%',
      backgroundColor: progress === 100 
        ? 'linear-gradient(90deg, #32CD32, #228B22)' 
        : 'linear-gradient(90deg, #FFD700, #FFA500)',
      width: `${progress}%`,
      transition: 'width 0.3s ease-out',
      boxShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
      backgroundImage: progress < 100 
        ? 'linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%)'
        : 'none',
      backgroundSize: '20px 20px',
      animation: progress < 100 ? 'progressStripes 1s linear infinite' : 'none',
    }),
    statusText: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#DEB887',
      marginTop: '8px',
      minHeight: '20px',
      textShadow: '1px 1px 2px rgba(0, 0, 0, 0.7)',
    },
    loadingText: {
      fontFamily: 'MountainKing, serif',
      fontSize: '20px',
      color: '#FFD700',
      marginTop: '30px',
      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
    },
    retryHint: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: 'rgba(255, 255, 255, 0.7)',
      marginTop: '20px',
      fontStyle: 'italic' as const,
    }
  };

  const overallProgress = Math.round((characterProgress + zombieProgress) / 2);

  return (
    <>
      <div style={styles.overlay}>
        <div style={styles.container}>
          <h1 style={styles.title}>LOADING REALM</h1>
          <div style={styles.subtitle}>Preparing your adventure{dots}</div>
          
          {/* Character Loading Progress */}
          <div style={styles.progressContainer}>
            <div style={styles.progressLabel}>
              📱 Character Model: {characterProgress}%
            </div>
            <div style={styles.progressBar}>
              <div style={styles.progressFill(characterProgress)} />
            </div>
            <div style={styles.statusText}>{characterStatus}</div>
          </div>

          {/* Zombie Loading Progress */}
          <div style={styles.progressContainer}>
            <div style={styles.progressLabel}>
              🧟 Spawning Enemies: {zombieProgress}%
            </div>
            <div style={styles.progressBar}>
              <div style={styles.progressFill(zombieProgress)} />
            </div>
            <div style={styles.statusText}>{zombieStatus}</div>
          </div>

          <div style={styles.loadingText}>
            {overallProgress < 100 
              ? `Loading ${overallProgress}%${dots}` 
              : 'Ready to begin your quest!'
            }
          </div>
          
          {overallProgress < 30 && (
            <div style={styles.retryHint}>
              If loading takes too long, try refreshing the page
            </div>
          )}
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes progressStripes {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 20px 0;
          }
        }
      `}</style>
    </>
  );
}; 