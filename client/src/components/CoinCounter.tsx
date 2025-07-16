import React, { useState, useEffect } from 'react';

interface CoinCounterProps {
  coinCount: number;
}

const CoinCounter: React.FC<CoinCounterProps> = ({ coinCount }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevCoinCount, setPrevCoinCount] = useState(coinCount);

  // Trigger animation when coin count increases
  useEffect(() => {
    if (coinCount > prevCoinCount) {
      setIsAnimating(true);
      
      // Reset animation after a short duration
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 300); // Animation duration in milliseconds
      
      return () => clearTimeout(timer);
    }
    setPrevCoinCount(coinCount);
  }, [coinCount, prevCoinCount]);

  return (
    <div className="coin-counter">
      <div className="coin-counter-content">
        <img 
          src="/grok-coin.png" 
          alt="Coin" 
          className="coin-icon"
        />
        <span 
          className={`coin-count ${isAnimating ? 'coin-count-animate' : ''}`}
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          x{coinCount}
        </span>
      </div>
      
      <style>{`
        .coin-counter {
          position: fixed;
          top: 80px;
          left: 20px;
          z-index: 1000;
          font-family: 'HorrorTheater', Arial, sans-serif;
          pointer-events: none;
          user-select: none;
        }
        
        .coin-counter-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .coin-icon {
          width: 48px;
          height: 48px;
          object-fit: contain;
          filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.8));
        }
        
        .coin-count {
          color: black;
          font-size: 24px;
          font-weight: bold;
          text-shadow: 2px 2px 4px red;
          transition: transform 300ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
          transform-origin: center;
        }
        
        .coin-count-animate {
          transform: scale(1.5);
        }
        
        /* Fallback fonts */
        @font-face {
          font-family: 'HorrorTheater';
          src: url('/HorrorTheater.ttf') format('truetype');
          font-display: swap;
        }
      `}</style>
    </div>
  );
};

export default CoinCounter; 