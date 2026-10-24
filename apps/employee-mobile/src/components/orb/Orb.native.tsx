import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';

import { colors as themeColors } from '@/constants/theme';
import type { OrbProps } from './types';

// Convert latitude & longitude to 3D Cartesian coordinates on a sphere of radius R
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// Approximate landmass bounding checks for continental clusters
function isContinentalLand(lat: number, lon: number): boolean {
  // Africa
  if (lat >= -35 && lat <= 37 && lon >= -18 && lon <= 52) {
    if (lat < 5 && lon > 42) return false;
    return true;
  }
  // Europe
  if (lat >= 36 && lat <= 71 && lon >= -10 && lon <= 42) return true;
  // Asia
  if (lat >= 2 && lat <= 77 && lon >= 42 && lon <= 180) {
    if (lat < 10 && lon < 95) return false;
    return true;
  }
  // North America
  if (lat >= 7 && lat <= 75 && lon >= -168 && lon <= -52) {
    if (lat < 15 && lon > -85) return false;
    return true;
  }
  // South America
  if (lat >= -56 && lat <= 13 && lon >= -82 && lon <= -34) {
    if (lat < -20 && lon > -40) return false;
    return true;
  }
  // Australia & New Zealand
  if (lat >= -46 && lat <= -10 && lon >= 112 && lon <= 178) return true;
  // Greenland
  if (lat >= 60 && lat <= 83 && lon >= -73 && lon <= -12) return true;
  // India & Southeast Asia density
  if (lat >= 5 && lat <= 32 && lon >= 68 && lon <= 92) return true;
  return false;
}

// Major global city hubs for network lines
const HUBS = [
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Dubai', lat: 25.20, lon: 55.27 },
  { name: 'Mumbai', lat: 19.08, lon: 72.88 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
  { name: 'São Paulo', lat: -23.55, lon: -46.63 },
];

const CONNECTIONS = [
  [0, 1], // NY - London
  [1, 2], // London - Dubai
  [2, 3], // Dubai - Mumbai
  [3, 4], // Mumbai - Singapore
  [4, 5], // Singapore - Tokyo
  [4, 6], // Singapore - Sydney
  [0, 7], // NY - São Paulo
  [5, 0], // Tokyo - NY
];

// Realistic Earth Biome Color Classifier with modern cyber-luminous palettes
function getEarthBiomeColor(lat: number, lon: number): { isLand: boolean; color: THREE.Color } {
  // 1. Polar Ice Caps & Glaciers (Antarctica, Greenland, Arctic)
  if (lat < -60 || lat > 72 || (lat > 60 && lon > -73 && lon < -12)) {
    const isGlacierCenter = lat < -68 || lat > 76;
    return {
      isLand: true,
      color: new THREE.Color(isGlacierCenter ? '#FFFFFF' : '#E0F2FE'),
    };
  }

  // 2. Arid Deserts & Sand Dunes (Sahara, Arabian Peninsula, Australian Outback, Gobi)
  const isSahara = lat >= 14 && lat <= 32 && lon >= -17 && lon <= 35;
  const isArabia = lat >= 12 && lat <= 32 && lon >= 35 && lon <= 60;
  const isOutback = lat >= -32 && lat <= -18 && lon >= 118 && lon <= 142;
  const isGobi = lat >= 38 && lat <= 46 && lon >= 90 && lon <= 115;
  if (isSahara || isArabia || isOutback || isGobi) {
    return {
      isLand: true,
      color: new THREE.Color('#F59E0B'), // Luminous Desert Gold
    };
  }

  // 3. Continental Landmasses & Vegetated Biomes
  if (isContinentalLand(lat, lon)) {
    // Tropical Rainforests (Amazon Basin, Congo Basin, Southeast Asia)
    const isAmazon = lat >= -20 && lat <= 8 && lon >= -78 && lon <= -45;
    const isCongo = lat >= -8 && lat <= 6 && lon >= 10 && lon <= 30;
    const isSEAsia = lat >= -10 && lat <= 18 && lon >= 95 && lon <= 145;

    if (isAmazon || isCongo || isSEAsia) {
      return {
        isLand: true,
        color: new THREE.Color('#10B981'), // Rich Rainforest Emerald
      };
    }

    // High Himalayas & Mountain Summits
    const isHimalayas = lat >= 26 && lat <= 36 && lon >= 74 && lon <= 96;
    if (isHimalayas) {
      return {
        isLand: true,
        color: new THREE.Color('#E2E8F0'), // Snow-capped alpine peaks
      };
    }

    // Temperate plains, forests & grasslands (North America, Europe, East Asia, India)
    return {
      isLand: true,
      color: new THREE.Color('#22C55E'), // Modern Vibrant Green
    };
  }

  // 4. Oceans: Shallow Coastal Shelf Waters vs Deep Space Sapphire
  const isCoast =
    isContinentalLand(lat + 2.5, lon) ||
    isContinentalLand(lat - 2.5, lon) ||
    isContinentalLand(lat, lon + 2.5) ||
    isContinentalLand(lat, lon - 2.5);

  if (isCoast) {
    return {
      isLand: false,
      color: new THREE.Color('#0284C7'), // Vibrant Marine Coastal Cyan
    };
  }

  return {
    isLand: false,
    color: new THREE.Color('#081024'), // Deep Space Sapphire Ocean
  };
}

// 1. Holographic Earth Globe with Fibonacci Continental Grid & Network Arcs
function HolographicGlobe({ isAmbient, animated }: { isAmbient: boolean; animated: boolean }) {
  const globeGroup = useRef<THREE.Group>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const beaconsGroup = useRef<THREE.Group>(null);

  // Fibonacci continental point cloud with realistic Earth colors (850 points budgeted for mobile 60fps)
  const { positions, colors } = useMemo(() => {
    const count = isAmbient ? 600 : 850;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const lat = 90 - (phi * 180) / Math.PI;
      const lon = ((theta * 180) / Math.PI) % 360 - 180;

      const { isLand, color } = getEarthBiomeColor(lat, lon);
      const r = isLand ? 1.585 + (i % 5) * 0.005 : 1.56;

      const v = latLonToVector3(lat, lon, r);
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;

      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
    }

    return { positions: pos, colors: col };
  }, [isAmbient]);

  // Network Arcs between global hubs
  const arcCurves = useMemo(() => {
    const R = 1.58;
    return CONNECTIONS.map(([fromIdx, toIdx]) => {
      const p1 = latLonToVector3(HUBS[fromIdx].lat, HUBS[fromIdx].lon, R);
      const p2 = latLonToVector3(HUBS[toIdx].lat, HUBS[toIdx].lon, R);
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const dist = p1.distanceTo(p2);
      mid.normalize().multiplyScalar(R + Math.min(dist * 0.35, 0.45));
      return new THREE.CatmullRomCurve3([p1, mid, p2]);
    });
  }, []);

  const hubPositions = useMemo(() => {
    return HUBS.map((h) => latLonToVector3(h.lat, h.lon, 1.59));
  }, []);

  useFrame((state, delta) => {
    if (!animated) return;
    const dt = Math.min(delta, 0.05);

    if (globeGroup.current) {
      globeGroup.current.rotation.y += dt * 0.09;
    }
    if (atmosphereRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.015;
      atmosphereRef.current.scale.set(pulse, pulse, pulse);
    }
    if (beaconsGroup.current) {
      const t = (state.clock.elapsedTime * 0.35) % 1;
      beaconsGroup.current.children.forEach((beacon, i) => {
        const curve = arcCurves[i % arcCurves.length];
        const point = curve.getPoint((t + i * 0.12) % 1);
        beacon.position.copy(point);
      });
    }
  });

  return (
    <group ref={globeGroup}>
      {/* Translucent Deep Ocean Core */}
      <mesh>
        <sphereGeometry args={[1.56, 32, 32]} />
        <meshStandardMaterial
          color={themeColors.bg}
          emissive={themeColors.indigoDeep}
          emissiveIntensity={0.65}
          roughness={0.28}
          metalness={0.7}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Continental Landmass Point Matrix */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={isAmbient ? 0.034 : 0.042}
          vertexColors
          transparent
          opacity={isAmbient ? 0.72 : 0.92}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Global Data Arc Lines */}
      {arcCurves.map((curve, idx) => (
        <line key={idx}>
          <bufferGeometry attach="geometry">
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array(curve.getPoints(24).flatMap((v) => [v.x, v.y, v.z])), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color={idx % 2 === 0 ? themeColors.info : themeColors.success}
            transparent
            opacity={0.38}
            blending={THREE.AdditiveBlending}
          />
        </line>
      ))}

      {/* City Hub Nodes */}
      {hubPositions.map((pos, idx) => (
        <mesh key={idx} position={pos}>
          <sphereGeometry args={[0.028, 6, 6]} />
          <meshBasicMaterial color={idx % 2 === 0 ? themeColors.success : themeColors.info} />
        </mesh>
      ))}

      {/* Travelling Data Packet Beacons */}
      <group ref={beaconsGroup}>
        {arcCurves.map((_, idx) => (
          <mesh key={idx}>
            <sphereGeometry args={[0.032, 6, 6]} />
            <meshBasicMaterial color={themeColors.warning} />
          </mesh>
        ))}
      </group>

      {/* Outer Atmospheric Aura */}
      <mesh ref={atmosphereRef}>
        <sphereGeometry args={[1.72, 24, 24]} />
        <meshStandardMaterial
          color="#38BDF8"
          emissive="#0284C7"
          emissiveIntensity={0.42}
          transparent
          opacity={0.16}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// 2. Dual Tilted Orbital Rings with Satellites
function OrbitalSystem({ animated }: { animated: boolean }) {
  const ring1Ref = useRef<THREE.Group>(null);
  const ring2Ref = useRef<THREE.Group>(null);
  const sat1Ref = useRef<THREE.Mesh>(null);
  const sat2Ref = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (!animated) return;
    const dt = Math.min(delta, 0.05);
    if (ring1Ref.current) ring1Ref.current.rotation.z += dt * 0.06;
    if (ring2Ref.current) ring2Ref.current.rotation.z -= dt * 0.05;

    const time = state.clock.elapsedTime;
    if (sat1Ref.current) {
      sat1Ref.current.position.x = Math.cos(time * 0.6) * 2.45;
      sat1Ref.current.position.y = Math.sin(time * 0.6) * 2.45;
    }
    if (sat2Ref.current) {
      sat2Ref.current.position.x = Math.cos(-time * 0.45) * 2.82;
      sat2Ref.current.position.y = Math.sin(-time * 0.45) * 2.82;
    }
  });

  return (
    <>
      {/* Tilted Orbit 1 */}
      <group rotation={[1.15, 0.45, 0.2]}>
        <group ref={ring1Ref}>
          <mesh>
            <torusGeometry args={[2.45, 0.014, 6, 64]} />
            <meshStandardMaterial
              color={themeColors.info}
              emissive={themeColors.info}
              emissiveIntensity={0.55}
              transparent
              opacity={0.42}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <mesh ref={sat1Ref}>
            <octahedronGeometry args={[0.07, 0]} />
            <meshBasicMaterial color={themeColors.warning} />
          </mesh>
        </group>
      </group>

      {/* Tilted Orbit 2 */}
      <group rotation={[-0.95, -0.5, -0.4]}>
        <group ref={ring2Ref}>
          <mesh>
            <torusGeometry args={[2.82, 0.012, 6, 72]} />
            <meshStandardMaterial
              color={themeColors.success}
              emissive={themeColors.success}
              emissiveIntensity={0.48}
              transparent
              opacity={0.34}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <mesh ref={sat2Ref}>
            <octahedronGeometry args={[0.06, 0]} />
            <meshBasicMaterial color={themeColors.success} />
          </mesh>
        </group>
      </group>
    </>
  );
}

// 3. Double-Helix Twisting Pedestal Ribbon (Cradles Globe from Below)
function HelixPedestal() {
  const { tube1, tube2, neon1, neon2 } = useMemo(() => {
    const pts1: THREE.Vector3[] = [];
    const pts2: THREE.Vector3[] = [];

    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * Math.PI * 1.6;
      const r = 1.35 + Math.sin(t * Math.PI * 1.5 - 0.4) * 0.45;
      const y = -2.7 + t * 3.1;

      pts1.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r * 0.7));
      pts2.push(new THREE.Vector3(Math.cos(angle + Math.PI) * r, y, Math.sin(angle + Math.PI) * r * 0.7));
    }

    const c1 = new THREE.CatmullRomCurve3(pts1);
    const c2 = new THREE.CatmullRomCurve3(pts2);

    return {
      tube1: new THREE.TubeGeometry(c1, 32, 0.05, 8, false),
      tube2: new THREE.TubeGeometry(c2, 32, 0.05, 8, false),
      neon1: new THREE.TubeGeometry(c1, 32, 0.016, 6, false),
      neon2: new THREE.TubeGeometry(c2, 32, 0.016, 6, false),
    };
  }, []);

  return (
    <group position={[0, -0.15, 0]}>
      {/* Dark Carbon Main Ribbons */}
      <mesh geometry={tube1}>
        <meshStandardMaterial
          color="#141727"
          metalness={0.92}
          roughness={0.24}
          emissive={themeColors.bgRaised}
        />
      </mesh>
      <mesh geometry={tube2}>
        <meshStandardMaterial
          color="#141727"
          metalness={0.92}
          roughness={0.24}
          emissive={themeColors.bgRaised}
        />
      </mesh>

      {/* Glowing Neon Veins Running Along Ribbons */}
      <mesh geometry={neon1}>
        <meshBasicMaterial
          color={themeColors.info}
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh geometry={neon2}>
        <meshBasicMaterial
          color={themeColors.indigo}
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// 4. Central Pulsing Energy Core at Helix Intersection
function EnergyCore({ animated }: { animated: boolean }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (!animated) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.22;
    if (coreRef.current) {
      coreRef.current.scale.set(pulse, pulse, pulse);
      coreRef.current.rotation.y += 0.02;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 4.5 + Math.sin(state.clock.elapsedTime * 3) * 2;
    }
  });

  return (
    <group position={[0, -1.05, 0]}>
      <pointLight ref={lightRef} color={themeColors.warning} distance={4} decay={2} intensity={4.5} />
      <mesh ref={coreRef}>
        <octahedronGeometry args={[0.15, 1]} />
        <meshBasicMaterial color="#FFF0C2" />
      </mesh>
      <mesh scale={2.2}>
        <sphereGeometry args={[0.11, 14, 14]} />
        <meshBasicMaterial
          color={themeColors.warning}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// 5. Drifting Stardust & Nebula Particle Field
function StardustField({ count = 120, animated }: { count?: number; animated: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const palette = [
      new THREE.Color(themeColors.info),
      new THREE.Color(themeColors.success),
      new THREE.Color(themeColors.warning),
      new THREE.Color(themeColors.indigo),
      new THREE.Color(themeColors.lavender),
    ];

    for (let i = 0; i < count; i++) {
      const r = 3.8 + Math.random() * 4.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.8;
      pos[i * 3 + 2] = r * Math.cos(phi) * 0.7 - 0.5;

      const c = palette[i % palette.length];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return { positions: pos, colors: col };
  }, [count]);

  useFrame((_, delta) => {
    if (!animated || !ref.current) return;
    ref.current.rotation.y += Math.min(delta, 0.05) * 0.015;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.038}
        vertexColors
        transparent
        opacity={0.65}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Main Scene Composition
function HolographicScene({
  animated,
  intensity,
  variant,
}: {
  animated: boolean;
  intensity: 'soft' | 'normal';
  variant: 'hero' | 'ambient';
}) {
  const group = useRef<THREE.Group>(null);
  const light = intensity === 'soft' ? 0.65 : 1;
  const isAmbient = variant === 'ambient';

  useFrame((state, delta) => {
    if (!animated) return;
    const time = state.clock.elapsedTime;
    if (group.current) {
      group.current.position.y = Math.sin(time * 0.6) * 0.06;
      group.current.rotation.y += Math.min(delta, 0.05) * 0.03;
    }
  });

  return (
    <>
      <ambientLight intensity={0.75 * light} color="#C7CCFF" />
      <directionalLight position={[0, 6, 3]} intensity={1.2 * light} color="#F4F5FF" />
      <pointLight position={[-4, 4, 4]} intensity={12 * light} color={themeColors.info} />
      <pointLight position={[5, -3, 3]} intensity={10 * light} color={themeColors.indigo} />
      <pointLight position={[0, -4, 4]} intensity={8 * light} color={themeColors.success} />

      <group ref={group} scale={isAmbient ? 0.85 : 1}>
        <HolographicGlobe isAmbient={isAmbient} animated={animated} />
        <OrbitalSystem animated={animated} />
        <HelixPedestal />
        <EnergyCore animated={animated} />
        <StardustField count={isAmbient ? 60 : 120} animated={animated} />
      </group>
    </>
  );
}

export function Orb({
  size = 280,
  animated = true,
  style,
  intensity = 'normal',
  variant = 'hero',
}: OrbProps) {
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  return (
    <View pointerEvents="none" style={[styles.wrapper, { width: size, height: size }, style]}>
      <Canvas
        camera={{ position: [0, 0, 7.6], fov: 44 }}
        frameloop={animated && appActive ? 'always' : 'demand'}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
        style={styles.canvas}>
        <HolographicScene animated={animated && appActive} intensity={intensity} variant={variant} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    backgroundColor: 'transparent',
    width: '100%',
    height: '100%',
  },
});
