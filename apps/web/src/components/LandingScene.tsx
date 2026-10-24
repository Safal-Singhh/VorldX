import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Convert latitude & longitude to 3D Cartesian coordinates on sphere of radius R
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// Approximate landmass detection for realistic continental clusters
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
  // India & Southeast Asia density boost
  if (lat >= 5 && lat <= 32 && lon >= 68 && lon <= 92) return true;
  return false;
}

// Major global city hubs for holographic network lines
const HUBS = [
  { name: "New York", lat: 40.71, lon: -74.01 },
  { name: "London", lat: 51.51, lon: -0.13 },
  { name: "Paris", lat: 48.86, lon: 2.35 },
  { name: "Dubai", lat: 25.20, lon: 55.27 },
  { name: "Mumbai", lat: 19.08, lon: 72.88 },
  { name: "Singapore", lat: 1.35, lon: 103.82 },
  { name: "Tokyo", lat: 35.68, lon: 139.69 },
  { name: "Sydney", lat: -33.87, lon: 151.21 },
  { name: "São Paulo", lat: -23.55, lon: -46.63 },
  { name: "Nairobi", lat: -1.29, lon: 36.82 },
];

const CONNECTIONS = [
  [0, 1], // NY - London
  [1, 2], // London - Paris
  [1, 3], // London - Dubai
  [3, 4], // Dubai - Mumbai
  [4, 5], // Mumbai - Singapore
  [5, 6], // Singapore - Tokyo
  [5, 7], // Singapore - Sydney
  [0, 8], // NY - São Paulo
  [3, 9], // Dubai - Nairobi
  [6, 0], // Tokyo - NY
];

// Realistic Earth Biome Color Classifier with modern cyber-luminous palettes
function getEarthBiomeColor(lat: number, lon: number): { isLand: boolean; color: THREE.Color } {
  // 1. Polar Ice Caps & Glaciers (Antarctica, Greenland, Arctic)
  if (lat < -60 || lat > 72 || (lat > 60 && lon > -73 && lon < -12)) {
    const isGlacierCenter = lat < -68 || lat > 76;
    return {
      isLand: true,
      color: new THREE.Color(isGlacierCenter ? "#FFFFFF" : "#E0F2FE"),
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
      color: new THREE.Color("#F59E0B"), // Luminous Desert Gold
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
        color: new THREE.Color("#10B981"), // Rich Rainforest Emerald
      };
    }

    // High Himalayas & Mountain Summits
    const isHimalayas = lat >= 26 && lat <= 36 && lon >= 74 && lon <= 96;
    if (isHimalayas) {
      return {
        isLand: true,
        color: new THREE.Color("#E2E8F0"), // Snow-capped alpine peaks
      };
    }

    // Temperate plains, forests & grasslands (North America, Europe, East Asia, India)
    return {
      isLand: true,
      color: new THREE.Color("#22C55E"), // Modern Vibrant Green
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
      color: new THREE.Color("#0284C7"), // Vibrant Marine Coastal Cyan
    };
  }

  return {
    isLand: false,
    color: new THREE.Color("#081024"), // Deep Space Sapphire Ocean
  };
}

function HolographicGlobe({ isAmbient }: { isAmbient: boolean }) {
  const globeGroup = useRef<THREE.Group>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const dataBeaconsRef = useRef<THREE.Group>(null);

  // 1. Continental Point Cloud with Realistic Earth Colors
  const { positions, colors } = useMemo(() => {
    const count = isAmbient ? 1800 : 2600;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const lat = 90 - (phi * 180 / Math.PI);
      const lon = ((theta * 180 / Math.PI) % 360) - 180;

      const { isLand, color } = getEarthBiomeColor(lat, lon);
      const r = isLand ? 1.585 + (Math.random() * 0.02) : 1.56;

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

  // 2. Hub Connection Arcs (Great Circle Splines with Midpoint Arch)
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

  // 3. City Hub Beacons
  const hubPositions = useMemo(() => {
    return HUBS.map((h) => latLonToVector3(h.lat, h.lon, 1.59));
  }, []);

  useFrame((state, dt) => {
    if (document.hidden) return;
    const delta = Math.min(dt, 0.05);
    if (globeGroup.current) {
      globeGroup.current.rotation.y += delta * 0.08;
    }
    if (atmosphereRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.015;
      atmosphereRef.current.scale.set(pulse, pulse, pulse);
    }
    if (dataBeaconsRef.current) {
      const t = (state.clock.elapsedTime * 0.35) % 1;
      dataBeaconsRef.current.children.forEach((beacon, i) => {
        const curve = arcCurves[i % arcCurves.length];
        const point = curve.getPoint((t + i * 0.1) % 1);
        beacon.position.copy(point);
      });
    }
  });

  return (
    <group ref={globeGroup}>
      {/* Glossy Translucent Ocean Core */}
      <mesh>
        <sphereGeometry args={[1.56, 48, 48]} />
        <meshStandardMaterial
          color="#060919"
          emissive="#121638"
          emissiveIntensity={0.45}
          roughness={0.2}
          metalness={0.7}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Continental Landmass & Grid Matrix */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={isAmbient ? 0.032 : 0.04}
          vertexColors
          transparent
          opacity={isAmbient ? 0.7 : 0.9}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Network Arc Lines */}
      {arcCurves.map((curve, idx) => (
        <line key={idx}>
          <bufferGeometry attach="geometry">
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array(curve.getPoints(36).flatMap((v) => [v.x, v.y, v.z])), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color={idx % 2 === 0 ? "#76B8FF" : "#45D6A6"}
            transparent
            opacity={0.35}
            blending={THREE.AdditiveBlending}
          />
        </line>
      ))}

      {/* City Hub Nodes */}
      {hubPositions.map((pos, idx) => (
        <mesh key={idx} position={pos}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshBasicMaterial color={idx % 2 === 0 ? "#45D6A6" : "#76B8FF"} />
        </mesh>
      ))}

      {/* Travelling Data Beacons along Arcs */}
      <group ref={dataBeaconsRef}>
        {arcCurves.map((_, idx) => (
          <mesh key={idx}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshBasicMaterial color="#F5C76B" />
          </mesh>
        ))}
      </group>

      {/* Outer Atmospheric Aura (Fresnel Halo) */}
      <mesh ref={atmosphereRef}>
        <sphereGeometry args={[1.72, 32, 32]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0284c7"
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

// 4. Orbital Rings with Satellites
function OrbitalSystem() {
  const ring1Ref = useRef<THREE.Group>(null);
  const ring2Ref = useRef<THREE.Group>(null);
  const sat1Ref = useRef<THREE.Mesh>(null);
  const sat2Ref = useRef<THREE.Mesh>(null);

  useFrame((state, dt) => {
    if (document.hidden) return;
    const delta = Math.min(dt, 0.05);
    if (ring1Ref.current) ring1Ref.current.rotation.z += delta * 0.05;
    if (ring2Ref.current) ring2Ref.current.rotation.z -= delta * 0.04;

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
      {/* Tilted Ring 1 */}
      <group rotation={[1.15, 0.45, 0.2]}>
        <group ref={ring1Ref}>
          <mesh>
            <torusGeometry args={[2.45, 0.015, 8, 80]} />
            <meshStandardMaterial
              color="#76B8FF"
              emissive="#76B8FF"
              emissiveIntensity={0.6}
              transparent
              opacity={0.4}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <mesh ref={sat1Ref}>
            <octahedronGeometry args={[0.07, 0]} />
            <meshBasicMaterial color="#F5C76B" />
          </mesh>
        </group>
      </group>

      {/* Tilted Ring 2 */}
      <group rotation={[-0.95, -0.5, -0.4]}>
        <group ref={ring2Ref}>
          <mesh>
            <torusGeometry args={[2.82, 0.012, 8, 90]} />
            <meshStandardMaterial
              color="#45D6A6"
              emissive="#45D6A6"
              emissiveIntensity={0.5}
              transparent
              opacity={0.3}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <mesh ref={sat2Ref}>
            <octahedronGeometry args={[0.06, 0]} />
            <meshBasicMaterial color="#45D6A6" />
          </mesh>
        </group>
      </group>
    </>
  );
}

// 5. Double-Helix Twisting Pedestal Ribbon (matching reference art)
function HelixPedestal() {
  const { tube1, tube2, neon1, neon2 } = useMemo(() => {
    const pts1: THREE.Vector3[] = [];
    const pts2: THREE.Vector3[] = [];

    const steps = 36;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * Math.PI * 1.6;
      // Radius flares wide at bottom, tightens near center intersection, flares to cradle globe
      const r = 1.35 + Math.sin(t * Math.PI * 1.5 - 0.4) * 0.45;
      const y = -2.7 + t * 3.1;

      pts1.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r * 0.7));
      pts2.push(new THREE.Vector3(Math.cos(angle + Math.PI) * r, y, Math.sin(angle + Math.PI) * r * 0.7));
    }

    const c1 = new THREE.CatmullRomCurve3(pts1);
    const c2 = new THREE.CatmullRomCurve3(pts2);

    return {
      tube1: new THREE.TubeGeometry(c1, 48, 0.052, 10, false),
      tube2: new THREE.TubeGeometry(c2, 48, 0.052, 10, false),
      neon1: new THREE.TubeGeometry(c1, 48, 0.018, 8, false),
      neon2: new THREE.TubeGeometry(c2, 48, 0.018, 8, false),
    };
  }, []);

  return (
    <group position={[0, -0.15, 0]}>
      {/* Metallic Carbon Main Ribbons */}
      <mesh geometry={tube1}>
        <meshStandardMaterial
          color="#1b2034"
          metalness={0.92}
          roughness={0.22}
          emissive="#0d1124"
        />
      </mesh>
      <mesh geometry={tube2}>
        <meshStandardMaterial
          color="#1b2034"
          metalness={0.92}
          roughness={0.22}
          emissive="#0d1124"
        />
      </mesh>

      {/* Glowing Neon Veins Running Along Helix Ribbons */}
      <mesh geometry={neon1}>
        <meshBasicMaterial color="#76B8FF" transparent opacity={0.65} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh geometry={neon2}>
        <meshBasicMaterial color="#F5C76B" transparent opacity={0.55} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// 6. Central Pulsing Energy Core at Helix Intersection
function EnergyCore() {
  const coreRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (document.hidden) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.22;
    if (coreRef.current) {
      coreRef.current.scale.set(pulse, pulse, pulse);
      coreRef.current.rotation.y += 0.02;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 5 + Math.sin(state.clock.elapsedTime * 3) * 2;
    }
  });

  return (
    <group position={[0, -1.05, 0]}>
      <pointLight ref={lightRef} color="#F5C76B" distance={4.5} decay={2} />
      <mesh ref={coreRef}>
        <octahedronGeometry args={[0.16, 1]} />
        <meshBasicMaterial color="#FFF0C2" />
      </mesh>
      <mesh scale={2.2}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial
          color="#F5C76B"
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// 7. Drifting Stardust & Nebula Particle Field
function Starfield({ count = 380 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const palette = [
      new THREE.Color("#76B8FF"),
      new THREE.Color("#45D6A6"),
      new THREE.Color("#F5C76B"),
      new THREE.Color("#5965F2"),
      new THREE.Color("#9194BA"),
    ];

    for (let i = 0; i < count; i++) {
      const r = 4.5 + Math.random() * 6.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.8;
      pos[i * 3 + 2] = r * Math.cos(phi) * 0.7 - 1.5;

      const c = palette[Math.floor(Math.random() * palette.length)];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return { positions: pos, colors: col };
  }, [count]);

  useFrame((_, dt) => {
    if (document.hidden || !ref.current) return;
    ref.current.rotation.y += Math.min(dt, 0.05) * 0.012;
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

// 8. Interactive Camera Rig with Smooth Mouse Parallax
function SceneContainer({ isAmbient }: { isAmbient: boolean }) {
  const sceneRef = useRef<THREE.Group>(null);

  useFrame((state, dt) => {
    if (document.hidden || !sceneRef.current) return;
    const delta = Math.min(dt, 0.05);
    const targetX = state.pointer.x * 0.35;
    const targetY = state.pointer.y * 0.25;

    sceneRef.current.rotation.y = THREE.MathUtils.damp(
      sceneRef.current.rotation.y,
      targetX,
      2.5,
      delta
    );
    sceneRef.current.rotation.x = THREE.MathUtils.damp(
      sceneRef.current.rotation.x,
      -targetY,
      2.5,
      delta
    );
  });

  // Hero mode (Landing/Login): positioned right to elegantly frame cards on the left
  // Ambient mode (Dashboard): centered/deep background with subtle ambient opacity
  const rootPos: [number, number, number] = isAmbient ? [2.4, -0.1, -1.8] : [2.1, 0.15, -0.2];
  const rootScale = isAmbient ? 0.88 : 1.0;

  return (
    <group ref={sceneRef} position={rootPos} scale={rootScale}>
      <HolographicGlobe isAmbient={isAmbient} />
      <OrbitalSystem />
      <HelixPedestal />
      <EnergyCore />
      <Starfield count={isAmbient ? 240 : 420} />
    </group>
  );
}

export function LandingScene({ variant = "hero" }: { variant?: "hero" | "ambient" }) {
  const isAmbient = variant === "ambient";

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{
        zIndex: 0,
        opacity: isAmbient ? 0.45 : 1,
        transition: "opacity 0.6s ease",
      }}
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 8.2], fov: 46 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        <fog attach="fog" args={["#07080e", 8.5, 18]} />
        <ambientLight intensity={0.8} />
        {/* Core Rim & Dramatic Accent Lights */}
        <pointLight position={[-5, 4, 5]} intensity={14} color="#76B8FF" />
        <pointLight position={[6, -3, 3]} intensity={10} color="#5965F2" />
        <pointLight position={[0, -4, 4]} intensity={8} color="#45D6A6" />
        <directionalLight position={[0, 6, 2]} intensity={1.2} color="#f4f5ff" />

        <SceneContainer isAmbient={isAmbient} />
      </Canvas>
    </div>
  );
}
