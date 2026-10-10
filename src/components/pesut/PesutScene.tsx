"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import {
  buildBody,
  buildCape,
  buildEyes,
  buildFin,
  buildFluke,
  finPivotZ,
  FIN_PIVOT,
  FLUKE_PIVOT_X,
  CAPE_LENGTH,
  type CapeCell,
  type Voxel,
} from "./model";
import { ACTION_DURATION, usePesut, type PesutAction } from "./mood";
import { PARTICLE_POOL, ParticleSystem } from "./particles";

/** World units per voxel. The whole dolphin ends up about 3.2 units long. */
const SCALE = 0.13;
const CUBE = new THREE.BoxGeometry(0.96, 0.96, 0.96);
const dummy = new THREE.Object3D();
const paint = new THREE.Color();

type Pointer = { x: number; y: number };

export type PesutSceneProps = {
  /** Resolved CSS colours for the river, so the water follows the theme. */
  water: string;
  foam: string;
  /** Run the render loop. False when off-screen or the tab is hidden. */
  active: boolean;
  /** prefers-reduced-motion: hold a calm pose, skip the travelling motion. */
  still: boolean;
  /** Pointer position relative to the stage centre, -1..1 on each axis. */
  pointer: RefObject<Pointer>;
};

export default function PesutScene(props: PesutSceneProps) {
  return (
    <Canvas
      frameloop={props.active ? "always" : "demand"}
      dpr={[1, 2]}
      camera={{ position: [0, 2, 7.6], fov: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={({ camera }) => camera.lookAt(0, 0.95, 0)}
    >
      <hemisphereLight args={["#ffffff", "#0b5d5e", 1.25]} />
      <directionalLight position={[4, 6, 5]} intensity={1.7} />
      <River water={props.water} foam={props.foam} />
      <Rig {...props} />
    </Canvas>
  );
}

/**
 * The river surface: a wide sheet reaching past the camera so it fills the
 * bottom of the panel, translucent enough that the belly shows through it.
 * A foam band marks the far bank.
 */
function River({ water, foam }: { water: string; foam: string }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -2]}>
        <planeGeometry args={[40, 30]} />
        <meshBasicMaterial color={water} transparent opacity={0.86} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -9]}>
        <planeGeometry args={[40, 1.2]} />
        <meshBasicMaterial color={foam} transparent opacity={0.6} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** A static list of voxels as one instanced mesh: one draw call per part. */
function VoxelMesh({
  voxels,
  meshRef,
}: {
  voxels: Voxel[];
  meshRef?: RefObject<THREE.InstancedMesh | null>;
}) {
  const local = useRef<THREE.InstancedMesh>(null);
  const ref = meshRef ?? local;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    voxels.forEach((v, i) => {
      dummy.position.set(v.x, v.y, v.z);
      dummy.scale.setScalar(1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, paint.set(v.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [voxels, ref]);
  return (
    <instancedMesh ref={ref} args={[CUBE, undefined, voxels.length]}>
      <meshLambertMaterial />
    </instancedMesh>
  );
}

const easeOutBack = (p: number) => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;
const progressOf = (action: { kind: PesutAction; at: number } | null, now: number) => {
  if (!action) return { kind: null, p: 1 };
  const p = (now - action.at) / 1000 / ACTION_DURATION[action.kind];
  return p >= 1 ? { kind: null, p: 1 } : { kind: action.kind, p };
};

function Rig({ still, pointer }: PesutSceneProps) {
  const body = useMemo(() => buildBody(), []);
  const eyes = useMemo(() => buildEyes(), []);
  const finL = useMemo(() => buildFin(1), []);
  const finR = useMemo(() => buildFin(-1), []);
  const fluke = useMemo(() => buildFluke(), []);
  const cape = useMemo(() => buildCape(), []);
  const finZ = useMemo(() => finPivotZ(), []);

  const root = useRef<THREE.Group>(null);
  const finLRef = useRef<THREE.Group>(null);
  const finRRef = useRef<THREE.Group>(null);
  const flukeRef = useRef<THREE.Group>(null);
  const eyeMesh = useRef<THREE.InstancedMesh>(null);
  const capeMesh = useRef<THREE.InstancedMesh>(null);
  const particles = useParticles();
  const nextBlink = useRef(2);
  const lastSplash = useRef(0);
  const followYaw = useRef(-0.55);

  useFrame(({ clock }, delta) => {
    const g = root.current;
    if (!g) return;
    const t = still ? 0 : clock.elapsedTime;
    const now = performance.now();
    const { mood, action } = usePesut.getState();
    const { kind, p } = progressOf(action, now);

    // Swim: bob on the surface, fins paddle, fluke beats up and down.
    const pace = mood === "happy" ? 1.6 : mood === "worried" ? 0.6 : 1;
    let y = 0.42 + Math.sin(t * 1.5 * pace) * 0.1;
    let pitch = Math.sin(t * 0.9) * 0.04;
    let spin = 0;
    let flourish = 0;

    if (kind === "poke") {
      spin = easeOutBack(p) * Math.PI * 2;
      y += Math.sin(p * Math.PI) * 0.35;
    } else if (kind === "jump" || kind === "celebrate") {
      y += 4 * 1.7 * p * (1 - p);
      pitch = (0.5 - p) * 1.3;
      flourish = Math.sin(p * Math.PI);
      if (kind === "celebrate") spin = easeOutBack(p) * Math.PI * 2;
      if (p > 0.92 && now - lastSplash.current > 800) {
        lastSplash.current = now;
        particles.emit("splash", g.position, 14);
      }
      if (kind === "celebrate" && p < 0.6) particles.emit("confetti", g.position, 0.5);
    } else if (kind === "squirt") {
      pitch = Math.sin(Math.min(p * 2, 1) * Math.PI * 0.5) * 0.45 * (1 - p);
      if (p > 0.15 && p < 0.75) particles.emit("squirt", g.position, 1, g.rotation.y);
    }
    if (mood === "thinking") particles.emit("bubble", g.position, 0.08);
    if (mood === "worried") pitch -= 0.12;

    // Follow the pointer with the head, softly.
    const target = pointer.current ?? { x: 0, y: 0 };
    followYaw.current = THREE.MathUtils.damp(followYaw.current, -0.55 + target.x * 0.6, 4, delta);
    g.rotation.y = followYaw.current + spin;
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, pitch + target.y * 0.18, 5, delta);
    g.position.y = THREE.MathUtils.damp(g.position.y, y, 10, delta);

    const paddle = still ? 0 : Math.sin(t * 3 * pace);
    if (finLRef.current) finLRef.current.rotation.x = -0.25 + paddle * 0.3;
    if (finRRef.current) finRRef.current.rotation.x = 0.25 - paddle * 0.3;
    if (flukeRef.current) flukeRef.current.rotation.z = paddle * (0.22 + flourish * 0.3);

    updateEyes(eyeMesh.current, eyes, t, nextBlink, mood);
    updateCape(capeMesh.current, cape, t, flourish, still);
    particles.step(delta);
  });

  return (
    <>
      <group ref={root} scale={SCALE} position-x={0.7}>
        <VoxelMesh voxels={body} />
        <VoxelMesh voxels={eyes} meshRef={eyeMesh} />
        <group ref={finLRef} position={[FIN_PIVOT.x, FIN_PIVOT.y, finZ]}>
          <VoxelMesh voxels={finL} />
        </group>
        <group ref={finRRef} position={[FIN_PIVOT.x, FIN_PIVOT.y, -finZ]}>
          <VoxelMesh voxels={finR} />
        </group>
        <group ref={flukeRef} position={[FLUKE_PIVOT_X, 0, 0]}>
          <VoxelMesh voxels={fluke} />
        </group>
        <VoxelMesh voxels={cape} meshRef={capeMesh} />
      </group>
      {particles.node}
    </>
  );
}

function updateEyes(
  mesh: THREE.InstancedMesh | null,
  eyes: Voxel[],
  t: number,
  nextBlink: RefObject<number>,
  mood: string,
) {
  if (!mesh) return;
  if (t > nextBlink.current + 0.14) nextBlink.current = t + 2.5 + Math.random() * 3;
  const blinking = t > nextBlink.current;
  const lid = blinking ? 0.12 : mood === "worried" ? 0.55 : mood === "happy" ? 0.4 : 1;
  eyes.forEach((v, i) => {
    dummy.position.set(v.x, v.y, v.z);
    dummy.rotation.set(0, 0, 0);
    const shine = i >= 4;
    dummy.scale.set(shine ? 0.45 : 1, (shine ? 0.45 : 1) * lid, shine ? 0.45 : 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

/** Ripples the cape from neck to hem; a jump or celebration lifts it into a flourish. */
function updateCape(
  mesh: THREE.InstancedMesh | null,
  cape: CapeCell[],
  t: number,
  flourish: number,
  still: boolean,
) {
  if (!mesh) return;
  cape.forEach((c, i) => {
    const reach = c.u / CAPE_LENGTH;
    const wave = still
      ? 0
      : Math.sin(t * 5 - c.u * 0.8 + c.v * 0.15) * (0.25 + flourish * 0.9) * reach;
    const lift = flourish * reach * reach * 3.5;
    dummy.position.set(c.x - lift * 0.4, c.y + wave + lift, c.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

/** The particle pool lives in a plain object so the render loop can mutate it freely. */
function useParticles() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const [system] = useState(() => new ParticleSystem());

  // Give every slot a colour up front: the shader only supports per-instance
  // colour if the attribute exists when the material first compiles.
  useLayoutEffect(() => {
    if (mesh.current) system.attach(mesh.current);
  }, [system]);

  const node = (
    <instancedMesh ref={mesh} args={[CUBE, undefined, PARTICLE_POOL]} frustumCulled={false}>
      <meshLambertMaterial />
    </instancedMesh>
  );
  return { emit: system.emit, step: system.step, node };
}
