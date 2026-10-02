"use client";
import { Canvas } from "@react-three/fiber";
import { useState } from "react";
function Block({
  position,
  size,
  colour,
  onClick,
}: {
  position: [number, number, number];
  size: [number, number, number];
  colour: string;
  onClick?: () => void;
}) {
  return (
    <mesh position={position} onClick={onClick}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={colour} />
    </mesh>
  );
}
export default function RoomCanvas({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (v: number) => void;
}) {
  const [angle, setAngle] = useState(0);
  return (
    <div className="room-canvas" aria-hidden="true">
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [6, 5, 7], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[3, 8, 5]} intensity={2} />
        <group
          rotation={[0, angle, 0]}
          onPointerMove={(e) =>
            setAngle(Math.max(-0.2, Math.min(0.2, e.point.x * 0.025)))
          }
        >
          <Block
            position={[0, -0.1, 0]}
            size={[5, 0.2, 4]}
            colour="#cfae90"
            onClick={() => onSelect(1)}
          />
          <Block
            position={[-2.5, 1.4, 0]}
            size={[0.12, 3, 4]}
            colour="#e6dfd4"
          />
          <Block position={[0, 1.4, -2]} size={[5, 3, 0.12]} colour="#f3e9da" />
          <Block
            position={[0, 0.04, 0]}
            size={[3, 0.03, 2.7]}
            colour={selected === 1 ? "#f6d9e3" : "#fbf5e9"}
            onClick={() => onSelect(1)}
          />
          <Block
            position={[-0.3, 0.5, -0.9]}
            size={[3, 1, 1.3]}
            colour="#ddaabc"
            onClick={() => onSelect(0)}
          />
          <Block
            position={[-0.3, 1.1, -1.45]}
            size={[3, 1, 0.2]}
            colour="#efc2d1"
          />
          <Block
            position={[1.4, 0.65, 1]}
            size={[0.7, 0.13, 0.7]}
            colour={selected === 2 ? "#e28eaf" : "#244d62"}
            onClick={() => onSelect(2)}
          />
          <Block
            position={[1.4, 0.3, 1]}
            size={[0.15, 0.6, 0.15]}
            colour="#244d62"
          />
          <Block
            position={[-2.4, 1.8, -0.2]}
            size={[0.16, 1.4, 1.3]}
            colour="#afcbd1"
          />
          <Block
            position={[1.8, 0.35, -1.2]}
            size={[0.35, 0.7, 0.35]}
            colour="#f4f0e7"
          />
          <mesh position={[1.8, 0.95, -1.2]}>
            <sphereGeometry args={[0.35, 12, 12]} />
            <meshStandardMaterial color="#67816b" />
          </mesh>
        </group>
      </Canvas>
    </div>
  );
}
