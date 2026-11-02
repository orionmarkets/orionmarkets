'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// The Orion constellation, [right ascension in hours, declination in degrees, magnitude].
const STARS: Record<string, [number, number, number]> = {
  betelgeuse: [5.919, 7.41, 0.5],
  bellatrix: [5.419, 6.35, 1.6],
  meissa: [5.585, 9.93, 3.4],
  mintaka: [5.533, -0.3, 2.2],
  alnilam: [5.603, -1.2, 1.7],
  alnitak: [5.679, -1.94, 1.8],
  saiph: [5.796, -9.67, 2.1],
  rigel: [5.242, -8.2, 0.1],
  iota: [5.59, -5.91, 2.8],
  m42: [5.588, -5.39, 4],
  pi1: [4.916, 10.15, 4.6],
  pi2: [4.876, 8.9, 4.4],
  pi3: [4.83, 6.96, 3.2],
  pi4: [4.853, 5.6, 3.7],
  pi5: [4.904, 2.44, 3.7],
  pi6: [4.976, 1.71, 4.5],
  mu: [6.04, 9.65, 4.1],
  nu: [6.126, 14.77, 4.4],
  xi: [6.2, 14.21, 4.5],
  chi1: [5.906, 20.28, 4.4],
  chi2: [6.065, 20.14, 4.6],
};
const LINES: Array<[string, string]> = [
  ['meissa', 'betelgeuse'], ['meissa', 'bellatrix'], ['betelgeuse', 'alnitak'], ['bellatrix', 'mintaka'],
  ['mintaka', 'alnilam'], ['alnilam', 'alnitak'], ['alnitak', 'saiph'], ['mintaka', 'rigel'],
  ['alnilam', 'm42'], ['m42', 'iota'], ['bellatrix', 'pi3'], ['pi1', 'pi2'], ['pi2', 'pi3'], ['pi3', 'pi4'],
  ['pi4', 'pi5'], ['pi5', 'pi6'], ['betelgeuse', 'mu'], ['mu', 'nu'], ['nu', 'xi'], ['nu', 'chi1'], ['chi1', 'chi2'],
];

const STAR_VERTEX = /* glsl */ `
  attribute float size;
  attribute float phase;
  attribute vec3 tint;
  uniform float uTime;
  uniform float uPixel;
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.72 + 0.28 * sin(uTime * (0.8 + phase * 0.6) + phase * 6.28);
    gl_PointSize = size * uPixel * twinkle * (240.0 / -mv.z);
    vTint = tint;
    vAlpha = twinkle;
  }
`;
const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, d);
    float glow = pow(core, 3.0) + 0.35 * pow(core, 1.2);
    gl_FragColor = vec4(vTint, glow * vAlpha);
  }
`;

/**
 * The hero sky: the Orion constellation in three.js, figure stars in depth over a field of dust stars, its lines drawn
 * in from lime to blue. Slow orbit plus pointer parallax; paused off screen; one still frame with reduced motion.
 */
export function OrionSky({ className = '' }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      el.dataset.ready = 'fallback';
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(dpr);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 1, 2000);
    camera.position.set(0, 0, 150);
    const group = new THREE.Group();
    scene.add(group);

    const lime = new THREE.Color('#b0e135');
    const blue = new THREE.Color('#4178ff');
    const white = new THREE.Color('#eef6e4');
    const uniforms = { uTime: { value: 0 }, uPixel: { value: dpr } };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Sky coordinates to scene units: Orion spans about 1.4h by 30°; centred on the belt.
    const pos = new Map<string, THREE.Vector3>();
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const [name, [ra, dec]] of Object.entries(STARS)) {
      const x = -(ra - 5.6) * 15 * Math.cos((dec * Math.PI) / 180) * 3.2;
      const y = (dec - 3.5) * 3.2;
      pos.set(name, new THREE.Vector3(x, y, (rand() - 0.5) * 50));
    }

    const figure = new THREE.BufferGeometry();
    const fPos: number[] = [];
    const fSize: number[] = [];
    const fPhase: number[] = [];
    const fTint: number[] = [];
    for (const [name, [, , mag]] of Object.entries(STARS)) {
      const p = pos.get(name)!;
      fPos.push(p.x, p.y, p.z);
      fSize.push(name === 'm42' ? 26 : 5 + (4.8 - mag) * 3.2);
      fPhase.push(rand());
      const c = name === 'betelgeuse' ? new THREE.Color('#ffb36b') : name === 'rigel' || name === 'm42' ? blue : name.startsWith('al') || name === 'mintaka' ? lime : white;
      fTint.push(c.r, c.g, c.b);
    }
    figure.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
    figure.setAttribute('size', new THREE.Float32BufferAttribute(fSize, 1));
    figure.setAttribute('phase', new THREE.Float32BufferAttribute(fPhase, 1));
    figure.setAttribute('tint', new THREE.Float32BufferAttribute(fTint, 3));
    group.add(new THREE.Points(figure, material));

    const dust = new THREE.BufferGeometry();
    const DUST = 1400;
    const dPos = new Float32Array(DUST * 3);
    const dSize = new Float32Array(DUST);
    const dPhase = new Float32Array(DUST);
    const dTint = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
      dPos.set([(rand() - 0.5) * 420, (rand() - 0.5) * 260, -40 - rand() * 260], i * 3);
      dSize[i] = 0.8 + rand() * rand() * 4;
      dPhase[i] = rand();
      const c = rand() < 0.12 ? lime : rand() < 0.2 ? blue : white;
      dTint.set([c.r * 0.8, c.g * 0.8, c.b * 0.8], i * 3);
    }
    dust.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    dust.setAttribute('size', new THREE.BufferAttribute(dSize, 1));
    dust.setAttribute('phase', new THREE.BufferAttribute(dPhase, 1));
    dust.setAttribute('tint', new THREE.BufferAttribute(dTint, 3));
    scene.add(new THREE.Points(dust, material));

    const lineGeo = new THREE.BufferGeometry();
    const lPos: number[] = [];
    const lCol: number[] = [];
    for (const [a, b] of LINES) {
      const pa = pos.get(a)!;
      const pb = pos.get(b)!;
      lPos.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
      const ca = lime.clone().lerp(blue, (pa.x + 80) / 160);
      const cb = lime.clone().lerp(blue, (pb.x + 80) / 160);
      lCol.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b);
    }
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lPos, 3));
    lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lCol, 3));
    const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    lineGeo.setDrawRange(0, 0);
    group.add(lines);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let tx = 0;
    let ty = 0;
    let frame = 0;
    let visible = true;
    const start = performance.now();

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      // Keep the whole figure in view on narrow screens.
      camera.position.z = camera.aspect < 1 ? 150 / Math.max(camera.aspect, 0.55) : 150;
      // Wide screens: the hunter stands right of the headline instead of behind it.
      group.position.x = camera.aspect > 1.2 ? 34 * Math.min(camera.aspect - 0.6, 1.2) : 0;
      group.scale.setScalar(camera.aspect > 1.2 ? 0.82 : 1);
      camera.updateProjectionMatrix();
    };

    const render = (now: number) => {
      const t = (now - start) / 1000;
      uniforms.uTime.value = t;
      lineGeo.setDrawRange(0, reduce ? LINES.length * 2 : Math.min(LINES.length * 2, Math.floor(t * 9) * 2));
      group.rotation.y = Math.sin(t * 0.08) * 0.35 + tx * 0.25;
      group.rotation.x = ty * 0.15;
      scene.rotation.z = Math.sin(t * 0.05) * 0.04;
      renderer.render(scene, camera);
    };
    const loop = (now: number) => {
      render(now);
      if (visible) frame = requestAnimationFrame(loop);
    };
    const onMove = (e: PointerEvent) => {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible && !reduce) frame = requestAnimationFrame(loop);
    });
    const ro = new ResizeObserver(() => {
      resize();
      render(performance.now());
    });

    resize();
    render(performance.now());
    el.dataset.ready = 'true';
    ro.observe(el);
    io.observe(el);
    if (!reduce) window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      figure.dispose();
      dust.dispose();
      lineGeo.dispose();
      material.dispose();
      lineMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className={`orion-sky ${className}`} aria-hidden="true" />;
}
