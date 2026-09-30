import { PLATE_WIDTHS } from './plates.generated'
import { DOWNLOAD_BYTES } from './downloads.generated'

export type AssetKind = 'web_glb' | 'source_blend' | 'textures_zip' | 'frame_seq'

export interface DownloadOption {
  kind: AssetKind
  label: string
  format: string
  note: string
  approxBytes: number
}

export interface Hotspot {
  /**
   * Key into ANCHORS (src/lib/anchors.generated.ts). Positions are measured from
   * the exported geometry by scripts/anchors.mjs, never typed in by hand.
   */
  anchor: string
  title: string
  body: string
}

export interface Model {
  slug: string
  title: string
  subtitle: string
  summary: string
  /** 'live' has a baked GLB and gets the WebGL inspector. 'sequence' does not, yet. */
  heroKind: 'live' | 'sequence'
  /** True when a scroll-scrubbable frame sequence was rendered for this model. */
  hasSequence: boolean
  /** A looping turntable or walk video at /assets/loops/<slug>.mp4, played on card hover. */
  hasLoop?: boolean
  /** For a rigged model: the clip that starts on its own, looping, once the model is revealed. */
  showcase?: string
  dims?: string
  triCount?: number
  materials?: number
  /** Metres along the longest axis, shown under the inspector. */
  lengthM?: number
  specs: [string, string][]
  plates: { ortho: string[]; detail: string[] }
  hotspots: Hotspot[]
  downloads: DownloadOption[]
  /** Why this model is not yet inspectable, shown in place of the canvas. */
  pending?: string
}

/**
 * Download options. Sizes are not typed here: they come from DOWNLOAD_BYTES,
 * measured by scripts/package-downloads.mjs from the files actually shipped.
 */
const GLB = (slug: string): DownloadOption => ({
  kind: 'web_glb',
  label: 'Web GLB',
  format: 'glb',
  note: 'The file the viewer above loads: WebP textures, lighter geometry where it was heavy. Drops straight into three.js, Babylon or Godot.',
  approxBytes: DOWNLOAD_BYTES[slug]?.web_glb ?? 0,
})
const SOURCE = (slug: string, textured: boolean): DownloadOption => ({
  kind: 'source_blend',
  label: 'Blender source',
  format: 'zip',
  note: textured
    ? 'The baked scene with its textures packed in, so it opens complete — plus the Python scripts that generated it.'
    : 'The scene plus the Python scripts that generated it. Materials are procedural; there is no texture bake yet.',
  approxBytes: DOWNLOAD_BYTES[slug]?.source_blend ?? 0,
})
const TEXTURES = (slug: string): DownloadOption => ({
  kind: 'textures_zip',
  label: 'Texture set',
  format: 'zip',
  note: '2048 px baked PBR maps — base colour, normal, roughness, metallic, emission — for use outside Blender.',
  approxBytes: DOWNLOAD_BYTES[slug]?.textures_zip ?? 0,
})

export const MODELS: Model[] = [
  {
    slug: 'starfighter',
    hasLoop: true,
    title: 'Starfighter',
    subtitle: 'Four-wing atmospheric interceptor',
    summary:
      'Measured off the blueprint by ratio rather than by its annotations, which mix metres and centimetres. Nose tip to exhaust is 100% of length and every feature is a fraction of that, so the silhouette is a set of constants rather than a set of vertices.',
    heroKind: 'live',
    hasSequence: true,
    dims: '13.0 × 11.4 × 5.1 m',
    triCount: 24432,
    materials: 3,
    lengthM: 13.0,
    specs: [
      ['Length', '13.0 m'],
      ['Span', '11.4 m'],
      ['Height', '5.1 m'],
      ['Length : span', '1.14 : 1'],
      ['Triangles', '24,432'],
      ['Materials', '3 — Hull, Glass, Glow'],
      ['Texture bake', '2048 px, 5 channels'],
      ['Web GLB', '1.22 MB'],
    ],
    plates: {
      ortho: ['top', 'front', 'profile', 'rear'],
      detail: ['detail-cockpit', 'detail-exhaust', 'detail-intake'],
    },
    hotspots: [
      { anchor: 'canopy', title: 'Canopy', body: 'Opens at 45% of length and runs 14%. The glass is rebuilt after the bake: transmission is not a bakeable channel, and baking it flat made the cockpit opaque.' },
      { anchor: 'engine', title: 'Engine', body: 'Front face 62% aft. The glow is its own material so it survives export as real emission instead of being baked into the hull colour.' },
      { anchor: 'cannon', title: 'Cannon', body: 'The ratio table puts the muzzle 29% aft of the nose, which is 2.73 m. Measured off the exported geometry it is at 2.80 m.' },
    ],
    downloads: [GLB('starfighter'), SOURCE('starfighter', true), TEXTURES('starfighter')],
  },
  {
    slug: 'tie-fighter',
    title: 'TIE Fighter',
    subtitle: 'Twin ion engine escort',
    summary:
      'Wing height is the unit. Every other proportion derives from it, and the build prints a guard line each run so a stray edit cannot drift the shape. Three unique triangles carry the wing texture, which is why a 2048 px bake lands at roughly 180 px per metre.',
    heroKind: 'live',
    hasSequence: false,
    dims: '7.50 × 6.15 × 4.30 m',
    triCount: 15864,
    materials: 4,
    lengthM: 7.5,
    specs: [
      ['Wing height', '7.50 m'],
      ['Chord', '6.15 m'],
      ['Top edge', '4.30 m'],
      ['Span across rims', '5.40 m'],
      ['Height : span', '1.39 : 1'],
      ['Ball diameter', '2.40 m'],
      ['Triangles', '15,864'],
      ['Materials', '4 — Hull, Panels, Glass, Glow'],
      ['Web GLB', '829 KB'],
    ],
    plates: {
      ortho: ['front', 'side', 'top', 'rear'],
      detail: ['detail-hub', 'detail-window', 'detail-panel'],
    },
    hotspots: [
      { anchor: 'viewport', title: 'Viewport', body: 'The transmissive pane is rebuilt after the bake for the same reason as the Starfighter canopy — baked flat, glass exports opaque.' },
      { anchor: 'wing', title: 'Wing', body: 'Wing height is the unit every other proportion derives from: 7.50 m. Only three unique triangles take texture space, which is why a 2048 px bake lands near 180 px per metre.' },
      { anchor: 'hub', title: 'Ball', body: 'Diameter 2.40 m, or 0.32 of wing height. Measured off the exported mesh, the underside sits exactly 1.20 m below centre.' },
    ],
    downloads: [GLB('tie-fighter'), SOURCE('tie-fighter', true), TEXTURES('tie-fighter')],
  },
  {
    slug: 'at-at',
    hasLoop: true,
    title: 'AT-AT',
    subtitle: 'Four-legged armoured transport',
    summary:
      'Three primitives do all the work: a prism whose ends can be scaled apart, a tube, and a tapered strut running between two joints. A leg is described only as hip, knee, ankle and foot — move one of those points and the thigh, shin, knee housing and ribs all follow.',
    heroKind: 'sequence',
    hasSequence: true,
    dims: '20.0 m long × 22.5 m tall',
    lengthM: 20.0,
    specs: [
      ['Length', '20.0 m'],
      ['Height', '22.5 m'],
      ['Legs', '4, four-jointed'],
      ['Head pitch', '6.5° nose-down'],
      ['Construction', 'bmesh prisms, no modifiers or booleans'],
      ['Renderer', 'Cycles on Metal'],
      ['Walk cycle', '60 frames'],
    ],
    plates: {
      ortho: ['front', 'side', 'top', 'rear'],
      detail: ['detail-knee', 'detail-foot', 'detail-guns'],
    },
    hotspots: [],
    downloads: [SOURCE('at-at', false)],
    pending:
      'The AT-AT has no UV unwrap or texture bake yet, so there is no web GLB to walk around. The geometry is finished — the bake pass that the Starfighter and TIE already went through is the remaining step.',
  },
  {
    slug: 'r2-d2',
    showcase: 'R2_LookAround',
    title: 'R2-D2',
    subtitle: 'Astromech droid, 3 animation clips',
    summary:
      'The whole droid lives on two surfaces: a cylinder and a flattened hemisphere. Every panel, stripe, vent and logic display is a real volume standing proud of one of them, swept from a profile or cut from the dome\'s azimuth-elevation grid. No decals, no booleans, no modifiers.',
    heroKind: 'live',
    hasSequence: false,
    dims: '1.09 m tall × 0.467 m barrel',
    triCount: 145314,
    materials: 12,
    specs: [
      ['Height to dome crown', '1.09 m'],
      ['Barrel diameter', '0.467 m'],
      ['Periscope, deployed', '+0.175 m'],
      ['Stance', 'Tripod'],
      ['Skeleton', '7 bones — root, sway, body, dome, three legs'],
      ['Animation clips', '3 — look around, roll, rolling loop'],
      ['Triangles', '145,314 (web: 65,579)'],
      ['Materials', '12 — constant Principled inputs, no textures'],
      ['Construction', 'Two sweep surfaces, no modifiers or booleans'],
      ['Reference', 'R2 Builders Club figures'],
    ],
    plates: {
      ortho: ['front', 'side', 'rear', 'top'],
      detail: ['detail-dome', 'detail-shoulder', 'detail-vents', 'detail-low'],
    },
    hotspots: [
      { anchor: 'dome', title: 'Dome', body: 'A flattened hemisphere — its rise is 0.93 of the barrel radius, not a half-ball. It turns on its own bone, so the look-around clip can be layered over either roll in an engine.' },
      { anchor: 'shoulder', title: 'Shoulder hub', body: 'Sits 1.25 barrel radii off the axis, on the outer face of the leg. Built at the hub station instead, the disc ends up buried inside the leg and the blue ring never shows.' },
      { anchor: 'centre', title: 'Centre foot', body: 'Reaches 0.91 barrel radii forward of the axis. It hangs off the body bone rather than the root, because it retracts into the body — and braking out of a roll, R2 tips forward onto it.' },
    ],
    downloads: [
      GLB('r2-d2'),
      {
        ...SOURCE('r2-d2', false),
        note: 'The rigged scene with all three clips, the Python scripts that built it, and export/: the full-detail GLB and FBX. No textures needed — every material is a plain Principled BSDF.',
      },
    ],
  },
  {
    slug: 'b1-battle-droid',
    showcase: 'B1_Idle',
    hasLoop: true,
    title: 'B1 Battle Droid',
    subtitle: 'Rigged infantry droid, 18 animation clips',
    summary:
      'Measured off a square-on side turnaround scaled to its 1.91 m height, by ratio. Every shell is a sweep of superellipse sections along a spine, and every limb hangs off six joint points that also place the bones, so each pivot sits exactly on its hinge. One rigidly skinned mesh, 42 bones, IK legs, and 18 clips that check themselves on every build.',
    heroKind: 'live',
    hasSequence: true,
    dims: '1.92 m tall × 0.52 m shoulders',
    triCount: 106103,
    materials: 1,
    specs: [
      ['Height to crown', '1.92 m'],
      ['Shoulders', '0.52 m'],
      ['Skeleton', '42 deform bones, IK legs and arms'],
      ['Animation clips', '18 — idle, march, run, stop, turns, hits, death, gestures'],
      ['Triangles', '106,103 (web: 26,525)'],
      ['Materials', '1 — baked'],
      ['Texture bake', '2048 px, 4 channels'],
      ['Walk cycle', '84 frames — march, then stop'],
    ],
    plates: {
      ortho: ['front', 'side', 'top', 'rear'],
      detail: ['detail-head', 'detail-pack', 'detail-knee'],
    },
    hotspots: [
      { anchor: 'muzzle', title: 'Muzzle', body: 'The skull is twelve control points resampled to forty superellipse sections along a curved spine. It slopes about 50° and ends just above the chest front, 1.69 m up, with the vocoder slit over a lip.' },
      { anchor: 'antenna', title: 'Antenna', body: 'The tallest point, 1.97 m. Both antennae ride the backpack, so the head alone can only turn about 24° before its rear cylinders reach them; the look-around clip turns the chest and pelvis too.' },
      { anchor: 'backpack', title: 'Backpack', body: 'A tall thin shield in side view: a domed cap over a V bottom, 0.125 m deep, with the unit number 1138 stencilled under the dome.' },
      { anchor: 'knee', title: 'Knee', body: 'Hinge at 0.56 m with protruding discs either side. It sits 1 cm forward of the hip–ankle line, so leg IK always bends it the right way.' },
    ],
    downloads: [
      GLB('b1-battle-droid'),
      {
        ...SOURCE('b1-battle-droid', true),
        note: 'The baked scene with its textures packed in, the Python scripts that generated it, and export/: the full-detail rigged FBX and GLB with all 18 clips, the procedural .blend, and a guide to the controls.',
      },
      {
        ...TEXTURES('b1-battle-droid'),
        note: '2048 px baked PBR maps — base colour, normal, roughness, metallic — for use outside Blender.',
      },
    ],
  },
]

export const bySlug = (slug?: string) => MODELS.find((m) => m.slug === slug)

const widthsFor = (slug: string, name: string) => PLATE_WIDTHS[slug]?.[name] ?? [400, 800]

/** Largest available width at or below the one asked for — never a 404. */
export const plateSrc = (slug: string, name: string, want = 800) => {
  const ws = widthsFor(slug, name)
  const w = [...ws].reverse().find((x) => x <= want) ?? ws[0]
  return `/assets/posters/${slug}/${name}-${w}.avif`
}

export const plateSrcSet = (slug: string, name: string) =>
  widthsFor(slug, name).map((w) => `/assets/posters/${slug}/${name}-${w}.avif ${w}w`).join(', ')

export const prettyBytes = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} MB` : `${Math.round(n / 1e3)} KB`
