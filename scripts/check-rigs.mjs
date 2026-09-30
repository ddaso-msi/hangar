/**
 * Proves every rigged web GLB actually animates, without a GPU.
 *
 * Runs the same path the inspector does -- GLTFLoader, SkeletonUtils.clone,
 * AnimationMixer -- then, for each clip:
 *   - how far the skinned vertices travel (zero means the clip binds to
 *     nothing, or the mesh is still bound to the original skeleton), and
 *   - whether each hotspot, parented to its bone exactly as Inspector.tsx does
 *     it, stays on the part it labels (its distance to the nearest rest-pose
 *     vertex must not change as the part moves).
 *
 *   node scripts/check-rigs.mjs            (every rigged model in public/assets/models)
 *   node scripts/check-rigs.mjs r2-d2
 */
import fs from 'node:fs'
import { join } from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { ROOT } from './_shared.mjs'

// Textures are irrelevant here and cannot decode in Node; keep the loader quiet about them.
const quiet = console.warn
console.warn = (...a) => (String(a[0]).includes('THREE.GLTFLoader') ? undefined : quiet(...a))
const quietErr = console.error
console.error = (...a) => (String(a[0]).includes('THREE.GLTFLoader') ? undefined : quietErr(...a))

const ANCHORS = JSON.parse(
  fs.readFileSync(join(ROOT, 'src/lib/anchors.generated.ts'), 'utf8').match(/ANCHORS[^=]*= (\{.*\})/s)[1]
)

const only = process.argv[2]
let failures = 0

for (const [slug, measured] of Object.entries(ANCHORS)) {
  if (!measured.skinned || (only && slug !== only)) continue
  // Textures cannot decode in Node and play no part in animation: drop them from
  // an in-memory copy before three.js sees the file.
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const doc = await io.read(join(ROOT, 'public/assets/models', `${slug}.glb`))
  for (const t of doc.getRoot().listTextures()) t.dispose()
  const bin = await io.writeBinary(doc)
  const ab = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej))

  // Exactly as Model in Inspector.tsx: clone, then shift by the measured centre.
  const root = skeletonClone(gltf.scene)
  root.position.sub(new THREE.Vector3(...measured.centre))
  root.updateMatrixWorld(true)
  // A glTF mesh with several materials loads as one SkinnedMesh per primitive,
  // all sharing a skeleton. Every one of them counts.
  const meshes = []
  root.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o) })
  const ownBones = meshes.every((m) => m.skeleton.bones.every((b) => { let p = b; while (p.parent) p = p.parent; return p === root }))
  console.log(`${slug}: ${gltf.animations.length} clips, ${meshes[0].skeleton.bones.length} bones, ${meshes.length} skinned mesh(es), clone bound to its own bones: ${ownBones}`)
  if (!ownBones) failures++

  // Every vertex of every skinned mesh, addressed as [mesh, index].
  const verts = meshes.flatMap((m) => Array.from({ length: m.geometry.attributes.position.count }, (_, i) => [m, i]))
  const skinned = ([m, i], v = new THREE.Vector3()) => m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld)
  const settle = () => { root.updateMatrixWorld(true); for (const m of meshes) m.skeleton.update() }
  settle()

  // Markers: bone-local offset in the rest pose, plus the rest-pose vertex nearest each.
  const markers = Object.entries(measured.anchorBones ?? {}).map(([key, boneName]) => {
    const bone = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(boneName))
    const world = new THREE.Vector3(...measured.anchors[key])
    const local = bone ? bone.worldToLocal(world.clone()) : null
    let nearest = verts[0], best = Infinity
    const v = new THREE.Vector3()
    for (const vert of verts) { const d = skinned(vert, v).distanceToSquared(world); if (d < best) { best = d; nearest = vert } }
    return { key, bone, local, nearest, restGap: Math.sqrt(best) }
  })
  for (const m of markers) if (!m.bone) { console.log(`  marker ${m.key}: bone not found`); failures++ }

  const step = Math.max(1, Math.floor(verts.length / 3000))
  const sampled = verts.filter((_, i) => i % step === 0)
  const rest = sampled.map((vert) => skinned(vert))

  const mixer = new THREE.AnimationMixer(root)
  for (const clip of gltf.animations) {
    mixer.stopAllAction()
    mixer.clipAction(clip).reset().play()
    let travel = 0, drift = 0
    for (const t of [0.2, 0.4, 0.6, 0.8]) {
      mixer.setTime(clip.duration * t)
      settle()
      sampled.forEach((vert, j) => { travel = Math.max(travel, skinned(vert).distanceTo(rest[j])) })
      for (const m of markers) {
        if (!m.bone) continue
        const at = m.bone.localToWorld(m.local.clone())
        drift = Math.max(drift, Math.abs(at.distanceTo(skinned(m.nearest)) - m.restGap))
      }
    }
    const unresolved = clip.tracks.filter((tr) => !THREE.PropertyBinding.findNode(root, THREE.PropertyBinding.parseTrackName(tr.name).nodeName)).length
    const ok = travel > 1e-4 && unresolved === 0 && drift < 1e-3
    if (!ok) failures++
    console.log(
      `  ${clip.name.padEnd(16)} travel ${(travel * 100).toFixed(1).padStart(6)} cm   unbound tracks ${unresolved}   ` +
        `hotspot drift ${(drift * 1000).toFixed(2)} mm   ${ok ? 'ok' : 'FAIL'}`
    )
  }
}

console.log(failures ? `\n${failures} failure(s)` : '\nall rigs animate; every hotspot stays on its part')
process.exit(failures ? 1 : 0)
