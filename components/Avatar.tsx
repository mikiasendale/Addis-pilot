import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, Box, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

interface AvatarProps {
  analyser: AnalyserNode | null;
}

const Head = ({ analyser }: { analyser: AnalyserNode | null }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);
  
  // Reusable array for frequency data (avoid GC)
  const dataArray = useRef(new Uint8Array(0));

  useEffect(() => {
    if (analyser) {
      dataArray.current = new Uint8Array(analyser.frequencyBinCount);
    }
  }, [analyser]);
  
  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return;
    
    let volume = 0;

    if (analyser) {
      analyser.getByteFrequencyData(dataArray.current);
      // Calculate average volume from frequency data
      let sum = 0;
      // We only need the lower frequencies for "voice" visualization usually
      const lowerHalf = Math.floor(dataArray.current.length / 2); 
      for (let i = 0; i < lowerHalf; i++) {
        sum += dataArray.current[i];
      }
      // Normalize to 0-1 range roughly
      volume = sum / (lowerHalf * 255);
    }

    // Smooth floating animation
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1;
    
    // React to Audio Volume
    // Base scale is 1. When loud, grow to 1.3.
    const targetScale = 1 + (volume * 0.5); 
    
    // Linear interpolation for smoothness (prevents jitter)
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

    // Update material distortion based on volume
    // Quiet = smooth, Loud = glitchy/energetic
    materialRef.current.distort = THREE.MathUtils.lerp(materialRef.current.distort, 0.3 + (volume * 0.8), 0.1);
    materialRef.current.color.lerp(new THREE.Color(volume > 0.1 ? "#a78bfa" : "#4c1d95"), 0.1);
  });

  return (
    <Sphere args={[1.4, 64, 64]} ref={meshRef}>
      <MeshDistortMaterial
        ref={materialRef}
        color="#4c1d95"
        distort={0.3}
        speed={4}
        roughness={0.2}
        metalness={0.8}
      />
    </Sphere>
  );
};

const Eyes = () => {
  return (
    <group position={[0, 0.3, 1.3]}>
      <Box args={[0.3, 0.1, 0.1]} position={[-0.5, 0, 0]}>
        <meshStandardMaterial color="cyan" emissive="cyan" emissiveIntensity={2} />
      </Box>
      <Box args={[0.3, 0.1, 0.1]} position={[0.5, 0, 0]}>
        <meshStandardMaterial color="cyan" emissive="cyan" emissiveIntensity={2} />
      </Box>
    </group>
  )
}

export const Avatar: React.FC<AvatarProps> = ({ analyser }) => {
  return (
    <div className="w-full h-64 bg-slate-800 rounded-lg overflow-hidden border border-slate-700 relative">
      <div className="absolute top-2 left-2 z-10 text-xs text-white/50 font-mono">
        AVATAR SYSTEM: {analyser ? "ONLINE" : "STANDBY"}
      </div>
      <Canvas>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Head analyser={analyser} />
        <Eyes />
      </Canvas>
    </div>
  );
};
