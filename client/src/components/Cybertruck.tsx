/**
 * Cybertruck.tsx
 * 
 * Component responsible for rendering the Cybertruck vehicle in the 3D scene.
 * Handles vehicle positioning, rotation, and visual states based on occupation.
 */

import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { CybertruckData } from '../generated';

interface CybertruckProps {
  cybertruckData: CybertruckData;
  isLocalPlayerDriving: boolean;
  drivingPosition?: THREE.Vector3; // Override position when driving client-side
}

export const Cybertruck: React.FC<CybertruckProps> = ({ 
  cybertruckData, 
  isLocalPlayerDriving,
  drivingPosition
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);

  // Load the cybertruck model using useGLTF hook
  const gltf = useGLTF('/models/items/cybertruck.glb');
  
  // Process the loaded model
  useEffect(() => {
    if (gltf?.scene) {
      console.log('🚗 Cybertruck model loaded successfully');
      const cybertruckModel = gltf.scene.clone();
      
      // Scale the model appropriately
      cybertruckModel.scale.set(2, 2, 2);
      
      // Enable shadows
      cybertruckModel.traverse((child: any) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      setModel(cybertruckModel);
    }
  }, [gltf]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (model) {
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((material) => material?.dispose());
            } else {
              child.material?.dispose();
            }
          }
        });
      }
    };
  }, [model]);

  // Update position and rotation based on server data or driving position
  useFrame(() => {
    if (groupRef.current && cybertruckData) {
      // Use driving position when available (client-side driving), otherwise use server position
      if (isLocalPlayerDriving && drivingPosition) {
        groupRef.current.position.copy(drivingPosition);
        console.log('🚗 [CYBERTRUCK] Using driving position:', drivingPosition.x.toFixed(1), drivingPosition.z.toFixed(1));
      } else {
        groupRef.current.position.set(
          cybertruckData.position.x,
          cybertruckData.position.y,
          cybertruckData.position.z
        );
      }
      
      // Update rotation (always use server rotation for now)
      groupRef.current.rotation.set(
        cybertruckData.rotation.x,
        cybertruckData.rotation.y,
        cybertruckData.rotation.z
      );
    }
  });

  // Add model to group when it's loaded
  useEffect(() => {
    if (model && groupRef.current) {
      // Clear existing children
      while (groupRef.current.children.length > 0) {
        groupRef.current.remove(groupRef.current.children[0]);
      }
      // Add the new model
      groupRef.current.add(model);
    }
  }, [model]);

  return (
    <group ref={groupRef}>
      {/* Cybertruck body */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[8, 4, 16]} />
        <meshStandardMaterial 
          color={cybertruckData.isOccupied ? "#ff4444" : "#888888"} 
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      
      {/* Wheels */}
      <mesh position={[-3, -2, 5]} castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.2, 1.2, 1]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      <mesh position={[3, -2, 5]} castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.2, 1.2, 1]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      <mesh position={[-3, -2, -5]} castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.2, 1.2, 1]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      <mesh position={[3, -2, -5]} castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.2, 1.2, 1]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      
      {/* Pillar of light when available */}
      {!cybertruckData.isOccupied && (
        <group position={[0, 0, 0]}>
          {/* Blue glow pillar */}
          <mesh position={[0, 5, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 10]} />
            <meshBasicMaterial 
              color="#0088ff" 
              transparent={true} 
              opacity={0.6}
            />
          </mesh>
          <mesh position={[0, 5, 0]}>
            <cylinderGeometry args={[0.5, 0.5, 10]} />
            <meshBasicMaterial 
              color="#0088ff" 
              transparent={true} 
              opacity={0.3}
            />
          </mesh>
          <mesh position={[0, 5, 0]}>
            <cylinderGeometry args={[0.7, 0.7, 10]} />
            <meshBasicMaterial 
              color="#0088ff" 
              transparent={true} 
              opacity={0.15}
            />
          </mesh>
        </group>
      )}
      
      {/* Optional: Add interaction indicator */}
      {!cybertruckData.isOccupied && (
        <mesh position={[0, 3, 0]}>
          <sphereGeometry args={[0.2]} />
          <meshStandardMaterial 
            color="#00ff00" 
            emissive="#00ff00"
            emissiveIntensity={0.5}
          />
        </mesh>
      )}
    </group>
  );
};

// Preload the model for better performance
useGLTF.preload('/models/items/cybertruck.glb'); 