/**
 * 2 MB Cycles PNGs -> responsive AVIF/WebP ladder.
 *
 * These become the LCP image for every page (shown while the sequence streams in),
 * the orthographic and detail plates in the scroll acts, and the grid cards.
 */
import { mkdirSync, statSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { ROOT, sourceRoot, MODELS, bytes } from './_shared.mjs'

const WIDTHS = [400, 800, 1600]
const only = process.argv[2]
// Which widths actually exist per plate. Written to src/ so the client never
// requests a size that was skipped because the source render was smaller.
const available = {}
const aspects = {}
const backdrops = {}
const seams = {}

/**
 * The render camera, from Blender coordinates (Z up) into glTF (Y up), with its
 * vertical field of view. Blender's AUTO sensor fit spans the sensor across the
 * image's LONGER side, so a portrait frame's sensor is vertical.
 */
function renderCamera({ position, target, lens, sensor = 36 }, aspect) {
  const toGltf = ([x, y, z]) => [x, z, -y]
  const half = Math.atan(sensor / 2 / lens)
  const vfov = aspect < 1 ? 2 * half : 2 * Math.atan(Math.tan(half) / aspect)
  return {
    position: toGltf(position),
    target: toGltf(target),
    vfov: +((vfov * 180) / Math.PI).toFixed(3),
  }
}

/**
 * The still's backdrop as a top-to-bottom colour profile, averaged across a
 * narrow strip at each side edge (clear of the model). Studio renders are not a
 * flat colour -- a wall band and a lit floor -- and a flat field would show
 * exactly where the still ends and the live canvas begins.
 */
async function backdropProfile(src, stops = 48) {
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = info
  const strip = Math.max(2, Math.round(W * 0.03))
  const out = []
  for (let s = 0; s < stops; s++) {
    const y0 = Math.floor((s / stops) * H), y1 = Math.floor(((s + 1) / stops) * H)
    const sum = [0, 0, 0]
    let n = 0
    for (let y = y0; y < y1; y++)
      for (const x0 of [0, W - strip])
        for (let x = x0; x < x0 + strip; x++) {
          const i = (y * W + x) * 3
          for (let k = 0; k < 3; k++) sum[k] += data[i + k]
          n++
        }
    out.push('#' + sum.map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join(''))
  }
  return out
}

/**
 * Backdrop colour of a render: the mean of its two upper corner patches. Upper
 * only, because studio renders put a darker floor along the bottom edge. Used to
 * set a portrait hero into a matching field instead of cropping it.
 */
async function backdropOf(src) {
  const img = sharp(src).removeAlpha()
  const { width: W, height: H } = await img.metadata()
  const s = Math.round(Math.min(W, H) * 0.06)
  const avg = [0, 0, 0]
  for (const left of [0, W - s]) {
    const data = await sharp(src).removeAlpha().extract({ left, top: 0, width: s, height: s }).resize(1, 1).raw().toBuffer()
    for (let k = 0; k < 3; k++) avg[k] += data[k] / 2
  }
  return '#' + avg.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

/**
 * Measure a seam still: its aspect, its backdrop colour (mean of the four corner
 * patches, which are clear of the model), and what fraction of its width the
 * model spans. The inspector uses these to open on a framing you cannot tell
 * apart from the still during the dissolve.
 */
async function measureSeam(src, band, contrast) {
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = info
  const px = (x, y) => {
    const i = (y * W + x) * 3
    return [data[i], data[i + 1], data[i + 2]]
  }

  const patch = Math.round(Math.min(W, H) * 0.06)
  const bg = [0, 0, 0]
  for (const [x0, y0] of [[0, 0], [W - patch, 0], [0, H - patch], [W - patch, H - patch]]) {
    for (let y = y0; y < y0 + patch; y++)
      for (let x = x0; x < x0 + patch; x++) {
        const c = px(x, y)
        for (let k = 0; k < 3; k++) bg[k] += c[k] / (4 * patch * patch)
      }
  }

  // A column belongs to the model if enough of its pixels inside the band differ
  // from the backdrop by more than `contrast`. The right bar depends on the shot:
  // a starfield has dim props (asteroids, nebula) that must not count, so it needs
  // a high bar; a clean studio backdrop has none, and a low bar is what catches
  // pale edges. The count threshold ignores isolated stars.
  const [b0, b1] = band.map((f) => Math.round(f * H))
  const minHits = Math.max(4, Math.round((b1 - b0) * 0.02))
  const isModel = []
  for (let x = 0; x < W; x++) {
    let hits = 0
    for (let y = b0; y < b1; y++) {
      const c = px(x, y)
      const d = Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2])
      if (d > contrast) hits++
    }
    isModel.push(hits >= minHits)
  }

  // Keep only the widest run of model columns, bridging small gaps (the space
  // between a wing and a cannon, say). Anything detached is scenery.
  const gap = Math.round(W * 0.03)
  let best = [0, 0], start = -1, lastHit = -1
  for (let x = 0; x <= W; x++) {
    const hit = x < W && isModel[x]
    if (hit) {
      if (start < 0 || x - lastHit > gap) start = x
      lastHit = x
      if (lastHit - start > best[1] - best[0]) best = [start, lastHit]
    }
  }
  const span = best[1] > best[0] ? best[1] - best[0] : W * 0.5
  const hex = '#' + bg.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
  return { aspect: +(W / H).toFixed(4), fill: +(span / W).toFixed(4), backdrop: hex }
}

for (const model of MODELS) {
  if (only && model.slug !== only) continue

  const base = join(sourceRoot(), model.project)
  const outDir = join(ROOT, 'public/assets/posters', model.slug)
  mkdirSync(outDir, { recursive: true })

  const plates = [['poster', model.poster], ...model.stills]
  if (model.seam) plates.push(['seam', model.seam.still])
  if (model.firstFrame) plates.push(['first', model.firstFrame])
  const manifest = {}
  let total = 0

  for (const [name, rel] of plates) {
    const src = join(base, rel)
    if (!existsSync(src)) {
      console.log(`  ! ${model.slug}/${name}: missing ${rel}`)
      continue
    }
    const meta = await sharp(src).metadata()
    manifest[name] = { aspect: +(meta.width / meta.height).toFixed(4), widths: [] }

    // Standard tiers up to the render's own width -- plus the render's full width
    // when it falls between tiers. Otherwise a 1400 px render tops out at the
    // 800 px tier and looks soft on a retina screen.
    const tiers = WIDTHS.filter((w) => w <= meta.width)
    if (WIDTHS.some((w) => w > meta.width)) tiers.push(meta.width)
    for (const w of tiers) {
      const out = join(outDir, `${name}-${w}.avif`)
      await sharp(src).resize({ width: w }).avif({ quality: 58, effort: 4 }).toFile(out)
      total += statSync(out).size
      manifest[name].widths.push(w)
    }
  }

  if (model.seam) {
    const still = join(base, model.seam.still)
    const m = await measureSeam(still, model.seam.band, model.seam.contrast)
    const spec = { view: model.seam.view, stars: model.seam.stars, fit: model.seam.fit ?? 'cover', ...m }
    if (model.seam.lighting) spec.lighting = model.seam.lighting
    if (model.seam.camera) spec.camera = renderCamera(model.seam.camera, m.aspect)
    // A still shown at full height maps its rows 1:1 onto screen rows, so its
    // backdrop's vertical profile can continue across the side bars and sit
    // behind the transparent canvas: the wall and floor bands never jump.
    if (spec.fit === 'height') spec.gradient = await backdropProfile(still)
    seams[model.slug] = spec
    console.log(
      `  seam: fills ${(m.fill * 100).toFixed(1)}% of width, backdrop ${m.backdrop}, aspect ${m.aspect}, fit ${spec.fit}` +
        (spec.camera ? `, camera vfov ${spec.camera.vfov}°` : '') +
        (spec.gradient ? `, ${spec.gradient.length}-stop backdrop profile` : '')
    )
  }

  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  available[model.slug] = Object.fromEntries(
    Object.entries(manifest).map(([k, v]) => [k, v.widths])
  )
  aspects[model.slug] = Object.fromEntries(Object.entries(manifest).map(([k, v]) => [k, v.aspect]))
  backdrops[model.slug] = await backdropOf(join(base, model.poster))
  console.log(`${model.slug.padEnd(14)} ${Object.keys(manifest).length} plates, ${bytes(total)}`)
}

if (!only) {
  const out = join(ROOT, 'src/lib/plates.generated.ts')
  writeFileSync(
    out,
    `// Generated by scripts/make-posters.mjs. Do not edit.\n` +
      `export const PLATE_WIDTHS: Record<string, Record<string, number[]>> = ${JSON.stringify(available, null, 2)}\n\n` +
      `export const PLATE_ASPECT: Record<string, Record<string, number>> = ${JSON.stringify(aspects, null, 2)}\n\n` +
      `/** Measured backdrop colour of each model's poster render. */\n` +
      `export const POSTER_BACKDROP: Record<string, string> = ${JSON.stringify(backdrops, null, 2)}\n\n` +
      `export interface SeamCamera { position: [number, number, number]; target: [number, number, number]; vfov: number }\n` +
      `export interface SeamSpec {\n` +
      `  view: [number, number, number]; stars: boolean; aspect: number; fill: number; backdrop: string\n` +
      `  /** 'cover' crops the still to fill the screen; 'height' shows it at full viewport height. */\n` +
      `  fit: 'cover' | 'height'\n` +
      `  /** The render camera, in glTF axes. When present the inspector opens on it exactly. */\n` +
      `  camera?: SeamCamera\n` +
      `  /** Top-to-bottom backdrop colours, for 'height' seams. */\n` +
      `  gradient?: string[]\n` +
      `  /** Overrides the light rig otherwise inferred from the backdrop's brightness. */\n` +
      `  lighting?: 'studio' | 'space'\n` +
      `}\n` +
      `export const SEAMS: Record<string, SeamSpec> = ${JSON.stringify(seams, null, 2)}\n`
  )
  console.log(`widths -> src/lib/plates.generated.ts`)
}
