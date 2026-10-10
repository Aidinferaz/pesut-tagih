import * as THREE from "three";

/** Water from the mouth, splashes on landing, thinking bubbles, confetti. */
export type ParticleKind = "squirt" | "splash" | "bubble" | "confetti";

export const PARTICLE_POOL = 64;

const PALETTE: Record<ParticleKind, string[]> = {
  squirt: ["#cfeef2", "#9fd8e2", "#ffffff"],
  splash: ["#cfeef2", "#9fd8e2"],
  bubble: ["#e8f6f8"],
  confetti: ["#f4c21b", "#f2781e", "#d2382b", "#ffffff"],
};

type Particle = {
  life: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  gravity: number;
  size: number;
};

const dummy = new THREE.Object3D();
const paint = new THREE.Color();
const jitter = () => (Math.random() - 0.5) * 0.4;

/**
 * A fixed pool of voxel particles drawn by one instanced mesh. Slots are
 * reused round-robin, so emitting never allocates once the pool exists.
 */
export class ParticleSystem {
  private particles: Particle[] = Array.from({ length: PARTICLE_POOL }, () => ({
    life: 0,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    gravity: 0,
    size: 0.08,
  }));
  private mesh: THREE.InstancedMesh | null = null;
  private cursor = 0;
  private owed = 0;
  private forward = new THREE.Vector3();

  attach(mesh: THREE.InstancedMesh) {
    this.mesh = mesh;
    for (let i = 0; i < PARTICLE_POOL; i += 1) mesh.setColorAt(i, paint.set("#ffffff"));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /** `rate` accumulates across frames, so 0.1 per frame means one particle every ten frames. */
  emit = (kind: ParticleKind, origin: THREE.Vector3, rate = 1, yaw = 0) => {
    this.owed += rate;
    while (this.owed >= 1) {
      this.owed -= 1;
      this.spawn(kind, origin, yaw);
    }
  };

  step = (delta: number) => {
    const mesh = this.mesh;
    if (!mesh) return;
    this.particles.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= delta;
        p.vel.y -= p.gravity * delta;
        p.pos.addScaledVector(p.vel, delta);
      }
      dummy.position.copy(p.pos);
      dummy.rotation.set(p.pos.x * 3, p.pos.y * 3, 0);
      dummy.scale.setScalar(p.life > 0 ? p.size : 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  private spawn(kind: ParticleKind, origin: THREE.Vector3, yaw: number) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % PARTICLE_POOL;
    const p = this.particles[i];
    const colors = PALETTE[kind];
    if (this.mesh) {
      this.mesh.setColorAt(i, paint.set(colors[Math.floor(Math.random() * colors.length)]));
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }

    switch (kind) {
      case "squirt":
        // The mouth sits at the front of the head; turn it with the body's yaw.
        this.forward.set(Math.cos(yaw), 0, -Math.sin(yaw));
        p.pos.copy(origin).addScaledVector(this.forward, 1.15);
        p.vel.copy(this.forward).multiplyScalar(2.4);
        p.vel.x += jitter();
        p.vel.y = 2.2 + jitter();
        p.vel.z += jitter();
        p.gravity = 5;
        p.size = 0.07;
        p.life = 1.1;
        break;
      case "splash":
        p.pos.copy(origin).setY(0);
        p.vel.set(jitter() * 5, 2 + Math.random() * 1.5, jitter() * 3);
        p.gravity = 7;
        p.size = 0.09;
        p.life = 0.9;
        break;
      case "bubble":
        p.pos.copy(origin);
        p.pos.x += 0.4;
        p.pos.y += 0.65;
        p.vel.set(jitter() * 0.3, 0.6, jitter() * 0.3);
        p.gravity = -0.2;
        p.size = 0.06;
        p.life = 1.6;
        break;
      case "confetti":
        p.pos.copy(origin);
        p.pos.y += 0.7;
        p.vel.set(jitter() * 6, 2.5 + Math.random() * 2, jitter() * 4);
        p.gravity = 4.5;
        p.size = 0.07;
        p.life = 1.8;
        break;
    }
  }
}
