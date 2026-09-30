/**
 * Hotspot anchors, measured from the exported geometry rather than typed in.
 *
 * The bake pipeline joins each ship into one mesh per material, so the material
 * split is the only part structure left -- but it is a meaningful one: Glass is
 * the canopy or viewport, Glow is the engines. Everything else is found as an
 * extreme of the hull (a cannon muzzle is the furthest-forward point at a wingtip).
 *
 * Output is in the inspector's frame: glTF axes (nose/window +X, wings ±Z, up +Y),
 * re-centred on the model's bounding-box centre exactly as Inspector.tsx does.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

function mul(m, [x, y, z]) {
  // glTF matrices are column-major.
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ]
}

function matMul(a, b) {
  // Column-major 4x4 product a * b.
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
  return o
}

/**
 * World-space vertex positions in the rest pose, grouped by material name
 * ("Glass_Baked" -> "Glass") and, for skinned meshes, also by bone name.
 *
 * A skinned vertex is not placed by its mesh node: the renderer places it with
 * joint.worldMatrix * inverseBindMatrix. The rigs here are rigid (every vertex
 * 100% on one bone), so that is one matrix per vertex -- and it is what the
 * inspector will actually draw before any clip plays.
 */
export async function verticesByMaterial(path) {
  const doc = await io.read(path)
  const groups = {}
  const bones = {}
  const joints = {}
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const skin = node.getSkin()
    const world = node.getWorldMatrix()
    let jointMats = null
    let jointNames = null
    if (skin) {
      const ibm = skin.getInverseBindMatrices()
      jointNames = skin.listJoints().map((j) => j.getName())
      jointMats = skin.listJoints().map((j, i) => matMul(j.getWorldMatrix(), ibm.getElement(i, [])))
      skin.listJoints().forEach((j) => (joints[j.getName()] = mul(j.getWorldMatrix(), [0, 0, 0])))
    }
    for (const prim of mesh.listPrimitives()) {
      const name = (prim.getMaterial()?.getName() ?? 'none').replace(/_Baked$/, '')
      const pos = prim.getAttribute('POSITION')
      if (!pos) continue
      const J = prim.getAttribute('JOINTS_0')
      const W = prim.getAttribute('WEIGHTS_0')
      const out = (groups[name] ??= [])
      const v = [0, 0, 0], j = [0, 0, 0, 0], w = [0, 0, 0, 0]
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v)
        if (jointMats && J && W) {
          J.getElement(i, j)
          W.getElement(i, w)
          // Dominant bone. Rigid rigs have exactly one; blended ones are rare here
          // and the dominant bone is within millimetres at rest.
          let b = 0
          for (let k = 1; k < 4; k++) if (w[k] > w[b]) b = k
          const p = mul(jointMats[j[b]], v)
          out.push(p)
          ;(bones[jointNames[j[b]]] ??= []).push(p)
        } else {
          out.push(mul(world, v))
        }
      }
    }
  }
  return { groups, bones, joints, parts: doc.getRoot().listMeshes().length, skinned: doc.getRoot().listSkins().length > 0 }
}

const bbox = (pts) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
  for (const p of pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]) }
  return { lo, hi, c: lo.map((l, k) => (l + hi[k]) / 2), size: lo.map((l, k) => hi[k] - l) }
}
const mean = (pts) => pts.reduce((a, p) => a.map((v, k) => v + p[k] / pts.length), [0, 0, 0])
const argmax = (pts, f) => pts.reduce((best, p) => (f(p) > f(best) ? p : best))

const X = 0, Y = 1, Z = 2

/** Per-model anchor rules. Each returns a world-space point. */
const RULES = {
  starfighter: {
    // Top of the canopy glass.
    canopy: (g) => { const b = bbox(g.Glass); return [b.c[X], b.hi[Y], b.c[Z]] },
    // One of the four nozzles: the upper-right cluster of the glow mesh, at its rear face.
    engine: (g) => {
      const b = bbox(g.Glow)
      const q = g.Glow.filter((p) => p[Z] > b.c[Z] && p[Y] > b.c[Y])
      const qb = bbox(q)
      return [qb.lo[X], qb.c[Y], qb.c[Z]]
    },
    // Muzzle: the furthest-forward hull point out at the upper-right wingtip.
    cannon: (g) => {
      const b = bbox(g.Hull)
      const tip = g.Hull.filter((p) => p[Z] > b.hi[Z] - b.size[Z] * 0.08 && p[Y] > b.c[Y])
      return argmax(tip, (p) => p[X])
    },
  },
  'tie-fighter': {
    // Front face of the viewport glass.
    viewport: (g) => { const b = bbox(g.Glass); return [b.hi[X], b.c[Y], b.c[Z]] },
    // Top edge of the right-hand wing's outer face.
    wing: (g) => {
      const all = [...g.Hull, ...(g.Panels ?? [])]
      const b = bbox(all)
      const face = all.filter((p) => p[Z] > b.hi[Z] - b.size[Z] * 0.03)
      const fb = bbox(face)
      return [fb.c[X], fb.hi[Y], fb.c[Z]]
    },
    // Underside of the central ball: hull points within a ball-radius of the centreline.
    hub: (g) => {
      const b = bbox(g.Hull)
      const ball = g.Hull.filter((p) => Math.abs(p[Z] - b.c[Z]) < b.size[Z] * 0.12)
      const bb = bbox(ball)
      return [bb.c[X], bb.lo[Y], bb.c[Z]]
    },
  },
  // A character, not a ship: it faces glTF +Z, up is +Y, its right hand side is
  // -X. One baked material ("B1"), so everything is an extreme of the whole mesh.
  'b1-battle-droid': {
    // Tip of the drooping muzzle: the furthest-forward point above the shoulders.
    muzzle: (g) => argmax(g.B1.filter((p) => p[Y] > 1.5), (p) => p[Z]),
    // Top of the signal-reception antenna: the highest point on the droid.
    antenna: (g) => argmax(g.B1, (p) => p[Y]),
    // Back face of the backpack, at chest height.
    backpack: (g) => {
      const pack = g.B1.filter((p) => p[Y] > 1.25 && p[Y] < 1.55)
      const back = argmax(pack, (p) => -p[Z])
      return [bbox(pack).c[X], back[Y], back[Z]]
    },
    // Outer face of the right knee disc: the furthest -X point at knee height.
    knee: (g) => argmax(g.B1.filter((p) => Math.abs(p[Y] - 0.56) < 0.05), (p) => -p[X]),
  },
  // Rigid 7-bone rig. glTF axes: front +X, up +Y; .L is the droid's left (-Z),
  // so .R (+Z) is the side the hero camera looks at.
  'r2-d2': {
    // Crown of the dome, which turns on its own bone.
    dome: ({ bones }) => { const b = bbox(bones.dome); return [b.c[X], b.hi[Y], b.c[Z]] },
    // Right shoulder hub: top of the right leg, on its outer face.
    shoulder: ({ bones }) => { const b = bbox(bones['leg.R']); return [b.c[X], b.hi[Y] - b.size[Y] * 0.06, b.hi[Z]] },
    // Toe of the centre foot, which reaches forward of the barrel axis.
    centre: ({ bones }) => { const b = bbox(bones['leg.C']); return [b.hi[X], b.lo[Y] + b.size[Y] * 0.15, b.c[Z]] },
  },
}

/**
 * Silhouette support points: for directions spread evenly over the sphere, the
 * vertex furthest along each. A few dozen points that bound the true shape far
 * more tightly than a bounding box -- which matters for a TIE, whose deep wings
 * leave the box's corners empty. The inspector projects these with perspective
 * to frame the model exactly as the seam still does.
 */
function supportPoints(points, n = 96) {
  const out = new Map()
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const d = [Math.cos(golden * i) * r, y, Math.sin(golden * i) * r]
    const p = argmax(points, (q) => q[0] * d[0] + q[1] * d[1] + q[2] * d[2])
    out.set(p.join(','), p)
  }
  return [...out.values()]
}

export async function measureAnchors(slug, glbPath) {
  const rules = RULES[slug]
  if (!rules) return null
  const measured = await verticesByMaterial(glbPath)
  const { groups } = measured
  const scene = bbox(Object.values(groups).flat())
  const round = (v) => +v.toFixed(3)
  const anchors = {}
  // For a rigged model, the bone each anchor rides on: the bone of the nearest
  // vertex. The inspector parents the hotspot to that bone, so the marker stays
  // on its part while a clip plays instead of floating where the part used to be.
  const anchorBones = {}
  for (const [key, rule] of Object.entries(rules)) {
    // Material rules take the groups; bone rules destructure { bones }.
    const p = rule(Object.assign(Object.create(groups), { bones: measured.bones, joints: measured.joints }))
    anchors[key] = p.map((v, k) => round(v - scene.c[k]))
    if (measured.skinned) {
      let best = Infinity
      for (const [bone, pts] of Object.entries(measured.bones)) {
        for (const q of pts) {
          const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2
          if (d < best) { best = d; anchorBones[key] = bone }
        }
      }
    }
  }
  const all = Object.values(groups).flat()
  const hull = supportPoints(all).map((p) => p.map((v, k) => round(v - scene.c[k])))
  return {
    anchors,
    hull,
    size: scene.size.map(round),
    // The inspector centres on this, not on a runtime bounding box: three.js cannot
    // measure a skinned mesh's pose until its skeleton has been updated by a render.
    centre: scene.c.map(round),
    parts: measured.parts,
    skinned: measured.skinned,
    anchorBones,
    materials: Object.keys(groups),
  }
}
