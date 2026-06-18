"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Three.js hero backdrop - a slowly rotating spherical particle field in the
 * brand gradient with a wireframe core, gently parallaxing toward the cursor.
 * Decorative (aria-hidden), dynamically imported (ssr:false) so it never blocks
 * first paint, and fully skipped for prefers-reduced-motion users.
 */

function Scene({ count = 2800 }: { count?: number }) {
  const group = useRef<THREE.Group>(null);
  const points = useRef<THREE.Points>(null);
  const core = useRef<THREE.Mesh>(null);

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const a = new THREE.Color("#4f46e5"); // brand-600
    const b = new THREE.Color("#38bdf8"); // accent-400
    for (let i = 0; i < count; i++) {
      const r = 2.6 + Math.random() * 0.55;
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = 2 * Math.PI * Math.random();
      pos.set(
        [r * Math.sin(theta) * Math.cos(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(theta)],
        i * 3
      );
      const c = a.clone().lerp(b, (r * Math.sin(theta) * Math.sin(phi) + r) / (2 * r));
      col.set([c.r, c.g, c.b], i * 3);
    }
    return [pos, col];
  }, [count]);

  useFrame((state, delta) => {
    if (points.current) {
      points.current.rotation.y += delta * 0.07;
      points.current.rotation.x += delta * 0.02;
    }
    if (core.current) {
      core.current.rotation.y -= delta * 0.1;
      core.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.04);
    }
    if (group.current) {
      // ease the whole sphere toward the pointer for a parallax feel
      group.current.rotation.y += (state.pointer.x * 0.35 - group.current.rotation.y) * 0.04;
      group.current.rotation.x += (-state.pointer.y * 0.25 - group.current.rotation.x) * 0.04;
    }
  });

  return (
    <group ref={group}>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.034} vertexColors transparent opacity={0.92} sizeAttenuation depthWrite={false} />
      </points>
      <mesh ref={core}>
        <icosahedronGeometry args={[1.5, 1]} />
        <meshBasicMaterial color="#6366f1" wireframe transparent opacity={0.16} />
      </mesh>
    </group>
  );
}

export default function Hero3D() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);

  if (reduced) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
