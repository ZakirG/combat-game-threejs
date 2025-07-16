# Coin Effects System

This document explains the coin effects system that spawns spinning, floating coins when zombies are hit in the 3D multiplayer combat game.

## Overview

The coin effects system creates visual feedback when players successfully hit zombies. Each hit spawns a spinning coin that floats up and down at the zombie's location, providing satisfying visual confirmation of successful attacks.

## Features

- **Automatic Spawning**: Coins appear at the exact location where zombies are hit
- **Spinning Animation**: Coins continuously rotate around their vertical axis
- **Floating Motion**: Coins gently rise and fall in a sine wave pattern after landing
- **Proper Orientation**: Coins lie flat on the ground
- **Glowing Pillar**: Enhanced white magical beam with triple-layer glow effect
- **Flyaway Physics**: Coins fly away from player on impact, then settle with bouncing
- **Player Collection**: Coins persist until player walks into them
- **Collection Radius**: 1.5 units around player position for pickup detection
- **Coin Counter UI**: Displays collected coin count with scaling animation
- **Fallback Geometry**: Uses simple golden cylinder if custom model not found

## Configuration

### Global Toggle

Located in `client/src/utils/coinEffect.ts`:

```typescript
export const COIN_EFFECTS_ENABLED = true; // Set to false to disable all coin effects
```

### Visual Properties

```typescript
private readonly COIN_SCALE = 0.3;        // Size relative to player (30%)
private readonly FLOAT_AMPLITUDE = 0.5;    // How high/low coins float
private readonly COIN_DURATION = 3000;     // 3 seconds before cleanup

// Glow pillar properties
private readonly PILLAR_HEIGHT = 10;       // Height of the magical beam
private readonly PILLAR_RADIUS = 0.3;      // Thin beam radius
// Triple-layer glow: Inner (0.12), Middle (0.08), Outer (0.05) opacity
```

### Animation Properties

Each coin has randomized properties for visual variety:
- **Rotation Speed**: 2-5 radians per second (random)
- **Float Speed**: 1-1.5 Hz frequency (random)
- **Flyaway Speed**: 4-7 units/sec horizontal, 6-9 units/sec upward (enhanced range)
- **Gravity**: -12 units/sec² with air resistance decay (extended flight time)
- **Collection Effect**: Coin disappears instantly, pillar fades out over 0.3 seconds

## Adding Your Custom Coin Model

### Required Files
Place your coin model at: `client/public/models/items/grok-coin.glb`
Place your coin icon at: `client/public/grok-coin.png` (for UI counter)

### Model Requirements
- **Format**: GLB (GLTF Binary)
- **Orientation**: Model should be lying flat by default (no rotation applied)
- **Size**: Any size (will be scaled to 30% of player size)
- **Materials**: Standard PBR materials work best

### Model Conversion
If you have an FBX model, convert it to GLB using:
```bash
# Use online converters or Blender to export as GLB
# Or use the existing convert-fbx-to-glb.sh script as reference
```

## Implementation Details

### File Structure
```
client/src/utils/coinEffect.ts    # Main coin effect system
client/src/components/Player.tsx  # Integration and spawning logic
```

### Key Classes and Functions

#### `CoinEffectManager`
- **Purpose**: Manages all active coins in the scene
- **Initialization**: Creates manager instance per player
- **Methods**:
  - `loadCoinModel()`: Loads GLB model or creates fallback
  - `createCoin(position)`: Spawns new coin at specified location
  - `update(deltaTime)`: Updates all active coins (call in render loop)
  - `cleanup()`: Removes all coins from scene

#### Integration Points
- **Spawning**: Triggered in Player.tsx when `hitZombies.forEach()` executes
- **Position**: Same location as blood spurts but 0.5 units lower
- **Update Loop**: Called in `useFrame()` alongside blood effects
- **Cleanup**: Called in `useEffect()` cleanup on component unmount

## Usage in Code

### Spawning Coins
```typescript
// Automatic spawning when zombies are hit (already implemented)
if (coinEffectManagerRef.current) {
  hitZombies.forEach((zombie: any) => {
    if (zombie.position) {
             const coinPosition = new THREE.Vector3(
         zombie.position.x,
         zombie.position.y - 0.8, // On the ground level
         zombie.position.z
       );
      coinEffectManagerRef.current!.createCoin(coinPosition);
    }
  });
}
```

### Manual Coin Spawning
```typescript
// For custom events or testing
const position = new THREE.Vector3(x, y, z);
coinEffectManagerRef.current?.createCoin(position);
```

## Performance Considerations

- **Automatic Cleanup**: Coins are automatically removed after 3 seconds
- **Efficient Updates**: Only active coins are updated each frame
- **Memory Management**: Proper cleanup on component unmount
- **Batch Operations**: Multiple coins from one attack are processed together

## Customization Options

### Disable Coin Effects
```typescript
// In coinEffect.ts
export const COIN_EFFECTS_ENABLED = false;
```

### Adjust Coin Appearance
```typescript
// Modify fallback coin properties
const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16); // radius, height, segments
const material = new THREE.MeshLambertMaterial({ color: 0xFFD700 }); // Gold color
```

### Change Animation Properties
```typescript
// In CoinEffectManager constructor
private readonly COIN_SCALE = 0.5;        // Make coins bigger
private readonly FLOAT_AMPLITUDE = 1.0;    // Make floating more dramatic
private readonly COIN_DURATION = 5000;     // Make coins last longer

// Customize glow pillar
private readonly PILLAR_HEIGHT = 15;       // Taller magical beam
private readonly PILLAR_RADIUS = 0.5;      // Thicker beam
```

### Modify Randomization
```typescript
// In createCoin() method
rotationSpeed: 1 + Math.random() * 2,  // Slower spinning (1-3 rad/s)
floatSpeed: 0.5 + Math.random() * 0.3,  // Slower floating
```

## Testing

### Without Custom Model
1. Start the game without `grok-coin.glb`
2. Attack zombies
3. Should see golden cylinder coins spinning and floating
4. Check console for "Using fallback coin geometry" message

### With Custom Model
1. Place `grok-coin.glb` in `client/public/models/`
2. Restart client
3. Attack zombies
4. Should see your custom coin model
5. Check console for "Coin model loaded successfully" message

### Debug Information
- Coin creation: `[Player] 🪙 Coin created at zombie position`
- Model loading: `[CoinEffect] Coin model loaded successfully`
- Cleanup: `[CoinEffect] Coin removed after duration expired`

## Troubleshooting

### Common Issues

1. **No coins appearing**
   - Check `COIN_EFFECTS_ENABLED = true`
   - Verify console for error messages
   - Ensure zombie hits are being detected

2. **Coins not spinning**
   - Check that `update()` is being called in render loop
   - Verify deltaTime is being passed correctly

3. **Custom model not loading**
   - Verify file is at exact path: `/models/items/grok-coin.glb`
   - Check file format is GLB, not FBX
   - Look for fallback geometry as backup

4. **Performance issues**
   - Reduce `COIN_DURATION` for faster cleanup
   - Lower `COIN_SCALE` for smaller coins
   - Check number of active coins with `getActiveCoinsCount()`

## Integration with Other Systems

- **Blood Effects**: Coins spawn alongside blood spurts
- **Screenshake**: Uses same hit detection system
- **Kill Counter**: Triggered by same zombie hit events
- **Audio System**: Could be extended to play coin pickup sounds 