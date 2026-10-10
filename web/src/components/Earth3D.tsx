import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useFmt } from '../i18n';
import type { Hotspot } from '../lib/spatial';

interface Props {
  areas: GeoJSON.Feature[]; points: Hotspot[]; focus: [number, number];
  onSelect: (point: Hotspot) => void; onUnavailable: () => void;
}

// SphereGeometry UVs: Greenwich is +X, east is -Z, north is +Y.
export function earthPosition(lon: number, lat: number, radius = 1) {
  const phi = THREE.MathUtils.degToRad(lat), theta = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(phi) * Math.cos(theta), Math.sin(phi), -Math.cos(phi) * Math.sin(theta)).multiplyScalar(radius);
}

interface SceneHandle {
  camera: THREE.PerspectiveCamera; controls: OrbitControls;
  markers: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  boundary: THREE.LineSegments; render: () => void; focus: (distance: number) => void;
}

export default function Earth3D(props: Props) {
  const { lang, num } = useFmt();
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const latest = useRef(props); latest.current = props;
  const [selected, setSelected] = useState<Hotspot | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    // Probe before Three logs an expected unsupported-WebGL error.
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { alpha: true, antialias: true, preserveDrawingBuffer: true });
    if (!context) { latest.current.onUnavailable(); return; }
    try { renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' }); }
    catch { latest.current.onUnavailable(); return; }
    let disposed = false, frame = 0;
    const textures: THREE.Texture[] = [];
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, .01, 30);
    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false; controls.enableDamping = false;
    controls.minDistance = 1.12; controls.maxDistance = 5;
    controls.rotateSpeed = .5; controls.zoomSpeed = .65;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 640 ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    element.appendChild(canvas);
    const render = () => {
      if (disposed || frame) return;
      frame = requestAnimationFrame(() => { frame = 0; if (!disposed) renderer.render(scene, camera); });
    };
    const focus = (distance: number) => {
      camera.position.copy(earthPosition(...latest.current.focus, distance));
      camera.up.set(0, 1, 0); controls.target.set(0, 0, 0); controls.update(); render();
    };
    scene.add(new THREE.AmbientLight(0xffffff, 1.05));
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.3);
    sun.position.copy(earthPosition(125, 40, 5)); scene.add(sun);
    const geometry = new THREE.SphereGeometry(1, 96, 64);
    const surface = new THREE.MeshStandardMaterial({ roughness: .86, metalness: 0 });
    const earth = new THREE.Mesh(geometry, surface); scene.add(earth);
    const cloudMaterial = new THREE.MeshStandardMaterial({ transparent: true, opacity: .48, depthWrite: false, roughness: 1 });
    const clouds = new THREE.Mesh(geometry, cloudMaterial); clouds.scale.setScalar(1.004); clouds.visible = false; scene.add(clouds);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, depthWrite: false,
      uniforms: { rim: { value: new THREE.Color('#c4e9f5') } },
      vertexShader: 'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
      fragmentShader: 'varying vec3 n; varying vec3 v; uniform vec3 rim; void main(){float f=pow(1.-abs(dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(rim,f*.3);}',
    });
    const atmosphere = new THREE.Mesh(geometry, atmosphereMaterial); atmosphere.scale.setScalar(1.012); scene.add(atmosphere);
    const pointMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, vertexColors: true,
      uniforms: { pixelRatio: { value: renderer.getPixelRatio() } },
      vertexShader: 'varying vec3 tint; uniform float pixelRatio; void main(){tint=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(8./-p.z,3.,10.)*pixelRatio;}',
      fragmentShader: 'varying vec3 tint; void main(){float d=length(gl_PointCoord-vec2(.5));if(d>.5)discard;gl_FragColor=vec4(tint,1.-smoothstep(.25,.5,d));}',
    });
    const markers = new THREE.Points(new THREE.BufferGeometry(), pointMaterial); scene.add(markers);
    const boundaryMaterial = new THREE.LineBasicMaterial({ color: '#e7f5e9', transparent: true, opacity: .8 });
    const boundary = new THREE.LineSegments(new THREE.BufferGeometry(), boundaryMaterial); scene.add(boundary);
    sceneRef.current = { camera, controls, markers, boundary, render, focus };
    focus(3.15);
    const resize = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); render();
    }); resize.observe(element);
    controls.addEventListener('change', render);
    const loader = new THREE.TextureLoader();
    const day = loader.load(`${import.meta.env.BASE_URL}earth/2k_earth_daymap.jpg`, texture => {
      if (disposed) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      surface.map = texture; surface.needsUpdate = true; setReady(true); render();
    }, undefined, () => { if (!disposed) latest.current.onUnavailable(); }); textures.push(day);
    const cloud = loader.load(`${import.meta.env.BASE_URL}earth/2k_earth_clouds.jpg`, texture => {
      if (disposed) { texture.dispose(); return; }
      cloudMaterial.alphaMap = texture; cloudMaterial.needsUpdate = true; clouds.visible = true; render();
    }); textures.push(cloud);
    const lost = (e: Event) => { e.preventDefault(); latest.current.onUnavailable(); };
    canvas.addEventListener('webglcontextlost', lost);
    const ray = new THREE.Raycaster();
    ray.params.Points = { threshold: .012 };
    const pointer = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    const hit = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
      ray.setFromCamera(pointer, camera);
      const surfaceHit = ray.intersectObject(earth)[0];
      return ray.intersectObject(markers).find(h => h.index !== undefined && (!surfaceHit || h.distance <= surfaceHit.distance + .012));
    };
    const move = (e: PointerEvent) => {
      if (e.buttons) return;
      const result = hit(e); setSelected(result?.index !== undefined ? latest.current.points[result.index] : null);
    };
    const start = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const end = (e: PointerEvent) => {
      if (down && Math.hypot(down.x - e.clientX, down.y - e.clientY) < 5) {
        const result = hit(e); const point = result?.index !== undefined ? latest.current.points[result.index] : null;
        setSelected(point); if (point) latest.current.onSelect(point);
      } down = null;
    };
    const leave = () => setSelected(null);
    canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerdown', start); canvas.addEventListener('pointerup', end); canvas.addEventListener('pointerleave', leave);
    return () => {
      disposed = true; cancelAnimationFrame(frame); resize.disconnect(); controls.dispose();
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerdown', start); canvas.removeEventListener('pointerup', end); canvas.removeEventListener('pointerleave', leave);
      geometry.dispose(); surface.dispose(); cloudMaterial.dispose(); atmosphereMaterial.dispose();
      markers.geometry.dispose(); pointMaterial.dispose(); boundary.geometry.dispose(); boundaryMaterial.dispose();
      textures.forEach(texture => texture.dispose()); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handle = sceneRef.current; if (!handle) return;
    const position: number[] = [], color: number[] = [];
    props.points.forEach(p => {
      position.push(...earthPosition(p.lon, p.lat, 1.007).toArray());
      color.push(...new THREE.Color(p.status === 2 ? '#3982a2' : '#ff5c16').toArray());
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
    handle.markers.geometry.dispose(); handle.markers.geometry = geometry; setSelected(null); handle.render();
  }, [props.points]);

  useEffect(() => {
    const handle = sceneRef.current; if (!handle) return;
    const segments: number[] = [];
    props.areas.forEach(f => {
      const g = f.geometry;
      const polygons = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
      polygons.forEach(polygon => polygon.forEach(ring => {
        for (let i = 1; i < ring.length; i++) segments.push(...earthPosition(ring[i - 1][0], ring[i - 1][1], 1.006).toArray(), ...earthPosition(ring[i][0], ring[i][1], 1.006).toArray());
      }));
    });
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
    handle.boundary.geometry.dispose(); handle.boundary.geometry = geometry; handle.render();
  }, [props.areas]);
  useEffect(() => { sceneRef.current?.focus(3.15); setSelected(null); }, [props.focus[0], props.focus[1]]);

  const zoom = (factor: number) => {
    const h = sceneRef.current; if (!h) return;
    h.camera.position.setLength(THREE.MathUtils.clamp(h.camera.position.length() * factor, 1.12, 5)); h.controls.update(); h.render();
  };
  return <div className="earth-renderer earth-realistic" data-ready={ready}>
    <div ref={host} className="earth-scene" tabIndex={0} role="img" aria-label={lang === 'bn' ? 'পৃথিবী: টেনে বা তীরচিহ্ন দিয়ে ঘোরান, + বা − দিয়ে জুম করুন' : 'Earth: drag or use arrow keys to rotate, + or − to zoom'} onKeyDown={e => {
      const h = sceneRef.current; if (!h || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-'].includes(e.key)) return;
      e.preventDefault();
      if (e.key === '+') zoom(.85); else if (e.key === '-') zoom(1.15); else {
        const spherical = new THREE.Spherical().setFromVector3(h.camera.position);
        spherical.theta += e.key === 'ArrowLeft' ? -.1 : e.key === 'ArrowRight' ? .1 : 0;
        spherical.phi += e.key === 'ArrowUp' ? -.1 : e.key === 'ArrowDown' ? .1 : 0;
        spherical.makeSafe(); h.camera.position.setFromSpherical(spherical); h.controls.update(); h.render();
      }
    }} />
    {!ready && <p className="earth-loading" role="status">{lang === 'bn' ? 'পৃথিবীর চিত্র লোড হচ্ছে…' : 'Loading Earth imagery…'}</p>}
    <div className="earth-tools"><button onClick={() => zoom(.8)} aria-label={lang === 'bn' ? 'জুম বাড়ান' : 'Zoom in'}>+</button><button onClick={() => zoom(1.25)} aria-label={lang === 'bn' ? 'জুম কমান' : 'Zoom out'}>−</button><button onClick={() => sceneRef.current?.focus(1.3)}>{lang === 'bn' ? 'কেন্দ্র' : 'Focus'}</button><button onClick={() => sceneRef.current?.focus(3.15)}>{lang === 'bn' ? 'পৃথিবী' : 'Reset view'}</button></div>
    <p className="earth-detail" aria-live="polite">{selected ? `${selected.lon.toFixed(3)}° E · ${selected.lat.toFixed(3)}° N · ${lang === 'bn' ? 'সপ্তাহ' : 'Week'} ${num(selected.week)} · ${selected.status === 2 ? (lang === 'bn' ? 'স্থির উৎস' : 'Static source') : (lang === 'bn' ? 'শনাক্ত আগুন' : 'Retained detection')}` : (lang === 'bn' ? 'টেনে ঘোরান · আগুনে ক্লিক করে জেলা নির্বাচন করুন' : 'Drag to rotate · Select a detection to explore its district')}</p>
  </div>;
}
