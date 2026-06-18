"use client";

import { useRef } from "react";
import { animated, useSpring } from "@react-spring/web";

/**
 * react-spring powered pointer parallax/tilt. Wrap any element to give it a
 * physical, spring-damped 3D tilt that reacts to the cursor. No-op feel on
 * touch (no pointer move) and respects reduced-motion via small displacement.
 */
export function Tilt({
  children,
  className,
  max = 12,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [styles, api] = useSpring(() => ({
    rotateX: 0,
    rotateY: 0,
    scale: 1,
    config: { mass: 1, tension: 220, friction: 26 },
  }));

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    api.start({ rotateX: -py * max, rotateY: px * max, scale: 1.03 });
  };
  const reset = () => api.start({ rotateX: 0, rotateY: 0, scale: 1 });

  return (
    <animated.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={className}
      style={{
        transformStyle: "preserve-3d",
        perspective: 900,
        rotateX: styles.rotateX,
        rotateY: styles.rotateY,
        scale: styles.scale,
      }}
    >
      {children}
    </animated.div>
  );
}
