import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, useAnimations, Html, AdaptiveDpr, Stars, Environment, Lightformer } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { SkeletonUtils } from 'three-stdlib'
import * as THREE from 'three'
import type { Hotspot } from '../lib/catalog'
import { ANCHORS } from '../lib/anchors.generated'
import { SEAMS, type SeamSpec } from '../lib/plates.generated'

const FOV = 32

/**
 * Opening camera distance, solved so the model spans the same fraction of the
 * viewport width as it does in the seam still.
 *
 * The still is shown with object-fit: cover, so its on-screen width is
 * max(W, H * aspect), and `fill` (measured by scripts/make-posters.mjs) is the
 * fraction of that the model covers. On the live side, the model's silhouette
 * points are projected with real perspective -- near geometry reads wider than
 * far geometry, which a flat bounding-box estimate gets wrong by ~10% on a
 * model as deep as the TIE -- and the distance is found by bisection.
 */
function openingDistance(seam: SeamSpec, hull: [number, number, number][], W: number, H: number) {
  const dir = new THREE.Vector3(...seam.view).normalize()
  const forward = dir.clone().negate()
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
  const target = Math.min(0.9, (seam.fill * Math.max(W, H * seam.aspect)) / W)
  const tanHalfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (W / H)

  // On-screen width of the model as a fraction of the viewport, at distance d.
  const span = (d: number) => {
    let lo = Infinity, hi = -Infinity
    for (const [x, y, z] of hull) {
      const depth = d - (x * dir.x + y * dir.y + z * dir.z)
      if (depth <= 0) return Infinity
      const sx = (x * right.x + y * right.y + z * right.z) / (depth * tanHalfH)
      lo = Math.min(lo, sx)
      hi = Math.max(hi, sx)
    }
    return (hi - lo) / 2
  }

  // span() falls monotonically with distance, so bisect.
  const r = Math.max(...hull.map((p) => Math.hypot(...p)))
  let near = r * 1.01, far = r * 200
  for (let i = 0; i < 40; i++) {
    const mid = (near + far) / 2
    if (span(mid) > target) near = mid
    else far = mid
  }
  return { dir, distance: (near + far) / 2 }
}

function Rig({ seam, size, hull, touched }: { seam: SeamSpec; size: [number, number, number]; hull: [number, number, number][]; touched: React.RefObject<boolean> }) {
  const camera = useThree((s) => s.camera)
  const { width, height } = useThree((s) => s.size)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null

  useEffect(() => {
    // Once the viewer has orbited, a resize must not yank the camera back.
    if (touched.current || !width || !height) return
    const { dir, distance } = openingDistance(seam, hull, width, height)
    camera.position.copy(dir).multiplyScalar(distance)
    camera.lookAt(0, 0, 0)
    const r = Math.hypot(...size) / 2
    camera.near = r / 100
    camera.far = distance + r * 40
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.set(0, 0, 0)
      controls.maxDistance = Math.max(r * 7, distance * 1.6)
      controls.update()
    }
  }, [camera, controls, seam, size, hull, width, height, touched])
  return null
}

/** Fires once, after the first frame that actually contains the model. */
function ReadySignal({ onReady }: { onReady?: () => void }) {
  const fired = useRef(false)
  useFrame(() => {
    if (fired.current) return
    fired.current = true
    // One more frame so the draw has reached the screen, not just the GPU queue.
    requestAnimationFrame(() => onReady?.())
  })
  return null
}

/** Clips that loop; everything else plays once and holds its last frame. */
const LOOPING = /(^|_)(Idle|March|Run)$/

/** "B1_Turn90_L" -> "Turn 90 L", "B1_RogerRoger" -> "Roger Roger". */
const clipLabel = (name: string) =>
  name
    .replace(/^[A-Z0-9]+_/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Z])/g, '$1 $2')

function Model({
  url,
  wireframe,
  explode,
  centre,
  clip,
  onClips,
}: {
  url: string
  wireframe: boolean
  explode: number
  /** Measured by scripts/anchors.mjs. Anchors and hull are relative to this same point. */
  centre?: [number, number, number]
  clip: string | null
  onClips: (names: string[]) => void
}) {
  const { scene, animations } = useGLTF(url, false, true)
  const root = useRef<THREE.Group>(null)

  const { centred, rest, skinned } = useMemo(() => {
    let skinned = false
    scene.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true
    })
    // Object3D.clone() leaves a SkinnedMesh bound to the ORIGINAL bones, which
    // are not in the rendered scene and never update: the mesh would render
    // collapsed or frozen. SkeletonUtils rebinds the clone to its own bones.
    const clone = skinned ? (SkeletonUtils.clone(scene) as THREE.Group) : scene.clone(true)
    // Centre on the measured point rather than a runtime bounding box: three.js
    // cannot measure a skinned mesh's pose until a render has updated its skeleton.
    const c = centre ? new THREE.Vector3(...centre) : new THREE.Box3().setFromObject(clone).getCenter(new THREE.Vector3())
    clone.position.sub(c)
    const rest = new Map<THREE.Object3D, THREE.Vector3>()
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) rest.set(o, o.position.clone())
    })
    return { centred: clone, rest, skinned }
  }, [scene, centre])

  const { actions, mixer } = useAnimations(animations, root)

  useEffect(() => {
    onClips(animations.map((a) => a.name))
  }, [animations, onClips])

  useEffect(() => {
    mixer.stopAllAction()
    if (!clip) {
      // Back to the bind pose, which for these rigs is the rest pose the seam still shows.
      centred.traverse((o) => {
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) (o as THREE.SkinnedMesh).skeleton.pose()
      })
      return
    }
    const action = actions[clip]
    if (!action) return
    const loop = LOOPING.test(clip)
    action.reset()
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
    action.clampWhenFinished = !loop
    action.fadeIn(0.15).play()
  }, [clip, actions, mixer, centred])

  useEffect(() => {
    centred.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = mesh.receiveShadow = true
      // A skinned mesh moves out of its static bounds when it animates; without
      // this, three.js culls it as a limb swings out of the original box.
      if (skinned) mesh.frustumCulled = false
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          ;(m as THREE.MeshStandardMaterial).wireframe = wireframe
        }
      }
    })
  }, [centred, wireframe, skinned])

  // The bake joins each ship into one mesh per material, so "exploded" separates
  // glass and glow from the hull -- which is the actual part structure that exists.
  useEffect(() => {
    let i = 0
    for (const [mesh, home] of rest) {
      const dir = home.lengthSq() > 1e-6 ? home.clone().normalize() : new THREE.Vector3(0, 1, 0)
      mesh.position.copy(home).addScaledVector(dir, explode * (i++ % 2 === 0 ? 1 : -1))
    }
  }, [rest, explode])

  return (
    <group ref={root}>
      <primitive object={centred} />
    </group>
  )
}

function Lights({ r, light }: { r: number; light: boolean }) {
  // A three-point rig rather than an HDR environment: it matches the Cycles
  // renders, and it means the inspector fetches nothing but the GLB.
  return (
    <>
      <hemisphereLight args={[light ? '#ffffff' : '#5b6d87', light ? '#8a8c90' : '#0a0c11', light ? 1.1 : 0.7]} />
      <directionalLight position={[r * 2, r * 2.4, r * 1.4]} intensity={light ? 2.0 : 2.6} color="#fff4e8" castShadow />
      <directionalLight position={[-r * 2.2, r * 0.6, -r * 1.8]} intensity={0.9} color={light ? '#dfe8ff' : '#7aa7ff'} />
      {!light && <directionalLight position={[-r * 0.4, -r * 1.2, r * 2]} intensity={0.5} color="#ff8a4d" />}
    </>
  )
}

/**
 * Reflections. The baked materials are metallic, and a metallic surface shows
 * only what it reflects: with no environment it renders nearly black, which is
 * why the live TIE first came out far darker than its Cycles still. This builds
 * the environment in-scene from softbox light-formers, rendered once into a
 * cube map -- no HDR download, so the inspector still fetches only the GLB.
 */
function Reflections({ light, backdrop }: { light: boolean; backdrop: string }) {
  return (
    <Environment resolution={128} frames={1}>
      <color attach="background" args={[backdrop]} />
      {light ? (
        <>
          {/* A bright cyclorama studio, like the one the TIE was rendered in. */}
          <Lightformer form="rect" intensity={2.2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[14, 14, 1]} />
          <Lightformer form="rect" intensity={1.4} position={[8, 1, 0]} rotation-y={-Math.PI / 2} scale={[10, 6, 1]} />
          <Lightformer form="rect" intensity={1.0} position={[-8, 1, 3]} rotation-y={Math.PI / 2} scale={[10, 6, 1]} />
          <Lightformer form="rect" intensity={0.8} position={[0, 1, -8]} scale={[12, 6, 1]} />
        </>
      ) : (
        <>
          {/* Deep space: a warm key to one side, a cool rim, near-black everywhere else. */}
          <Lightformer form="rect" intensity={1.6} color="#fff1e0" position={[6, 5, 4]} scale={[6, 4, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={0.6} color="#6f93ff" position={[-7, 2, -5]} scale={[8, 3, 1]} target={[0, 0, 0]} />
          <Lightformer form="ring" intensity={0.35} color="#ff9a5c" position={[-6, -2, 0]} scale={3} target={[0, 0, 0]} />
        </>
      )}
    </Environment>
  )
}

function Marker({ spot, at, index }: { spot: Hotspot; at: [number, number, number]; index: number }) {
  const [open, setOpen] = useState(false)
  return (
    <group position={at}>
      <Html center zIndexRange={[20, 0]}>
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={spot.title}
            className={`grid h-6 w-6 place-items-center rounded-full border text-[10px] font-medium shadow-lg transition ${
              open
                ? 'border-ember bg-ember text-void'
                : 'border-ink/70 bg-void/80 text-ink backdrop-blur hover:border-ember hover:text-ember'
            }`}
          >
            {index + 1}
          </button>
          {open && (
            <div className="absolute left-8 top-0 w-60 rounded border border-edge bg-hull/95 p-3 text-left backdrop-blur">
              <p className="font-display text-sm font-semibold text-ink">{spot.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-dim">{spot.body}</p>
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}

const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) > 140
}

interface Props {
  slug: string
  hotspots: Hotspot[]
  lengthM?: number
  className?: string
  /** Called once the model is on screen, so a caller can hold a still over it until then. */
  onReady?: () => void
  /**
   * False while the inspector is covered by the still. It then renders on demand
   * only, instead of drawing 60 frames a second nobody can see while the frame
   * sequence above it is trying to scrub smoothly.
   */
  active?: boolean
}

export function Inspector({ slug, hotspots, lengthM, className = 'relative', onReady, active = true }: Props) {
  const seam = SEAMS[slug]
  const measured = ANCHORS[slug]
  const size = measured?.size ?? [10, 5, 10]
  const r = Math.hypot(...size) / 2
  const light = isLight(seam?.backdrop ?? '#080A0F')
  const backdrop = seam?.backdrop ?? '#080A0F'

  const [wireframe, setWireframe] = useState(false)
  const [exploded, setExploded] = useState(false)
  const [showSpots, setShowSpots] = useState(true)
  const [clips, setClips] = useState<string[]>([])
  const [clip, setClip] = useState<string | null>(null)
  // Exploding pulls apart separate meshes; a single skinned mesh has none.
  const canExplode = (measured?.parts ?? 2) > 1
  const controls = useRef<OrbitControlsImpl>(null)
  const touched = useRef(false)

  /**
   * A canvas in the middle of a scrolling page must not eat the scroll.
   * With a mouse, dragging orbits and the wheel is left to the page (zoom moves to
   * buttons). On touch, one-finger drag is indistinguishable from scrolling, so the
   * canvas stays inert until the viewer asks for it.
   */
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const [held, setHeld] = useState(false)
  const live = !coarse || held

  const zoom = (factor: number) => {
    const c = controls.current
    if (!c) return
    touched.current = true
    const cam = c.object
    const next = THREE.MathUtils.clamp(cam.position.distanceTo(c.target) * factor, c.minDistance, c.maxDistance)
    cam.position.sub(c.target).setLength(next).add(c.target)
    c.update()
  }

  const spots = hotspots.filter((h) => measured?.anchors[h.anchor])

  return (
    <div className={className} style={{ background: backdrop }}>
      <Canvas
        frameloop={active ? 'always' : 'demand'}
        shadows
        style={{ touchAction: live ? 'none' : 'pan-y', pointerEvents: live ? 'auto' : 'none' }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: FOV }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = light ? 0.95 : 1.05
          scene.background = new THREE.Color(backdrop)
          scene.fog = new THREE.Fog(backdrop, r * 8, r * 30)
        }}
      >
        <AdaptiveDpr pixelated />
        {seam && measured && <Rig seam={seam} size={size} hull={measured.hull} touched={touched} />}
        <Lights r={r} light={light} />
        <Reflections light={light} backdrop={backdrop} />
        {/* The flythrough ends in a starfield; so does the canvas, or the dissolve shows. */}
        {seam?.stars && <Stars radius={r * 12} depth={r * 6} count={2500} factor={r * 0.35} fade speed={0} />}
        <Suspense fallback={null}>
          <Model
            url={`/assets/models/${slug}.glb`}
            wireframe={wireframe}
            explode={exploded && canExplode ? r * 0.18 : 0}
            centre={measured?.centre}
            clip={clip}
            onClips={setClips}
          />
          {/* Inside the same Suspense boundary: it cannot run until the GLB has resolved. */}
          <ReadySignal onReady={onReady} />
          {/* Anchors are measured in the rest pose; a playing clip moves the parts away from them. */}
          {showSpots && !clip &&
            spots.map((s, i) => <Marker key={s.anchor} spot={s} at={measured!.anchors[s.anchor]} index={i} />)}
        </Suspense>
        <OrbitControls
          ref={controls}
          makeDefault
          enabled={live}
          enablePan={false}
          enableZoom={false}
          enableDamping
          dampingFactor={0.06}
          rotateSpeed={0.5}
          minDistance={r * 1.2}
          onStart={() => (touched.current = true)}
        />
      </Canvas>

      {coarse && !held && (
        <button onClick={() => setHeld(true)} className="absolute inset-0 grid place-items-center">
          <span className="rounded-full border border-edge bg-void/85 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink backdrop-blur">
            Tap to inspect
          </span>
        </button>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 bg-gradient-to-t from-void/70 to-transparent p-4 pt-12 sm:p-6 sm:pt-16">
        <p className="label !text-dim">drag to orbit{lengthM ? ` · ${lengthM} m long` : ''}</p>
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-full border border-edge bg-hull/80 backdrop-blur">
            <button onClick={() => zoom(0.8)} aria-label="Zoom in" className="px-3 py-1.5 font-mono text-[13px] leading-none text-dim transition hover:text-ember">+</button>
            <span className="w-px bg-edge" />
            <button onClick={() => zoom(1.25)} aria-label="Zoom out" className="px-3 py-1.5 font-mono text-[13px] leading-none text-dim transition hover:text-ember">−</button>
          </div>
          {clips.length > 0 && (
            <label className="relative">
              <span className="sr-only">Animation</span>
              <select
                value={clip ?? ''}
                onChange={(e) => setClip(e.target.value || null)}
                className={`appearance-none rounded-full border py-1.5 pl-3 pr-7 font-mono text-[11px] uppercase tracking-[0.14em] outline-none transition ${
                  clip ? 'border-ember bg-ember/15 text-ember' : 'border-edge bg-hull/80 text-dim backdrop-blur hover:border-faint hover:text-ink'
                }`}
              >
                <option value="">Rest pose</option>
                {clips.map((c) => (
                  <option key={c} value={c}>
                    {clipLabel(c)}
                  </option>
                ))}
              </select>
              <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-faint">▾</span>
            </label>
          )}
          {spots.length > 0 && !clip && <Toggle on={showSpots} onClick={() => setShowSpots((v) => !v)}>Hotspots</Toggle>}
          <Toggle on={wireframe} onClick={() => setWireframe((v) => !v)}>Wireframe</Toggle>
          {canExplode && <Toggle on={exploded} onClick={() => setExploded((v) => !v)}>Exploded</Toggle>}
          {coarse && held && <Toggle on onClick={() => setHeld(false)}>Done</Toggle>}
        </div>
      </div>
    </div>
  )
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition ${
        on ? 'border-ember bg-ember/15 text-ember' : 'border-edge bg-hull/80 text-dim backdrop-blur hover:border-faint hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
