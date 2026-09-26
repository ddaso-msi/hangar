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
  note: 'Meshopt geometry, WebP textures. Drops straight into three.js, Babylon or a game engine.',
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
