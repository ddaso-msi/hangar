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

/** World-space vertex positions grouped by material name (e.g. "Glass_Baked" -> "Glass"). */
export async function verticesByMaterial(path) {
  const doc = await io.read(path)
  const groups = {}
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const world = node.getWorldMatrix()
    for (const prim of mesh.listPrimitives()) {
      const name = (prim.getMaterial()?.getName() ?? 'none').replace(/_Baked$/, '')
      const pos = prim.getAttribute('POSITION')
      if (!pos) continue
      const out = (groups[name] ??= [])
      const v = [0, 0, 0]
      for (let i = 0; i < pos.getCount(); i++) out.push(mul(world, pos.getElement(i, v)))
    }
  }
  return groups
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
  const groups = await verticesByMaterial(glbPath)
  const scene = bbox(Object.values(groups).flat())
  const round = (v) => +v.toFixed(3)
  const anchors = {}
  for (const [key, rule] of Object.entries(rules)) {
    const p = rule(groups)
    anchors[key] = p.map((v, k) => round(v - scene.c[k]))
  }
  const all = Object.values(groups).flat()
  const hull = supportPoints(all).map((p) => p.map((v, k) => round(v - scene.c[k])))
  return { anchors, hull, size: scene.size.map(round), materials: Object.keys(groups) }
}
